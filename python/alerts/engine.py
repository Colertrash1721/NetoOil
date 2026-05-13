from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from alerts.service import create_alert_if_needed

if TYPE_CHECKING:
    from fuel_management.models import (
        AlertThreshold,
        Dispenser,
        InstitutionalTank,
        RefuelingTransaction,
        TankTelemetry,
    )
    from vehicles.models import Vehicle, VehicleTelemetry


def _thresholds_for(
    db: Session,
    *,
    company_id: int | None,
    scope: str,
    entity_id: int | None,
    metrics: set[str],
) -> list[AlertThreshold]:
    from fuel_management.models import AlertThreshold

    query = db.query(AlertThreshold).filter(AlertThreshold.enabled.is_(True))
    if company_id is not None:
        query = query.filter(
            (AlertThreshold.assignedCompanyId == company_id)
            | (AlertThreshold.assignedCompanyId.is_(None))
        )
    thresholds = []
    for item in query.all():
        if item.metric not in metrics:
            continue
        if item.scope not in {"global", "company", scope}:
            continue
        if item.scope == scope and item.entityId not in {None, entity_id}:
            continue
        thresholds.append(item)
    return thresholds


def _check_range(value: float | None, threshold: AlertThreshold) -> tuple[bool, str | None]:
    if value is None:
        return False, None
    if threshold.minValue is not None and value < threshold.minValue:
        return True, f"{value} esta por debajo del minimo {threshold.minValue}"
    if threshold.maxValue is not None and value > threshold.maxValue:
        return True, f"{value} esta por encima del maximo {threshold.maxValue}"
    return False, None


def evaluate_vehicle_telemetry_alerts(
    db: Session,
    *,
    vehicle: Vehicle,
    telemetry: VehicleTelemetry,
    previous_telemetry: VehicleTelemetry | None = None,
) -> None:
    thresholds = _thresholds_for(
        db,
        company_id=vehicle.assignedCompanyId,
        scope="vehicle",
        entity_id=vehicle.id,
        metrics={
            "vehicle_fuel_level",
            "vehicle_fuel_drop",
            "vehicle_fuel_drop_percent",
            "vehicle_temperature",
            "fuel_drop_percent",
        },
    )
    values = {
        "vehicle_fuel_level": telemetry.fuelLevel,
        "vehicle_temperature": telemetry.temperature,
    }

    for threshold in thresholds:
        if threshold.metric in values:
            triggered, reason = _check_range(values[threshold.metric], threshold)
            if triggered:
                create_alert_if_needed(
                    db,
                    vehicle=vehicle,
                    sensor_identifier=vehicle.sensorIdentifier,
                    alert_type=f"{threshold.metric}_threshold",
                    severity="medium",
                    title="Umbral de vehiculo excedido",
                    message=reason or "Umbral configurado excedido.",
                    recorded_at=telemetry.recordedAt,
                    metadata={"thresholdId": threshold.id, "metric": threshold.metric},
                    company_id=vehicle.assignedCompanyId,
                    notification_email=threshold.notificationEmail,
                )

        if threshold.metric in {"vehicle_fuel_drop", "vehicle_fuel_drop_percent", "fuel_drop_percent"} and threshold.variationLimit is not None:
            previous_level = previous_telemetry.fuelLevel if previous_telemetry else None
            if previous_level is None or telemetry.fuelLevel is None:
                continue
            drop = previous_level - telemetry.fuelLevel
            if drop >= threshold.variationLimit:
                create_alert_if_needed(
                    db,
                    vehicle=vehicle,
                    sensor_identifier=vehicle.sensorIdentifier,
                    alert_type="fuel_leak",
                    severity="high",
                    title="Posible robo de combustible",
                    message=(
                        f"Caida de combustible de {round(drop, 2)} entre mediciones; "
                        f"limite configurado {threshold.variationLimit}."
                    ),
                    recorded_at=telemetry.recordedAt,
                    metadata={
                        "thresholdId": threshold.id,
                        "previousFuelLevel": previous_level,
                        "currentFuelLevel": telemetry.fuelLevel,
                        "drop": round(drop, 4),
                    },
                    company_id=vehicle.assignedCompanyId,
                    notification_email=threshold.notificationEmail,
                )

    if telemetry.fuelValidationStatus == "incoherent" and (telemetry.fuelDelta or 0) > 0:
        create_alert_if_needed(
            db,
            vehicle=vehicle,
            sensor_identifier=vehicle.sensorIdentifier,
            alert_type="fuel_leak",
            severity="high",
            title="Posible fuga o robo de combustible",
            message=telemetry.fuelValidationMessage or "Consumo incoherente detectado.",
            recorded_at=telemetry.recordedAt,
            metadata={
                "distanceKm": telemetry.distanceKm,
                "expectedFuelUsed": telemetry.expectedFuelUsed,
                "actualFuelUsed": telemetry.actualFuelUsed,
                "fuelDelta": telemetry.fuelDelta,
            },
            company_id=vehicle.assignedCompanyId,
        )


