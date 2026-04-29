# NetoFuel Docker

## Arranque

El compose levanta cuatro servicios:

- `db`: MySQL 8.4
- `backend`: FastAPI en `8000`
- `frontend`: Next.js en `3000` interno
- `nginx`: reverse proxy publico en `80`

Usa el archivo `python/.env` para las variables reales del backend. Para crear uno limpio, toma como base `python/.env.example`.

```bash
docker compose up --build
```

URLs:

- Web: `http://localhost`
- API: `http://localhost/api`
- WebSocket: `ws://localhost/api/ws/realtime`

## Notas

- En Docker, `DB_HOST` se sobreescribe a `db`.
- El frontend se compila con `NEXT_PUBLIC_MY_BACKEND_API=/api` para pasar por Nginx.
- No subas archivos `.env` con credenciales al repositorio.
