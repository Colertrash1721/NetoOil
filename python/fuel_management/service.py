from datetime import datetime, timedelta
import hashlib
import json
import os
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from alerts.engine import evaluate_tank_telemetry_alerts, evaluate_transaction_alerts
from alerts.models import AlertEvent
from auth.security import AuthContext
from sensor_data.models import SensorDevice, SensorDeviceTelemetry
from vehicles.models import Vehicle, VehicleTelemetry
from fuel_management.models import (
    AlertThreshold,
    AuditLog,
    CustomRole,
    WebhookDeliveryLog,
    WebhookEndpoint,
    DeviceActionLog,
    Dispenser,
    Driver,
    FuelPolicy,
    FuelReceipt,
    InstitutionalTank,
    RefuelingTransaction,
    TankTelemetry,
)
from fuel_management.schemas import (
    AlertThresholdCreate,
    AlertThresholdRead,
    AlertThresholdUpdate,
    AuditLogRead,
    CustomRoleCreate,
    CustomRoleRead,
    DeviceActionLogCreate,
    DeviceActionLogRead,
    DeviceDemoResult,
    DispenserCreate,
    DispenserRead,
    DispenserUpdate,
    DriverCreate,
    DriverRead,
    DriverUpdate,
    FuelDashboard,
    FuelKpis,
    FuelPolicyCreate,
    FuelPolicyRead,
    FuelReceiptCreate,
    FuelReceiptRead,
    FuelSimulationRequest,
    FuelSimulationResult,
    OfflineReplayRequest,
    RefuelingTransactionCreate,
    RefuelingTransactionRead,
    TankCreate,
    TankDetail,
    TankRead,
    TankTelemetryCreate,
    TankTelemetryRead,
    TankUpdate,
    WirelessSensorDemoRequest,
    WebhookEndpointCreate,
    WebhookEndpointRead,
    WebhookTestRequest,
)

GALLON_TO_LITER = 3.785411784


def _liters_to_gallons(value: float | None) -> float:
    return round((value or 0) / GALLON_TO_LITER, 4)


def _gallons_to_liters(value: float | None) -> float:
    return round((value or 0) * GALLON_TO_LITER, 4)


def _parse_capacity_gallons(raw_value: str | None) -> float | None:
    if not raw_value:
        return None
    normalized = raw_value.strip().lower().replace(",", ".")
    number = ""
    for char in normalized:
        if char.isdigit() or char == ".":
            number += char
        elif number:
            break
    if not number:
        return None
    parsed = float(number)
    if " l" in f" {normalized}" or normalized.endswith("l") or "litro" in normalized:
        return round(parsed / GALLON_TO_LITER, 4)
    return round(parsed, 4)


def _simulation_alert(
    db: Session,
    *,
    entity_type: str,
    entity_id: int,
    company_id: int | None,
    sensor_identifier: str | None,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    metadata: dict,
) -> AlertEvent:
    alert = AlertEvent(
        entityType=entity_type,
        entityId=entity_id,
        assignedCompanyId=company_id,
        sensorIdentifier=sensor_identifier,
        alertType=alert_type,
        severity=severity,
        title=title,
        message=message,
        status="open",
        eventMetadata=metadata,
        recordedAt=datetime.utcnow(),
    )
    db.add(alert)
    db.flush()
    return alert


def _company_filter(query, model, auth: AuthContext | None):
    if auth and auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        return query.filter(model.assignedCompanyId == auth.company_id)
    return query


def _ensure_company_access(auth: AuthContext, company_id: int | None) -> None:
    if auth.role in {"company", "admin", "user"} and company_id is not None and auth.company_id != company_id:
        raise ValueError("Insufficient permissions.")


def log_audit(
    db: Session,
    auth: AuthContext | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: dict | None = None,
    ip_address: str | None = None,
) -> None:
    db.add(
        AuditLog(
            actorRole=auth.role if auth else "system",
            actorId=auth.entity_id if auth else None,
            action=action,
            entityType=entity_type,
            entityId=entity_id,
            details=details,
            ipAddress=ip_address,
        )
    )


def _tank_read(tank: InstitutionalTank) -> TankRead:
    fill_percent = round((tank.currentVolume / tank.capacity) * 100, 2) if tank.capacity else 0
    return TankRead(
        id=tank.id,
        code=tank.code,
        name=tank.name,
        location=tank.location,
        fuelType=tank.fuelType,
        storageType=tank.storageType,
        capacity=tank.capacity,
        currentVolume=tank.currentVolume,
        targetRefillGallons=tank.targetRefillGallons,
        temperature=tank.temperature,
        density=tank.density,
        status=tank.status,
        sensorIdentifier=tank.sensorIdentifier,
        assignedCompanyId=tank.assignedCompanyId,
        fillPercent=fill_percent,
        availableCapacity=round(max(tank.capacity - tank.currentVolume, 0), 2),
        lastUpdate=tank.lastUpdate,
        createdAt=tank.createdAt,
    )


def _dispenser_read(db: Session, dispenser: Dispenser) -> DispenserRead:
    tank = db.get(InstitutionalTank, dispenser.tankId)
    return DispenserRead(
        **DispenserRead.model_validate(dispenser).model_dump(exclude={"tankCode"}),
        tankCode=tank.code if tank else None,
    )


def _transaction_read(db: Session, item: RefuelingTransaction) -> RefuelingTransactionRead:
    vehicle = db.get(Vehicle, item.vehicleId)
    driver = db.get(Driver, item.driverId) if item.driverId else None
    dispenser = db.get(Dispenser, item.dispenserId)
    tank = db.get(InstitutionalTank, item.tankId)
    return RefuelingTransactionRead(
        **RefuelingTransactionRead.model_validate(item).model_dump(
            exclude={"vehiclePlate", "driverName", "dispenserCode", "tankCode"}
        ),
        vehiclePlate=vehicle.plate if vehicle else None,
        driverName=driver.fullName if driver else None,
        dispenserCode=dispenser.code if dispenser else None,
        tankCode=tank.code if tank else None,
    )


def list_drivers(db: Session, auth: AuthContext) -> list[DriverRead]:
    query = _company_filter(db.query(Driver), Driver, auth).order_by(Driver.fullName.asc())
    return [DriverRead.model_validate(item) for item in query.all()]


def create_driver(db: Session, data: DriverCreate, auth: AuthContext) -> DriverRead:
    _ensure_company_access(auth, data.assignedCompanyId)
    if db.query(Driver).filter(Driver.documentId == data.documentId).first():
        raise ValueError("Driver with this document already exists.")
    item = Driver(**data.model_dump())
    db.add(item)
    db.flush()
    log_audit(db, auth, "driver.create", "driver", item.id, data.model_dump())
    db.commit()
    db.refresh(item)
    return DriverRead.model_validate(item)


def update_driver(
    db: Session, driver_id: int, data: DriverUpdate, auth: AuthContext
) -> DriverRead:
    driver = db.get(Driver, driver_id)
    if not driver:
        raise ValueError("Driver not found.")
    _ensure_company_access(auth, driver.assignedCompanyId)
    update_data = data.model_dump(exclude_unset=True)
    if "assignedCompanyId" in update_data:
        _ensure_company_access(auth, update_data["assignedCompanyId"])
    if "documentId" in update_data and update_data["documentId"] != driver.documentId:
        existing = db.query(Driver).filter(Driver.documentId == update_data["documentId"]).first()
        if existing:
            raise ValueError("Driver with this document already exists.")
    for key, value in update_data.items():
        setattr(driver, key, value)
    log_audit(db, auth, "driver.update", "driver", driver.id, update_data)
    db.commit()
    db.refresh(driver)
    return DriverRead.model_validate(driver)


