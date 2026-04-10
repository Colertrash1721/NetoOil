import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String

from db.database import Base


class AlertEvent(Base):
    __tablename__ = "alert_events"

    id = Column(Integer, primary_key=True, index=True)
    vehicleId = Column(Integer, ForeignKey("vehicles.id"), nullable=False, index=True)
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
