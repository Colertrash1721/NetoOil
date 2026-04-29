# NetoFuel

NetoFuel es una plataforma web de control integral de combustible para flotas e infraestructura institucional. El sistema combina backend FastAPI, frontend Next.js, ingesta MQTT, WebSocket, alertas automaticas, reportes historicos y modulos operativos para controlar el ciclo completo:

```text
recepcion -> almacenamiento -> despacho -> consumo -> conciliacion
```

El proyecto conserva datos demo para pruebas funcionales: 50 vehiculos, 10 tanques y 10 dispensadores asociados a la empresa de demostracion.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS, Leaflet, Recharts.
- Backend: FastAPI, SQLAlchemy, Pydantic.
- Base de datos: MySQL.
- Tiempo real: MQTT para ingesta IoT y WebSocket para clientes web.
- Infraestructura: Docker Compose con MySQL, backend, frontend y Nginx.

## Estructura

```text
NetoFuel/
├── docker-compose.yml
├── nginx/
│   └── nginx.conf
├── frontend/
│   ├── Dockerfile
│   ├── src/app/admin/      # Panel NetoFuel para superadmins
│   ├── src/app/client/     # Portal de companias
│   ├── src/components/
│   ├── src/hooks/
│   ├── src/services/
│   └── src/types/
└── python/
    ├── Dockerfile
    ├── main.py
    ├── admins/             # Administradores root
    ├── alerts/             # Eventos y motor automatico de alertas
    ├── auth/               # Login, cookies y roles
    ├── companies/          # Empresas cliente
    ├── fuel_management/    # Tanques, dispensadores, choferes, politicas y auditoria
    ├── notifications/      # Envio SMTP
    ├── reports/            # Historicos, PDFs y KPIs
    ├── sensor_data/        # Mensajes MQTT crudos
    ├── users/              # Usuarios de companias
    └── vehicles/           # Vehiculos, telemetria y consumo
```

## Roles y Accesos

La plataforma maneja tres roles principales:

- `superadmin`: administrador root de NetoFuel. Accede a `/admin` y puede gestionar empresas, usuarios root, vehiculos, tanques, dispensadores y configuracion global.
- `admin`: administrador de una compania. Accede a `/client` y puede ver la data de su empresa, crear choferes, asignarlos a vehiculos, modificar alertas y configurar recursos de su compania.
- `user`: usuario de una compania. Accede a `/client` y puede visualizar la misma informacion operativa, pero sin crear, editar ni borrar choferes, alertas o recursos.

El backend mantiene compatibilidad con cuentas legacy de tipo `company`, tratandolas como administradores de compania para operaciones existentes.

## Modulos Principales

### Autenticacion

- Login por usuario root, usuario de compania o cuenta legacy de empresa.
- Cookies HTTP-only para sesion.
- Endpoint de sesion activa.
- Logout con limpieza de cookies.

