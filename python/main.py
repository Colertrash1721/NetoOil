# main.py
import asyncio
from contextlib import asynccontextmanager
from datetime import date, datetime, timedelta
import logging

from fastapi import FastAPI, APIRouter, Request, WebSocket, WebSocketDisconnect # type: ignore
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from admins.models import Admin
from alerts.models import AlertEvent
from alerts.routes import router as alerts_router
from auth import router as auth_router
from auth.security import AuthContext, LEGACY_COOKIE_NAMES, hash_password, verify_token
from companies.models import Company
from fuel_management import router as fuel_management_router
from fuel_management.models import (
    AlertThreshold,
    Dispenser,
    Driver,
    FuelPolicy,
    FuelReceipt,
    InstitutionalTank,
    RefuelingTransaction,
    TankTelemetry,
)
from users import router as users_router  # this comes from users.py
from companies import router as company_router
from db.database import Base, SessionLocal, engine
from mqtt_listener import MqttIngestService
from realtime import manager as realtime_manager, set_realtime_loop
from reports.routes import router as reports_router
from sensor_data.models import SensorMqttMessage
from users.models import User
from vehicles import router as vehicles_router
from vehicles.models import Vehicle, VehicleTelemetry

logger = logging.getLogger(__name__)
mqtt_ingest_service = MqttIngestService()


