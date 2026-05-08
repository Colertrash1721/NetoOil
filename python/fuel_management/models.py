import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import relationship

from db.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    fullName = Column(String(160), nullable=False, index=True)
    documentId = Column(String(80), unique=True, nullable=False, index=True)
    licenseNumber = Column(String(80), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    status = Column(String(40), nullable=False, default="active", index=True)
    assignedCompanyId = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)


class InstitutionalTank(Base):
    __tablename__ = "institutional_tanks"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(60), unique=True, nullable=False, index=True)
    name = Column(String(140), nullable=False)
    location = Column(String(180), nullable=False)
    fuelType = Column(String(60), nullable=False, default="diesel")
    storageType = Column(String(40), nullable=False, default="aereo")
    capacity = Column(Float, nullable=False)
    currentVolume = Column(Float, nullable=False, default=0)
    targetRefillGallons = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    density = Column(Float, nullable=True)
    status = Column(String(40), nullable=False, default="operational", index=True)
    sensorIdentifier = Column(String(100), unique=True, nullable=True, index=True)
    assignedCompanyId = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    lastUpdate = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)

    telemetryHistory = relationship(
        "TankTelemetry",
        back_populates="tank",
        cascade="all, delete-orphan",
        order_by="desc(TankTelemetry.recordedAt)",
    )


class TankTelemetry(Base):
    __tablename__ = "tank_telemetry"

    id = Column(Integer, primary_key=True, index=True)
    tankId = Column(Integer, ForeignKey("institutional_tanks.id"), nullable=False, index=True)
    levelPercent = Column(Float, nullable=True)
    volume = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    density = Column(Float, nullable=True)
    variation = Column(Float, nullable=True)
    alarm = Column(Boolean, nullable=False, default=False)
    recordedAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)

    tank = relationship("InstitutionalTank", back_populates="telemetryHistory")


class Dispenser(Base):
    __tablename__ = "dispensers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(60), unique=True, nullable=False, index=True)
    name = Column(String(140), nullable=False)
    location = Column(String(180), nullable=False)
    tankId = Column(Integer, ForeignKey("institutional_tanks.id"), nullable=False, index=True)
    totalizer = Column(Float, nullable=False, default=0)
    targetRefillGallons = Column(Float, nullable=True)
    supportedIdentificationMethods = Column(String(160), nullable=False, default="rfid,mifare,anpr,ble")
    fallbackIdentificationMethod = Column(String(40), nullable=False, default="anpr")
    productConfigurations = Column(JSON, nullable=True)
    hoseCount = Column(Integer, nullable=False, default=1)
    status = Column(String(40), nullable=False, default="online", index=True)
    deviceIdentifier = Column(String(100), unique=True, nullable=True, index=True)
    assignedCompanyId = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    lastTransactionAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)


class FuelReceipt(Base):
    __tablename__ = "fuel_receipts"

    id = Column(Integer, primary_key=True, index=True)
    tankId = Column(Integer, ForeignKey("institutional_tanks.id"), nullable=False, index=True)
    supplier = Column(String(160), nullable=False)
    invoiceNumber = Column(String(100), nullable=True, index=True)
    volume = Column(Float, nullable=False)
    density = Column(Float, nullable=True)
    temperature = Column(Float, nullable=True)
    receivedByUserId = Column(Integer, nullable=True)
    status = Column(String(40), nullable=False, default="accepted", index=True)
    receivedAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)


class FuelPolicy(Base):
    __tablename__ = "fuel_policies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(140), nullable=False)
    vehicleId = Column(Integer, ForeignKey("vehicles.id"), nullable=True, index=True)
    driverId = Column(Integer, ForeignKey("drivers.id"), nullable=True, index=True)
    assignedCompanyId = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    maxVolumePerTransaction = Column(Float, nullable=True)
    maxVolumePerDay = Column(Float, nullable=True)
    maxVolumePerWeek = Column(Float, nullable=True)
    shiftName = Column(String(80), nullable=True)
    startsAt = Column(DateTime, nullable=True)
    endsAt = Column(DateTime, nullable=True)
    identificationMethod = Column(String(40), nullable=False, default="rfid")
    requiresPreAuthorization = Column(Boolean, nullable=False, default=True)
    autoCutEnabled = Column(Boolean, nullable=False, default=True)
    status = Column(String(40), nullable=False, default="active", index=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)


