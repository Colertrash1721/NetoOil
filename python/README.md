# NetoFuel Backend (FastAPI)

Documentacion tecnica del backend real ubicado en `python/`.

Este servicio expone una API REST con FastAPI, persiste datos en MySQL mediante SQLAlchemy y ejecuta un proceso de ingesta MQTT para recibir telemetria de sensores, asociarla a vehiculos, validar consumo de combustible y generar alertas operativas.

## 1. Stack y responsabilidades

- Framework HTTP: FastAPI
- ORM: SQLAlchemy
- Base de datos: MySQL
- Validacion de datos: Pydantic
- Autenticacion: token firmado tipo JWT almacenado en cookie y tambien devuelto en header `Authorization`
- Ingesta en tiempo real: `paho-mqtt`
- Reporteria: salida JSON y exportacion PDF basica

## 2. Objetivo del backend

El backend resuelve cuatro flujos principales:

1. Autenticacion de administradores, empresas y usuarios cliente.
2. CRUD de empresas, usuarios y vehiculos.
3. Recepcion y almacenamiento de telemetria desde MQTT.
4. Validacion de consumo, deteccion de eventos anormales y generacion de reportes.

## 3. Estructura del proyecto

```text
python/
├── main.py                  # Punto de entrada FastAPI y ciclo de vida
├── mqtt_listener.py         # Servicio MQTT en segundo plano
├── db/
│   └── database.py          # Conexion SQLAlchemy y dependencia get_db
├── auth/                    # Login, registro, sesion, seguridad y dependencias
├── companies/               # CRUD de empresas
├── users/                   # Usuarios cliente y aprobacion de estado
├── vehicles/                # CRUD de vehiculos y telemetria
├── alerts/                  # Consulta y generacion de alertas
├── reports/                 # Reportes historicos y PDF
├── sensor_data/             # Modelos de mensajes/dispositivos MQTT
├── admins/                  # CRUD de administradores
└── cert/backup/             # Certificados usados por MQTT TLS
```

## 4. Ejecucion local

### Requisitos

- Python 3.12
- MySQL accesible desde la aplicacion
- Variables de entorno para base de datos

### Comando de arranque

```bash
uvicorn main:app --reload
```

### Variables de entorno relevantes

#### Base de datos

Definidas y consumidas en `db/database.py`:

- `DB_HOST`
- `DB_USER`
- `DB_PASS`
- `DB_PORT`
- `DB_NAME`

La URL final usada por SQLAlchemy es:

```text
mysql+pymysql://DB_USER:DB_PASS@DB_HOST:DB_PORT/DB_NAME
```

#### Autenticacion

Consumidas principalmente en `auth/security.py` y `auth/service.py`:

- `SECRET_KEY`: clave para firmar tokens.
- `TOKEN_TTL_SECONDS`: tiempo de vida del token.
- `PASSWORD_HASH_ITERATIONS`: iteraciones PBKDF2.
- `AUTH_COOKIE_SAMESITE`: politica de cookie.
- `AUTH_COOKIE_SECURE`: `true`, `false` o `auto`.
- `ENV`: afecta decisiones por defecto de cookies seguras.

#### MQTT

Consumidas en `mqtt_listener.py`:

- `MQTT_HOST`
- `MQTT_PORT`
- `MQTT_TOPIC`
- `MQTT_CLIENT_ID`
- `MQTT_USERNAME`
- `MQTT_PASSWORD`
- `MQTT_KEEPALIVE`
- `MQTT_USE_TLS`
- `MQTT_TLS_INSECURE`
- `MQTT_CA_CERT_PATH`
- `MQTT_CLIENT_CERT_PATH`
- `MQTT_CLIENT_KEY_PATH`

## 5. Ciclo de vida de la aplicacion

El `lifespan` definido en `main.py` ejecuta, en este orden:

1. `ensure_database_schema()`
   Crea tablas con `Base.metadata.create_all()` y agrega columnas faltantes con `ALTER TABLE` para compatibilidad con esquemas existentes.
2. `seed_default_admin()`
   Inserta un admin por defecto (`admin/admin`) si no existe.