def ensure_database_schema() -> None:
    Base.metadata.create_all(bind=engine)
    inspector = inspect(engine)

    if not inspector.has_table("companies"):
        return

    existing_columns = {column["name"] for column in inspector.get_columns("companies")}
    statements = []

    if "username" not in existing_columns:
        statements.append("ALTER TABLE companies ADD COLUMN username VARCHAR(100) NULL")
        statements.append("CREATE UNIQUE INDEX ix_companies_username ON companies (username)")
    if "hashed_password" not in existing_columns:
        statements.append("ALTER TABLE companies ADD COLUMN hashed_password VARCHAR(255) NULL")
    if "isOnline" not in existing_columns:
        statements.append("ALTER TABLE companies ADD COLUMN isOnline BOOLEAN NOT NULL DEFAULT FALSE")
    if "lastConnection" not in existing_columns:
        statements.append("ALTER TABLE companies ADD COLUMN lastConnection DATE NULL")

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

    if inspector.has_table("users"):
        user_columns = {column["name"] for column in inspector.get_columns("users")}
        user_statements = []

        if "status" not in user_columns:
            user_statements.append("ALTER TABLE users ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'pending'")
        if "companyId" not in user_columns:
            user_statements.append("ALTER TABLE users ADD COLUMN companyId INTEGER NULL")
        if "companyRole" not in user_columns:
            user_statements.append("ALTER TABLE users ADD COLUMN companyRole VARCHAR(50) NOT NULL DEFAULT 'viewer'")

        with engine.begin() as connection:
            for statement in user_statements:
                connection.execute(text(statement))

    if not inspector.has_table("vehicles"):
        return

    vehicle_columns = {column["name"] for column in inspector.get_columns("vehicles")}
    vehicle_statements = []

    if "version" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN version VARCHAR(100) NULL")
    if "vin" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN vin VARCHAR(100) NULL")
    if "seatCount" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN seatCount INTEGER NULL")
    if "engineType" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN engineType VARCHAR(100) NULL")
    if "engineDisplacement" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN engineDisplacement VARCHAR(100) NULL")
    if "engineCylinderCount" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN engineCylinderCount INTEGER NULL")
    if "maxPower" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN maxPower VARCHAR(100) NULL")
    if "maxTorque" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN maxTorque VARCHAR(100) NULL")
    if "fuelConsumption" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN fuelConsumption VARCHAR(100) NULL")
    if "tankCapacity" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN tankCapacity VARCHAR(100) NULL")
    if "transmission" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN transmission VARCHAR(100) NULL")
    if "deviceIsStopped" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN deviceIsStopped BOOLEAN NOT NULL DEFAULT FALSE")
    if "stopStartedAt" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN stopStartedAt DATETIME NULL")
    if "lastMovementAt" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN lastMovementAt DATETIME NULL")
    if "assignedDriverId" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN assignedDriverId INTEGER NULL")

    with engine.begin() as connection:
        for statement in vehicle_statements:
            connection.execute(text(statement))

    if not inspector.has_table("vehicle_telemetry"):
        return

    telemetry_columns = {column["name"] for column in inspector.get_columns("vehicle_telemetry")}
    telemetry_statements = []

    if "distanceKm" not in telemetry_columns:
        telemetry_statements.append("ALTER TABLE vehicle_telemetry ADD COLUMN distanceKm FLOAT NULL")
    if "expectedFuelUsed" not in telemetry_columns:
        telemetry_statements.append("ALTER TABLE vehicle_telemetry ADD COLUMN expectedFuelUsed FLOAT NULL")
    if "actualFuelUsed" not in telemetry_columns:
        telemetry_statements.append("ALTER TABLE vehicle_telemetry ADD COLUMN actualFuelUsed FLOAT NULL")
    if "fuelDelta" not in telemetry_columns:
        telemetry_statements.append("ALTER TABLE vehicle_telemetry ADD COLUMN fuelDelta FLOAT NULL")
    if "fuelValidationStatus" not in telemetry_columns:
        telemetry_statements.append("ALTER TABLE vehicle_telemetry ADD COLUMN fuelValidationStatus VARCHAR(50) NULL")
    if "fuelValidationMessage" not in telemetry_columns:
        telemetry_statements.append("ALTER TABLE vehicle_telemetry ADD COLUMN fuelValidationMessage VARCHAR(255) NULL")
    if "fuelValidationAt" not in telemetry_columns:
        telemetry_statements.append("ALTER TABLE vehicle_telemetry ADD COLUMN fuelValidationAt DATETIME NULL")

    with engine.begin() as connection:
        for statement in telemetry_statements:
            connection.execute(text(statement))

    if inspector.has_table("alert_events"):
        alert_columns = {column["name"] for column in inspector.get_columns("alert_events")}
        alert_statements = []
        if "entityType" not in alert_columns:
            alert_statements.append("ALTER TABLE alert_events ADD COLUMN entityType VARCHAR(40) NOT NULL DEFAULT 'vehicle'")
        if "entityId" not in alert_columns:
            alert_statements.append("ALTER TABLE alert_events ADD COLUMN entityId INTEGER NULL")
        if "assignedCompanyId" not in alert_columns:
            alert_statements.append("ALTER TABLE alert_events ADD COLUMN assignedCompanyId INTEGER NULL")
        alert_statements.append("UPDATE alert_events SET entityId = vehicleId WHERE entityId IS NULL")
        alert_statements.append("ALTER TABLE alert_events MODIFY COLUMN vehicleId INTEGER NULL")

        with engine.begin() as connection:
            for statement in alert_statements:
                try:
                    connection.execute(text(statement))
                except Exception:
                    logger.debug("Schema statement skipped: %s", statement, exc_info=True)


def seed_default_admin() -> None:
    db = SessionLocal()
    try:
        admin = db.query(Admin).filter(Admin.username == "admin").first()
        if admin:
            return

        db.add(
            Admin(
                username="admin",
                email="admin@netooil.local",
                hashed_password=hash_password("admin"),
                isOnline=False,
                creationDate=date.today(),
                lastConnection=None,
            )
        )
        db.commit()
    finally:
        db.close()


def seed_default_company() -> None:
    db = SessionLocal()
    try:
        company = (
            db.query(Company)
            .filter((Company.username == "usuario") | (Company.name == "usuario"))
            .first()
        )
        if company:
            return

        db.add(
            Company(
                name="usuario",
                address="Cliente de prueba",
                phone="",
                email="usuario@netooil.local",
                username="usuario",
                hashed_password=hash_password("usuario"),
                isOnline=False,
                creationDate=date.today(),
                lastConnection=None,
                rnc="00000000001",
            )
        )
        db.commit()
    finally:
        db.close()


