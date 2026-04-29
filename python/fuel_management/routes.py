from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from auth.dependencies import get_current_auth, require_roles
from auth.security import AuthContext
from db.database import get_db
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
from fuel_management.service import (
    add_tank_telemetry,
    create_device_action,
    create_dispenser,
    create_driver,
    create_policy,
    create_receipt,
    create_tank,
    create_threshold,
    create_transaction,
    delete_dispenser,
    delete_driver,
    delete_tank,
    get_dashboard,
    get_operational_report,
    get_tank,
    list_audit_logs,
    list_dispensers,
    list_drivers,
    list_policies,
    list_receipts,
    list_tanks,
    list_thresholds,
    list_transactions,
    log_audit,
    update_dispenser,
    update_driver,
    update_tank,
    update_threshold,
)


router = APIRouter(prefix="/fuel", tags=["fuel-management"])


def _handle_error(error: ValueError) -> HTTPException:
    message = str(error)
    if message == "Insufficient permissions.":
        return HTTPException(status_code=403, detail=message)
    if "not found" in message.lower():
        return HTTPException(status_code=404, detail=message)
    return HTTPException(status_code=400, detail=message)


@router.get("/dashboard", response_model=FuelDashboard)
def fuel_dashboard(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    return get_dashboard(db, auth)


@router.get("/reports/{report_type}", response_model=dict)
def fuel_report(
    report_type: str,
    start: str | None = Query(default=None),
    end: str | None = Query(default=None),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    try:
        from datetime import datetime

        start_at = datetime.fromisoformat(start) if start else None
        end_at = datetime.fromisoformat(end) if end else None
        return get_operational_report(db, auth, report_type, start_at, end_at)
    except ValueError as error:
        raise _handle_error(error)


@router.get("/drivers", response_model=list[DriverRead])
def get_drivers(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    return list_drivers(db, auth)


@router.post("/drivers", response_model=DriverRead)
def post_driver(
    data: DriverCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return create_driver(db, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.patch("/drivers/{driver_id}", response_model=DriverRead)
def patch_driver(
    driver_id: int,
    data: DriverUpdate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return update_driver(db, driver_id, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.delete("/drivers/{driver_id}", response_model=dict[str, str])
def remove_driver(
    driver_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return delete_driver(db, driver_id, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.get("/tanks", response_model=list[TankRead])
def get_tanks(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    return list_tanks(db, auth)


@router.post("/tanks", response_model=TankRead)
def post_tank(
    data: TankCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return create_tank(db, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.patch("/tanks/{tank_id}", response_model=TankRead)
def patch_tank(
    tank_id: int,
    data: TankUpdate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return update_tank(db, tank_id, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.delete("/tanks/{tank_id}", response_model=dict[str, str])
def remove_tank(
    tank_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return delete_tank(db, tank_id, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.get("/tanks/{tank_id}", response_model=TankDetail)
def get_tank_detail(
    tank_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    try:
        return get_tank(db, tank_id, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.post("/tanks/{tank_id}/telemetry", response_model=TankTelemetryRead)
def post_tank_telemetry(
    tank_id: int,
    data: TankTelemetryCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return add_tank_telemetry(db, tank_id, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.get("/dispensers", response_model=list[DispenserRead])
def get_dispensers(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    return list_dispensers(db, auth)


@router.post("/dispensers", response_model=DispenserRead)
def post_dispenser(
    data: DispenserCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return create_dispenser(db, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.patch("/dispensers/{dispenser_id}", response_model=DispenserRead)
def patch_dispenser(
    dispenser_id: int,
    data: DispenserUpdate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return update_dispenser(db, dispenser_id, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.delete("/dispensers/{dispenser_id}", response_model=dict[str, str])
def remove_dispenser(
    dispenser_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return delete_dispenser(db, dispenser_id, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.get("/receipts", response_model=list[FuelReceiptRead])
def get_receipts(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    return list_receipts(db, auth, limit)


@router.post("/receipts", response_model=FuelReceiptRead)
def post_receipt(
    data: FuelReceiptCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return create_receipt(db, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.get("/policies", response_model=list[FuelPolicyRead])
def get_policies(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    return list_policies(db, auth)


@router.post("/policies", response_model=FuelPolicyRead)
def post_policy(
    data: FuelPolicyCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return create_policy(db, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.get("/transactions", response_model=list[RefuelingTransactionRead])
def get_transactions(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    return list_transactions(db, auth, limit)


@router.post("/transactions", response_model=RefuelingTransactionRead)
def post_transaction(
    data: RefuelingTransactionCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return create_transaction(db, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.get("/thresholds", response_model=list[AlertThresholdRead])
def get_thresholds(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    return list_thresholds(db, auth)


@router.post("/thresholds", response_model=AlertThresholdRead)
def post_threshold(
    data: AlertThresholdCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return create_threshold(db, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.patch("/thresholds/{threshold_id}", response_model=AlertThresholdRead)
def patch_threshold(
    threshold_id: int,
    data: AlertThresholdUpdate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    try:
        return update_threshold(db, threshold_id, data, auth)
    except ValueError as error:
        raise _handle_error(error)


@router.post("/device-actions", response_model=DeviceActionLogRead)
def post_device_action(
    data: DeviceActionLogCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    return create_device_action(db, data, auth)


@router.get("/audit", response_model=list[AuditLogRead])
def get_audit_logs(
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("superadmin", "admin", "company")),
):
    return list_audit_logs(db, auth, limit)


@router.post("/audit", response_model=dict[str, str])
def post_user_action(
    request: Request,
    action: str,
    entityType: str,
    entityId: int | None = None,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    log_audit(
        db,
        auth,
        action,
        entityType,
        entityId,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return {"message": "Audit event registered."}
    delete_driver,
    update_driver,
