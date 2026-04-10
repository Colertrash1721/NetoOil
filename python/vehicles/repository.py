from sqlalchemy.orm import Session, joinedload

from vehicles.models import Vehicle, VehicleTelemetry


def create_vehicle(db: Session, data: dict) -> Vehicle:
    vehicle = Vehicle(**data)
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def get_all_vehicles(db: Session) -> list[Vehicle]:
    return (
        db.query(Vehicle)
        .options(joinedload(Vehicle.telemetryHistory))
        .order_by(Vehicle.id.desc())
        .all()
    )


def get_vehicle_by_id(db: Session, vehicle_id: int) -> Vehicle | None:
    return (
        db.query(Vehicle)
        .options(joinedload(Vehicle.telemetryHistory))
        .filter(Vehicle.id == vehicle_id)
        .first()
    )


def get_vehicle_by_plate(db: Session, plate: str) -> Vehicle | None:
    return db.query(Vehicle).filter(Vehicle.plate == plate).first()


def get_vehicle_by_sensor_identifier(db: Session, sensor_identifier: str) -> Vehicle | None:
    return (
        db.query(Vehicle)
        .filter(Vehicle.sensorIdentifier == sensor_identifier)
        .first()
    )


def get_vehicle_by_vin(db: Session, vin: str) -> Vehicle | None:
    return db.query(Vehicle).filter(Vehicle.vin == vin).first()


def update_vehicle(db: Session, vehicle: Vehicle, data: dict) -> Vehicle:
    for key, value in data.items():
        setattr(vehicle, key, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


def delete_vehicle(db: Session, vehicle: Vehicle) -> None:
    db.delete(vehicle)
    db.commit()


def create_vehicle_telemetry(db: Session, data: dict) -> VehicleTelemetry:
    telemetry = VehicleTelemetry(**data)
    db.add(telemetry)
    db.commit()
    db.refresh(telemetry)
    return telemetry


def get_vehicle_telemetry_history(
    db: Session, vehicle_id: int, limit: int = 100
) -> list[VehicleTelemetry]:
    return (
        db.query(VehicleTelemetry)
        .filter(VehicleTelemetry.vehicleId == vehicle_id)
        .order_by(VehicleTelemetry.recordedAt.desc())
        .limit(limit)
        .all()
    )