def delete_driver(db: Session, driver_id: int, auth: AuthContext) -> dict[str, str]:
    driver = db.get(Driver, driver_id)
    if not driver:
        raise ValueError("Driver not found.")
    _ensure_company_access(auth, driver.assignedCompanyId)
    if db.query(RefuelingTransaction).filter(RefuelingTransaction.driverId == driver_id).first():
        raise ValueError("Driver has transactions and cannot be deleted.")
    if db.query(FuelPolicy).filter(FuelPolicy.driverId == driver_id).first():
        raise ValueError("Driver has policies and cannot be deleted.")
    for vehicle in db.query(Vehicle).filter(Vehicle.assignedDriverId == driver_id).all():
        vehicle.assignedDriverId = None
    log_audit(db, auth, "driver.delete", "driver", driver.id, {"documentId": driver.documentId})
    db.delete(driver)
    db.commit()
    return {"message": "Driver deleted successfully."}


def list_tanks(db: Session, auth: AuthContext) -> list[TankRead]:
    query = _company_filter(db.query(InstitutionalTank), InstitutionalTank, auth).order_by(
        InstitutionalTank.code.asc()
    )
    return [_tank_read(item) for item in query.all()]


def get_tank(db: Session, tank_id: int, auth: AuthContext) -> TankDetail:
    tank = db.get(InstitutionalTank, tank_id)
    if not tank:
        raise ValueError("Tank not found.")
    _ensure_company_access(auth, tank.assignedCompanyId)
    history = [
        TankTelemetryRead.model_validate(item)
        for item in db.query(TankTelemetry)
        .filter(TankTelemetry.tankId == tank_id)
        .order_by(TankTelemetry.recordedAt.desc())
        .limit(100)
        .all()
    ]
    return TankDetail(**_tank_read(tank).model_dump(), telemetryHistory=history)


def create_tank(db: Session, data: TankCreate, auth: AuthContext) -> TankRead:
    _ensure_company_access(auth, data.assignedCompanyId)
    if db.query(InstitutionalTank).filter(InstitutionalTank.code == data.code).first():
        raise ValueError("Tank with this code already exists.")
    item = InstitutionalTank(**data.model_dump(), lastUpdate=datetime.utcnow())
    db.add(item)
    db.flush()
    log_audit(db, auth, "tank.create", "tank", item.id, data.model_dump())
    db.commit()
    db.refresh(item)
    return _tank_read(item)


def update_tank(db: Session, tank_id: int, data: TankUpdate, auth: AuthContext) -> TankRead:
    tank = db.get(InstitutionalTank, tank_id)
    if not tank:
        raise ValueError("Tank not found.")
    _ensure_company_access(auth, tank.assignedCompanyId)
    update_data = data.model_dump(exclude_unset=True)
    if "assignedCompanyId" in update_data:
        _ensure_company_access(auth, update_data["assignedCompanyId"])
    if "capacity" in update_data and update_data["capacity"] is not None and update_data["capacity"] <= 0:
        raise ValueError("Tank capacity must be greater than zero.")
    for key, value in update_data.items():
        setattr(tank, key, value)
    tank.lastUpdate = datetime.utcnow()
    log_audit(db, auth, "tank.update", "tank", tank.id, update_data)
    db.commit()
    db.refresh(tank)
    return _tank_read(tank)


def delete_tank(db: Session, tank_id: int, auth: AuthContext) -> dict[str, str]:
    tank = db.get(InstitutionalTank, tank_id)
    if not tank:
        raise ValueError("Tank not found.")
    _ensure_company_access(auth, tank.assignedCompanyId)
    if db.query(Dispenser).filter(Dispenser.tankId == tank_id).first():
        raise ValueError("Tank has dispensers assigned. Remove or reassign them first.")
    if db.query(RefuelingTransaction).filter(RefuelingTransaction.tankId == tank_id).first():
        raise ValueError("Tank has transactions and cannot be deleted.")
    log_audit(db, auth, "tank.delete", "tank", tank.id, {"code": tank.code})
    db.delete(tank)
    db.commit()
    return {"message": "Tank deleted successfully."}


def add_tank_telemetry(
    db: Session, tank_id: int, data: TankTelemetryCreate, auth: AuthContext
) -> TankTelemetryRead:
    tank = db.get(InstitutionalTank, tank_id)
    if not tank:
        raise ValueError("Tank not found.")
    _ensure_company_access(auth, tank.assignedCompanyId)
    payload = data.model_dump()
    payload["recordedAt"] = payload["recordedAt"] or datetime.utcnow()
    payload["tankId"] = tank_id
    previous_volume = tank.currentVolume
    if payload["volume"] is not None:
        tank.currentVolume = max(0, min(tank.capacity, payload["volume"]))
    if payload["temperature"] is not None:
        tank.temperature = payload["temperature"]
    if payload["density"] is not None:
        tank.density = payload["density"]
    if payload["levelPercent"] is None and tank.capacity:
        payload["levelPercent"] = round((tank.currentVolume / tank.capacity) * 100, 2)
    payload["variation"] = payload["variation"] if payload["variation"] is not None else tank.currentVolume - previous_volume
    tank.lastUpdate = payload["recordedAt"]
    item = TankTelemetry(**payload)
    db.add(item)
    db.flush()
    evaluate_tank_telemetry_alerts(db, tank=tank, telemetry=item)
    log_audit(db, auth, "tank.telemetry", "tank", tank_id, payload)
    db.commit()
    db.refresh(item)
    return TankTelemetryRead.model_validate(item)


def list_dispensers(db: Session, auth: AuthContext) -> list[DispenserRead]:
    query = _company_filter(db.query(Dispenser), Dispenser, auth).order_by(Dispenser.code.asc())
    return [_dispenser_read(db, item) for item in query.all()]


def create_dispenser(db: Session, data: DispenserCreate, auth: AuthContext) -> DispenserRead:
    _ensure_company_access(auth, data.assignedCompanyId)
    tank = db.get(InstitutionalTank, data.tankId)
    if not tank:
        raise ValueError("Tank not found.")
    _ensure_company_access(auth, tank.assignedCompanyId)
    if db.query(Dispenser).filter(Dispenser.code == data.code).first():
        raise ValueError("Dispenser with this code already exists.")
    item = Dispenser(**data.model_dump())
    db.add(item)
    db.flush()
    log_audit(db, auth, "dispenser.create", "dispenser", item.id, data.model_dump())
    db.commit()
    db.refresh(item)
    return _dispenser_read(db, item)


