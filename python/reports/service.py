from datetime import datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from alerts.models import AlertEvent
from auth.security import AuthContext
from fuel_management.models import InstitutionalTank, RefuelingTransaction
from reports.pdf_utils import build_simple_pdf
from vehicles.models import Vehicle, VehicleTelemetry


def _get_vehicle_for_auth(db: Session, auth: AuthContext, vehicle_id: int) -> Vehicle:
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    if auth.role in {"company", "admin", "user"} and auth.company_id != vehicle.assignedCompanyId:
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    return vehicle


def _resolve_period(
    start: datetime | None,
    end: datetime | None,
    period: str | None,
) -> tuple[datetime | None, datetime | None]:
    now = datetime.utcnow()
    if start or end:
        return start, end
    if period == "day":
        return now - timedelta(days=1), now
    if period == "week":
        return now - timedelta(days=7), now
    if period == "month":
        return now - timedelta(days=30), now
    return None, None


def _apply_date_filter(query, column, start: datetime | None, end: datetime | None):
    if start is not None:
        query = query.filter(column >= start)
    if end is not None:
        query = query.filter(column <= end)
    return query


def build_vehicle_history_report(
    db: Session,
    auth: AuthContext,
    vehicle_id: int,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    period: str | None = None,
) -> dict:
    vehicle = _get_vehicle_for_auth(db, auth, vehicle_id)
    start, end = _resolve_period(start, end, period)

    telemetry_query = db.query(VehicleTelemetry).filter(VehicleTelemetry.vehicleId == vehicle.id)
    telemetry_query = _apply_date_filter(telemetry_query, VehicleTelemetry.recordedAt, start, end)
    telemetry_history = telemetry_query.order_by(VehicleTelemetry.recordedAt.desc()).all()

    alerts_query = db.query(AlertEvent).filter(AlertEvent.vehicleId == vehicle.id)
    alerts_query = _apply_date_filter(alerts_query, AlertEvent.recordedAt, start, end)
    alerts = alerts_query.order_by(AlertEvent.recordedAt.desc()).all()

    total_distance = round(
        sum(item.distanceKm or 0 for item in telemetry_history if item.distanceKm is not None),
        4,
    )
    total_expected = round(
        sum(
            item.expectedFuelUsed or 0
            for item in telemetry_history
            if item.expectedFuelUsed is not None
        ),
        4,
    )
    total_actual = round(
        sum(item.actualFuelUsed or 0 for item in telemetry_history if item.actualFuelUsed and item.actualFuelUsed > 0),
        4,
    )
    coherent_events = sum(1 for item in telemetry_history if item.fuelValidationStatus == "coherent")
    incoherent_events = sum(1 for item in telemetry_history if item.fuelValidationStatus == "incoherent")
    refuels = [alert for alert in alerts if alert.alertType == "refuel"]
    thefts = [alert for alert in alerts if alert.alertType == "fuel_leak"]

    return {
        "vehicle": {
            "id": vehicle.id,
            "plate": vehicle.plate,
            "brand": vehicle.brand,
            "model": vehicle.model,
            "assignedCompanyId": vehicle.assignedCompanyId,
        },
        "generatedAt": datetime.utcnow(),
        "filters": {"start": start, "end": end, "period": period},
        "summary": {
            "totalDistanceKm": total_distance,
            "expectedFuelUsed": total_expected,
            "actualFuelUsed": total_actual,
            "coherentEvents": coherent_events,
            "incoherentEvents": incoherent_events,
            "fuelLeakAlerts": len(thefts),
            "refuelAlerts": len(refuels),
            "stoppedAlerts": sum(1 for alert in alerts if alert.alertType == "device_stopped"),
        },
        "consumptionHistory": [
            {
                "recordedAt": item.recordedAt,
                "distanceKm": item.distanceKm,
                "expectedFuelUsed": item.expectedFuelUsed,
                "actualFuelUsed": item.actualFuelUsed,
                "fuelDelta": item.fuelDelta,
                "fuelValidationStatus": item.fuelValidationStatus,
                "fuelValidationMessage": item.fuelValidationMessage,
            }
            for item in telemetry_history
        ],
        "theftHistory": [
            {
                "recordedAt": alert.recordedAt,
                "severity": alert.severity,
                "message": alert.message,
                "status": alert.status,
            }
            for alert in thefts
        ],
        "refuelHistory": [
            {
                "recordedAt": alert.recordedAt,
                "severity": alert.severity,
                "message": alert.message,
                "status": alert.status,
            }
            for alert in refuels
        ],
    }