def seed_demo_data() -> None:
    db = SessionLocal()
    try:
        company = (
            db.query(Company)
            .filter((Company.username == "usuario") | (Company.name == "usuario"))
            .first()
        )
        if not company:
            return

        brands = ["Hyundai", "Isuzu", "Toyota", "Mercedes-Benz", "Mitsubishi"]
        models = ["HD65", "NPR", "Coaster", "Sprinter", "Rosa"]
        now = datetime.utcnow()

        for index in range(1, 51):
            plate = f"NF-{index:03d}"
            vehicle = db.query(Vehicle).filter(Vehicle.plate == plate).first()
            if not vehicle:
                vehicle = Vehicle(
                    plate=plate,
                    brand=brands[index % len(brands)],
                    model=models[index % len(models)],
                    year=2020 + (index % 5),
                    vin=f"NETOFUELDEMO{index:05d}",
                    color=["Blanco", "Azul", "Gris", "Rojo"][index % 4],
                    seatCount=2 + (index % 28),
                    engineType="Diesel",
                    fuelConsumption=f"{7.5 + (index % 6) * 0.4:.1f} L/100km",
                    tankCapacity=str(90 + (index % 6) * 15),
                    sensorIdentifier=f"VEH-DEMO-{index:03d}",
                    status="active" if index % 9 else "alert",
                    assignedCompanyId=company.id,
                    lastTemperature=30 + (index % 8),
                    lastInclination=round((index % 5) * 0.7, 2),
                    lastVolume=45 + (index % 40),
                    lastLatitude=18.4861 + (index % 10) * 0.01,
                    lastLongitude=-69.9312 - (index % 10) * 0.01,
                    lastSpeed=20 + (index % 65),
                    lastFuelLevel=35 + (index % 60),
                    lastPressure=28 + (index % 7),
                    lastHumidity=40 + (index % 20),
                    lastBatteryLevel=65 + (index % 35),
                    lastAlarm=index % 9 == 0,
                    lastUpdate=now - timedelta(minutes=index * 3),
                )
                db.add(vehicle)
                db.flush()

            if db.query(VehicleTelemetry).filter(VehicleTelemetry.vehicleId == vehicle.id).count() < 3:
                for offset in range(3):
                    fuel_level = max((vehicle.lastFuelLevel or 70) - (2 - offset) * 3, 5)
                    db.add(
                        VehicleTelemetry(
                            vehicleId=vehicle.id,
                            temperature=(vehicle.lastTemperature or 30) + offset,
                            inclination=vehicle.lastInclination,
                            volume=(vehicle.lastVolume or 50) - (2 - offset),
                            latitude=vehicle.lastLatitude,
                            longitude=vehicle.lastLongitude,
                            speed=max((vehicle.lastSpeed or 0) - offset * 4, 0),
                            fuelLevel=fuel_level,
                            pressure=vehicle.lastPressure,
                            humidity=vehicle.lastHumidity,
                            batteryLevel=vehicle.lastBatteryLevel,
                            alarm=vehicle.lastAlarm,
                            distanceKm=12 + offset * 4,
                            expectedFuelUsed=2.5 + offset,
                            actualFuelUsed=2.8 + offset,
                            fuelDelta=0.3,
                            fuelValidationStatus="ok",
                            fuelValidationMessage="Lectura demo conciliada",
                            fuelValidationAt=now - timedelta(minutes=offset * 30),
                            recordedAt=now - timedelta(hours=2 - offset, minutes=index),
                        )
                    )

            document_id = f"DRV-DEMO-{index:03d}"
            if not db.query(Driver).filter(Driver.documentId == document_id).first():
                db.add(
                    Driver(
                        fullName=f"Chofer Demo {index:02d}",
                        documentId=document_id,
                        licenseNumber=f"LIC-{index:05d}",
                        phone=f"809-555-{index:04d}",
                        status="active",
                        assignedCompanyId=company.id,
                    )
                )

        db.flush()

        for index in range(1, 11):
            code = f"TNK-{index:02d}"
            tank = db.query(InstitutionalTank).filter(InstitutionalTank.code == code).first()
            if not tank:
                capacity = 18000 + index * 1500
                current_volume = capacity * (0.52 + (index % 4) * 0.08)
                tank = InstitutionalTank(
                    code=code,
                    name=f"Tanque Institucional {index:02d}",
                    location=f"Patio operativo {index:02d}",
                    fuelType="diesel",
                    capacity=capacity,
                    currentVolume=round(current_volume, 2),
                    temperature=27 + index % 5,
                    density=0.82 + (index % 3) * 0.01,
                    status="operational",
                    sensorIdentifier=f"TANK-SENSOR-{index:02d}",
                    assignedCompanyId=company.id,
                    lastUpdate=now - timedelta(minutes=index * 5),
                )
                db.add(tank)
                db.flush()

            if db.query(TankTelemetry).filter(TankTelemetry.tankId == tank.id).count() < 3:
                for offset in range(3):
                    volume = max(tank.currentVolume - (2 - offset) * 350, 0)
                    db.add(
                        TankTelemetry(
                            tankId=tank.id,
                            levelPercent=round((volume / tank.capacity) * 100, 2),
                            volume=volume,
                            temperature=tank.temperature,
                            density=tank.density,
                            variation=-350 if offset else 0,
                            alarm=False,
                            recordedAt=now - timedelta(hours=3 - offset, minutes=index),
                        )
                    )

            dispenser_code = f"DSP-{index:02d}"
            if not db.query(Dispenser).filter(Dispenser.code == dispenser_code).first():
                db.add(
                    Dispenser(
                        code=dispenser_code,
                        name=f"Surtidor {index:02d}",
                        location=tank.location,
                        tankId=tank.id,
                        totalizer=25000 + index * 875,
                        status="online" if index % 5 else "maintenance",
                        deviceIdentifier=f"DISP-DEMO-{index:02d}",
                        assignedCompanyId=company.id,
                        lastTransactionAt=now - timedelta(minutes=index * 11),
                    )
                )

            if not db.query(FuelReceipt).filter(FuelReceipt.invoiceNumber == f"FAC-DEMO-{index:03d}").first():
                db.add(
                    FuelReceipt(
                        tankId=tank.id,
                        supplier="Proveedor Demo",
                        invoiceNumber=f"FAC-DEMO-{index:03d}",
                        volume=4500 + index * 120,
                        density=tank.density,
                        temperature=tank.temperature,
                        status="accepted",
                        receivedAt=now - timedelta(days=index),
                    )
                )

        db.flush()

        vehicles = db.query(Vehicle).filter(Vehicle.plate.like("NF-%")).order_by(Vehicle.id.asc()).limit(50).all()
        drivers = db.query(Driver).filter(Driver.documentId.like("DRV-DEMO-%")).order_by(Driver.id.asc()).limit(50).all()
        dispensers = db.query(Dispenser).filter(Dispenser.code.like("DSP-%")).order_by(Dispenser.id.asc()).limit(10).all()

        for index, vehicle in enumerate(vehicles[:20], start=1):
            if not db.query(FuelPolicy).filter(FuelPolicy.vehicleId == vehicle.id).first():
                db.add(
                    FuelPolicy(
                        name=f"Política demo {vehicle.plate}",
                        vehicleId=vehicle.id,
                        driverId=drivers[index - 1].id if index - 1 < len(drivers) else None,
                        assignedCompanyId=company.id,
                        maxVolumePerTransaction=65 + index % 8,
                        maxVolumePerDay=110 + index % 12,
                        maxVolumePerWeek=450 + index * 3,
                        shiftName=["AM", "PM", "24H"][index % 3],
                        identificationMethod=["rfid", "card", "anpr", "ble"][index % 4],
                        requiresPreAuthorization=True,
                        autoCutEnabled=True,
                        status="active",
                    )
                )

        db.flush()

        for index, vehicle in enumerate(vehicles[:30], start=1):
            transaction_code = f"TX-DEMO-{index:04d}"
            if db.query(RefuelingTransaction).filter(RefuelingTransaction.transactionCode == transaction_code).first():
                continue
            dispenser = dispensers[(index - 1) % len(dispensers)]
            tank = db.get(InstitutionalTank, dispenser.tankId)
            driver = drivers[index - 1] if index - 1 < len(drivers) else None
            policy = db.query(FuelPolicy).filter(FuelPolicy.vehicleId == vehicle.id).first()
            dispensed = 28 + (index % 12) * 2
            db.add(
                RefuelingTransaction(
                    transactionCode=transaction_code,
                    vehicleId=vehicle.id,
                    driverId=driver.id if driver else None,
                    dispenserId=dispenser.id,
                    tankId=tank.id if tank else dispenser.tankId,
                    policyId=policy.id if policy else None,
                    requestedVolume=dispensed + 5,
                    authorizedVolume=policy.maxVolumePerTransaction if policy else dispensed + 5,
                    dispensedVolume=dispensed,
                    odometer=12000 + index * 173,
                    identificationMethod=["rfid", "card", "anpr", "ble"][index % 4],
                    identificationValue=f"ID-DEMO-{index:04d}",
                    preAuthorized=True,
                    cutReason=None,
                    status="completed",
                    startedAt=now - timedelta(hours=index),
                    completedAt=now - timedelta(hours=index, minutes=-4),
                )
            )

        for metric, min_value, max_value, variation in [
            ("tank_level_percent", 18, 92, 12),
            ("tank_temperature", 18, 38, 5),
            ("vehicle_fuel_level", 15, 95, 20),
            ("dispensed_volume", 0, 75, None),
        ]:
            exists = (
                db.query(AlertThreshold)
                .filter(AlertThreshold.assignedCompanyId == company.id, AlertThreshold.metric == metric)
                .first()
            )
            if not exists:
                db.add(
                    AlertThreshold(
                        scope="company",
                        assignedCompanyId=company.id,
                        metric=metric,
                        minValue=min_value,
                        maxValue=max_value,
                        variationLimit=variation,
                        notificationEmail=company.email,
                        enabled=True,
                    )
                )

        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    set_realtime_loop(asyncio.get_running_loop())
    ensure_database_schema()
    seed_default_admin()
    seed_default_company()
    seed_demo_data()
    try:
        mqtt_ingest_service.start()
    except Exception:
        logger.exception("Unable to start MQTT ingest service")
    yield
    mqtt_ingest_service.stop()
    set_realtime_loop(None)


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://.*$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Authorization", "Set-Cookie"],
)