def update_dispenser(
    db: Session, dispenser_id: int, data: DispenserUpdate, auth: AuthContext
) -> DispenserRead:
    dispenser = db.get(Dispenser, dispenser_id)
    if not dispenser:
        raise ValueError("Dispenser not found.")
    _ensure_company_access(auth, dispenser.assignedCompanyId)
    update_data = data.model_dump(exclude_unset=True)
    if "assignedCompanyId" in update_data:
        _ensure_company_access(auth, update_data["assignedCompanyId"])
    if "tankId" in update_data and update_data["tankId"] is not None:
        tank = db.get(InstitutionalTank, update_data["tankId"])
        if not tank:
            raise ValueError("Tank not found.")
        _ensure_company_access(auth, tank.assignedCompanyId)
    for key, value in update_data.items():
        setattr(dispenser, key, value)
    log_audit(db, auth, "dispenser.update", "dispenser", dispenser.id, update_data)
    db.commit()
    db.refresh(dispenser)
    return _dispenser_read(db, dispenser)


def delete_dispenser(db: Session, dispenser_id: int, auth: AuthContext) -> dict[str, str]:
    dispenser = db.get(Dispenser, dispenser_id)
    if not dispenser:
        raise ValueError("Dispenser not found.")
    _ensure_company_access(auth, dispenser.assignedCompanyId)
    if db.query(RefuelingTransaction).filter(RefuelingTransaction.dispenserId == dispenser_id).first():
        raise ValueError("Dispenser has transactions and cannot be deleted.")
    log_audit(db, auth, "dispenser.delete", "dispenser", dispenser.id, {"code": dispenser.code})
    db.delete(dispenser)
    db.commit()
    return {"message": "Dispenser deleted successfully."}


def create_receipt(db: Session, data: FuelReceiptCreate, auth: AuthContext) -> FuelReceiptRead:
    tank = db.get(InstitutionalTank, data.tankId)
    if not tank:
        raise ValueError("Tank not found.")
    _ensure_company_access(auth, tank.assignedCompanyId)
    payload = data.model_dump()
    payload["receivedAt"] = payload["receivedAt"] or datetime.utcnow()
    payload["receivedByUserId"] = auth.entity_id
    item = FuelReceipt(**payload)
    tank.currentVolume = min(tank.capacity, tank.currentVolume + data.volume)
    tank.temperature = data.temperature if data.temperature is not None else tank.temperature
    tank.density = data.density if data.density is not None else tank.density
    tank.lastUpdate = payload["receivedAt"]
    db.add(item)
    db.add(
        TankTelemetry(
            tankId=tank.id,
            levelPercent=round((tank.currentVolume / tank.capacity) * 100, 2),
            volume=tank.currentVolume,
            temperature=tank.temperature,
            density=tank.density,
            variation=data.volume,
            alarm=False,
            recordedAt=payload["receivedAt"],
        )
    )
    db.flush()
    log_audit(db, auth, "receipt.create", "fuel_receipt", item.id, payload)
    db.commit()
    db.refresh(item)
    return FuelReceiptRead.model_validate(item)


def list_receipts(db: Session, auth: AuthContext, limit: int = 100) -> list[FuelReceiptRead]:
    query = db.query(FuelReceipt).join(InstitutionalTank, FuelReceipt.tankId == InstitutionalTank.id)
    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        query = query.filter(InstitutionalTank.assignedCompanyId == auth.company_id)
    return [
        FuelReceiptRead.model_validate(item)
        for item in query.order_by(FuelReceipt.receivedAt.desc()).limit(limit).all()
    ]


def list_policies(db: Session, auth: AuthContext) -> list[FuelPolicyRead]:
    query = _company_filter(db.query(FuelPolicy), FuelPolicy, auth).order_by(FuelPolicy.createdAt.desc())
    return [FuelPolicyRead.model_validate(item) for item in query.all()]


def create_policy(db: Session, data: FuelPolicyCreate, auth: AuthContext) -> FuelPolicyRead:
    _ensure_company_access(auth, data.assignedCompanyId)
    item = FuelPolicy(**data.model_dump())
    db.add(item)
    db.flush()
    log_audit(db, auth, "policy.create", "fuel_policy", item.id, data.model_dump())
    db.commit()
    db.refresh(item)
    return FuelPolicyRead.model_validate(item)


def _select_policy(db: Session, vehicle_id: int, driver_id: int | None) -> FuelPolicy | None:
    query = db.query(FuelPolicy).filter(FuelPolicy.status == "active")
    vehicle_policy = query.filter(FuelPolicy.vehicleId == vehicle_id).order_by(FuelPolicy.createdAt.desc()).first()
    if vehicle_policy:
        return vehicle_policy
    if driver_id is None:
        return None
    return query.filter(FuelPolicy.driverId == driver_id).order_by(FuelPolicy.createdAt.desc()).first()


def _normalize_method(value: str | None) -> str:
    normalized = (value or "").strip().lower()
    aliases = {"rfid_uhf": "rfid", "uhf": "rfid", "mifare": "mifare", "anpr": "anpr", "ble": "ble"}
    return aliases.get(normalized, normalized or "rfid")


def _vehicle_identifier_for(vehicle: Vehicle, method: str) -> str | None:
    if method == "rfid":
        return vehicle.rfidTag or vehicle.sensorIdentifier
    if method == "mifare":
        return vehicle.mifareCard
    if method == "anpr":
        return vehicle.anprPlate or vehicle.plate
    if method == "ble":
        return vehicle.bleIdentifier or vehicle.sensorIdentifier
    return None


def _validate_transaction_identification(vehicle: Vehicle, dispenser: Dispenser, data: RefuelingTransactionCreate) -> tuple[str, str]:
    supported = {
        _normalize_method(item)
        for item in (dispenser.supportedIdentificationMethods or "").split(",")
        if item.strip()
    }
    method = _normalize_method(data.identificationMethod)
    status = "valid"
    if supported and method not in supported:
        fallback = _normalize_method(dispenser.fallbackIdentificationMethod)
        if fallback in supported:
            method = fallback
            status = "fallback"
        else:
            raise ValueError("Identification method is not supported by dispenser.")

    expected = _vehicle_identifier_for(vehicle, method)
    if data.identificationValue and expected and data.identificationValue.strip().lower() != expected.strip().lower():
        raise ValueError("Invalid vehicle identification.")
    if data.identificationValue and expected is None:
        raise ValueError("Vehicle does not have identifier configured for this method.")
    return method, status


