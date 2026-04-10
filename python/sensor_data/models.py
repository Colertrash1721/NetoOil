import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from db.database import Base


class SensorMqttMessage(Base):
    __tablename__ = "sensor_mqtt_messages"

    id = Column(Integer, primary_key=True, index=True)
    topic = Column(String(255), nullable=False, index=True)
    topicSuffix = Column(String(255), nullable=True, index=True)
    sensorIdentifier = Column(String(255), nullable=True, index=True)
    payloadText = Column(Text, nullable=False)
    payloadJson = Column(JSON, nullable=True)
    qos = Column(Integer, nullable=False, default=0)
    retained = Column(Integer, nullable=False, default=0)
    receivedAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)


class SensorDevice(Base):
    __tablename__ = "sensor_devices"

    id = Column(Integer, primary_key=True, index=True)
    identifier = Column(String(255), nullable=False, unique=True, index=True)
    topic = Column(String(255), nullable=False)
    firstSeenAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)
    lastSeenAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)

    telemetryHistory = relationship(
        "SensorDeviceTelemetry",
        back_populates="device",
        cascade="all, delete-orphan",
        order_by="desc(SensorDeviceTelemetry.recordedAt)",
    )


class SensorDeviceTelemetry(Base):
    __tablename__ = "sensor_device_telemetry"

    id = Column(Integer, primary_key=True, index=True)
    deviceId = Column(Integer, ForeignKey("sensor_devices.id"), nullable=False, index=True)
    topic = Column(String(255), nullable=False, index=True)
    eventId = Column(Integer, nullable=True)
    priority = Column(Integer, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    altitude = Column(Float, nullable=True)
    angle = Column(Float, nullable=True)
    satellites = Column(Integer, nullable=True)
    speed = Column(Float, nullable=True)
    gsmSignal = Column(Integer, nullable=True)
    io66 = Column(Float, nullable=True)
    batteryVoltage = Column(Float, nullable=True)
    batteryCurrent = Column(Float, nullable=True)
    gnssStatus = Column(Integer, nullable=True)
    gnssPdop = Column(Float, nullable=True)
    gnssHdop = Column(Float, nullable=True)
    sleepMode = Column(Integer, nullable=True)
    ignition = Column(Boolean, nullable=True)
    movement = Column(Boolean, nullable=True)
    bleTemperature1 = Column(Float, nullable=True)
    bleBattery1 = Column(Float, nullable=True)
    io22 = Column(Float, nullable=True)
    io24 = Column(Float, nullable=True)
    io713 = Column(Float, nullable=True)
    io729 = Column(Float, nullable=True)
    io730 = Column(Float, nullable=True)
    rawReported = Column(JSON, nullable=True)
    unknownReported = Column(JSON, nullable=True)
    receivedAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)
    recordedAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)

    device = relationship("SensorDevice", back_populates="telemetryHistory")
