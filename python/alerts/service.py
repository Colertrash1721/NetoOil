from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from alerts.models import AlertEvent
from alerts.schemas import AlertRead
from auth.security import AuthContext
from vehicles.models import Vehicle

STOP_ALERT_THRESHOLD_MINUTES = 30
ALERT_DEDUPLICATION_MINUTES = 30


def create_alert_if_needed(
    db: Session,
    *,
    vehicle: Vehicle,
    sensor_identifier: str | None,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    recorded_at: datetime,
    metadata: dict | None = None,
) -> AlertEvent | None:
    dedupe_since = recorded_at - timedelta(minutes=ALERT_DEDUPLICATION_MINUTES)
    existing = (
        db.query(AlertEvent)
        .filter(
            AlertEvent.vehicleId == vehicle.id,
            AlertEvent.alertType == alert_type,
            AlertEvent.status == "open",
            AlertEvent.recordedAt >= dedupe_since,
        )
        .order_by(AlertEvent.recordedAt.desc())
        .first()
    )
    if existing:
        return None

    alert = AlertEvent(
        vehicleId=vehicle.id,
        sensorIdentifier=sensor_identifier,
        alertType=alert_type,
        severity=severity,
        title=title,
        message=message,
        status="open",
        eventMetadata=metadata,
        recordedAt=recorded_at,
    )
    db.add(alert)
    return alert


def close_open_alerts(db: Session, *, vehicle_id: int, alert_type: str, resolved_at: datetime) -> None:
    alerts = (
        db.query(AlertEvent)
        .filter(
            AlertEvent.vehicleId == vehicle_id,
            AlertEvent.alertType == alert_type,
            AlertEvent.status == "open",
        )
        .all()
    )
    for alert in alerts:
        alert.status = "resolved"
        alert.resolvedAt = resolved_at


def read_alerts_service(
    db: Session,
    auth: AuthContext,
    *,
    vehicle_id: int | None = None,
    limit: int = 100,
) -> list[AlertRead]:
    query = db.query(AlertEvent).join(Vehicle, Vehicle.id == AlertEvent.vehicleId)
    if auth.role in {"company", "client"} and auth.company_id is not None:
        query = query.filter(Vehicle.assignedCompanyId == auth.company_id)
    if vehicle_id is not None:
        query = query.filter(AlertEvent.vehicleId == vehicle_id)
    alerts = query.order_by(AlertEvent.recordedAt.desc()).limit(limit).all()
    return [AlertRead.model_validate(alert) for alert in alerts]
