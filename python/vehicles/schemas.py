from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VehicleBase(BaseModel):
    plate: str
    brand: str
    model: str
    year: int | None = None
    version: str | None = None
    vin: str | None = None
    color: str | None = None
    seatCount: int | None = None
    engineType: str | None = None
    engineDisplacement: str | None = None
    engineCylinderCount: int | None = None
    maxPower: str | None = None
    maxTorque: str | None = None
    fuelConsumption: str | None = None
    tankCapacity: str | None = None
    transmission: str | None = None
    sensorIdentifier: str | None = None
    status: str = "active"
    assignedCompanyId: int


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    plate: str | None = None
    brand: str | None = None
    model: str | None = None
    year: int | None = None
    version: str | None = None
    vin: str | None = None
    color: str | None = None
    seatCount: int | None = None
    engineType: str | None = None
    engineDisplacement: str | None = None
    engineCylinderCount: int | None = None
    maxPower: str | None = None
    maxTorque: str | None = None
    fuelConsumption: str | None = None
    tankCapacity: str | None = None
    transmission: str | None = None
    sensorIdentifier: str | None = None
    status: str | None = None
    assignedCompanyId: int | None = None


class VehicleTelemetryCreate(BaseModel):
    temperature: float | None = None
    inclination: float | None = None
    volume: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    speed: float | None = None
    fuelLevel: float | None = None
    pressure: float | None = None
    humidity: float | None = None
    batteryLevel: float | None = None
    alarm: bool = False
    distanceKm: float | None = None
    expectedFuelUsed: float | None = None
    actualFuelUsed: float | None = None
    fuelDelta: float | None = None
    fuelValidationStatus: str | None = None
    fuelValidationMessage: str | None = None
    fuelValidationAt: datetime | None = None
    recordedAt: datetime | None = None


class VehicleTelemetryRead(VehicleTelemetryCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicleId: int
    recordedAt: datetime


class VehicleRead(VehicleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    creationDate: datetime
    lastTemperature: float | None = None
    lastInclination: float | None = None
    lastVolume: float | None = None
    lastLatitude: float | None = None
    lastLongitude: float | None = None
    lastSpeed: float | None = None
    lastFuelLevel: float | None = None
    lastPressure: float | None = None
    lastHumidity: float | None = None
    lastBatteryLevel: float | None = None
    lastAlarm: bool = False
    deviceIsStopped: bool = False
    stopStartedAt: datetime | None = None
    lastMovementAt: datetime | None = None
    stoppedMinutes: float | None = None
    lastUpdate: datetime | None = None


class VehicleDetail(VehicleRead):
    assignedCompanyName: str | None = None
    telemetryHistory: list[VehicleTelemetryRead] = Field(default_factory=list)