3. `seed_default_company()`
   Inserta una empresa de prueba (`usuario/usuario`) si no existe.
4. `mqtt_ingest_service.start()`
   Levanta el listener MQTT en segundo plano.

Al cerrar la aplicacion se llama `mqtt_ingest_service.stop()`.

## 6. Flujo general de peticiones HTTP

1. La peticion entra por FastAPI.
2. `auth_middleware` busca token en cookies legacy (`jwt`, `access_token`) o en el header `Authorization`.
3. Si el token es valido, se crea `request.state.auth` con `AuthContext`.
4. Cada router usa dependencias como `get_current_auth()` o `require_roles(...)`.
5. La ruta delega en `service.py`.
6. El servicio aplica validaciones y llama al `repository.py` correspondiente o a SQLAlchemy directo.
7. Se devuelve respuesta serializada con Pydantic.

## 7. Arquitectura por capas

El backend sigue una separacion simple:

- `models.py`: entidades SQLAlchemy.
- `schemas.py`: contratos de entrada/salida Pydantic.
- `repository.py`: operaciones CRUD de base de datos.
- `service.py`: reglas de negocio y validaciones.
- `routes.py`: endpoints FastAPI.

No todos los modulos siguen el mismo nivel de pureza. Por ejemplo:

- `reports/service.py` consulta SQLAlchemy directamente.
- `mqtt_listener.py` contiene logica de negocio, transformacion y persistencia.
- `main.py` tambien hace cambios de esquema, no solo inicializacion.

## 8. Router montados en la API

`main.py` crea un `APIRouter` con prefijo `/api` y monta:

- `/api/health`
- `/api/users`
- `/api/companies`
- `/api/auth`
- `/api/vehicles`
- `/api/alerts`
- `/api/reports`

### Nota importante

Existe el modulo `admins`, pero su router no se incluye en `main.py`. Eso significa que sus endpoints estan implementados, pero actualmente no quedan expuestos por la aplicacion.

## 9. Endpoints disponibles

### Salud

- `GET /api/health`
  Devuelve:

```json
{
  "Status": "Alive",
  "ProjectName": "NetoFuel"
}
```

### Auth

- `POST /api/auth/login`
  Login por `username` o `email`. Intenta autenticar en este orden: admin, usuario cliente, empresa.
- `POST /api/auth/logout`
  Elimina cookies de sesion.
- `GET /api/auth/me`
  Devuelve la sesion autenticada actual.
- `POST /api/auth/register`
  Registra un usuario cliente asociado a una empresa. Queda con estado `pending`.

### Companies

Requiere rol `admin`.

- `GET /api/companies/`
- `GET /api/companies/{id}`
- `POST /api/companies/`
- `PATCH /api/companies/{id}`
- `DELETE /api/companies/{id}`

### Users

Requiere rol `admin`.

- `GET /api/users/`
  Lista usuarios cliente junto con el nombre de empresa.
- `PATCH /api/users/{user_id}/status`
  Cambia estado a `pending`, `accepted` o `rejected`.

### Vehicles

- `GET /api/vehicles/`
  Requiere autenticacion. Si el rol es `company` o `client`, solo devuelve vehiculos de su empresa.
- `GET /api/vehicles/{vehicle_id}`
  Devuelve detalle del vehiculo y su historial de telemetria relacionado.
- `POST /api/vehicles/`
  Requiere rol `admin` o `company`.
- `PATCH /api/vehicles/{vehicle_id}`
  Requiere rol `admin` o `company`.
- `DELETE /api/vehicles/{vehicle_id}`
  Requiere rol `admin` o `company`.
- `POST /api/vehicles/{vehicle_id}/telemetry`
  Inserta telemetria manualmente y ejecuta validacion de consumo.
- `GET /api/vehicles/{vehicle_id}/telemetry?limit=100`
  Devuelve historial de telemetria.

### Alerts

- `GET /api/alerts/?vehicleId=&limit=`
  Requiere autenticacion. Filtra por empresa segun el rol autenticado.

### Reports