class RefuelingTransaction(Base):
    __tablename__ = "refueling_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transactionCode = Column(String(80), unique=True, nullable=False, index=True)
    vehicleId = Column(Integer, ForeignKey("vehicles.id"), nullable=False, index=True)
    driverId = Column(Integer, ForeignKey("drivers.id"), nullable=True, index=True)
    dispenserId = Column(Integer, ForeignKey("dispensers.id"), nullable=False, index=True)
    tankId = Column(Integer, ForeignKey("institutional_tanks.id"), nullable=False, index=True)
    policyId = Column(Integer, ForeignKey("fuel_policies.id"), nullable=True, index=True)
    operatorName = Column(String(160), nullable=True)
    authorizationNumber = Column(String(100), nullable=True, index=True)
    productType = Column(String(60), nullable=False, default="diesel", index=True)
    hoseNumber = Column(Integer, nullable=False, default=1)
    flowMeterStart = Column(Float, nullable=True)
    flowMeterEnd = Column(Float, nullable=True)
    flowMeterAccuracyPercent = Column(Float, nullable=True)
    identificationStatus = Column(String(40), nullable=False, default="valid")
    requestedVolume = Column(Float, nullable=True)
    authorizedVolume = Column(Float, nullable=True)
    dispensedVolume = Column(Float, nullable=False, default=0)
    odometer = Column(Float, nullable=True)
    identificationMethod = Column(String(40), nullable=False, default="rfid")
    identificationValue = Column(String(120), nullable=True)
    preAuthorized = Column(Boolean, nullable=False, default=False)
    cutReason = Column(String(120), nullable=True)
    status = Column(String(40), nullable=False, default="completed", index=True)
    startedAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)
    completedAt = Column(DateTime, nullable=True, index=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)


class AlertThreshold(Base):
    __tablename__ = "alert_thresholds"

    id = Column(Integer, primary_key=True, index=True)
    scope = Column(String(40), nullable=False, index=True)
    entityId = Column(Integer, nullable=True, index=True)
    assignedCompanyId = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    metric = Column(String(80), nullable=False, index=True)
    minValue = Column(Float, nullable=True)
    maxValue = Column(Float, nullable=True)
    variationLimit = Column(Float, nullable=True)
    notificationEmail = Column(String(255), nullable=True)
    notificationChannels = Column(String(120), nullable=False, default="internal,email")
    smsNumber = Column(String(50), nullable=True)
    webhookUrl = Column(String(255), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True, index=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actorRole = Column(String(50), nullable=False, index=True)
    actorId = Column(Integer, nullable=True, index=True)
    action = Column(String(120), nullable=False, index=True)
    entityType = Column(String(80), nullable=False, index=True)
    entityId = Column(Integer, nullable=True, index=True)
    details = Column(JSON, nullable=True)
    ipAddress = Column(String(80), nullable=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)


class DeviceActionLog(Base):
    __tablename__ = "device_action_logs"

    id = Column(Integer, primary_key=True, index=True)
    deviceType = Column(String(60), nullable=False, index=True)
    deviceIdentifier = Column(String(120), nullable=False, index=True)
    action = Column(String(120), nullable=False, index=True)
    status = Column(String(40), nullable=False, default="accepted", index=True)
    payload = Column(JSON, nullable=True)
    message = Column(Text, nullable=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)


class CustomRole(Base):
    __tablename__ = "custom_roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, index=True)
    description = Column(String(255), nullable=True)
    assignedCompanyId = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    permissions = Column(JSON, nullable=False, default=list)
    status = Column(String(40), nullable=False, default="active", index=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)


class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    url = Column(String(255), nullable=False)
    eventTypes = Column(String(255), nullable=False, default="alert.created,transaction.created")
    retryCount = Column(Integer, nullable=False, default=3)
    secret = Column(String(120), nullable=True)
    status = Column(String(40), nullable=False, default="active", index=True)
    createdAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)


class WebhookDeliveryLog(Base):
    __tablename__ = "webhook_delivery_logs"

    id = Column(Integer, primary_key=True, index=True)
    webhookId = Column(Integer, ForeignKey("webhook_endpoints.id"), nullable=False, index=True)
    eventType = Column(String(120), nullable=False, index=True)
    payload = Column(JSON, nullable=True)
    attempts = Column(Integer, nullable=False, default=1)
    status = Column(String(40), nullable=False, default="delivered", index=True)
    response = Column(String(255), nullable=True)
    deliveredAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)