api_router = APIRouter(prefix="/api", tags=["api"])


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    request.state.auth = None
    token = None
    for cookie_name in LEGACY_COOKIE_NAMES:
        token = request.cookies.get(cookie_name)
        if token:
            break
    if not token:
        authorization = request.headers.get("Authorization")
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ", 1)[1].strip()
    elif token.startswith("Bearer "):
        token = token.split(" ", 1)[1].strip()

    if token:
        try:
            payload = verify_token(token)
            request.state.auth = AuthContext(
                entity_id=int(payload["sub"]),
                username=str(payload["username"]),
                email=str(payload["email"]),
                role=str(payload["role"]),
                company_id=int(payload["company_id"]) if payload.get("company_id") is not None else None,
                token=token,
            )
        except Exception:
            request.state.auth = None

    return await call_next(request)

@api_router.get("/health")
def read_root():
    return {
        "Status": "Alive",
        "ProjectName": "NetoFuel",
    }


def _auth_from_websocket(websocket: WebSocket) -> AuthContext | None:
    token = websocket.query_params.get("token")
    if not token:
        for cookie_name in LEGACY_COOKIE_NAMES:
            token = websocket.cookies.get(cookie_name)
            if token:
                break
    if not token:
        authorization = websocket.headers.get("Authorization")
        if authorization and authorization.startswith("Bearer "):
            token = authorization.split(" ", 1)[1].strip()
    elif token.startswith("Bearer "):
        token = token.split(" ", 1)[1].strip()

    if not token:
        return None

    try:
        payload = verify_token(token)
        return AuthContext(
            entity_id=int(payload["sub"]),
            username=str(payload["username"]),
            email=str(payload["email"]),
            role=str(payload["role"]),
            company_id=int(payload["company_id"]) if payload.get("company_id") is not None else None,
            token=token,
        )
    except Exception:
        return None