- `GET /api/reports/vehicles/{vehicle_id}/history`
  Devuelve un reporte historico resumido en JSON.
- `GET /api/reports/vehicles/{vehicle_id}/history.pdf`
  Devuelve el mismo contexto principal en PDF descargable.

## 10. Autenticacion y autorizacion

### Roles manejados

- `admin`
- `company`
- `client`

### Como funciona el login

`auth/service.py -> login_service()`:

1. Valida que `user` y `password` existan.
2. Busca primero un administrador con `get_admin_by_user`.
3. Si no existe, busca un usuario cliente con `get_user_by_user`.
4. Si no existe, busca una empresa con `get_company_by_user`.
5. Verifica password con `verify_password()`.
6. Si la contraseña antigua no esta en formato PBKDF2, la considera valida por comparacion directa y marca `needs_rehash=True`.
7. Si aplica, rehashea la contraseña y la guarda.
8. Marca estado online o ultima conexion.
9. Genera token con `build_access_token()`.
10. Guarda token en cookies y tambien lo devuelve en la respuesta.

### Notas de seguridad

- La firma del token es HMAC SHA-256 hecha manualmente.
- La contraseña se cifra con PBKDF2 SHA-256 y salt aleatoria.
- Si `SECRET_KEY` no existe, el sistema usa `change-me-in-env`, lo cual es inseguro para produccion.
- El middleware acepta tanto cookie como bearer token.

### Control de acceso

- `get_current_auth()`: exige autenticacion.
- `require_roles(*roles)`: exige que el rol autenticado este permitido.
- `vehicles/routes.py` agrega una capa adicional con `_ensure_vehicle_company_access()` para impedir que una empresa vea o mutile vehiculos de otra.

## 11. Flujo MQTT y procesamiento de telemetria

El componente mas importante fuera de HTTP es `MqttIngestService` en `mqtt_listener.py`.

### Inicio del servicio

`start()`:

- Crea cliente MQTT.
- Configura usuario/clave si existen.
- Configura TLS si esta habilitado.
- Registra callbacks `on_connect`, `on_message` y `on_disconnect`.
- Se conecta al broker y deja el loop en background con `loop_start()`.

### Ingesta de mensajes

`_on_message()` realiza este flujo:

1. Decodifica el payload a texto UTF-8.
2. Intenta parsear JSON con `_parse_json()`.
3. Extrae `topicSuffix`.
4. Extrae `sensor_identifier` desde:
   - topic `netofuel/<sensor>/...`
   - sufijo del topic
   - campos del payload como `sensorIdentifier`, `sensorId`, `deviceId`, `imei`
5. Convierte `state.reported` a una telemetria clasificada con `_build_classified_telemetry()`.
6. Inserta el mensaje crudo en `sensor_mqtt_messages`.
7. Crea o actualiza el dispositivo en `sensor_devices`.
8. Si hubo telemetria estructurada, inserta registro en `sensor_device_telemetry`.
9. Intenta sincronizar esa telemetria con un vehiculo via `_sync_vehicle_telemetry()`.

### Clasificacion del payload

`_build_classified_telemetry()` interpreta un formato de payload donde los datos vienen en `state.reported`. Campos relevantes:

- `latlng`: latitud/longitud
- `sp`: velocidad
- `evt`: evento
- `239`: ignition
- `240`: movement
- `701`: temperatura BLE
- `705`: bateria BLE
- `713`: presion
- `729`: nivel de combustible
- `730`: volumen

Tambien guarda:

- `rawReported`: payload original interpretado
- `unknownReported`: claves no mapeadas
- `recordedAt`: timestamp del dispositivo si `ts` existe; si no, hora actual UTC

### Sincronizacion con vehiculos

`_sync_vehicle_telemetry()` busca un `Vehicle` cuyo `sensorIdentifier` coincida con el sensor recibido. Si lo encuentra:

1. Obtiene la telemetria previa con `get_previous_vehicle_telemetry()`.
2. Ejecuta `validate_vehicle_consumption()`.
3. Inserta un nuevo `VehicleTelemetry`.
4. Actualiza los campos `last*` del vehiculo.
5. Marca si el dispositivo esta detenido.
6. Genera o cierra alertas segun el resultado.

