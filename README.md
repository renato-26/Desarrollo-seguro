# pnkSecurity — EVA 3

Aplicación React + Vite, Express MVC y PostgreSQL. Rama de trabajo: `feature/fullstack-mvc`.

**Entrega local React + CRUD completa.** Para instalar en un equipo nuevo, seguir la [GUIA_COMPANERO_EVA3.txt](GUIA_COMPANERO_EVA3.txt), con requisitos, credenciales propias, comandos DEV/QA, primer administrador y continuidad del equipo.

La [validación de publicación](docs/EVA3-publicacion.md) aprobó 49 unitarias, 3 pruebas HTTP QA de solo lectura y build Compose auditado. No modificó las bases ni actualizó los servicios DEV/QA. El [cierre operativo anterior](docs/EVA3-estado-final.md) conserva la evidencia histórica de 82 ejecuciones de aceptación, incluidas integración y CRUD E2E en QA; estas suites con escritura no se repitieron para publicar.

## Acceso local

| Entorno | Carta | Administración | PostgreSQL |
| --- | --- | --- | --- |
| DEV | http://127.0.0.1:3101/carta/1 | http://127.0.0.1:3101/admin/login | 127.0.0.1:5433 / pnk_security |
| QA | http://127.0.0.1:3201/carta/1 | http://127.0.0.1:3201/admin/login | 127.0.0.1:5434 / pnk_security_qa |

Las credenciales y los datos particulares de cada instalación no se publican. En un entorno nuevo, el script `scripts/create-admin.js` crea exclusivamente una cuenta administrativa nueva mediante JSON por stdin, con identidad y contraseña propias; no eleva una cuenta existente. La guía TXT incluye el procedimiento. Las cuentas de fixtures QA se desactivan al terminar las suites completas.

## Funcionalidad

- Diseño y recursos originales de pnkSecurity; siete restaurantes, cartas, categorías, platos, imágenes, destacados y precios CLP.
- Carrito por restaurante en `sessionStorage`, login/logout y comentarios persistidos con texto escapado.
- Administración de restaurantes, cartas, categorías, productos y usuarios; edición, orden, disponibilidad, roles, asignaciones y desactivación lógica.
- Dashboard real desde PostgreSQL; autorización de origen y destino en Express y transacciones para escrituras.
- Argon2id, sesiones PostgreSQL, CSRF, consultas parametrizadas, cookies seguras en producción y API `no-store`.
- Fotografías existentes JPG/PNG/WebP del mismo restaurante, con firma y tamaño validados. No hay API de subida ni almacenamiento S3 implementados.

## Desarrollo y pruebas

Requisitos: Node.js 24, Docker Desktop con contenedores Linux y Compose, dependencias del lockfile y Chromium de Playwright. PostgreSQL se mantiene en Docker, con volúmenes persistentes separados. No sobrescribir `.env`, `.env.qa` ni otras credenciales existentes.

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
node scripts/stack.mjs test qa
node scripts/maintenance/e2e-qa-docker.mjs
```

`stack.mjs test qa` fija HTTP temporal 3401 y PostgreSQL QA 5434; hace build, unitarias, integración y Playwright. El último auxiliar comprueba el aislamiento y prueba la imagen QA real en 3201. Ambas suites con escritura son exclusivamente QA. `npm.cmd test` compila y ejecuta sólo unitarias.

Ejecutar las suites con escritura únicamente en una QA propia autorizada. Para comprobar la QA existente sin fixtures, la guía documenta la selección exclusiva de `tests/e2e/health.spec.js` con la configuración Docker.

Para editar React con recarga:

```powershell
npm.cmd run dev:frontend
```

Vite sirve 5173 con proxy al backend DEV 3101. Para ejecutar Express desde el checkout, compilar primero y configurar explícitamente el entorno/puerto; Docker usa `node backend/src/server.js`, sin cargar archivos de credenciales en la imagen.

## Docker y migraciones

El Dockerfile compila React en una etapa, copia `frontend/dist` y recursos históricos y ejecuta Node como usuario `node`. La imagen final contiene dependencias de producción y Argon2 funcional, sin Vite/Playwright ni `.env`.

DEV y QA tienen 001–004 aplicadas. La migración 004 añade roles seguros por defecto, asignaciones restrictivas y disponibilidad; conserva datos anteriores. Los SQL históricos y seeds no cambiaron. Usar siempre `node database/run.js migrate` con la imagen y conexión del entorno correctas; nunca aplicar 004 directamente ni volver a importar seeds para actualizar datos existentes.

Para intervenciones futuras seguir el [procedimiento Compose](docs/superpowers/plans/2026-11-16-compose-update.md) y sus controles, usando capturas y backups nuevos. La ejecución efectiva de este cierre se documenta en [finalización local](docs/superpowers/plans/2026-11-16-local-finalization.md). `tmp/refresh-existing.mjs` está descartado. No usar `docker cp` para actualizar código ni eliminar volúmenes.

`compose.yaml` es local DEV/QA. El comando heredado `stack.mjs up prod` se rechaza: ese Compose tiene PostgreSQL local sin TLS. [compose.production.yaml](compose.production.yaml) prepara una aplicación con DB externa, TLS verificado, CA montada y una imagen ya validada; no inicia una DB ni aplica migraciones implícitas. Sólo se validó su sintaxis, no se inició producción.

## Documentación

- [Guía completa del compañero, instalación y continuidad](GUIA_COMPANERO_EVA3.txt).
- [Validación de publicación y conservación de DEV/QA](docs/EVA3-publicacion.md).
- [Estado final, pruebas, backups y pendientes](docs/EVA3-estado-final.md).
- [React y panel CRUD](docs/EVA3-react-admin.md).
- [API REST y permisos](docs/EVA3-api.md).
- [Arquitectura, sesiones y almacenamiento](docs/EVA3-arquitectura.md).
- [Preparación AWS: EC2, ALB, Auto Scaling, RDS, TLS y Cloudflare](docs/EVA3-AWS.md).
- [Revisión independiente y cierre de hallazgos](docs/EVA3-revision-final.md).

AWS/Cloudflare permanecen sin desplegar. La guía distingue preparación de pruebas reales pendientes, incluidos TLS remoto, proxy, secretos y múltiples instancias. La entrega se publica en `feature/fullstack-mvc`; no integra cambios en `main` ni `mejoras`.

## Equipo

Renato Muñoz · Alejandro Tapia · Sebastian Larraguibel.
