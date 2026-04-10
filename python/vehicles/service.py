from datetime import datetime

from sqlalchemy.orm import Session

from auth.security import AuthContext
from companies.repository import get_company_by_id
from companies.models import Company
from vehicles.consumption import get_previous_vehicle_telemetry, validate_vehicle_consumption
from vehicles.repository import (
    create_vehicle,
    create_vehicle_telemetry,
    delete_vehicle,
    get_all_vehicles,
    get_vehicle_by_id,
    get_vehicle_by_plate,
    get_vehicle_by_sensor_identifier,
    get_vehicle_by_vin,
    get_vehicle_telemetry_history,
    update_vehicle,
)
from vehicles.schemas import (
    VehicleCreate,
    VehicleDetail,
    VehicleRead,
    VehicleTelemetryCreate,
    VehicleTelemetryRead,
    VehicleUpdate,
)


def _build_vehicle_read(vehicle) -> VehicleRead:
    stopped_minutes = None
    if vehicle.deviceIsStopped and vehicle.stopStartedAt:
        stopped_minutes = round(
            max((datetime.utcnow() - vehicle.stopStartedAt).total_seconds(), 0) / 60,
            2,
        )

    payload = VehicleRead.model_validate(vehicle).model_dump()
    payload["stoppedMinutes"] = stopped_minutes
    return VehicleRead(**payload)


def _build_vehicle_detail(db: Session, vehicle) -> VehicleDetail:
    company: Company | None = get_company_by_id(db, vehicle.assignedCompanyId)
    history = [
        VehicleTelemetryRead.model_validate(item)
        for item in getattr(vehicle, "telemetryHistory", [])
    ]

    return VehicleDetail(
        **_build_vehicle_read(vehicle).model_dump(),
        assignedCompanyName=company.name if company else None,
        telemetryHistory=history,
    )


def create_vehicle_service(db: Session, data: VehicleCreate) -> VehicleRead:
    if get_vehicle_by_plate(db, data.plate):
        raise ValueError("Vehicle with this plate already exists.")

    if data.sensorIdentifier and get_vehicle_by_sensor_identifier(db, data.sensorIdentifier):
        raise ValueError("Vehicle with this sensor identifier already exists.")

    if data.vin and get_vehicle_by_vin(db, data.vin):
        raise ValueError("Vehicle with this VIN already exists.")

    if not get_company_by_id(db, data.assignedCompanyId):
        raise ValueError("Assigned company not found.")

    vehicle = create_vehicle(db, data.model_dump())
    return _build_vehicle_read(vehicle)


def read_all_vehicles_service(db: Session, auth: AuthContext | None = None) -> list[VehicleRead]:
    vehicles = get_all_vehicles(db)
    if auth and auth.role in {"company", "client"} and auth.company_id is not None:
        vehicles = [vehicle for vehicle in vehicles if vehicle.assignedCompanyId == auth.company_id]
    return [_build_vehicle_read(vehicle) for vehicle in vehicles]


def read_vehicle_by_id_service(db: Session, vehicle_id: int) -> VehicleDetail:
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        raise ValueError("Vehicle not found.")
    return _build_vehicle_detail(db, vehicle)


def update_vehicle_service(db: Session, vehicle_id: int, data: VehicleUpdate) -> VehicleRead:
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        raise ValueError("Vehicle not found.")

    update_data = data.model_dump(exclude_unset=True)

    if "plate" in update_data and update_data["plate"] != vehicle.plate:
        if get_vehicle_by_plate(db, update_data["plate"]):
            raise ValueError("Vehicle with this plate already exists.")

    if (
        "sensorIdentifier" in update_data
        and update_data["sensorIdentifier"] != vehicle.sensorIdentifier
        and update_data["sensorIdentifier"] is not None
    ):
        if get_vehicle_by_sensor_identifier(db, update_data["sensorIdentifier"]):
            raise ValueError("Vehicle with this sensor identifier already exists.")

    if (
        "vin" in update_data
        and update_data["vin"] != vehicle.vin
        and update_data["vin"] is not None
    ):
        if get_vehicle_by_vin(db, update_data["vin"]):
            raise ValueError("Vehicle with this VIN already exists.")

    if "assignedCompanyId" in update_data:
        if not get_company_by_id(db, update_data["assignedCompanyId"]):
            raise ValueError("Assigned company not found.")

    vehicle = update_vehicle(db, vehicle, update_data)
    return _build_vehicle_read(vehicle)


def delete_vehicle_service(db: Session, vehicle_id: int) -> dict[str, str]:
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        raise ValueError("Vehicle not found.")

    delete_vehicle(db, vehicle)
    return {"message": "Vehicle deleted successfully."}


def create_vehicle_telemetry_service(
    db: Session, vehicle_id: int, data: VehicleTelemetryCreate
) -> VehicleTelemetryRead:
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        raise ValueError("Vehicle not found.")

    telemetry_payload = data.model_dump()
    telemetry_payload["vehicleId"] = vehicle_id
    telemetry_payload["recordedAt"] = telemetry_payload["recordedAt"] or datetime.utcnow()

    validation = validate_vehicle_consumption(
        vehicle,
        current_fuel_level=telemetry_payload["fuelLevel"],
        current_volume=telemetry_payload["volume"],
        current_latitude=telemetry_payload["latitude"],
        current_longitude=telemetry_payload["longitude"],
        current_speed=telemetry_payload["speed"],
        movement=None,
        recorded_at=telemetry_payload["recordedAt"],
        previous_telemetry=get_previous_vehicle_telemetry(
            db, vehicle_id, telemetry_payload["recordedAt"]
        ),
    )
    telemetry_payload["distanceKm"] = validation.distance_km
    telemetry_payload["expectedFuelUsed"] = validation.expected_fuel_used
    telemetry_payload["actualFuelUsed"] = validation.actual_fuel_used
    telemetry_payload["fuelDelta"] = validation.fuel_delta
    telemetry_payload["fuelValidationStatus"] = validation.status
    telemetry_payload["fuelValidationMessage"] = validation.message
    telemetry_payload["fuelValidationAt"] = validation.validated_at

    telemetry = create_vehicle_telemetry(db, telemetry_payload)

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
    db.commit()
    db.refresh(vehicle)

    return VehicleTelemetryRead.model_validate(telemetry)


def read_vehicle_telemetry_history_service(
    db: Session, vehicle_id: int, limit: int = 100
) -> list[VehicleTelemetryRead]:
    vehicle = get_vehicle_by_id(db, vehicle_id)
    if not vehicle:
        raise ValueError("Vehicle not found.")

    history = get_vehicle_telemetry_history(db, vehicle_id, limit)
    return [VehicleTelemetryRead.model_validate(item) for item in history]