## 12. Validacion de consumo de combustible

Toda la logica vive en `vehicles/consumption.py`.

### Objetivo

Comparar el consumo de combustible real reportado por sensores con el consumo esperado segun distancia recorrida y el perfil de consumo del vehiculo.

### Flujo de `validate_vehicle_consumption()`

1. Lee `vehicle.fuelConsumption`.
2. Lo convierte a galones por kilometro con `parse_gallons_per_kilometer()`.
3. Si no existe perfil valido, retorna `status="no_consumption_profile"`.
4. Si no hay telemetria previa, retorna `status="insufficient_history"`.
5. Calcula distancia con `haversine_km()`.
6. Si faltan coordenadas, retorna `status="missing_location"`.
7. Decide si el vehiculo se estaba moviendo con `is_vehicle_moving()`.
8. Si no se movia, retorna `status="stationary"`.
9. Calcula gasto esperado = `distancia * gal/km`.
10. Calcula gasto real con `compute_actual_fuel_used()`:
    - prioriza `volume`
    - si no, usa `fuelLevel`
11. Si no hay suficiente data, retorna `status="missing_fuel_data"`.
12. Si el gasto real es negativo, retorna `status="refuel_detected"`.
13. Si el delta entre gasto real y esperado supera la tolerancia, retorna `status="incoherent"`.
14. En caso contrario, retorna `status="coherent"`.

### Estados posibles

- `no_consumption_profile`
- `insufficient_history`
- `missing_location`
- `stationary`
- `missing_fuel_data`
- `refuel_detected`
- `coherent`
- `incoherent`

### Tolerancias usadas

- Tolerancia porcentual por defecto: `35%`
- Tolerancia absoluta minima: `0.25 gal`
- Distancia minima para considerar movimiento por geolocalizacion: `0.05 km`
- Umbral de velocidad para considerar movimiento: `3 km/h`

## 13. Sistema de alertas

`alerts/service.py` maneja creacion y cierre de alertas.

### Tipos observados en el codigo

- `device_stopped`
- `fuel_leak`
- `refuel`

### Reglas actuales

- Si el vehiculo permanece detenido al menos `30` minutos, se intenta abrir una alerta `device_stopped`.
- Si el consumo es `incoherent` y el delta indica gasto mayor al esperado, se crea `fuel_leak`.
- Si se detecta aumento de combustible, se crea `refuel`.
- Alertas abiertas del mismo tipo se deduplican dentro de `30` minutos.
- Cuando el vehiculo vuelve a moverse, las alertas abiertas `device_stopped` se marcan como `resolved`.

## 14. Reportes

`reports/service.py` genera reportes consolidados por vehiculo.

### `build_vehicle_history_report()`

Compone:

- datos basicos del vehiculo
- fecha de generacion
- resumen agregado
- historial de consumo
- historial de alertas por posible robo/fuga
- historial de recargas

### `export_vehicle_history_pdf()`

- transforma el resumen a una lista de lineas
- usa `build_simple_pdf()`
- devuelve `(filename, pdf_bytes)`

### `build_simple_pdf()`

Genera un PDF simple de una sola pagina escribiendo manualmente la estructura PDF. No usa librerias externas de reporteria.

## 15. Modelos de datos principales

### `companies`

Representa empresas clientes.

Campos clave:

- `name`
- `email`
- `username`
- `hashed_password`
- `isOnline`
- `creationDate`
- `lastConnection`
- `rnc`

### `users`

Usuarios cliente asociados a una empresa.

Campos clave:

- `email`
- `hashed_password`
- `username`
- `status`
- `companyId`

### `admins`

Administradores del sistema.

Campos esperados por el servicio:

- `username`
- `email`
- `hashed_password`
- `isOnline`
- `creationDate`
- `lastConnection`

### `vehicles`

Vehiculos y ultimo estado consolidado.

Campos clave:

