from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DriverBase(BaseModel):
    fullName: str
    documentId: str
    licenseNumber: str | None = None
    phone: str | None = None
    status: str = "active"
    assignedCompanyId: int


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    fullName: str | None = None
    documentId: str | None = None
    licenseNumber: str | None = None
    phone: str | None = None
    status: str | None = None
    assignedCompanyId: int | None = None


class DriverRead(DriverBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    createdAt: datetime


class TankBase(BaseModel):
    code: str
    name: str
    location: str
    fuelType: str = "diesel"
    capacity: float = Field(gt=0)
    currentVolume: float = Field(ge=0)
    temperature: float | None = None
    density: float | None = None
    status: str = "operational"
    sensorIdentifier: str | None = None
    assignedCompanyId: int


class TankCreate(TankBase):
    pass


class TankUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    location: str | None = None
    fuelType: str | None = None
    capacity: float | None = None
    currentVolume: float | None = None
    temperature: float | None = None
    density: float | None = None
    status: str | None = None
    sensorIdentifier: str | None = None
    assignedCompanyId: int | None = None


class TankTelemetryCreate(BaseModel):
    levelPercent: float | None = None
    volume: float | None = None
    temperature: float | None = None
    density: float | None = None
    variation: float | None = None
    alarm: bool = False
    recordedAt: datetime | None = None


class TankTelemetryRead(TankTelemetryCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tankId: int
    recordedAt: datetime


class TankRead(TankBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fillPercent: float
    availableCapacity: float
    lastUpdate: datetime | None = None
    createdAt: datetime


class TankDetail(TankRead):
    telemetryHistory: list[TankTelemetryRead] = Field(default_factory=list)


class DispenserBase(BaseModel):
    code: str
    name: str
    location: str
    tankId: int
    totalizer: float = 0
    status: str = "online"
    deviceIdentifier: str | None = None
    assignedCompanyId: int


class DispenserCreate(DispenserBase):
    pass


class DispenserUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    location: str | None = None
    tankId: int | None = None
    totalizer: float | None = None
    status: str | None = None
    deviceIdentifier: str | None = None
    assignedCompanyId: int | None = None


class DispenserRead(DispenserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tankCode: str | None = None
    lastTransactionAt: datetime | None = None
    createdAt: datetime


class FuelReceiptCreate(BaseModel):
    tankId: int
    supplier: str
    invoiceNumber: str | None = None
    volume: float = Field(gt=0)
    density: float | None = None
    temperature: float | None = None
    status: str = "accepted"
    receivedAt: datetime | None = None


class FuelReceiptRead(FuelReceiptCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    receivedByUserId: int | None = None
    receivedAt: datetime
    createdAt: datetime


class FuelPolicyCreate(BaseModel):
    name: str
    vehicleId: int | None = None
    driverId: int | None = None
    assignedCompanyId: int
    maxVolumePerTransaction: float | None = None
    maxVolumePerDay: float | None = None
    maxVolumePerWeek: float | None = None
    shiftName: str | None = None
    startsAt: datetime | None = None
    endsAt: datetime | None = None
    identificationMethod: str = "rfid"
    requiresPreAuthorization: bool = True
    autoCutEnabled: bool = True
    status: str = "active"


class FuelPolicyRead(FuelPolicyCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    createdAt: datetime


class RefuelingTransactionCreate(BaseModel):
    transactionCode: str | None = None
    vehicleId: int
    driverId: int | None = None
    dispenserId: int
    requestedVolume: float | None = None
    authorizedVolume: float | None = None
    dispensedVolume: float = Field(gt=0)
    odometer: float | None = None
    identificationMethod: str = "rfid"
    identificationValue: str | None = None
    preAuthorized: bool = False
    status: str = "completed"
    startedAt: datetime | None = None
    completedAt: datetime | None = None


class RefuelingTransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transactionCode: str
    vehicleId: int
    vehiclePlate: str | None = None
    driverId: int | None = None
    driverName: str | None = None
    dispenserId: int
    dispenserCode: str | None = None
    tankId: int
    tankCode: str | None = None
    policyId: int | None = None
    requestedVolume: float | None = None
    authorizedVolume: float | None = None
    dispensedVolume: float
    odometer: float | None = None
    identificationMethod: str
    identificationValue: str | None = None
    preAuthorized: bool
    cutReason: str | None = None
    status: str
    startedAt: datetime
    completedAt: datetime | None = None
    createdAt: datetime


class AlertThresholdCreate(BaseModel):
    scope: str
    entityId: int | None = None
    assignedCompanyId: int | None = None
    metric: str
    minValue: float | None = None
    maxValue: float | None = None
    variationLimit: float | None = None
    notificationEmail: str | None = None
    enabled: bool = True


class AlertThresholdUpdate(BaseModel):
    scope: str | None = None
    entityId: int | None = None
    assignedCompanyId: int | None = None
    metric: str | None = None
    minValue: float | None = None
    maxValue: float | None = None
    variationLimit: float | None = None
    notificationEmail: str | None = None
    enabled: bool | None = None


class AlertThresholdRead(AlertThresholdCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    createdAt: datetime


class AuditLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actorRole: str
    actorId: int | None = None
    action: str
    entityType: str
    entityId: int | None = None
    details: dict | None = None
    ipAddress: str | None = None
    createdAt: datetime


class DeviceActionLogCreate(BaseModel):
    deviceType: str
    deviceIdentifier: str
    action: str
    status: str = "accepted"
    payload: dict | None = None
    message: str | None = None


class DeviceActionLogRead(DeviceActionLogCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    createdAt: datetime


class FuelKpis(BaseModel):
    totalTankCapacity: float
    totalStoredVolume: float
    globalFillPercent: float
    volumeReceived: float
    volumeDispensed: float
    estimatedVehicleConsumption: float
    unreconciledFuel: float
    validTransactions: int
    activeAlerts: int
    averageAlarmResponseMinutes: float | None = None
    activeTanks: int
    onlineDispensers: int
    forecastNext7Days: float


class FuelDashboard(BaseModel):
    kpis: FuelKpis
    tanks: list[TankRead]
    dispensers: list[DispenserRead]
    recentTransactions: list[RefuelingTransactionRead]
