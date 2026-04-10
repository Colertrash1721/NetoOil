from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from alerts.schemas import AlertRead
from alerts.service import read_alerts_service
from auth.dependencies import get_current_auth
from auth.security import AuthContext
from db.database import get_db


router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("/", response_model=list[AlertRead])
def get_alerts(
    vehicleId: int | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    return read_alerts_service(db, auth, vehicle_id=vehicleId, limit=limit)

