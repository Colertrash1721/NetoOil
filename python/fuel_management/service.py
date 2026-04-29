from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from alerts.engine import evaluate_tank_telemetry_alerts, evaluate_transaction_alerts
from alerts.models import AlertEvent
from auth.security import AuthContext
from vehicles.models import Vehicle
from fuel_management.models import (
    AlertThreshold,
    AuditLog,
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
    DeviceActionLogCreate,
    DeviceActionLogRead,
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
    RefuelingTransactionCreate,
    RefuelingTransactionRead,
    TankCreate,
    TankDetail,
    TankRead,
    TankTelemetryCreate,
    TankTelemetryRead,
    TankUpdate,
)


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
        capacity=tank.capacity,
        currentVolume=tank.currentVolume,
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
    payload["tankId"] = tank.id
    payload["policyId"] = policy.id if policy else None
    payload["authorizedVolume"] = authorized_volume
    payload["preAuthorized"] = pre_authorized
    payload["cutReason"] = cut_reason
    payload["dispensedVolume"] = dispensed_volume
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


def list_transactions(db: Session, auth: AuthContext, limit: int = 100) -> list[RefuelingTransactionRead]:
    query = db.query(RefuelingTransaction).join(Vehicle, RefuelingTransaction.vehicleId == Vehicle.id)
    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        query = query.filter(Vehicle.assignedCompanyId == auth.company_id)
    return [
        _transaction_read(db, item)
        for item in query.order_by(RefuelingTransaction.startedAt.desc()).limit(limit).all()
    ]


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

    raise ValueError("Unsupported report type.")
