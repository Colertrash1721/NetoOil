# main.py
import asyncio
from contextlib import asynccontextmanager
from datetime import date
import logging

from fastapi import FastAPI, APIRouter, Request, WebSocket, WebSocketDisconnect # type: ignore
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from admins.models import Admin
from alerts.models import AlertEvent, NotificationDeliveryLog
from alerts.routes import router as alerts_router
from auth import router as auth_router
from auth.security import AuthContext, LEGACY_COOKIE_NAMES, hash_password, verify_token
from companies.models import Company
from fuel_management import router as fuel_management_router
from fuel_management.models import (
    CustomRole,
    WebhookEndpoint,
    WebhookDeliveryLog,
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
    if "fleetName" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN fleetName VARCHAR(120) NULL")
    if "corridor" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN corridor VARCHAR(120) NULL")
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
    if "targetRefillGallons" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN targetRefillGallons FLOAT NULL")
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
    if "rfidTag" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN rfidTag VARCHAR(120) NULL")
        vehicle_statements.append("CREATE INDEX ix_vehicles_rfidTag ON vehicles (rfidTag)")
    if "mifareCard" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN mifareCard VARCHAR(120) NULL")
        vehicle_statements.append("CREATE INDEX ix_vehicles_mifareCard ON vehicles (mifareCard)")
    if "anprPlate" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN anprPlate VARCHAR(120) NULL")
        vehicle_statements.append("CREATE INDEX ix_vehicles_anprPlate ON vehicles (anprPlate)")
    if "bleIdentifier" not in vehicle_columns:
        vehicle_statements.append("ALTER TABLE vehicles ADD COLUMN bleIdentifier VARCHAR(120) NULL")
        vehicle_statements.append("CREATE INDEX ix_vehicles_bleIdentifier ON vehicles (bleIdentifier)")

    with engine.begin() as connection:
        for statement in vehicle_statements:
            connection.execute(text(statement))

    if inspector.has_table("vehicle_telemetry"):
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

    if inspector.has_table("institutional_tanks"):
        tank_columns = {column["name"] for column in inspector.get_columns("institutional_tanks")}
        tank_statements = []
        if "storageType" not in tank_columns:
            tank_statements.append("ALTER TABLE institutional_tanks ADD COLUMN storageType VARCHAR(40) NOT NULL DEFAULT 'aereo'")
        if "targetRefillGallons" not in tank_columns:
            tank_statements.append("ALTER TABLE institutional_tanks ADD COLUMN targetRefillGallons FLOAT NULL")
        with engine.begin() as connection:
            for statement in tank_statements:
                connection.execute(text(statement))

    if inspector.has_table("dispensers"):
        dispenser_columns = {column["name"] for column in inspector.get_columns("dispensers")}
        dispenser_statements = []
        if "targetRefillGallons" not in dispenser_columns:
            dispenser_statements.append("ALTER TABLE dispensers ADD COLUMN targetRefillGallons FLOAT NULL")
        if "supportedIdentificationMethods" not in dispenser_columns:
            dispenser_statements.append("ALTER TABLE dispensers ADD COLUMN supportedIdentificationMethods VARCHAR(160) NOT NULL DEFAULT 'rfid,mifare,anpr,ble'")
        if "fallbackIdentificationMethod" not in dispenser_columns:
            dispenser_statements.append("ALTER TABLE dispensers ADD COLUMN fallbackIdentificationMethod VARCHAR(40) NOT NULL DEFAULT 'anpr'")
        if "productConfigurations" not in dispenser_columns:
            dispenser_statements.append("ALTER TABLE dispensers ADD COLUMN productConfigurations JSON NULL")
        if "hoseCount" not in dispenser_columns:
            dispenser_statements.append("ALTER TABLE dispensers ADD COLUMN hoseCount INTEGER NOT NULL DEFAULT 1")
        with engine.begin() as connection:
            for statement in dispenser_statements:
                connection.execute(text(statement))

    if inspector.has_table("refueling_transactions"):
        transaction_columns = {column["name"] for column in inspector.get_columns("refueling_transactions")}
        transaction_statements = []
        if "operatorName" not in transaction_columns:
            transaction_statements.append("ALTER TABLE refueling_transactions ADD COLUMN operatorName VARCHAR(160) NULL")
        if "authorizationNumber" not in transaction_columns:
            transaction_statements.append("ALTER TABLE refueling_transactions ADD COLUMN authorizationNumber VARCHAR(100) NULL")
            transaction_statements.append("CREATE INDEX ix_refueling_transactions_authorizationNumber ON refueling_transactions (authorizationNumber)")
        if "productType" not in transaction_columns:
            transaction_statements.append("ALTER TABLE refueling_transactions ADD COLUMN productType VARCHAR(60) NOT NULL DEFAULT 'diesel'")
        if "hoseNumber" not in transaction_columns:
            transaction_statements.append("ALTER TABLE refueling_transactions ADD COLUMN hoseNumber INTEGER NOT NULL DEFAULT 1")
        if "flowMeterStart" not in transaction_columns:
            transaction_statements.append("ALTER TABLE refueling_transactions ADD COLUMN flowMeterStart FLOAT NULL")
        if "flowMeterEnd" not in transaction_columns:
            transaction_statements.append("ALTER TABLE refueling_transactions ADD COLUMN flowMeterEnd FLOAT NULL")
        if "flowMeterAccuracyPercent" not in transaction_columns:
            transaction_statements.append("ALTER TABLE refueling_transactions ADD COLUMN flowMeterAccuracyPercent FLOAT NULL")
        if "identificationStatus" not in transaction_columns:
            transaction_statements.append("ALTER TABLE refueling_transactions ADD COLUMN identificationStatus VARCHAR(40) NOT NULL DEFAULT 'valid'")
        with engine.begin() as connection:
            for statement in transaction_statements:
                connection.execute(text(statement))

    if inspector.has_table("sensor_devices"):
        sensor_columns = {column["name"] for column in inspector.get_columns("sensor_devices")}
        sensor_statements = []
        if "sensorType" not in sensor_columns:
            sensor_statements.append("ALTER TABLE sensor_devices ADD COLUMN sensorType VARCHAR(60) NOT NULL DEFAULT 'ble'")
        if "pairedVehicleId" not in sensor_columns:
            sensor_statements.append("ALTER TABLE sensor_devices ADD COLUMN pairedVehicleId INTEGER NULL")
        if "pairingStatus" not in sensor_columns:
            sensor_statements.append("ALTER TABLE sensor_devices ADD COLUMN pairingStatus VARCHAR(40) NOT NULL DEFAULT 'paired'")
        if "batteryLevel" not in sensor_columns:
            sensor_statements.append("ALTER TABLE sensor_devices ADD COLUMN batteryLevel FLOAT NULL")
        if "remoteConfig" not in sensor_columns:
            sensor_statements.append("ALTER TABLE sensor_devices ADD COLUMN remoteConfig JSON NULL")
        if "tamperStatus" not in sensor_columns:
            sensor_statements.append("ALTER TABLE sensor_devices ADD COLUMN tamperStatus VARCHAR(40) NOT NULL DEFAULT 'normal'")
        if "cachedEvents" not in sensor_columns:
            sensor_statements.append("ALTER TABLE sensor_devices ADD COLUMN cachedEvents INTEGER NOT NULL DEFAULT 0")
        with engine.begin() as connection:
            for statement in sensor_statements:
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

    if inspector.has_table("alert_thresholds"):
        threshold_columns = {column["name"] for column in inspector.get_columns("alert_thresholds")}
        threshold_statements = []
        if "notificationChannels" not in threshold_columns:
            threshold_statements.append("ALTER TABLE alert_thresholds ADD COLUMN notificationChannels VARCHAR(120) NOT NULL DEFAULT 'internal,email'")
        if "smsNumber" not in threshold_columns:
            threshold_statements.append("ALTER TABLE alert_thresholds ADD COLUMN smsNumber VARCHAR(50) NULL")
        if "webhookUrl" not in threshold_columns:
            threshold_statements.append("ALTER TABLE alert_thresholds ADD COLUMN webhookUrl VARCHAR(255) NULL")
        with engine.begin() as connection:
            for statement in threshold_statements:
                connection.execute(text(statement))


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


@asynccontextmanager
async def lifespan(_: FastAPI):
    set_realtime_loop(asyncio.get_running_loop())
    ensure_database_schema()
    seed_default_admin()
    seed_default_company()
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
