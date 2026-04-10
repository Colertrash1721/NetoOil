import math
import re
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from vehicles.models import Vehicle, VehicleTelemetry

EARTH_RADIUS_KM = 6371.0
MIN_DISTANCE_KM = 0.05
MOVING_SPEED_THRESHOLD_KMH = 3.0
DEFAULT_TOLERANCE_PERCENT = 0.35
DEFAULT_TOLERANCE_ABSOLUTE_GAL = 0.25


@dataclass
class ConsumptionValidationResult:
    distance_km: float | None
    expected_fuel_used: float | None
    actual_fuel_used: float | None
    fuel_delta: float | None
    status: str
    message: str
    validated_at: datetime


def get_previous_vehicle_telemetry(
    db: Session, vehicle_id: int, recorded_at: datetime
) -> VehicleTelemetry | None:
    return (
        db.query(VehicleTelemetry)
        .filter(
            VehicleTelemetry.vehicleId == vehicle_id,
            VehicleTelemetry.recordedAt < recorded_at,
        )
        .order_by(VehicleTelemetry.recordedAt.desc(), VehicleTelemetry.id.desc())
        .first()
    )


def validate_vehicle_consumption(
    vehicle: Vehicle,
    *,
    current_fuel_level: float | None,
    current_volume: float | None,
    current_latitude: float | None,
    current_longitude: float | None,
    current_speed: float | None,
    movement: bool | None,
    recorded_at: datetime,
    previous_telemetry: VehicleTelemetry | None,
) -> ConsumptionValidationResult:
    validated_at = datetime.utcnow()
    gallons_per_km = parse_gallons_per_kilometer(vehicle.fuelConsumption)
    if gallons_per_km is None:
        return ConsumptionValidationResult(
            distance_km=None,
            expected_fuel_used=None,
            actual_fuel_used=None,
            fuel_delta=None,
            status="no_consumption_profile",
            message="El vehiculo no tiene un consumo valido en gal/km.",
            validated_at=validated_at,
        )

    if previous_telemetry is None:
        return ConsumptionValidationResult(
            distance_km=None,
            expected_fuel_used=None,
            actual_fuel_used=None,
            fuel_delta=None,
            status="insufficient_history",
            message="No hay telemetria previa para comparar el consumo.",
            validated_at=validated_at,
        )

    distance_km = haversine_km(
        previous_telemetry.latitude,
        previous_telemetry.longitude,
        current_latitude,
        current_longitude,
    )
    if distance_km is None:
        return ConsumptionValidationResult(
            distance_km=None,
            expected_fuel_used=None,
            actual_fuel_used=None,
            fuel_delta=None,
            status="missing_location",
            message="No hay coordenadas suficientes para estimar la distancia.",
            validated_at=validated_at,
        )

    moving = is_vehicle_moving(
        movement=movement,
        current_speed=current_speed,
        previous_speed=previous_telemetry.speed,
        distance_km=distance_km,
    )
    if not moving:
        return ConsumptionValidationResult(
            distance_km=distance_km,
            expected_fuel_used=0.0,
            actual_fuel_used=0.0,
            fuel_delta=0.0,
            status="stationary",
            message="El vehiculo no muestra movimiento suficiente para validar consumo.",
            validated_at=validated_at,
        )

    expected_fuel_used = round(distance_km * gallons_per_km, 4)
    actual_fuel_used = compute_actual_fuel_used(
        previous_telemetry=previous_telemetry,
        current_fuel_level=current_fuel_level,
        current_volume=current_volume,
    )
    if actual_fuel_used is None:
        return ConsumptionValidationResult(
            distance_km=distance_km,
            expected_fuel_used=expected_fuel_used,
            actual_fuel_used=None,
            fuel_delta=None,
            status="missing_fuel_data",
            message="No hay datos de combustible suficientes para validar el gasto real.",
            validated_at=validated_at,
        )

    fuel_delta = round(actual_fuel_used - expected_fuel_used, 4)
    if actual_fuel_used < 0:
        return ConsumptionValidationResult(
            distance_km=distance_km,
            expected_fuel_used=expected_fuel_used,
            actual_fuel_used=actual_fuel_used,
            fuel_delta=fuel_delta,
            status="refuel_detected",
            message="Se detecto aumento de combustible; posible recarga o lectura fuera de secuencia.",
            validated_at=validated_at,
        )

    tolerance = max(
        DEFAULT_TOLERANCE_ABSOLUTE_GAL,
        expected_fuel_used * DEFAULT_TOLERANCE_PERCENT,
    )
    status = "coherent" if abs(fuel_delta) <= tolerance else "incoherent"
    message = (
        "El consumo reportado es coherente con la distancia recorrida."
        if status == "coherent"
        else "El combustible gastado difiere de lo esperado para la distancia recorrida."
    )
    return ConsumptionValidationResult(
        distance_km=round(distance_km, 4),
        expected_fuel_used=expected_fuel_used,
        actual_fuel_used=round(actual_fuel_used, 4),
        fuel_delta=fuel_delta,
        status=status,
        message=message,
        validated_at=validated_at,
    )


def parse_gallons_per_kilometer(raw_value: str | None) -> float | None:
    if raw_value is None:
        return None

    normalized = raw_value.strip().lower().replace(" ", "")
    if not normalized:
        return None

    match = re.search(r"(\d+(?:[.,]\d+)?)", normalized)
    if not match:
        return None

    numeric_value = float(match.group(1).replace(",", "."))
    if numeric_value <= 0:
        return None

    if "km/gal" in normalized or "kmgal" in normalized:
        return 1 / numeric_value
    if "gal/km" in normalized or "galkm" in normalized:
        return numeric_value
    if "/" not in normalized:
        return numeric_value
    return None


def haversine_km(
    lat1: float | None,
    lon1: float | None,
    lat2: float | None,
    lon2: float | None,
) -> float | None:
    if None in {lat1, lon1, lat2, lon2}:
        return None

    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)

    delta_lat = lat2_rad - lat1_rad
    delta_lon = lon2_rad - lon1_rad
    a = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_KM * c


def is_vehicle_moving(
    *,
    movement: bool | None,
    current_speed: float | None,
    previous_speed: float | None,
    distance_km: float,
) -> bool:
    if movement is True:
        return True
    if current_speed is not None and current_speed >= MOVING_SPEED_THRESHOLD_KMH:
        return True
    if previous_speed is not None and previous_speed >= MOVING_SPEED_THRESHOLD_KMH:
        return True
    return distance_km >= MIN_DISTANCE_KM


def compute_actual_fuel_used(
    *,
    previous_telemetry: VehicleTelemetry,
    current_fuel_level: float | None,
    current_volume: float | None,
) -> float | None:
    if current_volume is not None and previous_telemetry.volume is not None:
        return previous_telemetry.volume - current_volume
    if current_fuel_level is not None and previous_telemetry.fuelLevel is not None:
        return previous_telemetry.fuelLevel - current_fuel_level
    return None
