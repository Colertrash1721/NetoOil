from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from auth.dependencies import get_current_auth
from auth.security import AuthContext
from db.database import get_db
from reports.service import build_vehicle_history_report, export_vehicle_history_pdf


router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/vehicles/{vehicle_id}/history")
def get_vehicle_history_report(
    vehicle_id: int,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    return build_vehicle_history_report(db, auth, vehicle_id)


@router.get("/vehicles/{vehicle_id}/history.pdf")
def export_vehicle_history_report_pdf(
    vehicle_id: int,
    auth: AuthContext = Depends(get_current_auth),
    db: Session = Depends(get_db),
):
    filename, pdf_bytes = export_vehicle_history_pdf(db, auth, vehicle_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
