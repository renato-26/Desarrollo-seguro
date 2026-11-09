# Desarrollo Seguro — pnkSecurity

Evolución de la carta digital multirrestaurante original a Full Stack MVC, en `feature/fullstack-mvc`, basada en `origin/mejoras` (7d321da). PHP y frontend originales se conservan como referencia; no se ha rediseñado la carta ni migrado todavía autenticación, carrito, comentarios o consultas de negocio.

## Stack y arquitectura

Node.js 24, Express 5, PostgreSQL 17, Docker Compose, Playwright y GitHub Actions. Cloudflare es la primera plataforma prevista; AWS será una fase posterior. No se ha desplegado ni creado infraestructura.

```text
backend/src/
  config/        Variables validadas y pool PostgreSQL
  routes/        Rutas HTTP
  controllers/   Traducción de solicitudes/respuestas
  services/      Lógica de disponibilidad
  models/        Acceso PostgreSQL
  views/         Reserva para migración de vistas existentes
  middleware/    Errores centralizados y 404
database/
  migrations/    Esquema versionado
  seeds/         Datos originales sin contraseñas activas
tests/           Unitarias HTTP, integración SQL y Playwright
infrastructure/  Plantillas QA/PROD y plan Cloudflare/AWS
docs/            Decisiones y estado de migración
pnkSecurity/     Aplicación original PHP sin cambios
```

## Instalación local

PostgreSQL se ejecuta mediante Docker Compose con la imagen oficial estable `postgres:17-alpine`. No se utiliza embedded-postgres ni versiones beta. Requisitos: Docker con Compose v2; Node.js 24 para desarrollar y ejecutar las pruebas desde el equipo.

Para ejecutar todo el backend y PostgreSQL, seguir la sección Docker local. Para desarrollar Express con recarga automática usando la misma DB en Docker:

```powershell
npm ci
Copy-Item .env.example .env
# Definir POSTGRES_PASSWORD y completar DATABASE_URL con la misma contraseña.
# DATABASE_URL usa localhost; codificar caracteres especiales de la contraseña para URL.
docker compose up -d --wait db
npm run db:migrate
npm run db:seed
npm run dev
```

`GET http://localhost:3000/api/health` responde 200 con `{"status":"ok","database":"up"}` si PostgreSQL acepta `SELECT 1`. Responde 503 con estado `degraded` si la DB no está disponible. El proceso HTTP puede arrancar con DB caída. Esta comprobación no valida la versión del esquema: ejecutar migraciones antes de habilitar tráfico.

La API no sirve PHP ni el directorio raíz. El frontend sigue funcionando bajo su entorno PHP original mientras se migra; Express aún no lo integra. Nunca publicar el PHP o el dump mediante un servidor estático.

## Docker local (DEV)

Si Docker todavía no está instalado, dejar estos pasos pendientes. Instalar e iniciar Docker Desktop con soporte para contenedores Linux y comprobar `docker version` y `docker compose version` antes de continuar. No hace falta instalar PostgreSQL en Windows.

```powershell
Copy-Item .env.example .env
# Definir POSTGRES_PASSWORD en .env. Compose pasa el secreto separado de la URL.
docker compose config --quiet
docker compose up --build -d
docker compose run --rm migrate node database/run.js seed
Invoke-RestMethod http://localhost:3000/api/health
docker compose ps
docker compose logs backend migrate
docker compose stop
```

Compose inicia PostgreSQL con volumen persistente, espera su health check, aplica el esquema y arranca Express. El seed es explícito. Backend usa usuario no root y health check HTTP. DB y HTTP se exponen solo en loopback. `stop` conserva datos. Si cambias la contraseña de `.env` después de inicializar el volumen, PostgreSQL no cambia la contraseña existente automáticamente.

Para QA copiar `infrastructure/env/qa.env.example` a `.env.qa`, completar secretos y ejecutar `docker compose --env-file .env.qa up --build -d`. El nombre de proyecto, DB, puertos y volumen quedan separados de DEV. PROD es una plantilla futura, no usar Compose local como despliegue productivo.

Para ejecutar la integración SQL desde Node contra PostgreSQL en Docker, usar una base QA desechable:

```powershell
Copy-Item infrastructure/env/qa.env.example .env.qa
# Completar POSTGRES_PASSWORD y DATABASE_URL en .env.qa con la misma contraseña.
docker compose --env-file .env.qa up -d --wait db
node --env-file=.env.qa --test tests/integration/*.test.js
docker compose --env-file .env.qa stop
```

Ejecutar este bloque en una terminal sin variables APP_ENV, NODE_ENV o DATABASE_URL exportadas de otro ambiente: las variables de la terminal tienen prioridad sobre el archivo. El seed y las migraciones solo se consideran verificados después de que la integración termine con salida 0 contra PostgreSQL real. Actualmente siguen pendientes de esa validación local.

## Pruebas y QA asistida por IA

```powershell
npm test
npm run test:e2e
# PostgreSQL real: usar exclusivamente DB QA vacía/desechable.
$env:APP_ENV='qa'
$env:NODE_ENV='test'
$env:DATABASE_URL='postgresql://pnk_qa:CLAVE@localhost:5433/pnk_security_qa'
npm run test:db
$env:EXPECT_DATABASE_UP='1'
npm run test:e2e
```

Playwright usa actualmente su cliente HTTP contra Express real; no requiere descargar navegadores. Sin DATABASE_URL usa una conexión deliberadamente inaccesible y verifica 503. Con DB configurada y `EXPECT_DATABASE_UP=1` exige 200. GitHub Actions prepara PostgreSQL, ejecuta integración y Playwright, audita dependencias y construye la imagen; no publica ni despliega.

La prueba SQL valida conteos, IDs, claves foráneas, secuencias, usuarios sin credenciales y repetición de migraciones/seed. Altera temporalmente el checksum para comprobar rechazo y lo restaura al finalizar: usar exclusivamente una base QA desechable.

En la siguiente fase, usar IA para proponer casos Playwright a partir de las rutas PHP: selección entre siete restaurantes, aislamiento de cartas/productos, login, carrito, comentarios y regresiones SQLi/XSS/autorización. Revisar las aserciones y usar datos QA sin secretos. Añadir pruebas de navegador cuando las vistas estén conectadas a Express.

## Estado y pendientes

- Preparados: base MVC, health endpoint, esquema/seed PostgreSQL, runner SQL, Docker, plantillas de ambientes y workflow QA.
- Pendientes: migración incremental de vistas y funciones PHP, recuperación/autenticación segura, permisos por restaurante, protección CSRF y límites de solicitudes para rutas sensibles.
- Verificación local y limitaciones: [informe](docs/verification.md).
- Detalles de conversión y credenciales: [migración](docs/migration.md).
- Publicación futura: [Cloudflare y AWS](infrastructure/README.md).

## Integrantes

- Renato Muñoz
- Alejandro Tapia
- Sebastian Larraguibel
