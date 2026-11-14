# EVA 3 — Nueva carta digital funcional (primera iteración)

**Nuevo en esta entrega:** frontend independiente del PHP original, API de lectura de restaurantes/carta/productos y pruebas de consultas parametrizadas. La autenticación, el carrito y los comentarios aún no se migran. La verificación completa exige Docker + PostgreSQL real. Ver [registro EVA3](docs/EVA3-avance.md).

**Acceso (una vez preparado `.env`, ejecutadas las migraciones y el seed):** `http://localhost:3000` o `http://localhost:3000/carta/1`. Para arrancar en Windows, `powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1`. Se requiere Docker Desktop activo.

**Rutas API:** `/api/restaurantes`, `/api/restaurantes/:id/carta`, `/api/health`. Los datos se obtienen exclusivamente de PostgreSQL. Si la DB no está accesible, el frontend informa del problema; no presenta datos ficticios.

---

# Desarrollo Seguro — pnkSecurity

Evolución de la carta digital multirrestaurante original a Full Stack MVC, en `feature/fullstack-mvc`, basada en `origin/mejoras` (7d321da). PHP y frontend originales se conservan como referencia histórica. Se añadió un frontend nuevo que consume la API de lectura de restaurantes, cartas, categorías y platos; autenticación, carrito, comentarios y escritura siguen pendientes.

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

La API no sirve PHP ni el dump ni los directorios sensibles del repositorio. Express sirve el frontend nuevo en `/` y `/carta/:id`, con recursos estáticos únicamente desde `frontend/public` a través de `/static`. Nunca publicar el PHP o el dump mediante un servidor estático.

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

- Preparados: base MVC, health endpoint, API de lectura de carta/restaurantes, frontend nuevo, esquema/seed PostgreSQL, runner SQL, Docker, plantillas de ambientes y workflow QA.
- Pendientes: validación real en Docker/PostgreSQL, recuperación/autenticación segura, carrito, comentarios, permisos de escritura por restaurante, protección CSRF y límites de solicitudes para rutas sensibles.
- Registro EVA3: [nueva interfaz y API de lectura](docs/EVA3-avance.md). Verificación anterior (9/11): [informe histórico](docs/verification.md).
- Detalles de conversión y credenciales: [migración](docs/migration.md).
- Publicación futura: [Cloudflare y AWS](infrastructure/README.md).

## Integrantes

- Renato Muñoz
- Alejandro Tapia
- Sebastian Larraguibel
