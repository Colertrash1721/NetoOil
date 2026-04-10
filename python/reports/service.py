from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from alerts.models import AlertEvent
from auth.security import AuthContext
from reports.pdf_utils import build_simple_pdf
from vehicles.models import Vehicle, VehicleTelemetry


def _get_vehicle_for_auth(db: Session, auth: AuthContext, vehicle_id: int) -> Vehicle:
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    if auth.role in {"company", "client"} and auth.company_id != vehicle.assignedCompanyId:
        raise HTTPException(status_code=403, detail="Insufficient permissions.")
    return vehicle


def build_vehicle_history_report(db: Session, auth: AuthContext, vehicle_id: int) -> dict:
    vehicle = _get_vehicle_for_auth(db, auth, vehicle_id)

    telemetry_history = (
        db.query(VehicleTelemetry)
        .filter(VehicleTelemetry.vehicleId == vehicle.id)
        .order_by(VehicleTelemetry.recordedAt.desc())
        .all()
    )
    alerts = (
        db.query(AlertEvent)
        .filter(AlertEvent.vehicleId == vehicle.id)
        .order_by(AlertEvent.recordedAt.desc())
        .all()
    )

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


def export_vehicle_history_pdf(db: Session, auth: AuthContext, vehicle_id: int) -> tuple[str, bytes]:
    report = build_vehicle_history_report(db, auth, vehicle_id)
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

