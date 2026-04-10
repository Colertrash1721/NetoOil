import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from db.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    plate = Column(String(50), unique=True, index=True, nullable=False)
    brand = Column(String(100), nullable=False)
    model = Column(String(100), nullable=False)
    year = Column(Integer, nullable=True)
    version = Column(String(100), nullable=True)
    vin = Column(String(100), nullable=True, index=True)
    color = Column(String(50), nullable=True)
    seatCount = Column(Integer, nullable=True)
    engineType = Column(String(100), nullable=True)
    engineDisplacement = Column(String(100), nullable=True)
    engineCylinderCount = Column(Integer, nullable=True)
    maxPower = Column(String(100), nullable=True)
    maxTorque = Column(String(100), nullable=True)
    fuelConsumption = Column(String(100), nullable=True)
    tankCapacity = Column(String(100), nullable=True)
    transmission = Column(String(100), nullable=True)
    sensorIdentifier = Column(String(100), unique=True, index=True, nullable=True)
    status = Column(String(50), nullable=False, default="active")
    assignedCompanyId = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    lastTemperature = Column(Float, nullable=True)
    lastInclination = Column(Float, nullable=True)
    lastVolume = Column(Float, nullable=True)
    lastLatitude = Column(Float, nullable=True)
    lastLongitude = Column(Float, nullable=True)
    lastSpeed = Column(Float, nullable=True)
    lastFuelLevel = Column(Float, nullable=True)
    lastPressure = Column(Float, nullable=True)
    lastHumidity = Column(Float, nullable=True)
    lastBatteryLevel = Column(Float, nullable=True)
    lastAlarm = Column(Boolean, nullable=False, default=False)
    deviceIsStopped = Column(Boolean, nullable=False, default=False)
    stopStartedAt = Column(DateTime, nullable=True)
    lastMovementAt = Column(DateTime, nullable=True)
    lastUpdate = Column(DateTime, nullable=True)
    creationDate = Column(DateTime, nullable=False, default=datetime.datetime.utcnow)

    telemetryHistory = relationship(
        "VehicleTelemetry",
        back_populates="vehicle",
        cascade="all, delete-orphan",
        order_by="desc(VehicleTelemetry.recordedAt)",
    )


class VehicleTelemetry(Base):
    __tablename__ = "vehicle_telemetry"

    id = Column(Integer, primary_key=True, index=True)
    vehicleId = Column(Integer, ForeignKey("vehicles.id"), nullable=False, index=True)
    temperature = Column(Float, nullable=True)
    inclination = Column(Float, nullable=True)
    volume = Column(Float, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    speed = Column(Float, nullable=True)
    fuelLevel = Column(Float, nullable=True)
    pressure = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    batteryLevel = Column(Float, nullable=True)
    alarm = Column(Boolean, nullable=False, default=False)
    distanceKm = Column(Float, nullable=True)
    expectedFuelUsed = Column(Float, nullable=True)
    actualFuelUsed = Column(Float, nullable=True)
    fuelDelta = Column(Float, nullable=True)
    fuelValidationStatus = Column(String(50), nullable=True, index=True)
    fuelValidationMessage = Column(String(255), nullable=True)
    fuelValidationAt = Column(DateTime, nullable=True)
    recordedAt = Column(DateTime, nullable=False, default=datetime.datetime.utcnow, index=True)

    vehicle = relationship("Vehicle", back_populates="telemetryHistory")