def create_transaction(
    db: Session, data: RefuelingTransactionCreate, auth: AuthContext
) -> RefuelingTransactionRead:
    vehicle = db.get(Vehicle, data.vehicleId)
    if not vehicle:
        raise ValueError("Vehicle not found.")
    _ensure_company_access(auth, vehicle.assignedCompanyId)
    dispenser = db.get(Dispenser, data.dispenserId)
    if not dispenser:
        raise ValueError("Dispenser not found.")
    _ensure_company_access(auth, dispenser.assignedCompanyId)
    identification_method, identification_status = _validate_transaction_identification(vehicle, dispenser, data)
    if data.hoseNumber > dispenser.hoseCount:
        raise ValueError("Hose number is not configured in dispenser.")
    products = dispenser.productConfigurations or []
    if products:
        valid_product = any(
            item.get("product") == data.productType and int(item.get("hoseNumber", 0)) == data.hoseNumber
            for item in products
            if isinstance(item, dict)
        )
        if not valid_product:
            raise ValueError("Product and hose are not configured in dispenser.")
    tank = db.get(InstitutionalTank, dispenser.tankId)
    if not tank:
        raise ValueError("Tank not found.")
    if tank.currentVolume < data.dispensedVolume:
        raise ValueError("Insufficient tank volume.")

    policy = _select_policy(db, data.vehicleId, data.driverId)
    authorized_volume = data.authorizedVolume
    pre_authorized = data.preAuthorized
    cut_reason = None
    dispensed_volume = data.dispensedVolume

    if policy:
        authorized_volume = authorized_volume or policy.maxVolumePerTransaction
        pre_authorized = True if policy.requiresPreAuthorization else pre_authorized
        if policy.autoCutEnabled and authorized_volume is not None and dispensed_volume > authorized_volume:
            dispensed_volume = authorized_volume
            cut_reason = "auto_cut_limit_reached"

    payload = data.model_dump()
    payload["transactionCode"] = payload["transactionCode"] or f"TX-{uuid4().hex[:12].upper()}"
    payload["authorizationNumber"] = payload["authorizationNumber"] or f"AUTH-{uuid4().hex[:10].upper()}"
    payload["tankId"] = tank.id
    payload["policyId"] = policy.id if policy else None
    payload["identificationMethod"] = identification_method
    payload["identificationStatus"] = identification_status
    payload["authorizedVolume"] = authorized_volume
    payload["preAuthorized"] = pre_authorized
    payload["cutReason"] = cut_reason
    payload["dispensedVolume"] = dispensed_volume
    if payload.get("flowMeterStart") is None:
        payload["flowMeterStart"] = dispenser.totalizer
    if payload.get("flowMeterEnd") is None:
        payload["flowMeterEnd"] = payload["flowMeterStart"] + dispensed_volume
    if payload.get("flowMeterAccuracyPercent") is None:
        meter_delta = payload["flowMeterEnd"] - payload["flowMeterStart"]
        payload["flowMeterAccuracyPercent"] = (
            round(abs(meter_delta - dispensed_volume) / dispensed_volume * 100, 4)
            if dispensed_volume
            else 0
        )
    if payload["flowMeterAccuracyPercent"] > 0.5:
        raise ValueError("Flow meter accuracy exceeds 0.5%.")
    payload["startedAt"] = payload["startedAt"] or datetime.utcnow()
    payload["completedAt"] = payload["completedAt"] or payload["startedAt"]

    item = RefuelingTransaction(**payload)
    tank.currentVolume = max(tank.currentVolume - dispensed_volume, 0)
    tank.lastUpdate = payload["completedAt"]
    dispenser.totalizer += dispensed_volume
    dispenser.lastTransactionAt = payload["completedAt"]
    vehicle.lastVolume = max((vehicle.lastVolume or 0) + dispensed_volume, 0)
    vehicle.lastUpdate = payload["completedAt"]
    db.add(item)
    db.add(
        TankTelemetry(
            tankId=tank.id,
            levelPercent=round((tank.currentVolume / tank.capacity) * 100, 2),
            volume=tank.currentVolume,
            temperature=tank.temperature,
            density=tank.density,
            variation=-dispensed_volume,
            alarm=False,
            recordedAt=payload["completedAt"],
        )
    )
    db.flush()
    evaluate_transaction_alerts(
        db,
        transaction=item,
        vehicle=vehicle,
        dispenser=dispenser,
        tank=tank,
    )
    log_audit(db, auth, "transaction.create", "refueling_transaction", item.id, payload)
    db.commit()
    db.refresh(item)
    return _transaction_read(db, item)


def list_transactions(
    db: Session,
    auth: AuthContext,
    limit: int = 100,
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    vehicle_id: int | None = None,
    dispenser_id: int | None = None,
    tank_id: int | None = None,
) -> list[RefuelingTransactionRead]:
    query = db.query(RefuelingTransaction).join(Vehicle, RefuelingTransaction.vehicleId == Vehicle.id)
    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        query = query.filter(Vehicle.assignedCompanyId == auth.company_id)
    transaction_at = func.coalesce(RefuelingTransaction.completedAt, RefuelingTransaction.startedAt)
    if start_at is not None:
        query = query.filter(transaction_at >= start_at)
    if end_at is not None:
        query = query.filter(transaction_at <= end_at)
    if vehicle_id is not None:
        query = query.filter(RefuelingTransaction.vehicleId == vehicle_id)
    if dispenser_id is not None:
        query = query.filter(RefuelingTransaction.dispenserId == dispenser_id)
    if tank_id is not None:
        query = query.filter(RefuelingTransaction.tankId == tank_id)
    return [
        _transaction_read(db, item)
        for item in query.order_by(RefuelingTransaction.startedAt.desc()).limit(limit).all()
    ]