def evaluate_tank_telemetry_alerts(
    db: Session,
    *,
    tank: InstitutionalTank,
    telemetry: TankTelemetry,
) -> None:
    thresholds = _thresholds_for(
        db,
        company_id=tank.assignedCompanyId,
        scope="tank",
        entity_id=tank.id,
        metrics={"tank_level", "tank_level_percent", "tank_temperature", "tank_density", "tank_variation"},
    )
    values = {
        "tank_level": telemetry.levelPercent,
        "tank_level_percent": telemetry.levelPercent,
        "tank_temperature": telemetry.temperature,
        "tank_density": telemetry.density,
    }

    for threshold in thresholds:
        if threshold.metric in values:
            triggered, reason = _check_range(values[threshold.metric], threshold)
            if triggered:
                create_alert_if_needed(
                    db,
                    sensor_identifier=tank.sensorIdentifier,
                    alert_type=f"{threshold.metric}_threshold",
                    severity="medium",
                    title="Umbral de tanque excedido",
                    message=reason or "Umbral configurado excedido.",
                    recorded_at=telemetry.recordedAt,
                    metadata={"thresholdId": threshold.id, "metric": threshold.metric},
                    entity_type="tank",
                    entity_id=tank.id,
                    company_id=tank.assignedCompanyId,
                    notification_email=threshold.notificationEmail,
                )

        variation = telemetry.variation
        if threshold.metric == "tank_variation" and threshold.variationLimit is not None and variation is not None:
            if abs(variation) >= threshold.variationLimit:
                alert_kind = "tank_drain" if variation < 0 else "tank_fill"
                create_alert_if_needed(
                    db,
                    sensor_identifier=tank.sensorIdentifier,
                    alert_type=alert_kind,
                    severity="high" if variation < 0 else "medium",
                    title="Variacion brusca en tanque",
                    message=(
                        f"Variacion de {round(variation, 2)} en tanque; "
                        f"limite configurado {threshold.variationLimit}."
                    ),
                    recorded_at=telemetry.recordedAt,
                    metadata={"thresholdId": threshold.id, "variation": variation},
                    entity_type="tank",
                    entity_id=tank.id,
                    company_id=tank.assignedCompanyId,
                    notification_email=threshold.notificationEmail,
                )


def evaluate_transaction_alerts(
    db: Session,
    *,
    transaction: RefuelingTransaction,
    vehicle: Vehicle,
    dispenser: Dispenser,
    tank: InstitutionalTank,
) -> None:
    thresholds = _thresholds_for(
        db,
        company_id=vehicle.assignedCompanyId,
        scope="dispenser",
        entity_id=dispenser.id,
        metrics={"dispensed_volume", "transaction_volume"},
    )
    recorded_at = transaction.completedAt or transaction.startedAt or datetime.utcnow()
    for threshold in thresholds:
        triggered, reason = _check_range(transaction.dispensedVolume, threshold)
        if triggered:
            create_alert_if_needed(
                db,
                vehicle=vehicle,
                sensor_identifier=dispenser.deviceIdentifier,
                alert_type="transaction_threshold",
                severity="medium",
                title="Umbral de despacho excedido",
                message=reason or "Volumen de despacho fuera del umbral configurado.",
                recorded_at=recorded_at,
                metadata={
                    "thresholdId": threshold.id,
                    "transactionId": transaction.id,
                    "dispenserId": dispenser.id,
                    "tankId": tank.id,
                },
                entity_type="transaction",
                entity_id=transaction.id,
                company_id=vehicle.assignedCompanyId,
                notification_email=threshold.notificationEmail,
            )
