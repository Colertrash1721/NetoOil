from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from auth.dependencies import get_current_auth, require_roles
from auth.security import AuthContext
from db.database import get_db
from vehicles.schemas import (
    VehicleCreate,
    VehicleDetail,
    VehicleRead,
    VehicleTelemetryCreate,
    VehicleTelemetryRead,
    VehicleUpdate,
)
from vehicles.service import (
    create_vehicle_service,
    create_vehicle_telemetry_service,
    delete_vehicle_service,
    read_all_vehicles_service,
    read_vehicle_by_id_service,
    read_vehicle_telemetry_history_service,
    update_vehicle_service,
)
from vehicles.service import read_vehicle_by_id_service


router = APIRouter(prefix="/vehicles", tags=["vehicles"])


def _ensure_vehicle_company_access(auth: AuthContext, company_id: int) -> None:
    if auth.role in {"company", "client"} and auth.company_id != company_id:
        raise HTTPException(status_code=403, detail="Insufficient permissions.")


@router.get("/", response_model=list[VehicleRead])
def get_all_vehicles(
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    return read_all_vehicles_service(db, auth)


@router.get("/{vehicle_id}", response_model=VehicleDetail)
def get_vehicle_by_id(
    vehicle_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    try:
        vehicle = read_vehicle_by_id_service(db, vehicle_id)
        _ensure_vehicle_company_access(auth, vehicle.assignedCompanyId)
        return vehicle
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@router.post("/", response_model=VehicleRead)
def create_vehicle(
    vehicle: VehicleCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("admin", "company")),
):
    try:
        _ensure_vehicle_company_access(auth, vehicle.assignedCompanyId)
        return create_vehicle_service(db, vehicle)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@router.patch("/{vehicle_id}", response_model=VehicleRead)
def update_vehicle(
    vehicle_id: int,
    data: VehicleUpdate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("admin", "company")),
):
    try:
        existing = read_vehicle_by_id_service(db, vehicle_id)
        _ensure_vehicle_company_access(auth, existing.assignedCompanyId)
        if data.assignedCompanyId is not None:
            _ensure_vehicle_company_access(auth, data.assignedCompanyId)
        return update_vehicle_service(db, vehicle_id, data)
    except ValueError as error:
        status_code = 404 if str(error) == "Vehicle not found." else 400
        raise HTTPException(status_code=status_code, detail=str(error))


@router.delete("/{vehicle_id}")
def delete_vehicle(
    vehicle_id: int,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("admin", "company")),
):
    try:
        existing = read_vehicle_by_id_service(db, vehicle_id)
        _ensure_vehicle_company_access(auth, existing.assignedCompanyId)
        return delete_vehicle_service(db, vehicle_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@router.post("/{vehicle_id}/telemetry", response_model=VehicleTelemetryRead)
def create_vehicle_telemetry(
    vehicle_id: int,
    telemetry: VehicleTelemetryCreate,
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(require_roles("admin", "company")),
):
    try:
        existing = read_vehicle_by_id_service(db, vehicle_id)
        _ensure_vehicle_company_access(auth, existing.assignedCompanyId)
        return create_vehicle_telemetry_service(db, vehicle_id, telemetry)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))


@router.get("/{vehicle_id}/telemetry", response_model=list[VehicleTelemetryRead])
def get_vehicle_telemetry_history(
    vehicle_id: int,
    limit: int = Query(default=100, ge=1, le=1000),
    db: Session = Depends(get_db),
    auth: AuthContext = Depends(get_current_auth),
):
    try:
        existing = read_vehicle_by_id_service(db, vehicle_id)
        _ensure_vehicle_company_access(auth, existing.assignedCompanyId)
        return read_vehicle_telemetry_history_service(db, vehicle_id, limit)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error))
