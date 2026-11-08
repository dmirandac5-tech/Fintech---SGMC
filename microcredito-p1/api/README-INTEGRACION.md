# Servidor provisional de integración SGMC

**No es un backend financiero final.** Se ejecuta en `http://localhost:3000`. Compatible con el adaptador actual `web/src/api.ts`.

Funciona con Express existente en `microcredito-p1/node_modules`. Iniciar desde `microcredito-p1`: `node .\api\server.mjs`.

Puede registrar clientes ficticios, simular un plan **aproximado de cuota francesa**, listar simulaciones y consultar indicadores explícitamente vacíos. Guarda datos locales en `api/.local/demostracion.json` (excluidos de Git).

**Limitaciones reales:** no utiliza PostgreSQL/pgvector; no importa los datos oficiales; no incorpora aún el motor del dominio; no calcula mora ni prelación; no hay autorización de usuarios. Los pagos y desembolsos dan HTTP 403. El Frontend también los bloquea. No presentar las simulaciones o indicadores como transacciones financieras reales.

Rutas principales: `GET /health`, `POST /api/clientes`, `GET /api/clientes`, `POST /api/creditos/simular`, `GET /api/solicitudes`, `GET /api/creditos/:id`, `GET /api/creditos/:id/amortizacion`, `GET /api/cartera/resumen`, `GET /api/cierres/:tipo`.

Para la versión final: usar PostgreSQL, cargar dataset canónico, reutilizar políticas del núcleo financiero y proteger operaciones con permisos y aprobación humana.