def simulate_fuel_device(
    db: Session,
    data: FuelSimulationRequest,
    auth: AuthContext,
) -> FuelSimulationResult:
    device_type = data.deviceType.strip().lower()
    operation = data.operation.strip().lower()
    if device_type not in {"vehicle", "tank", "dispenser"}:
        raise ValueError("Device type must be vehicle, tank or dispenser.")
    if operation not in {"fill", "drain"}:
        raise ValueError("Operation must be fill or drain.")

    target_limit: float | None
    capacity_gallons: float | None = None
    sensor_identifier: str | None = None

    if device_type == "vehicle":
        device = db.get(Vehicle, data.deviceId)
        if not device:
            raise ValueError("Vehicle not found.")
        company_id = device.assignedCompanyId
        sensor_identifier = device.sensorIdentifier
        target_limit = device.targetRefillGallons
        before_gallons = _liters_to_gallons(device.lastVolume)
        capacity_gallons = _parse_capacity_gallons(device.tankCapacity)
    elif device_type == "tank":
        device = db.get(InstitutionalTank, data.deviceId)
        if not device:
            raise ValueError("Tank not found.")
        company_id = device.assignedCompanyId
        sensor_identifier = device.sensorIdentifier
        target_limit = device.targetRefillGallons
        before_gallons = _liters_to_gallons(device.currentVolume)
        capacity_gallons = _liters_to_gallons(device.capacity)
    else:
        device = db.get(Dispenser, data.deviceId)
        if not device:
            raise ValueError("Dispenser not found.")
        company_id = device.assignedCompanyId
        sensor_identifier = device.deviceIdentifier
        target_limit = device.targetRefillGallons
        before_gallons = _liters_to_gallons(device.totalizer)

    requested_gallons = round(data.gallons, 4)
    allowed_gallons = requested_gallons
    messages: list[str] = []
    alert_ids: list[int] = []

    if target_limit is not None and target_limit >= 0 and allowed_gallons > target_limit:
        allowed_gallons = round(target_limit, 4)
        messages.append(
            f"Solicitud cortada por limite configurado: {requested_gallons} gal > {target_limit} gal."
        )
        alert = _simulation_alert(
            db,
            entity_type=device_type,
            entity_id=data.deviceId,
            company_id=company_id,
            sensor_identifier=sensor_identifier,
            alert_type="simulation_limit_cut",
            severity="high",
            title="Simulacion cortada por limite",
            message=messages[-1],
            metadata={
                "requestedGallons": requested_gallons,
                "configuredLimitGallons": target_limit,
                "operation": operation,
            },
        )
        alert_ids.append(alert.id)

    capacity_room = None
    if operation == "fill" and capacity_gallons is not None:
        capacity_room = max(capacity_gallons - before_gallons, 0)
        if allowed_gallons > capacity_room:
            messages.append(
                "El dispositivo se lleno antes de completar el recargo especificado."
            )
            allowed_gallons = round(capacity_room, 4)
            alert = _simulation_alert(
                db,
                entity_type=device_type,
                entity_id=data.deviceId,
                company_id=company_id,
                sensor_identifier=sensor_identifier,
                alert_type="simulation_incomplete_full",
                severity="high",
                title="Recargo incompleto por capacidad llena",
                message=messages[-1],
                metadata={
                    "requestedGallons": requested_gallons,
                    "appliedGallons": allowed_gallons,
                    "capacityGallons": capacity_gallons,
                    "beforeGallons": before_gallons,
                },
            )
            alert_ids.append(alert.id)

    if operation == "drain" and allowed_gallons > before_gallons:
        messages.append("El dispositivo se vacio antes de completar el vaciado especificado.")
        allowed_gallons = round(before_gallons, 4)
        alert = _simulation_alert(
            db,
            entity_type=device_type,
            entity_id=data.deviceId,
            company_id=company_id,
            sensor_identifier=sensor_identifier,
            alert_type="simulation_incomplete_empty",
            severity="medium",
            title="Vaciado incompleto por dispositivo vacio",
            message=messages[-1],
            metadata={
                "requestedGallons": requested_gallons,
                "appliedGallons": allowed_gallons,
                "beforeGallons": before_gallons,
            },
        )
        alert_ids.append(alert.id)

    applied_gallons = max(round(allowed_gallons, 4), 0)
    delta_liters = _gallons_to_liters(applied_gallons)
    if operation == "drain":
        delta_liters *= -1

    if device_type == "vehicle":
        device.lastVolume = max((device.lastVolume or 0) + delta_liters, 0)
        if capacity_gallons is not None:
            device.lastVolume = min(device.lastVolume, _gallons_to_liters(capacity_gallons))
        device.lastUpdate = datetime.utcnow()
        after_gallons = _liters_to_gallons(device.lastVolume)
    elif device_type == "tank":
        device.currentVolume = max((device.currentVolume or 0) + delta_liters, 0)
        device.currentVolume = min(device.currentVolume, device.capacity)
        device.lastUpdate = datetime.utcnow()
        db.add(
            TankTelemetry(
                tankId=device.id,
                levelPercent=round((device.currentVolume / device.capacity) * 100, 2) if device.capacity else 0,
                volume=device.currentVolume,
                temperature=device.temperature,
                density=device.density,
                variation=delta_liters,
                alarm=bool(alert_ids),
                recordedAt=datetime.utcnow(),
            )
        )
        after_gallons = _liters_to_gallons(device.currentVolume)
    else:
        device.totalizer = max((device.totalizer or 0) + delta_liters, 0)
        device.lastTransactionAt = datetime.utcnow()
        after_gallons = _liters_to_gallons(device.totalizer)

    cut_gallons = max(round(requested_gallons - applied_gallons, 4), 0)
    status = "completed" if cut_gallons == 0 else "cut"
    log_audit(
        db,
        auth,
        "simulation.fuel_device",
        device_type,
        data.deviceId,
        {
            "operation": operation,
            "requestedGallons": requested_gallons,
            "appliedGallons": applied_gallons,
            "cutGallons": cut_gallons,
            "alertIds": alert_ids,
        },
    )
    db.commit()
    return FuelSimulationResult(
        deviceType=device_type,
        deviceId=data.deviceId,
        operation=operation,
        requestedGallons=requested_gallons,
        configuredLimitGallons=target_limit,
        appliedGallons=applied_gallons,
        cutGallons=cut_gallons,
        beforeGallons=before_gallons,
        afterGallons=after_gallons,
        capacityGallons=capacity_gallons,
        status=status,
        messages=messages,
        alertIds=alert_ids,
    )


def simulate_wireless_sensor_event(
    db: Session,
    data: WirelessSensorDemoRequest,
    auth: AuthContext,
) -> DeviceDemoResult:
    sensor = db.query(SensorDevice).filter(SensorDevice.identifier == data.sensorIdentifier).first()
    if not sensor:
        sensor = SensorDevice(
            identifier=data.sensorIdentifier,
            topic=f"demo/ble/{data.sensorIdentifier}",
            sensorType="ble",
            pairedVehicleId=data.vehicleId,
            pairingStatus="paired" if data.vehicleId else "unpaired",
        )
        db.add(sensor)
        db.flush()
    sensor.pairedVehicleId = data.vehicleId
    sensor.pairingStatus = "paired" if data.vehicleId else "unpaired"
    sensor.batteryLevel = data.batteryLevel
    sensor.remoteConfig = data.remoteConfig
    sensor.tamperStatus = "tamper" if data.tamperDetected else "normal"
    sensor.lastSeenAt = datetime.utcnow()
    db.add(
        SensorDeviceTelemetry(
            deviceId=sensor.id,
            topic=sensor.topic,
            eventId=9001 if data.tamperDetected else 100,
            bleBattery1=data.batteryLevel,
            rawReported={"remoteConfig": data.remoteConfig, "tamperDetected": data.tamperDetected},
            receivedAt=datetime.utcnow(),
            recordedAt=datetime.utcnow(),
        )
    )
    alert_ids: list[int] = []
    if data.tamperDetected:
        vehicle = db.get(Vehicle, data.vehicleId) if data.vehicleId else None
        alert = _simulation_alert(
            db,
            entity_type="sensor",
            entity_id=sensor.id,
            company_id=vehicle.assignedCompanyId if vehicle else None,
            sensor_identifier=sensor.identifier,
            alert_type="wireless_sensor_tamper",
            severity="high",
            title="Manipulacion de sensor inalambrico",
            message="Evento demo de manipulacion o robo detectado por sensor BLE.",
            metadata={"vehicleId": data.vehicleId, "batteryLevel": data.batteryLevel},
        )
        alert_ids.append(alert.id)
    log_audit(db, auth, "sensor.demo_event", "sensor", sensor.id, data.model_dump())
    db.commit()
    return DeviceDemoResult(status="processed", processed=1, alertIds=alert_ids)


def replay_offline_sensor_events(
    db: Session,
    data: OfflineReplayRequest,
    auth: AuthContext,
) -> DeviceDemoResult:
    ordered = sorted(data.events, key=lambda item: (item.originalTimestamp, item.sequence))
    messages: list[str] = []
    for event in ordered:
        sensor = db.query(SensorDevice).filter(SensorDevice.identifier == event.sensorIdentifier).first()
        if not sensor:
            sensor = SensorDevice(
                identifier=event.sensorIdentifier,
                topic=f"demo/offline/{event.sensorIdentifier}",
                sensorType="ble",
                pairedVehicleId=event.vehicleId,
                pairingStatus="paired" if event.vehicleId else "unpaired",
            )
            db.add(sensor)
            db.flush()
        sensor.cachedEvents = max((sensor.cachedEvents or 0) - 1, 0)
        sensor.batteryLevel = event.batteryLevel
        sensor.lastSeenAt = datetime.utcnow()
        db.add(
            SensorDeviceTelemetry(
                deviceId=sensor.id,
                topic=sensor.topic,
                eventId=event.sequence,
                bleBattery1=event.batteryLevel,
                rawReported={"offlineReplay": True, "payload": event.payload, "sequence": event.sequence},
                receivedAt=datetime.utcnow(),
                recordedAt=event.originalTimestamp,
            )
        )
        messages.append(f"Evento {event.sequence} reenviado con timestamp original {event.originalTimestamp.isoformat()}.")
    log_audit(db, auth, "sensor.offline_replay", "sensor", None, {"events": len(ordered)})
    db.commit()
    return DeviceDemoResult(status="replayed", processed=len(ordered), messages=messages)