Endpoints principales:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/register`

### Empresas, Usuarios y Administradores

- Superadmins administran empresas y usuarios root desde `/admin`.
- Usuarios de companias tienen `companyId` y `companyRole`.
- El portal cliente aplica permisos visuales: `admin` edita, `user` solo consulta.

Endpoints principales:

- `GET /api/admins`
- `POST /api/admins`
- `GET /api/companies`
- `POST /api/companies`
- `GET /api/users`
- `PATCH /api/users/{user_id}/status`
- `PATCH /api/users/{user_id}/company-role`

### Vehiculos

- CRUD de vehiculos.
- Asignacion a empresa.
- Asignacion de sensor.
- Estado operativo: en linea, mantenimiento, ruta, alerta u otros estados definidos por el cliente.
- Telemetria historica por vehiculo.
- Validacion de consumo esperado contra consumo real.
- Asignacion de chofer.

Endpoints principales:

- `GET /api/vehicles`
- `POST /api/vehicles`
- `PATCH /api/vehicles/{vehicle_id}`
- `DELETE /api/vehicles/{vehicle_id}`
- `POST /api/vehicles/{vehicle_id}/telemetry`
- `GET /api/vehicles/{vehicle_id}/telemetry`

### Tanques Institucionales

- Gestion de tanques.
- Nivel, temperatura, densidad, volumen actual y capacidad.
- Telemetria por tanque.
- Umbrales configurables para llenado, drenaje y variaciones bruscas.
- Totales globales de combustible para dashboard.

Endpoints principales:

- `GET /api/fuel/tanks`
- `POST /api/fuel/tanks`
- `PATCH /api/fuel/tanks/{tank_id}`
- `DELETE /api/fuel/tanks/{tank_id}`
- `GET /api/fuel/tanks/{tank_id}`
- `POST /api/fuel/tanks/{tank_id}/telemetry`

### Dispensadores

- CRUD de dispensadores.
- Estado operativo.
- Relacion con tanques.
- Contadores volumetricos.
- Transacciones de despacho.

Endpoints principales:

- `GET /api/fuel/dispensers`
- `POST /api/fuel/dispensers`
- `PATCH /api/fuel/dispensers/{dispenser_id}`
- `DELETE /api/fuel/dispensers/{dispenser_id}`

### Choferes

- CRUD de conductores desde el portal cliente para usuarios `admin`.
- Usuarios `user` pueden consultar, pero no modificar.
- Asignacion de choferes a vehiculos.

Endpoints principales:

- `GET /api/fuel/drivers`
- `POST /api/fuel/drivers`
- `PATCH /api/fuel/drivers/{driver_id}`
- `DELETE /api/fuel/drivers/{driver_id}`

### Politicas y Transacciones de Combustible

- Recepciones de combustible.
- Politicas de suministro por vehiculo.
- Limites por turno, dia, semana o periodo.
- Registro de transacciones de repostaje con vehiculo, chofer, dispensador, hora y volumen.
- Base para conciliacion entre recepcion, almacenamiento, despacho y consumo.

Endpoints principales:

- `GET /api/fuel/receipts`
- `POST /api/fuel/receipts`
- `GET /api/fuel/policies`
- `POST /api/fuel/policies`
- `GET /api/fuel/transactions`
- `POST /api/fuel/transactions`

### Alertas

- Motor automatico de alertas para vehiculos, tanques y dispensadores.
- Configuracion personalizada de umbrales por empresa y entidad.
- Deteccion de variaciones bruscas, drenaje, llenado, robo probable y estados criticos.
- Envio de notificaciones por correo si SMTP esta configurado.

Endpoints principales:

- `GET /api/alerts`
- `GET /api/fuel/thresholds`
- `POST /api/fuel/thresholds`
- `PATCH /api/fuel/thresholds/{threshold_id}`

### Auditoria

- Registro de acciones de usuarios.
- Registro de acciones de dispositivos.
- Consulta de eventos operativos para soporte y auditorias internas.

Endpoints principales:

- `POST /api/fuel/device-actions`
- `GET /api/fuel/audit`
- `POST /api/fuel/audit`

### Reportes y KPIs

- Historico de vehiculos con filtros.
- Historico de combustible con filtros por fecha y entidad.
- Exportacion PDF basica.
- KPIs avanzados: combustible no conciliado, volumen dispensado, transacciones validas, respuesta a alarmas y metricas operativas.

Endpoints principales:

- `GET /api/reports/vehicles/{vehicle_id}/history`
- `GET /api/reports/vehicles/{vehicle_id}/history.pdf`
- `GET /api/reports/fuel/history`
- `GET /api/reports/kpis/advanced`

### Tiempo Real

- MQTT recibe mensajes de sensores.
- El backend persiste telemetria y dispara evaluacion de alertas.
- WebSocket publica eventos a clientes conectados.

Endpoint WebSocket:

- `WS /api/ws/realtime`

## Variables de Entorno

El backend usa `python/.env`. La plantilla esta en `python/.env.example`.

```env
DB_HOST=db
DB_USER=root
DB_PASS=root
DB_PORT=3306
DB_NAME=netooil
SECRET_KEY=change-me-in-production
ENV=production
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAMESITE=lax