- identidad: `plate`, `brand`, `model`, `vin`
- configuracion: `fuelConsumption`, `tankCapacity`, `sensorIdentifier`
- pertenencia: `assignedCompanyId`
- ultimo estado: `lastTemperature`, `lastVolume`, `lastLatitude`, `lastSpeed`, `lastFuelLevel`, etc.
- inmovilidad: `deviceIsStopped`, `stopStartedAt`, `lastMovementAt`

### `vehicle_telemetry`

Historial de lecturas por vehiculo.

Campos clave:

- medidas crudas: temperatura, inclinacion, volumen, velocidad, humedad, bateria
- analitica: `distanceKm`, `expectedFuelUsed`, `actualFuelUsed`, `fuelDelta`
- validacion: `fuelValidationStatus`, `fuelValidationMessage`, `fuelValidationAt`
- tiempo: `recordedAt`

### `sensor_mqtt_messages`

Bitacora de mensajes MQTT crudos recibidos.

### `sensor_devices`

Dispositivos/sensores detectados automaticamente desde MQTT.

### `sensor_device_telemetry`

Historial clasificado de payloads MQTT por sensor.

### `alert_events`

Eventos operativos detectados por reglas del sistema.

## 16. Documentacion de funciones por modulo

### `main.py`

- `ensure_database_schema()`
  Crea tablas y agrega columnas faltantes a `companies`, `users`, `vehicles` y `vehicle_telemetry`.
- `seed_default_admin()`
  Inserta admin inicial si no existe.
- `seed_default_company()`
  Inserta empresa inicial si no existe.
- `lifespan()`
  Orquesta arranque y parada del servicio.
- `auth_middleware()`
  Resuelve sesion autenticada desde cookies o bearer token.
- `read_root()`
  Endpoint de salud.

### `db/database.py`

- `get_db()`
  Dependencia FastAPI que entrega una sesion SQLAlchemy y luego la cierra.

### `auth/security.py`

- `hash_password(raw_password)`
  Genera hash PBKDF2 SHA-256.
- `verify_password(raw_password, stored_password)`
  Verifica hash moderno o password legacy plano.
- `sign_token(payload)`
  Firma el token.
- `verify_token(token)`
  Valida firma y expiracion.
- `build_access_token(...)`
  Construye payload estandar de autenticacion.

### `auth/dependencies.py`

- `get_current_auth(request)`
  Exige una sesion autenticada.
- `require_roles(*roles)`
  Fabrica dependencias por rol.

### `auth/service.py`

- `AuthError`
  Excepcion controlada para respuestas de autenticacion.
- `_set_auth_cookie(response, token)`
  Escribe cookies y header `Authorization`.
- `_build_login_response(...)`
  Ensambla respuesta final del login.
- `login_service(...)`
  Autentica admin, usuario o empresa.
- `logout_service(response)`
  Limpia cookies.
- `register_service(...)`
  Registra usuario cliente pendiente de aprobacion.

### `auth/repository.py`

- `get_admin_by_user(db, user)`
  Busca admin por username o email.
- `get_company_by_user(db, user)`
  Busca empresa por username, email o nombre.
- `get_company_by_email(db, email)`
- `get_company_by_username(db, username)`
- `get_company_by_rnc(db, rnc)`
- `get_user_by_user(db, user)`
  Busca usuario por username o email.
- `get_user_by_email(db, email)`
- `get_user_by_username(db, username)`

### `companies/service.py`

- `create_company_service(db, data)`
  Valida unicidad y crea empresa; si hay password, la hashea y la guarda.
- `read_all_company_service(db)`
  Lista empresas.
- `read_company_by_id_service(db, companyId)`
  Devuelve empresa por id.
- `update_company_service(db, companyId, data)`
  Actualiza datos y opcionalmente password.
- `delete_company_service(db, companyId)`
  Elimina empresa.

### `companies/repository.py`

- `create_company(db, data)`
- `get_all_company(db)`
- `get_company_by_id(db, companyId)`
- `get_company_by_name(db, name)`
- `get_company_by_email(db, email)`
- `get_company_by_username(db, username)`
- `get_company_by_rnc(db, rnc)`
- `update_company(db, company, data)`
- `delete_company(db, company)`