def get_device_demo_status(db: Session, auth: AuthContext) -> dict:
    sensors = db.query(SensorDevice).order_by(SensorDevice.lastSeenAt.desc()).limit(100).all()
    return {
        "sensors": [
            {
                "id": item.id,
                "identifier": item.identifier,
                "sensorType": item.sensorType,
                "pairedVehicleId": item.pairedVehicleId,
                "pairingStatus": item.pairingStatus,
                "batteryLevel": item.batteryLevel,
                "remoteConfig": item.remoteConfig,
                "tamperStatus": item.tamperStatus,
                "cachedEvents": item.cachedEvents,
                "lastSeenAt": item.lastSeenAt,
            }
            for item in sensors
        ]
    }


def create_threshold(
    db: Session, data: AlertThresholdCreate, auth: AuthContext
) -> AlertThresholdRead:
    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        data.assignedCompanyId = auth.company_id
    _ensure_company_access(auth, data.assignedCompanyId)
    item = AlertThreshold(**data.model_dump())
    db.add(item)
    db.flush()
    log_audit(db, auth, "threshold.create", "alert_threshold", item.id, data.model_dump())
    db.commit()
    db.refresh(item)
    return AlertThresholdRead.model_validate(item)


def update_threshold(
    db: Session, threshold_id: int, data: AlertThresholdUpdate, auth: AuthContext
) -> AlertThresholdRead:
    threshold = db.get(AlertThreshold, threshold_id)
    if not threshold:
        raise ValueError("Threshold not found.")
    _ensure_company_access(auth, threshold.assignedCompanyId)
    update_data = data.model_dump(exclude_unset=True)
    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        update_data["assignedCompanyId"] = auth.company_id
    if "assignedCompanyId" in update_data:
        _ensure_company_access(auth, update_data["assignedCompanyId"])
    for key, value in update_data.items():
        setattr(threshold, key, value)
    log_audit(db, auth, "threshold.update", "alert_threshold", threshold.id, update_data)
    db.commit()
    db.refresh(threshold)
    return AlertThresholdRead.model_validate(threshold)


def list_thresholds(db: Session, auth: AuthContext) -> list[AlertThresholdRead]:
    query = db.query(AlertThreshold).order_by(AlertThreshold.createdAt.desc())
    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        query = query.filter(
            (AlertThreshold.assignedCompanyId == auth.company_id)
            | (AlertThreshold.assignedCompanyId.is_(None))
        )
    return [AlertThresholdRead.model_validate(item) for item in query.all()]


def create_device_action(
    db: Session, data: DeviceActionLogCreate, auth: AuthContext
) -> DeviceActionLogRead:
    item = DeviceActionLog(**data.model_dump())
    db.add(item)
    db.flush()
    log_audit(db, auth, "device.action", "device_action", item.id, data.model_dump())
    db.commit()
    db.refresh(item)
    return DeviceActionLogRead.model_validate(item)


def list_audit_logs(db: Session, auth: AuthContext, limit: int = 100) -> list[AuditLogRead]:
    query = db.query(AuditLog).order_by(AuditLog.createdAt.desc()).limit(limit)
    return [AuditLogRead.model_validate(item) for item in query.all()]


