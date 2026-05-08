from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from auth.dependencies import get_current_auth
from auth.security import AuthContext
from db.database import get_db
from reports.service import (
    build_advanced_kpis,
    build_consumption_forecast,
    build_fuel_history_report,
    build_vehicle_history_report,
    export_records,
    export_vehicle_history_pdf,
)


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/vehicles/{vehicle_id}/history")
def get_vehicle_history_report(
    vehicle_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    period: str | None = None,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    return build_vehicle_history_report(db, auth, vehicle_id, start=start, end=end, period=period)


@router.get("/vehicles/{vehicle_id}/history.pdf")
def export_vehicle_history_report_pdf(
    vehicle_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
    period: str | None = None,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    filename, pdf_bytes = export_vehicle_history_pdf(db, auth, vehicle_id, start=start, end=end, period=period)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/fuel/history")
def get_fuel_history_report(
    start: datetime | None = None,
    end: datetime | None = None,
    period: str | None = None,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    return build_fuel_history_report(db, auth, start=start, end=end, period=period)


@router.get("/kpis/advanced")
def get_advanced_kpis(
    start: datetime | None = None,
    end: datetime | None = None,
    period: str | None = None,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    return build_advanced_kpis(db, auth, start=start, end=end, period=period)


@router.get("/forecast/consumption")
def get_consumption_forecast(
    months: int = 1,
    confidencePercent: float = 80,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    return build_consumption_forecast(db, auth, months=months, confidence_percent=confidencePercent)


@router.get("/exports/{report_name}.{fmt}")
def export_standard_report(
    report_name: str,
    fmt: str,
    start: datetime | None = None,
    end: datetime | None = None,
    period: str | None = None,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    report = build_fuel_history_report(db, auth, start=start, end=end, period=period)
    records = report.get(report_name) if report_name in {"tanks", "transactions", "alerts"} else [report.get("summary", {})]
    filename, media_type, content = export_records(records, fmt)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{report_name}-{filename}"'},
    )