def build_fuel_history_report(
    db: Session,
    auth: AuthContext,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    period: str | None = None,
) -> dict:
    start, end = _resolve_period(start, end, period)
    vehicle_query = db.query(Vehicle)
    tank_query = db.query(InstitutionalTank)
    transaction_query = db.query(RefuelingTransaction).join(Vehicle, RefuelingTransaction.vehicleId == Vehicle.id)
    alert_query = db.query(AlertEvent).outerjoin(Vehicle, Vehicle.id == AlertEvent.vehicleId)

    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        vehicle_query = vehicle_query.filter(Vehicle.assignedCompanyId == auth.company_id)
        tank_query = tank_query.filter(InstitutionalTank.assignedCompanyId == auth.company_id)
        transaction_query = transaction_query.filter(Vehicle.assignedCompanyId == auth.company_id)
        alert_query = alert_query.filter(
            (Vehicle.assignedCompanyId == auth.company_id)
            | (AlertEvent.assignedCompanyId == auth.company_id)
        )

    transaction_query = _apply_date_filter(transaction_query, RefuelingTransaction.startedAt, start, end)
    alert_query = _apply_date_filter(alert_query, AlertEvent.recordedAt, start, end)

    transactions = transaction_query.order_by(RefuelingTransaction.startedAt.desc()).all()
    alerts = alert_query.order_by(AlertEvent.recordedAt.desc()).all()
    tanks = tank_query.order_by(InstitutionalTank.code.asc()).all()

    total_tank_volume = round(sum(tank.currentVolume or 0 for tank in tanks), 4)
    total_capacity = round(sum(tank.capacity or 0 for tank in tanks), 4)
    total_dispensed = round(sum(item.dispensedVolume or 0 for item in transactions), 4)

    return {
        "generatedAt": datetime.utcnow(),
        "filters": {"start": start, "end": end, "period": period},
        "summary": {
            "vehicles": vehicle_query.count(),
            "tanks": len(tanks),
            "transactions": len(transactions),
            "totalStoredFuel": total_tank_volume,
            "totalCapacity": total_capacity,
            "storagePercent": round((total_tank_volume / total_capacity) * 100, 2) if total_capacity else 0,
            "totalDispensed": total_dispensed,
            "openAlerts": sum(1 for alert in alerts if alert.status == "open"),
        },
        "tanks": [
            {
                "id": tank.id,
                "code": tank.code,
                "name": tank.name,
                "fuelType": tank.fuelType,
                "currentVolume": tank.currentVolume,
                "capacity": tank.capacity,
                "temperature": tank.temperature,
                "density": tank.density,
                "status": tank.status,
                "lastUpdate": tank.lastUpdate,
            }
            for tank in tanks
        ],
        "transactions": [
            {
                "id": item.id,
                "transactionCode": item.transactionCode,
                "vehicleId": item.vehicleId,
                "driverId": item.driverId,
                "dispenserId": item.dispenserId,
                "tankId": item.tankId,
                "dispensedVolume": item.dispensedVolume,
                "status": item.status,
                "startedAt": item.startedAt,
                "completedAt": item.completedAt,
            }
            for item in transactions
        ],
        "alerts": [
            {
                "id": alert.id,
                "entityType": alert.entityType,
                "entityId": alert.entityId,
                "alertType": alert.alertType,
                "severity": alert.severity,
                "title": alert.title,
                "status": alert.status,
                "recordedAt": alert.recordedAt,
            }
            for alert in alerts
        ],
    }


