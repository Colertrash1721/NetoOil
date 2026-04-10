# NetoFuel

Plataforma para monitoreo de flota con enfasis en backend Python para autenticacion, gestion operativa de vehiculos, ingesta MQTT de sensores y analitica de consumo de combustible.

## Stack actual

- Frontend: Next.js
- Backend: FastAPI + SQLAlchemy
- Base de datos: MySQL
- Tiempo real: MQTT

## Estructura vigente

```text
NetoFuel/
├── frontend/      # Aplicacion web
├── python/        # Backend real en FastAPI
└── README.md
```

## Backend activo

Todo el backend del proyecto vive en [`python/README.md`](/home/colertrash/Desktop/EscGroup/NetoFuel/python/README.md).

Ese documento incluye:

- arquitectura del servicio
- variables de entorno
- flujo de autenticacion
- endpoints disponibles
- procesamiento MQTT
- validacion de consumo
- reportes y alertas
- documentacion de funciones por modulo

## Ejecucion rapida del backend

Desde `python/`:

```bash
uvicorn main:app --reload
```
