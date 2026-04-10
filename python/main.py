# main.py
from contextlib import asynccontextmanager
from datetime import date
import logging

from fastapi import FastAPI, APIRouter, Request # type: ignore
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from admins.models import Admin
from alerts.models import AlertEvent
from alerts.routes import router as alerts_router
from auth import router as auth_router
from auth.security import AuthContext, LEGACY_COOKIE_NAMES, hash_password, verify_token
from companies.models import Company
from users import router as users_router  # this comes from users.py
from companies import router as company_router
from db.database import Base, SessionLocal, engine
from mqtt_listener import MqttIngestService
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

    if not inspector.has_table("alert_events"):
        return


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
    ensure_database_schema()
    seed_default_admin()
    seed_default_company()
    try:
        mqtt_ingest_service.start()
    except Exception:
        logger.exception("Unable to start MQTT ingest service")
    yield
    mqtt_ingest_service.stop()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://((localhost|127\.0\.0\.1)(:\d+)?|192\.168\.\d+\.\d+(?::\d+)?)$",
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

# Include routers
api_router.include_router(users_router)
api_router.include_router(company_router)
api_router.include_router(auth_router)
api_router.include_router(vehicles_router)
api_router.include_router(alerts_router)
api_router.include_router(reports_router)
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