### `users/service.py`

- `_serialize_user(row)`
  Convierte resultado con join a `UserRead`.
- `read_all_users_service(db)`
  Lista usuarios con nombre de empresa.
- `update_user_status_service(db, user_id, status)`
  Cambia estado tras validar que sea uno de los permitidos.

### `users/repository.py`

- `create_user(...)`
  Inserta usuario cliente.
- `update_user_password(db, user, hashed_password)`
  Rehashea y persiste password.
- `get_user_by_id(db, user_id)`
- `get_user_by_username(db, username)`
- `get_user_by_email(db, email)`
- `get_user_by_user(db, user)`
- `get_all_users(db)`
  Devuelve filas con join a empresa.
- `update_user_status(db, user, status)`

### `vehicles/service.py`

- `_build_vehicle_read(vehicle)`
  Calcula `stoppedMinutes` si el dispositivo sigue detenido.
- `_build_vehicle_detail(db, vehicle)`
  Agrega nombre de empresa e historial de telemetria.
- `create_vehicle_service(db, data)`
  Valida placa, sensor, VIN y empresa asignada.
- `read_all_vehicles_service(db, auth)`
  Filtra por empresa cuando el rol no es admin.
- `read_vehicle_by_id_service(db, vehicle_id)`
  Devuelve detalle por id.
- `update_vehicle_service(db, vehicle_id, data)`
  Valida colisiones y actualiza campos.
- `delete_vehicle_service(db, vehicle_id)`
  Elimina vehiculo.
- `create_vehicle_telemetry_service(db, vehicle_id, data)`
  Inserta telemetria manual y calcula validacion de consumo.
- `read_vehicle_telemetry_history_service(db, vehicle_id, limit)`
  Lee historial ordenado.

### `vehicles/repository.py`

- `create_vehicle(db, data)`
- `get_all_vehicles(db)`
- `get_vehicle_by_id(db, vehicle_id)`
- `get_vehicle_by_plate(db, plate)`
- `get_vehicle_by_sensor_identifier(db, sensor_identifier)`
- `get_vehicle_by_vin(db, vin)`
- `update_vehicle(db, vehicle, data)`
- `delete_vehicle(db, vehicle)`
- `create_vehicle_telemetry(db, data)`
- `get_vehicle_telemetry_history(db, vehicle_id, limit)`

### `vehicles/consumption.py`

- `ConsumptionValidationResult`
  Estructura resultado de validacion.
- `get_previous_vehicle_telemetry(db, vehicle_id, recorded_at)`
  Busca la telemetria inmediatamente anterior.
- `validate_vehicle_consumption(...)`
  Ejecuta el analisis principal de coherencia de consumo.
- `parse_gallons_per_kilometer(raw_value)`
  Convierte formatos como `km/gal` o `gal/km`.
- `haversine_km(lat1, lon1, lat2, lon2)`
  Calcula distancia entre coordenadas.
- `is_vehicle_moving(...)`
  Decide si el vehiculo esta en movimiento.
- `compute_actual_fuel_used(...)`
  Calcula gasto real entre lectura anterior y actual.

### `alerts/service.py`

- `create_alert_if_needed(...)`
  Crea alerta si no existe una abierta reciente del mismo tipo.
- `close_open_alerts(...)`
  Marca alertas abiertas como resueltas.
- `read_alerts_service(...)`
  Lista alertas y aplica filtro por empresa segun el rol.

### `reports/service.py`

- `_get_vehicle_for_auth(db, auth, vehicle_id)`
  Verifica existencia y permisos.
- `build_vehicle_history_report(db, auth, vehicle_id)`
  Construye reporte JSON agregado.
- `export_vehicle_history_pdf(db, auth, vehicle_id)`
  Genera archivo PDF descargable.

### `reports/pdf_utils.py`

- `_escape_pdf_text(value)`
  Escapa caracteres reservados.
- `build_simple_pdf(title, lines)`
  Construye bytes PDF sin dependencia externa.

