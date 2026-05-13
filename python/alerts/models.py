import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String

from db.database import Base


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id = Column(Integer, primary_key=True, index=True)
    vehicleId = Column(Integer, ForeignKey("vehicles.id"), nullable=True, index=True)
    entityType = Column(String(40), nullable=False, default="vehicle", index=True)
    entityId = Column(Integer, nullable=True, index=True)
    assignedCompanyId = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    sensorIdentifier = Column(String(100), nullable=True, index=True)
    alertType = Column(String(50), nullable=False, index=True)
    severity = Column(String(30), nullable=False, default="medium", index=True)
    title = Column(String(120), nullable=False)
    message = Column(String(255), nullable=False)
    status = Column(String(30), nullable=False, default="open", index=True)
    eventMetadata = Column("metadata", JSON, nullable=True)
    recordedAt = Column(DateTime, nullable=False, index=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)
    resolvedAt = Column(DateTime, nullable=True)


class NotificationDeliveryLog(Base):
    __tablename__ = "notification_delivery_logs"

    id = Column(Integer, primary_key=True, index=True)
    alertId = Column(Integer, ForeignKey("alert_events.id"), nullable=True, index=True)
    channel = Column(String(40), nullable=False, index=True)
    recipient = Column(String(255), nullable=True)
    status = Column(String(40), nullable=False, default="sent", index=True)
    provider = Column(String(80), nullable=False, default="internal")
    response = Column(String(255), nullable=True)
    sentAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)
    receivedAt = Column(DateTime, nullable=True)