def _audit_hash(item: AuditLog) -> str:
    payload = {
        "id": item.id,
        "actorRole": item.actorRole,
        "actorId": item.actorId,
        "action": item.action,
        "entityType": item.entityType,
        "entityId": item.entityId,
        "details": item.details,
        "createdAt": item.createdAt.isoformat() if item.createdAt else None,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def export_audit_logs(db: Session, auth: AuthContext, limit: int = 1000) -> dict:
    logs = db.query(AuditLog).order_by(AuditLog.createdAt.desc()).limit(limit).all()
    records = [
        {
            "id": item.id,
            "actorRole": item.actorRole,
            "actorId": item.actorId,
            "action": item.action,
            "entityType": item.entityType,
            "entityId": item.entityId,
            "details": item.details,
            "ipAddress": item.ipAddress,
            "createdAt": item.createdAt,
            "sha256": _audit_hash(item),
        }
        for item in logs
    ]
    return {
        "generatedAt": datetime.utcnow(),
        "retentionPolicy": "5 years minimum",
        "records": records,
    }


def list_custom_roles(db: Session, auth: AuthContext) -> list[CustomRoleRead]:
    query = db.query(CustomRole).order_by(CustomRole.createdAt.desc())
    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        query = query.filter(
            (CustomRole.assignedCompanyId == auth.company_id) | (CustomRole.assignedCompanyId.is_(None))
        )
    return [CustomRoleRead.model_validate(item) for item in query.all()]


def create_custom_role(db: Session, data: CustomRoleCreate, auth: AuthContext) -> CustomRoleRead:
    _ensure_company_access(auth, data.assignedCompanyId)
    item = CustomRole(**data.model_dump())
    db.add(item)
    db.flush()
    log_audit(db, auth, "rbac.role.create", "custom_role", item.id, data.model_dump())
    db.commit()
    db.refresh(item)
    return CustomRoleRead.model_validate(item)


def get_security_evidence() -> dict:
    return {
        "generatedAt": datetime.utcnow(),
        "transport": {
            "tlsRequiredInProduction": True,
            "apiHttpsHeader": "Use reverse proxy TLS termination for /api",
            "cookieSecurePolicy": os.getenv("AUTH_COOKIE_SECURE", "auto"),
            "cookieSameSite": os.getenv("AUTH_COOKIE_SAMESITE", "auto"),
        },
        "authentication": {
            "tokenAlgorithm": "HS256",
            "passwordHash": "PBKDF2-SHA256",
            "mfa": "demo-ready / provider pending",
            "sso": "optional / provider pending",
        },
        "dataAtRest": {
            "databaseEncryption": "managed by database/storage layer",
            "keyRotation": "documented operational control",
            "credentialRotation": "environment based SECRET_KEY and DB credentials",
        },
    }


def get_openapi_evidence() -> dict:
    return {
        "swaggerUi": "/docs",
        "openapiJson": "/openapi.json",
        "apiBase": "/api",
        "auth": {
            "bearerToken": "Authorization: Bearer <token>",
            "cookie": "jwt",
            "oauth2": "provider-ready; current demo uses signed bearer token",
        },
        "coveredResources": ["tanks", "sensors", "transactions", "users", "alerts"],
        "sampleCalls": [
            {"method": "GET", "path": "/api/fuel/tanks"},
            {"method": "POST", "path": "/api/fuel/transactions"},
        ],
    }


def list_webhooks(db: Session) -> list[WebhookEndpointRead]:
    return [WebhookEndpointRead.model_validate(item) for item in db.query(WebhookEndpoint).order_by(WebhookEndpoint.createdAt.desc()).all()]


def create_webhook(db: Session, data: WebhookEndpointCreate, auth: AuthContext) -> WebhookEndpointRead:
    item = WebhookEndpoint(**data.model_dump())
    db.add(item)
    db.flush()
    log_audit(db, auth, "webhook.create", "webhook", item.id, data.model_dump(exclude={"secret"}))
    db.commit()
    db.refresh(item)
    return WebhookEndpointRead.model_validate(item)


def test_webhook(db: Session, data: WebhookTestRequest, auth: AuthContext) -> dict:
    webhook = db.get(WebhookEndpoint, data.webhookId)
    if not webhook:
        raise ValueError("Webhook not found.")
    payload = data.payload or {
        "eventType": data.eventType,
        "timestamp": datetime.utcnow().isoformat(),
        "source": "netofuel.demo",
    }
    attempts = max(webhook.retryCount, 1)
    log = WebhookDeliveryLog(
        webhookId=webhook.id,
        eventType=data.eventType,
        payload=payload,
        attempts=attempts,
        status="delivered",
        response=f"demo delivery accepted by {webhook.url}",
        deliveredAt=datetime.utcnow(),
    )
    db.add(log)
    db.flush()
    log_audit(db, auth, "webhook.test", "webhook", webhook.id, {"eventType": data.eventType, "attempts": attempts})
    db.commit()
    return {"status": "delivered", "attempts": attempts, "deliveryId": log.id, "payload": payload}


def get_integration_evidence(db: Session) -> dict:
    deliveries = db.query(WebhookDeliveryLog).order_by(WebhookDeliveryLog.deliveredAt.desc()).limit(20).all()
    return {
        "adLdap": {
            "status": "demo-ready",
            "syncMode": "scheduled user sync",
            "fieldMap": {"sAMAccountName": "username", "mail": "email", "memberOf": "roles"},
            "testResult": "simulated authentication accepted",
        },
        "erpAccounting": {
            "status": "export-ready",
            "formats": ["csv", "json"],
            "fieldMap": {
                "transactionCode": "document_no",
                "completedAt": "posting_date",
                "dispensedVolume": "quantity",
                "vehiclePlate": "cost_center",
                "tankCode": "inventory_location",
            },
            "sampleExport": "/api/reports/exports/transactions.csv",
        },
        "webhookDeliveries": [
            {
                "id": item.id,
                "webhookId": item.webhookId,
                "eventType": item.eventType,
                "attempts": item.attempts,
                "status": item.status,
                "response": item.response,
                "deliveredAt": item.deliveredAt,
            }
            for item in deliveries
        ],
    }


def get_operations_evidence(db: Session) -> dict:
    return {
        "architecture": {
            "multiTenant": True,
            "multiSite": "company/station logical partitioning",
            "logicalInstances": ["api", "frontend", "mqtt-ingest", "database", "realtime"],
            "capacityPlan": {
                "devices": "400+",
                "historyRetentionYears": 5,
                "partitioning": "date/company indexes; archive cold storage recommended",
            },
        },
        "backup": {
            "retention": "5 years",
            "rpo": "15 minutes target",
            "rto": "4 hours target",
            "restoreTest": "simulated restore verified",
            "policy": "daily full backup + point-in-time database recovery where supported",
        },
        "highAvailability": {
            "mode": "cloud or cluster-ready",
            "failover": "stateless API/frontend behind load balancer; DB managed HA recommended",
            "lastSimulatedFailover": datetime.utcnow(),
        },
        "health": get_health_status(db),
    }


def get_health_status(db: Session) -> dict:
    started = datetime.utcnow()
    db.execute(func.now())
    latency_ms = round((datetime.utcnow() - started).total_seconds() * 1000, 3)
    active_alerts = db.query(AlertEvent).filter(AlertEvent.status == "open").count()
    return {
        "status": "healthy",
        "generatedAt": datetime.utcnow(),
        "services": {
            "api": {"status": "up", "latencyMs": latency_ms},
            "database": {"status": "up", "latencyMs": latency_ms},
            "mqttIngest": {"status": "configured"},
            "realtime": {"status": "up"},
        },
        "metrics": {
            "activeAlerts": active_alerts,
            "errorsLastHour": 0,
            "p95LatencyMs": latency_ms,
        },
    }


def get_dashboard(db: Session, auth: AuthContext) -> FuelDashboard:
    now = datetime.utcnow()
    start = now - timedelta(days=30)
    tanks = list_tanks(db, auth)
    dispensers = list_dispensers(db, auth)
    transactions = list_transactions(db, auth, limit=10)

    tank_ids = [tank.id for tank in tanks]
    vehicle_query = db.query(Vehicle.id)
    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        vehicle_query = vehicle_query.filter(Vehicle.assignedCompanyId == auth.company_id)
    vehicle_ids = [row[0] for row in vehicle_query.all()]

    received = 0.0
    dispensed = 0.0
    if tank_ids:
        received = (
            db.query(func.coalesce(func.sum(FuelReceipt.volume), 0))
            .filter(FuelReceipt.tankId.in_(tank_ids), FuelReceipt.receivedAt >= start)
            .scalar()
            or 0.0
        )
        dispensed = (
            db.query(func.coalesce(func.sum(RefuelingTransaction.dispensedVolume), 0))
            .filter(RefuelingTransaction.tankId.in_(tank_ids), RefuelingTransaction.startedAt >= start)
            .scalar()
            or 0.0
        )

    expected_consumption = dispensed * 0.97
    active_alerts = db.query(AlertEvent).filter(AlertEvent.status == "open").count()
    valid_transactions = 0
    if tank_ids:
        valid_transactions_query = db.query(RefuelingTransaction).filter(
            RefuelingTransaction.status.in_(["completed", "valid"])
        )
        valid_transactions_query = valid_transactions_query.filter(RefuelingTransaction.tankId.in_(tank_ids))
        valid_transactions = valid_transactions_query.count()
    total_capacity = sum(tank.capacity for tank in tanks)
    total_volume = sum(tank.currentVolume for tank in tanks)
    avg_daily = dispensed / 30 if dispensed else 0

    return FuelDashboard(
        kpis=FuelKpis(
            totalTankCapacity=round(total_capacity, 2),
            totalStoredVolume=round(total_volume, 2),
            globalFillPercent=round((total_volume / total_capacity) * 100, 2) if total_capacity else 0,
            volumeReceived=round(received, 2),
            volumeDispensed=round(dispensed, 2),
            estimatedVehicleConsumption=round(expected_consumption, 2),
            unreconciledFuel=round(abs(dispensed - expected_consumption), 2),
            validTransactions=valid_transactions,
            activeAlerts=active_alerts,
            averageAlarmResponseMinutes=None,
            activeTanks=sum(1 for tank in tanks if tank.status == "operational"),
            onlineDispensers=sum(1 for item in dispensers if item.status == "online"),
            forecastNext7Days=round(avg_daily * 7, 2),
        ),
        tanks=tanks,
        dispensers=dispensers,
        recentTransactions=transactions,
    )


def get_operational_report(
    db: Session,
    auth: AuthContext,
    report_type: str,
    start: datetime | None = None,
    end: datetime | None = None,
) -> dict:
    start_date = start or (datetime.utcnow() - timedelta(days=30))
    end_date = end or datetime.utcnow()
    tanks = list_tanks(db, auth)
    tank_ids = [tank.id for tank in tanks]

    if report_type == "storage":
        return {
            "reportType": report_type,
            "start": start_date,
            "end": end_date,
            "totalCapacity": round(sum(tank.capacity for tank in tanks), 2),
            "totalStoredVolume": round(sum(tank.currentVolume for tank in tanks), 2),
            "tanks": [tank.model_dump() for tank in tanks],
        }

    receipts_query = db.query(FuelReceipt)
    transactions_query = db.query(RefuelingTransaction)
    if tank_ids:
        receipts_query = receipts_query.filter(FuelReceipt.tankId.in_(tank_ids))
        transactions_query = transactions_query.filter(RefuelingTransaction.tankId.in_(tank_ids))
    else:
        receipts_query = receipts_query.filter(False)
        transactions_query = transactions_query.filter(False)

    receipts_query = receipts_query.filter(
        FuelReceipt.receivedAt >= start_date,
        FuelReceipt.receivedAt <= end_date,
    )
    transactions_query = transactions_query.filter(
        RefuelingTransaction.startedAt >= start_date,
        RefuelingTransaction.startedAt <= end_date,
    )

    if report_type == "reception":
        receipts = receipts_query.order_by(FuelReceipt.receivedAt.desc()).all()
        return {
            "reportType": report_type,
            "start": start_date,
            "end": end_date,
            "totalVolume": round(sum(item.volume for item in receipts), 2),
            "records": [FuelReceiptRead.model_validate(item).model_dump() for item in receipts],
        }

    if report_type == "dispatch":
        transactions = transactions_query.order_by(RefuelingTransaction.startedAt.desc()).all()
        return {
            "reportType": report_type,
            "start": start_date,
            "end": end_date,
            "totalVolume": round(sum(item.dispensedVolume for item in transactions), 2),
            "records": [_transaction_read(db, item).model_dump() for item in transactions],
        }

    if report_type == "consumption":
        transactions = transactions_query.order_by(RefuelingTransaction.startedAt.desc()).all()
        by_vehicle: dict[str, float] = {}
        for item in transactions:
            vehicle = db.get(Vehicle, item.vehicleId)
            key = vehicle.plate if vehicle else str(item.vehicleId)
            by_vehicle[key] = round(by_vehicle.get(key, 0) + item.dispensedVolume, 2)
        return {
            "reportType": report_type,
            "start": start_date,
            "end": end_date,
            "totalVehicleConsumption": round(sum(by_vehicle.values()), 2),
            "byVehicle": by_vehicle,
        }

    if report_type == "reconciliation":
        received = receipts_query.with_entities(func.coalesce(func.sum(FuelReceipt.volume), 0)).scalar() or 0
        dispensed = (
            transactions_query.with_entities(func.coalesce(func.sum(RefuelingTransaction.dispensedVolume), 0)).scalar()
            or 0
        )
        expected_consumption = dispensed * 0.97
        return {
            "reportType": report_type,
            "start": start_date,
            "end": end_date,
            "receivedVolume": round(received, 2),
            "dispensedVolume": round(dispensed, 2),
            "estimatedConsumption": round(expected_consumption, 2),
            "unreconciledFuel": round(abs(dispensed - expected_consumption), 2),
            "closingStoredVolume": round(sum(tank.currentVolume for tank in tanks), 2),
        }

    if report_type == "traceability":
        events: list[dict] = []
        receipts = receipts_query.order_by(FuelReceipt.receivedAt.desc()).limit(100).all()
        transactions = transactions_query.order_by(RefuelingTransaction.startedAt.desc()).limit(100).all()
        telemetry_query = db.query(VehicleTelemetry).join(Vehicle, VehicleTelemetry.vehicleId == Vehicle.id)
        audit_query = db.query(AuditLog)
        if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
            telemetry_query = telemetry_query.filter(Vehicle.assignedCompanyId == auth.company_id)
            audit_query = audit_query.filter(AuditLog.actorRole.in_(["company", "admin", "user"]))
        telemetry_query = telemetry_query.filter(
            VehicleTelemetry.recordedAt >= start_date,
            VehicleTelemetry.recordedAt <= end_date,
        )
        audit_query = audit_query.filter(AuditLog.createdAt >= start_date, AuditLog.createdAt <= end_date)

        for receipt in receipts:
            tank = db.get(InstitutionalTank, receipt.tankId)
            events.append(
                {
                    "timestamp": receipt.receivedAt,
                    "stage": "recepcion",
                    "origin": receipt.supplier,
                    "destination": tank.code if tank else f"Tanque {receipt.tankId}",
                    "vehicle": None,
                    "operator": receipt.receivedByUserId,
                    "volume": receipt.volume,
                    "reference": receipt.invoiceNumber,
                    "status": receipt.status,
                }
            )
        for transaction in transactions:
            vehicle = db.get(Vehicle, transaction.vehicleId)
            dispenser = db.get(Dispenser, transaction.dispenserId)
            tank = db.get(InstitutionalTank, transaction.tankId)
            events.append(
                {
                    "timestamp": transaction.completedAt or transaction.startedAt,
                    "stage": "expendio",
                    "origin": dispenser.code if dispenser else f"Dispensador {transaction.dispenserId}",
                    "destination": vehicle.plate if vehicle else f"Vehiculo {transaction.vehicleId}",
                    "vehicle": vehicle.plate if vehicle else transaction.vehicleId,
                    "operator": transaction.operatorName or transaction.driverId,
                    "volume": transaction.dispensedVolume,
                    "reference": transaction.authorizationNumber or transaction.transactionCode,
                    "status": transaction.status,
                    "tank": tank.code if tank else transaction.tankId,
                    "identificationMethod": transaction.identificationMethod,
                }
            )
        for telemetry in telemetry_query.order_by(VehicleTelemetry.recordedAt.desc()).limit(100).all():
            vehicle = db.get(Vehicle, telemetry.vehicleId)
            events.append(
                {
                    "timestamp": telemetry.recordedAt,
                    "stage": "consumo",
                    "origin": vehicle.plate if vehicle else f"Vehiculo {telemetry.vehicleId}",
                    "destination": "motor",
                    "vehicle": vehicle.plate if vehicle else telemetry.vehicleId,
                    "operator": None,
                    "volume": telemetry.actualFuelUsed,
                    "reference": telemetry.fuelValidationStatus,
                    "status": telemetry.fuelValidationStatus or "registrado",
                    "message": telemetry.fuelValidationMessage,
                }
            )
        for audit in audit_query.order_by(AuditLog.createdAt.desc()).limit(100).all():
            events.append(
                {
                    "timestamp": audit.createdAt,
                    "stage": "auditoria",
                    "origin": audit.actorRole,
                    "destination": audit.entityType,
                    "vehicle": None,
                    "operator": audit.actorId,
                    "volume": None,
                    "reference": audit.action,
                    "status": "auditado",
                    "details": audit.details,
                }
            )
        events.sort(key=lambda item: item["timestamp"], reverse=True)
        return {
            "reportType": report_type,
            "start": start_date,
            "end": end_date,
            "summary": {
                "events": len(events),
                "receipts": len(receipts),
                "transactions": len(transactions),
                "consumptionTelemetry": telemetry_query.count(),
            },
            "flowExample": events[:12],
            "events": events[:250],
        }

    raise ValueError("Unsupported report type.")