### `mqtt_listener.py`

- `_env_flag(name, default)`
  Interpreta flags booleanas de entorno.
- `MqttIngestService.__init__()`
  Carga configuracion MQTT y rutas de certificados.
- `start()`
  Inicia conexion y loop MQTT.
- `_resolve_path(path_value)`
  Resuelve rutas relativas a la carpeta del backend.
- `stop()`
  Detiene cliente MQTT.
- `_on_connect(...)`
  Suscribe al topic configurado.
- `_on_disconnect(...)`
  Registra desconexion.
- `_on_message(...)`
  Orquesta parseo, almacenamiento y sincronizacion.
- `_extract_topic_suffix(topic)`
  Obtiene sufijo del topic respecto al patron base.
- `_extract_device_identifier_from_topic(topic)`
  Intenta leer el id del sensor desde el topic.
- `_parse_json(payload_text)`
  Convierte payload a `dict` o `list`.
- `_extract_sensor_identifier(payload_json)`
  Busca identificadores comunes dentro del JSON.
- `_to_float(value)`
  Convierte seguro a `float`.
- `_to_int(value)`
  Convierte seguro a `int`.
- `_parse_recorded_at(reported)`
  Interpreta timestamp del dispositivo.
- `_parse_latlng(value)`
  Convierte `"lat,lng"` a tupla numerica.
- `_build_classified_telemetry(payload_json)`
  Traduce IOs del sensor a campos semanticos.
- `_sync_vehicle_telemetry(db, sensor_identifier, telemetry_payload)`
  Inserta `VehicleTelemetry`, actualiza `Vehicle` y dispara alertas.

### `admins/service.py`

- `create_admin_service(db, data)`
- `read_all_admin_service(db)`
- `read_admin_by_id_service(db, adminId)`
- `delete_admin_service(db, adminId)`
- `update_admin_service(db, adminId, data)`

Estas funciones existen y usan el modulo `admins/repository.py`, pero sus rutas no estan activas porque `admins.routes.router` no se monta en `main.py`.

## 17. Comportamientos y reglas de negocio importantes

- Un usuario cliente no puede iniciar sesion hasta que su estado sea `accepted`.
- Una empresa y un usuario cliente solo pueden ver vehiculos de su `company_id`.
- El backend guarda tanto el mensaje MQTT crudo como la telemetria clasificada.
- La asociacion sensor -> vehiculo depende de `vehicles.sensorIdentifier`.
- La telemetria MQTT actualiza el ultimo estado del vehiculo en la tabla `vehicles`.
- La telemetria manual por HTTP tambien valida consumo, pero no genera alertas de inmovilidad ni de fuga por la misma via que MQTT.

## 18. Limitaciones y observaciones tecnicas actuales

- `ensure_database_schema()` aplica migraciones manuales parciales; no hay un sistema formal como Alembic.
- El modulo `admins` existe pero no esta expuesto.
- `seed_default_admin()` y `seed_default_company()` crean credenciales por defecto; esto debe revisarse en produccion.
- El token se firma manualmente en lugar de usar una libreria JWT consolidada.
- El PDF es minimalista, de una pagina y sin paginacion automatica.
- El servicio MQTT hace varias responsabilidades en un mismo archivo: parseo, persistencia, sincronizacion y alertas.

## 19. Flujo recomendado para entender el sistema

Si alguien nuevo entra al proyecto, este es el orden mas util para leerlo:

1. `main.py`
2. `auth/security.py`
3. `auth/service.py`
4. `vehicles/service.py`
5. `vehicles/consumption.py`
6. `mqtt_listener.py`
7. `alerts/service.py`
8. `reports/service.py`

## 20. Resumen ejecutivo del backend

Este backend centraliza autenticacion, administracion de empresas y vehiculos, ingesta MQTT y analitica operativa sobre combustible. Su comportamiento mas importante es transformar mensajes de sensores en historial de telemetria por vehiculo, estimar si el consumo es coherente con la distancia recorrida y abrir alertas cuando detecta inmovilidad prolongada, recargas o posibles fugas/robos.