def build_advanced_kpis(
    db: Session,
    auth: AuthContext,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    period: str | None = None,
) -> dict:
    start, end = _resolve_period(start, end, period)
    telemetry_query = db.query(VehicleTelemetry).join(Vehicle, VehicleTelemetry.vehicleId == Vehicle.id)
    transaction_query = db.query(RefuelingTransaction).join(Vehicle, RefuelingTransaction.vehicleId == Vehicle.id)
    alert_query = db.query(AlertEvent).outerjoin(Vehicle, Vehicle.id == AlertEvent.vehicleId)

    if auth.role in {"company", "admin", "user"} and auth.company_id is not None:
        telemetry_query = telemetry_query.filter(Vehicle.assignedCompanyId == auth.company_id)
        transaction_query = transaction_query.filter(Vehicle.assignedCompanyId == auth.company_id)
        alert_query = alert_query.filter(
            (Vehicle.assignedCompanyId == auth.company_id)
            | (AlertEvent.assignedCompanyId == auth.company_id)
        )

    telemetry_query = _apply_date_filter(telemetry_query, VehicleTelemetry.recordedAt, start, end)
    transaction_query = _apply_date_filter(transaction_query, RefuelingTransaction.startedAt, start, end)
    alert_query = _apply_date_filter(alert_query, AlertEvent.recordedAt, start, end)

    telemetry = telemetry_query.all()
    transactions = transaction_query.all()
    alerts = alert_query.all()

    total_distance = sum(item.distanceKm or 0 for item in telemetry)
    total_actual = sum(item.actualFuelUsed or 0 for item in telemetry if (item.actualFuelUsed or 0) > 0)
    total_expected = sum(item.expectedFuelUsed or 0 for item in telemetry)
    total_dispensed = sum(item.dispensedVolume or 0 for item in transactions)
    valid_transactions = sum(1 for item in transactions if item.status in {"completed", "authorized"})
    resolved_alert_minutes = [
        (alert.resolvedAt - alert.createdAt).total_seconds() / 60
        for alert in alerts
        if alert.resolvedAt is not None and alert.createdAt is not None
    ]
    abrupt_alerts = [
        alert
        for alert in alerts
        if alert.alertType in {"fuel_leak", "tank_drain", "tank_fill", "tank_variation_threshold"}
    ]
    days = max(((end or datetime.utcnow()) - (start or datetime.utcnow() - timedelta(days=30))).days, 1)
    daily_average = total_actual / days if days else 0

    per_vehicle = (
        telemetry_query.with_entities(
            Vehicle.id,
            Vehicle.plate,
            func.sum(VehicleTelemetry.distanceKm),
            func.sum(VehicleTelemetry.actualFuelUsed),
            func.sum(VehicleTelemetry.expectedFuelUsed),
        )
        .group_by(Vehicle.id, Vehicle.plate)
        .all()
    )
    by_tank = (
        transaction_query.with_entities(
            RefuelingTransaction.tankId,
            func.sum(RefuelingTransaction.dispensedVolume),
            func.count(RefuelingTransaction.id),
        )
        .group_by(RefuelingTransaction.tankId)
        .all()
    )

    return {
        "generatedAt": datetime.utcnow(),
        "filters": {"start": start, "end": end, "period": period},
        "kpis": {
            "consumptionPerKm": round(total_actual / total_distance, 4) if total_distance else 0,
            "totalDistanceKm": round(total_distance, 4),
            "totalActualFuelUsed": round(total_actual, 4),
            "totalExpectedFuelUsed": round(total_expected, 4),
            "totalDispensed": round(total_dispensed, 4),
            "unreconciledFuelPercent": (
                round((abs(total_dispensed - total_actual) / total_dispensed) * 100, 2)
                if total_dispensed
                else 0
            ),
            "alarmResponseAvgMinutes": (
                round(sum(resolved_alert_minutes) / len(resolved_alert_minutes), 2)
                if resolved_alert_minutes
                else 0
            ),
            "validTransactionsPercent": (
                round((valid_transactions / len(transactions)) * 100, 2)
                if transactions
                else 0
            ),
            "abruptVariations": len(abrupt_alerts),
            "forecastNext7Days": round(daily_average * 7, 4),
        },
        "efficiencyByUnit": [
            {
                "vehicleId": row[0],
                "plate": row[1],
                "distanceKm": round(row[2] or 0, 4),
                "actualFuelUsed": round(row[3] or 0, 4),
                "expectedFuelUsed": round(row[4] or 0, 4),
                "consumptionPerKm": round((row[3] or 0) / row[2], 4) if row[2] else 0,
            }
            for row in per_vehicle
        ],
        "volumeDispensedByTank": [
            {
                "tankId": row[0],
                "dispensedVolume": round(row[1] or 0, 4),
                "transactions": row[2],
            }
            for row in by_tank
        ],
    }


def export_vehicle_history_pdf(
    db: Session,
    auth: AuthContext,
    vehicle_id: int,
    *,
    start: datetime | None = None,
    end: datetime | None = None,
    period: str | None = None,
) -> tuple[str, bytes]:
    report = build_vehicle_history_report(db, auth, vehicle_id, start=start, end=end, period=period)
    vehicle = report["vehicle"]
    summary = report["summary"]
    lines = [
        f"Vehiculo: {vehicle['plate']} {vehicle['brand']} {vehicle['model']}",
        f"Distancia total: {summary['totalDistanceKm']} km",
        f"Consumo esperado: {summary['expectedFuelUsed']} gal",
        f"Consumo real: {summary['actualFuelUsed']} gal",
        f"Eventos coherentes: {summary['coherentEvents']}",
        f"Eventos incoherentes: {summary['incoherentEvents']}",
        f"Alertas de fuga/robo: {summary['fuelLeakAlerts']}",
        f"Alertas de recarga: {summary['refuelAlerts']}",
        f"Alertas por inmovilidad: {summary['stoppedAlerts']}",
        "",
        "Ultimos eventos de consumo:",
    ]

    for item in report["consumptionHistory"][:20]:
        lines.append(
            f"{item['recordedAt']}: dist={item['distanceKm']}km "
            f"esp={item['expectedFuelUsed']} real={item['actualFuelUsed']} "
            f"estado={item['fuelValidationStatus']}"
        )

    pdf_bytes = build_simple_pdf(
        f"Reporte historico {vehicle['plate']}",
        lines,
    )
    filename = f"vehicle-report-{vehicle['plate']}.pdf"
    return filename, pdf_bytes
