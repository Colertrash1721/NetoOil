import json
import logging
import os
import ssl
from datetime import datetime
from pathlib import Path
from typing import Any

import paho.mqtt.client as mqtt
from sqlalchemy.orm import Session

from alerts.service import STOP_ALERT_THRESHOLD_MINUTES, close_open_alerts, create_alert_if_needed
from db.database import SessionLocal
from sensor_data.models import SensorDevice, SensorDeviceTelemetry, SensorMqttMessage
from vehicles.consumption import get_previous_vehicle_telemetry, validate_vehicle_consumption
from vehicles.models import Vehicle, VehicleTelemetry

logger = logging.getLogger(__name__)
BASE_DIR = Path(__file__).resolve().parent


def _env_flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class MqttIngestService:
    def __init__(self) -> None:
        self.host = os.getenv("MQTT_HOST", "netotrack.com")
        self.port = int(os.getenv("MQTT_PORT", "8883"))
        self.topic = os.getenv("MQTT_TOPIC", "netofuel/#")
        self.client_id = os.getenv("MQTT_CLIENT_ID", "netooil-python-ingest")
        self.username = os.getenv("MQTT_USERNAME")
        self.password = os.getenv("MQTT_PASSWORD")
        self.keepalive = int(os.getenv("MQTT_KEEPALIVE", "60"))
        self.use_tls = _env_flag("MQTT_USE_TLS", self.port == 8883)
        self.tls_insecure = _env_flag("MQTT_TLS_INSECURE", False)
        self.ca_cert_path = self._resolve_path(
            os.getenv("MQTT_CA_CERT_PATH", "cert/backup/ca.crt")
        )
        self.client_cert_path = self._resolve_path(os.getenv("MQTT_CLIENT_CERT_PATH"))
        self.client_key_path = self._resolve_path(os.getenv("MQTT_CLIENT_KEY_PATH"))
        self._client: mqtt.Client | None = None

    def start(self) -> None:
        if self._client is not None:
            return

        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=self.client_id)
        client.enable_logger(logger)

        if self.username:
            client.username_pw_set(self.username, self.password)

        if self.use_tls:
            tls_kwargs: dict[str, Any] = {"cert_reqs": ssl.CERT_REQUIRED}

            if self.ca_cert_path:
                tls_kwargs["ca_certs"] = str(self.ca_cert_path)

            if self.client_cert_path and self.client_key_path:
                tls_kwargs["certfile"] = str(self.client_cert_path)
                tls_kwargs["keyfile"] = str(self.client_key_path)

            client.tls_set(**tls_kwargs)
            if self.tls_insecure:
                client.tls_insecure_set(True)

        client.on_connect = self._on_connect
        client.on_message = self._on_message
        client.on_disconnect = self._on_disconnect

        client.connect(self.host, self.port, keepalive=self.keepalive)
        client.loop_start()
        self._client = client

        logger.info("MQTT ingest started for %s:%s topic=%s", self.host, self.port, self.topic)

    @staticmethod
    def _resolve_path(path_value: str | None) -> Path | None:
        if not path_value:
            return None

        candidate = Path(path_value)
        if not candidate.is_absolute():
            candidate = BASE_DIR / candidate

        return candidate if candidate.exists() else None

    def stop(self) -> None:
        if self._client is None:
            return

        try:
            self._client.loop_stop()
            self._client.disconnect()
        finally:
            self._client = None

    def _on_connect(
        self,
        client: mqtt.Client,
        _: Any,
        __: Any,
        reason_code: mqtt.ReasonCode,
        ___: Any,
    ) -> None:
        if reason_code.is_failure:
            logger.error("MQTT connection failed: %s", reason_code)
            return

        client.subscribe(self.topic)
        logger.info("MQTT subscribed to %s", self.topic)

    def _on_disconnect(
        self,
        _: mqtt.Client,
        __: Any,
        disconnect_flags: mqtt.DisconnectFlags,
        reason_code: mqtt.ReasonCode,
        ___: Any,
    ) -> None:
        logger.warning(
            "MQTT disconnected. reason=%s session_lost=%s",
            reason_code,
            disconnect_flags.is_disconnect_packet_from_server,
        )

    def _on_message(self, _: mqtt.Client, __: Any, msg: mqtt.MQTTMessage) -> None:
        payload_text = msg.payload.decode("utf-8", errors="replace")
        payload_json = self._parse_json(payload_text)
        topic_suffix = self._extract_topic_suffix(msg.topic)
        sensor_identifier = self._extract_device_identifier_from_topic(msg.topic)
        if not sensor_identifier:
            sensor_identifier = topic_suffix or self._extract_sensor_identifier(payload_json)

        telemetry_payload = self._build_classified_telemetry(payload_json)
        received_at = datetime.utcnow()

        print(
            "[MQTT]",
            {
                "topic": msg.topic,
                "sensor_identifier": sensor_identifier,
                "payload": telemetry_payload if telemetry_payload is not None else payload_text,
            },
            flush=True,
        )

        db: Session = SessionLocal()
        try:
            db.add(
                SensorMqttMessage(
                    topic=msg.topic,
                    topicSuffix=topic_suffix,
                    sensorIdentifier=sensor_identifier,
                    payloadText=payload_text,
                    payloadJson=payload_json,
                    qos=msg.qos,
                    retained=1 if msg.retain else 0,
                    receivedAt=received_at,
                )
            )

            if sensor_identifier:
                device = (
                    db.query(SensorDevice)
                    .filter(SensorDevice.identifier == sensor_identifier)
                    .first()
                )
                if not device:
                    device = SensorDevice(
                        identifier=sensor_identifier,
                        topic=msg.topic,
                        firstSeenAt=received_at,
                        lastSeenAt=received_at,
                    )
                    db.add(device)
                    db.flush()
                else:
                    device.topic = msg.topic
                    device.lastSeenAt = received_at

                if telemetry_payload is not None:
                    db.add(
                        SensorDeviceTelemetry(
                            deviceId=device.id,
                            topic=msg.topic,
                            eventId=telemetry_payload["eventId"],
                            priority=telemetry_payload["priority"],
                            latitude=telemetry_payload["latitude"],
                            longitude=telemetry_payload["longitude"],
                            altitude=telemetry_payload["altitude"],
                            angle=telemetry_payload["angle"],
                            satellites=telemetry_payload["satellites"],
                            speed=telemetry_payload["speed"],
                            gsmSignal=telemetry_payload["gsmSignal"],
                            io66=telemetry_payload["io66"],
                            batteryVoltage=telemetry_payload["batteryVoltage"],
                            batteryCurrent=telemetry_payload["batteryCurrent"],
                            gnssStatus=telemetry_payload["gnssStatus"],
                            gnssPdop=telemetry_payload["gnssPdop"],
                            gnssHdop=telemetry_payload["gnssHdop"],
                            sleepMode=telemetry_payload["sleepMode"],
                            ignition=telemetry_payload["ignition"],
                            movement=telemetry_payload["movement"],
                            bleTemperature1=telemetry_payload["bleTemperature1"],
                            bleBattery1=telemetry_payload["bleBattery1"],
                            io22=telemetry_payload["io22"],
                            io24=telemetry_payload["io24"],
                            io713=telemetry_payload["io713"],
                            io729=telemetry_payload["io729"],
                            io730=telemetry_payload["io730"],
                            rawReported=telemetry_payload["rawReported"],
                            unknownReported=telemetry_payload["unknownReported"],
                            receivedAt=received_at,
                            recordedAt=telemetry_payload["recordedAt"],
                        )
                    )
                    self._sync_vehicle_telemetry(
                        db,
                        sensor_identifier=sensor_identifier,
                        telemetry_payload=telemetry_payload,
                    )

            db.commit()
        except Exception:
            db.rollback()
            logger.exception("Failed to persist MQTT message from topic %s", msg.topic)
        finally:
            db.close()

    def _extract_topic_suffix(self, topic: str) -> str | None:
        prefix = self.topic[:-1] if self.topic.endswith("#") else self.topic
        if topic.startswith(prefix):
            suffix = topic[len(prefix) :].strip("/")
            return suffix or None
        return None

    @staticmethod
    def _extract_device_identifier_from_topic(topic: str) -> str | None:
        parts = topic.strip("/").split("/")
        if len(parts) >= 2 and parts[0] == "netofuel":
            return parts[1]
        return None

    @staticmethod
    def _parse_json(payload_text: str) -> dict[str, Any] | list[Any] | None:
        try:
            parsed = json.loads(payload_text)
        except json.JSONDecodeError:
            return None

        if isinstance(parsed, (dict, list)):
            return parsed
        return None

    @staticmethod
    def _extract_sensor_identifier(payload_json: dict[str, Any] | list[Any] | None) -> str | None:
        if not isinstance(payload_json, dict):
            return None

        for key in ("sensorIdentifier", "sensor_id", "sensorId", "deviceId", "device_id", "imei"):
            value = payload_json.get(key)
            if value is not None:
                return str(value)
        return None

    @staticmethod
    def _to_float(value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _to_int(value: Any) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _parse_recorded_at(cls, reported: dict[str, Any]) -> datetime:
        timestamp_ms = cls._to_int(reported.get("ts"))
        if timestamp_ms:
            return datetime.utcfromtimestamp(timestamp_ms / 1000)
        return datetime.utcnow()

    @staticmethod
    def _parse_latlng(value: Any) -> tuple[float | None, float | None]:
        if not isinstance(value, str) or "," not in value:
            return None, None

        raw_latitude, raw_longitude = value.split(",", 1)
        try:
            return float(raw_latitude), float(raw_longitude)
        except ValueError:
            return None, None

    @classmethod
    def _build_classified_telemetry(
        cls,
        payload_json: dict[str, Any] | list[Any] | None,
    ) -> dict[str, Any] | None:
        if not isinstance(payload_json, dict):
            return None

        state = payload_json.get("state")
        reported = state.get("reported") if isinstance(state, dict) else None
        if not isinstance(reported, dict):
            return None

        latitude, longitude = cls._parse_latlng(reported.get("latlng"))
        known_keys = {
            "21",
            "22",
            "24",
            "66",
            "67",
            "68",
            "71",
            "181",
            "182",
            "200",
            "239",
            "240",
            "701",
            "705",
            "713",
            "729",
            "730",
            "ts",
            "pr",
            "latlng",
            "alt",
            "ang",
            "sat",
            "sp",
            "evt",
        }

        return {
            "eventId": cls._to_int(reported.get("evt")),
            "priority": cls._to_int(reported.get("pr")),
            "latitude": latitude,
            "longitude": longitude,
            "altitude": cls._to_float(reported.get("alt")),
            "angle": cls._to_float(reported.get("ang")),
            "satellites": cls._to_int(reported.get("sat")),
            "speed": cls._to_float(reported.get("sp")),
            "gsmSignal": cls._to_int(reported.get("21")),
            "io22": cls._to_float(reported.get("22")),
            "io24": cls._to_float(reported.get("24")),
            "io66": cls._to_float(reported.get("66")),
            "batteryVoltage": cls._to_float(reported.get("67")),
            "batteryCurrent": cls._to_float(reported.get("68")),
            "gnssStatus": cls._to_int(reported.get("71")),
            "gnssPdop": cls._to_float(reported.get("181")),
            "gnssHdop": cls._to_float(reported.get("182")),
            "sleepMode": cls._to_int(reported.get("200")),
            "ignition": bool(reported.get("239")) if reported.get("239") is not None else None,
            "movement": bool(reported.get("240")) if reported.get("240") is not None else None,
            "bleTemperature1": cls._to_float(reported.get("701")),
            "bleBattery1": cls._to_float(reported.get("705")),
            "io713": cls._to_float(reported.get("713")),
            "io729": cls._to_float(reported.get("729")),
            "io730": cls._to_float(reported.get("730")),
            "rawReported": reported,
            "unknownReported": {
                key: value for key, value in reported.items() if str(key) not in known_keys
            } or None,
            "recordedAt": cls._parse_recorded_at(reported),
        }

    @staticmethod
    def _sync_vehicle_telemetry(
        db: Session,
        *,
        sensor_identifier: str,
        telemetry_payload: dict[str, Any],
    ) -> None:
        vehicle = (
            db.query(Vehicle)
            .filter(Vehicle.sensorIdentifier == sensor_identifier)
            .first()
        )
        if not vehicle:
            return

        validation = validate_vehicle_consumption(
            vehicle,
            current_fuel_level=telemetry_payload["io729"],
            current_volume=telemetry_payload["io730"],
            current_latitude=telemetry_payload["latitude"],
            current_longitude=telemetry_payload["longitude"],
            current_speed=telemetry_payload["speed"],
            movement=telemetry_payload["movement"],
            recorded_at=telemetry_payload["recordedAt"],
            previous_telemetry=get_previous_vehicle_telemetry(
                db, vehicle.id, telemetry_payload["recordedAt"]
            ),
        )

        telemetry = VehicleTelemetry(
            vehicleId=vehicle.id,
            temperature=telemetry_payload["bleTemperature1"],
            inclination=telemetry_payload["angle"],
            volume=telemetry_payload["io730"],
            latitude=telemetry_payload["latitude"],
            longitude=telemetry_payload["longitude"],
            speed=telemetry_payload["speed"],
            fuelLevel=telemetry_payload["io729"],
            pressure=telemetry_payload["io713"],
            humidity=telemetry_payload["io24"],
            batteryLevel=telemetry_payload["bleBattery1"],
            alarm=bool(telemetry_payload["eventId"]),
            distanceKm=validation.distance_km,
            expectedFuelUsed=validation.expected_fuel_used,
            actualFuelUsed=validation.actual_fuel_used,
            fuelDelta=validation.fuel_delta,
            fuelValidationStatus=validation.status,
            fuelValidationMessage=validation.message,
            fuelValidationAt=validation.validated_at,
            recordedAt=telemetry_payload["recordedAt"],
        )
        db.add(telemetry)

        vehicle.lastTemperature = telemetry.temperature
        vehicle.lastInclination = telemetry.inclination
        vehicle.lastVolume = telemetry.volume
        vehicle.lastLatitude = telemetry.latitude
        vehicle.lastLongitude = telemetry.longitude
        vehicle.lastSpeed = telemetry.speed
        vehicle.lastFuelLevel = telemetry.fuelLevel
        vehicle.lastPressure = telemetry.pressure
        vehicle.lastHumidity = telemetry.humidity
        vehicle.lastBatteryLevel = telemetry.batteryLevel
        vehicle.lastAlarm = telemetry.alarm
        vehicle.lastUpdate = telemetry.recordedAt
        is_stopped = validation.status == "stationary"

        if is_stopped:
            vehicle.deviceIsStopped = True
            if vehicle.stopStartedAt is None:
                vehicle.stopStartedAt = telemetry.recordedAt
            stopped_minutes = (
                (telemetry.recordedAt - vehicle.stopStartedAt).total_seconds() / 60
                if vehicle.stopStartedAt
                else 0
            )
            if stopped_minutes >= STOP_ALERT_THRESHOLD_MINUTES:
                create_alert_if_needed(
                    db,
                    vehicle=vehicle,
                    sensor_identifier=sensor_identifier,
                    alert_type="device_stopped",
                    severity="medium",
                    title="Dispositivo detenido",
                    message=(
                        f"El dispositivo lleva {round(stopped_minutes, 2)} minutos sin moverse."
                    ),
                    recorded_at=telemetry.recordedAt,
                    metadata={"stoppedMinutes": round(stopped_minutes, 2)},
                )
        else:
            vehicle.deviceIsStopped = False
            vehicle.lastMovementAt = telemetry.recordedAt
            vehicle.stopStartedAt = None
            close_open_alerts(
                db,
                vehicle_id=vehicle.id,
                alert_type="device_stopped",
                resolved_at=telemetry.recordedAt,
            )

        if validation.status == "incoherent" and (validation.fuel_delta or 0) > 0:
            create_alert_if_needed(
                db,
                vehicle=vehicle,
                sensor_identifier=sensor_identifier,
                alert_type="fuel_leak",
                severity="high",
                title="Posible fuga o robo de combustible",
                message=validation.message,
                recorded_at=telemetry.recordedAt,
                metadata={
                    "distanceKm": validation.distance_km,
                    "expectedFuelUsed": validation.expected_fuel_used,
                    "actualFuelUsed": validation.actual_fuel_used,
                    "fuelDelta": validation.fuel_delta,
                },
            )
        elif validation.status == "refuel_detected":
            create_alert_if_needed(
                db,
                vehicle=vehicle,
                sensor_identifier=sensor_identifier,
                alert_type="refuel",
                severity="low",
                title="Recarga detectada",
                message=validation.message,
                recorded_at=telemetry.recordedAt,
                metadata={
                    "actualFuelUsed": validation.actual_fuel_used,
                    "fuelDelta": validation.fuel_delta,
                },
            )