MQTT_HOST=netotrack.com
MQTT_PORT=8883
MQTT_TOPIC=netofuel/#
MQTT_CLIENT_ID=netooil-python-ingest
MQTT_USE_TLS=true
MQTT_TLS_INSECURE=false
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_CA_CERT_PATH=cert/backup/ca.crt
MQTT_CLIENT_CERT_PATH=cert/backup/fmc650.crt
MQTT_CLIENT_KEY_PATH=cert/backup/fmc650.key

SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=NetoTrack <info@example.com>
```

Notas:

- No se debe versionar `python/.env`.
- En produccion se debe cambiar `SECRET_KEY`.
- Si se usa HTTPS, configurar `AUTH_COOKIE_SECURE=true`.
- Los secretos SMTP reales deben permanecer solo en `.env`.

## Ejecucion Local

### Backend

Desde la carpeta `python/`:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

URL local:

```text
http://localhost:8000
```

Documentacion interactiva de FastAPI:

```text
http://localhost:8000/docs
```

### Frontend

Desde la carpeta `frontend/`:

```bash
npm install
npm run dev
```

URL local:

```text
http://localhost:3000
```

Para apuntar el frontend a un backend especifico:

```env
NEXT_PUBLIC_MY_BACKEND_API=http://127.0.0.1:8000/api
```

## Ejecucion con Docker

Desde la raiz del proyecto:

```bash
docker compose up --build
```

Servicios:

- Web: `http://localhost`
- API via Nginx: `http://localhost/api`
- Backend directo: `http://localhost:8000`
- MySQL: `localhost:3306`

El proxy Nginx enruta:

- `/` hacia Next.js.
- `/api/` hacia FastAPI.
- WebSocket hacia el backend.

## Datos Demo

Al iniciar el backend se crean datos de prueba si no existen:

- Empresa demo: `usuario`.
- Usuario root inicial: `admin`.
- 50 vehiculos demo.
- 10 tanques demo.
- 10 dispensadores demo.
- Telemetria base, alertas y datos operativos suficientes para probar dashboards.

El usuario root inicial usa credenciales simples de desarrollo y debe cambiarse antes de produccion.

## Flujo Operativo

1. El sensor publica datos por MQTT.
2. `MqttIngestService` normaliza el mensaje.
3. El backend actualiza vehiculos, tanques o dispensadores.
4. El motor de alertas evalua umbrales y variaciones.
5. Se registran eventos, auditoria y telemetria.
6. Si aplica, se envia correo SMTP.
7. Los clientes conectados reciben actualizaciones por WebSocket.
8. Los reportes historicos y KPIs consultan la informacion persistida.

## Seguridad y Produccion

- Cambiar credenciales demo antes de publicar.
- Usar una `SECRET_KEY` fuerte.
- Mantener `.env` fuera de Git.
- Activar cookies seguras detras de HTTPS.
- Restringir puertos publicos de MySQL.
- Revisar permisos por rol antes de exponer nuevos endpoints.
- Configurar respaldos de base de datos para cumplir retencion historica.

## Verificacion

Comandos utiles antes de entregar cambios:

```bash
# Backend
python -m py_compile main.py auth/service.py vehicles/routes.py fuel_management/routes.py reports/service.py alerts/service.py mqtt_listener.py realtime.py

# Frontend
npx tsc --noEmit --pretty false

# Docker
docker compose config
```

## Estado de Alcance

Implementado o parcialmente implementado:

- Plataforma web responsive.
- API REST.
- Roles root, administrador de compania y usuario visualizador.
- Vehiculos, telemetria, tanques, dispensadores y choferes.
- MQTT, WebSocket y motor de alertas.
- Alertas configurables y correo SMTP.
- Reportes historicos, PDF basico y KPIs avanzados.
- Demo amplia con vehiculos, tanques y dispensadores.
- Docker Compose con Nginx.

Pendiente para una implantacion formal:

- Integracion fisica certificada con sensores de tanques y dispensadores reales.
- Validacion metrologica documentada de precision 99.5%.
- Pruebas de carga para crecimiento de flota.
- Plan operativo de instalacion, capacitacion y soporte.
- Matriz completa de permisos si se requiere granularidad por accion.
- Politicas de retencion y respaldo auditadas para garantia explicita de 5 anos.
