from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from alerts.models import AlertEvent, NotificationDeliveryLog
from alerts.schemas import AlertRead
from auth.security import AuthContext
from companies.models import Company
from notifications.email import send_email
from realtime import publish_realtime_event

STOP_ALERT_THRESHOLD_MINUTES = 30
ALERT_DEDUPLICATION_MINUTES = 30


def create_alert_if_needed(
    db: Session,
    *,
    vehicle=None,
    sensor_identifier: str | None,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    recorded_at: datetime,
    metadata: dict | None = None,
    entity_type: str = "vehicle",
    entity_id: int | None = None,
    company_id: int | None = None,
    notification_email: str | None = None,
) -> AlertEvent | None:
    dedupe_since = recorded_at - timedelta(minutes=ALERT_DEDUPLICATION_MINUTES)
    resolved_entity_id = entity_id if entity_id is not None else (vehicle.id if vehicle else None)
    resolved_company_id = company_id if company_id is not None else (
        vehicle.assignedCompanyId if vehicle else None
    )
    existing = (
        db.query(AlertEvent)
        .filter(
            AlertEvent.entityType == entity_type,
            AlertEvent.entityId == resolved_entity_id,
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
        vehicleId=vehicle.id if vehicle else None,
        entityType=entity_type,
        entityId=resolved_entity_id,
        assignedCompanyId=resolved_company_id,
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
    db.flush()
    _notify_alert_created(db, alert, notification_email)
    return alert


def _notify_alert_created(
    db: Session,
    alert: AlertEvent,
    notification_email: str | None = None,
) -> None:
    recipient = notification_email
    if not recipient and alert.assignedCompanyId is not None:
        company = db.get(Company, alert.assignedCompanyId)
        recipient = company.email if company else None

    if recipient:
        try:
            send_email(
                recipient,
                f"[NetoFuel] {alert.title}",
                (
                    f"{alert.title}\n\n"
                    f"{alert.message}\n\n"
                    f"Severidad: {alert.severity}\n"
                    f"Entidad: {alert.entityType} #{alert.entityId}\n"
                    f"Fecha: {alert.recordedAt.isoformat()}"
                ),
            )
            db.add(
                NotificationDeliveryLog(
                    alertId=alert.id,
                    channel="email",
                    recipient=recipient,
                    status="sent",
                    provider="smtp",
                    response="accepted",
                    sentAt=datetime.utcnow(),
                    receivedAt=datetime.utcnow(),
                )
            )
        except Exception as error:
            db.add(
                NotificationDeliveryLog(
                    alertId=alert.id,
                    channel="email",
                    recipient=recipient,
                    status="failed",
                    provider="smtp",
                    response=str(error)[:255],
                    sentAt=datetime.utcnow(),
                )
            )

    db.add(
        NotificationDeliveryLog(
            alertId=alert.id,
            channel="internal",
            recipient=f"company:{alert.assignedCompanyId}" if alert.assignedCompanyId else "global",
            status="received",
            provider="realtime",
            response="queued",
            sentAt=datetime.utcnow(),
            receivedAt=datetime.utcnow(),
        )
    )

    metadata = alert.eventMetadata or {}
    threshold_id = metadata.get("thresholdId") if isinstance(metadata, dict) else None
    if threshold_id:
        from fuel_management.models import AlertThreshold

        threshold = db.get(AlertThreshold, threshold_id)
        if threshold:
            metadata = {
                **metadata,
                "notificationChannels": threshold.notificationChannels,
                "smsNumber": threshold.smsNumber,
                "webhookUrl": threshold.webhookUrl,
            }
    for channel, recipient_key in (("sms", "smsNumber"), ("webhook", "webhookUrl")):
        recipient_value = metadata.get(recipient_key)
        if recipient_value:
            db.add(
                NotificationDeliveryLog(
                    alertId=alert.id,
                    channel=channel,
                    recipient=str(recipient_value),
                    status="sent",
                    provider="internal",
                    response="delivery accepted",
                    sentAt=datetime.utcnow(),
                    receivedAt=datetime.utcnow(),
                )
            )

    publish_realtime_event(
        {
            "type": "alert.created",
            "alert": {
                "id": alert.id,
                "vehicleId": alert.vehicleId,
                "entityType": alert.entityType,
                "entityId": alert.entityId,
                "assignedCompanyId": alert.assignedCompanyId,
                "alertType": alert.alertType,
                "severity": alert.severity,
                "title": alert.title,
                "message": alert.message,
                "status": alert.status,
                "metadata": alert.eventMetadata,
                "recordedAt": alert.recordedAt,
                "createdAt": alert.createdAt,
            },
        },
        alert.assignedCompanyId,
    )


def read_notification_logs_service(
    db: Session,
    auth: AuthContext,
    *,
    limit: int = 100,
) -> list[dict]:
    query = db.query(NotificationDeliveryLog).outerjoin(AlertEvent, NotificationDeliveryLog.alertId == AlertEvent.id)
    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        query = query.filter(AlertEvent.assignedCompanyId == auth.company_id)
    logs = query.order_by(NotificationDeliveryLog.sentAt.desc()).limit(limit).all()
    return [
        {
            "id": item.id,
            "alertId": item.alertId,
            "channel": item.channel,
            "recipient": item.recipient,
            "status": item.status,
            "provider": item.provider,
            "response": item.response,
            "sentAt": item.sentAt,
            "receivedAt": item.receivedAt,
        }
        for item in logs
    ]


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


def close_alert_service(
    db: Session,
    auth: AuthContext,
    *,
    alert_id: int,
) -> AlertRead:
    from vehicles.models import Vehicle

    alert = db.get(AlertEvent, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alerta no encontrada.")

    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        vehicle = db.get(Vehicle, alert.vehicleId) if alert.vehicleId else None
        belongs_to_company = (
            alert.assignedCompanyId == auth.company_id
            or (vehicle is not None and vehicle.assignedCompanyId == auth.company_id)
        )
        if not belongs_to_company:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta alerta.")

    if alert.status == "open":
        alert.status = "resolved"
        alert.resolvedAt = datetime.utcnow()
        db.add(alert)
        db.commit()
        db.refresh(alert)

        publish_realtime_event(
            {
                "type": "alert.resolved",
                "alert": {
                    "id": alert.id,
                    "vehicleId": alert.vehicleId,
                    "entityType": alert.entityType,
                    "entityId": alert.entityId,
                    "assignedCompanyId": alert.assignedCompanyId,
                    "alertType": alert.alertType,
                    "severity": alert.severity,
                    "title": alert.title,
                    "message": alert.message,
                    "status": alert.status,
                    "metadata": alert.eventMetadata,
                    "recordedAt": alert.recordedAt,
                    "createdAt": alert.createdAt,
                    "resolvedAt": alert.resolvedAt,
                },
            },
            alert.assignedCompanyId,
        )

    return AlertRead.model_validate(alert)


def read_alerts_service(
    db: Session,
    auth: AuthContext,
    *,
    vehicle_id: int | None = None,
    limit: int = 100,
) -> list[AlertRead]:
    from vehicles.models import Vehicle

    query = db.query(AlertEvent).outerjoin(Vehicle, Vehicle.id == AlertEvent.vehicleId)
    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        query = query.filter(
            or_(
                Vehicle.assignedCompanyId == auth.company_id,
                AlertEvent.assignedCompanyId == auth.company_id,
            )
        )
    if vehicle_id is not None:
        query = query.filter(AlertEvent.vehicleId == vehicle_id)
    alerts = query.order_by(AlertEvent.recordedAt.desc()).limit(limit).all()
    return [AlertRead.model_validate(alert) for alert in alerts]