@app.websocket("/api/ws/realtime")
async def realtime_websocket(websocket: WebSocket):
    auth = _auth_from_websocket(websocket)
    if auth is None:
        await websocket.close(code=1008)
        return

    company_channel = None if auth.role == "admin" else auth.company_id
    await realtime_manager.connect(websocket, company_channel)
    try:
        await websocket.send_json(
            {
                "type": "connected",
                "role": auth.role,
                "companyId": auth.company_id,
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_manager.disconnect(websocket, company_channel)

# Include routers
api_router.include_router(users_router)
api_router.include_router(company_router)
api_router.include_router(auth_router)
api_router.include_router(vehicles_router)
api_router.include_router(alerts_router)
api_router.include_router(reports_router)
api_router.include_router(fuel_management_router)
app.include_router(api_router)


# To run the app, use the command: uvicorn main:app --reload

"""
                        uuuuuuuuuuuuuuuuuuuuu.
                   .u$$$$$$$$$$$$$$$$$$$$$$$$$$W.
                 u$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$Wu.
               $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$i
              $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
         `    $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
           .i$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$i
           $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$W
          .$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$W
         .$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$i
         #$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$.
         W$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
$u       #$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$~
$#      `"$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
$i        $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
$$        #$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
$$         $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$
#$.        $$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$#
 $$      $iW$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$!
 $$i      $$$$$$$#"" `'''#$$$$$$$$$$$$$$$$$#"''''''''#$$$$$$$$$$$$$$$W
 #$$W    `$$$#"            "       !$$$$$`           `"#$$$$$$$$$$#
  $$$     ``                 ! !iuW$$$$$                 #$$$$$$$#
  #$$    $u                  $   $$$$$$$                  $$$$$$$~
   "#    #$$i.               #   $$$$$$$.                 `$$$$$$
          $$$$$i.                '''$$$$i.               .$$$$#
          $$$$$$$$!         .   `    $$$$$$$$$i           $$$$$
          `$$$$$  $iWW   .uW`        #$$$$$$$$$W.       .$$$$$$#
            "#$$$$$$$$$$$$#`          $$$$$$$$$$$iWiuuuW$$$$$$$$W
               !#""    ""             `$$$$$$$##$$$$$$$$$$$$$$$$
          i$$$$    .                   !$$$$$$ .$$$$$$$$$$$$$$$#
         $$$$$$$$$$`                    $$$$$$$$$Wi$$$$$$#"#$$`
         #$$$$$$$$$W.                   $$$$$$$$$$$#   ``
          `$$$$##$$$$!       i$u.  $. .i$$$$$$$$$#""
             "     `#W       $$$$$$$$$$$$$$$$$$$`      u$#
                            W$$$$$$$$$$$$$$$$$$      $$$$W
                            $$`!$$$##$$$$``$$$$      $$$$!
                           i$" $$$$  $$#"`  '''     W$$$$
                                                   W$$$$!
                      uW$$  uu  uu.  $$$  $$$Wu#   $$$$$$
                     ~$$$$iu$$iu$$$uW$$! $$$$$$i .W$$$$$$
             ..  !   "#$$$$$$$$$$##$$$$$$$$$$$$$$$$$$$$#"
             $$W  $     "#$$$$$$$iW$$$$$$$$$$$$$$$$$$$$$W
             $#`   `       ""#$$$$$$$$$$$$$$$$$$$$$$$$$$$
                              !$$$$$$$$$$$$$$$$$$$$$#`
                              $$$$$$$$$$$$$$$$$$$$$$!
                            $$$$$$$$$$$$$$$$$$$$$$$`
                             $$$$$$$$$$$$$$$$$$$$"
"""
