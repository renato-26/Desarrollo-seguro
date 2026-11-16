> Documento histórico: describe una iteración anterior. El estado vigente, las pruebas y las restricciones de operación están en [EVA3-estado-final.md](EVA3-estado-final.md).

# EVA 3 — Automatización local (DEV, QA, PROD local)

## Alcance y límites

Esta automatización opera únicamente contenedores Docker de desarrollo, pruebas y **simulación local de producción**. No provisiona AWS ni configura Cloudflare. Tu compañero puede usar el repositorio actualizado como entrada para su despliegue, pero deberá adaptar la conexión a RDS, configurar secretos fuera del código y proporcionar HTTPS.

No modificar los archivos SQL aplicados anteriormente: el proyecto verifica sus checksums. Agregar nuevas migraciones y seeds numerados.

## Requisitos

- Docker Desktop / Docker Compose activos.
- Node.js 24 y `npm ci` para tests en el equipo; el proyecto declara Node 24.
- En la raíz, archivos secretos `.env` (DEV), `.env.qa` (QA), `.env.prod` (simulación PROD local). **No subirlos a Git**. La app necesita `APP_ENV`, `NODE_ENV`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `DB_SSL`.
- Los archivos `.env` son para conexiones locales; en Docker el servicio usa PostgreSQL de la red interna.

## Comandos (desde la raíz del proyecto)

| Acción | Comando |
|---|---|
| Construir, iniciar y aplicar seeds en DEV | `node scripts/stack.mjs up dev` |
| Construir, iniciar y aplicar seeds en QA | `node scripts/stack.mjs up qa` |
| Construir e iniciar PROD local | `node scripts/stack.mjs up prod` |
| Importar datos de demostración en PROD local, solo por decisión expresa | `node scripts/stack.mjs seed prod` |
| Aplicar seeds pendientes en un ambiente | `node scripts/stack.mjs seed dev` (o `qa`) |
| Comprobar salud y catálogo | `node scripts/stack.mjs check dev` (o `qa` / `prod`) |
| Ver estado de contenedores | `node scripts/stack.mjs status qa` |
| Pruebas automatizadas contra QA Docker | `node scripts/stack.mjs test qa` |
| Detener ambiente sin borrar volumen | `node scripts/stack.mjs down dev` |

Puertos fijos para evitar choques con Live Preview y PostgreSQL local:

| Ambiente | HTTP | PostgreSQL en host | Archivo |
|---|---:|---:|---|
| DEV | 3101 | 5433 | `.env` |
| QA | 3201 | 5434 | `.env.qa` |
| PROD local | 3301 | 5435 | `.env.prod` |

`up` siempre ejecuta migraciones vía dependencia `migrate` de Compose y aplica seeds en DEV/QA. `up prod` **NO** aplica seeds automáticamente: jamás importar datos de demostración en una producción real por accidente. `seed` es idempotente gracias a `schema_history` y checksums; **no ejecutarlo sobre bases que contengan datos reales ajenos al laboratorio**.

`test qa` primero verifica la configuración y el estado Docker, después ejecuta unitarias, integración SQL contra `127.0.0.1:5434` (DB `pnk_security_qa`) y Playwright E2E en el puerto 3401. Las pruebas de integración requieren una QA desechable con datos esperados y podrían fallar si se añadieron comentarios. **Nunca dirigirlas a DEV o PROD.**

El script usa `spawnSync` con argumentos separados, sin ejecutar cadenas de shell; nunca imprime credenciales. La comprobación HTTP verifica salud y una respuesta JSON del catálogo.

## Precauciones

- `down` no utiliza `-v`: no elimina volúmenes.
- Si una imagen cambió, reconstruir con `up`.
- Asegurarse de que las credenciales existentes coincidan con las de un volumen PostgreSQL ya inicializado. Cambiar `.env` **no rota** contraseñas dentro de un volumen persistente.
- No agregar `.env*` a commits, y revisar `git status -sb` y `git diff --cached --name-only`.
- PROD local usa HTTP para comprobar la carta, **no es producción real**. Las cookies `Secure` de la aplicación en modo PROD requieren HTTPS; no afirmar que se ha probado login en PROD local por HTTP.
- Evidencias recomendadas: `docker compose ps -a` por ambiente, respuesta `/api/health`, `npm test`, integración y Playwright; documentar fecha, comando y resultado.

## Entrega a AWS

Tu compañero recibe el código, el Dockerfile y las migraciones versionadas. En AWS, no ejecutar el contenedor `db` si se usa RDS: adaptar el Compose o la plataforma de despliegue para usar RDS PostgreSQL con credenciales administradas y TLS verificado. Detrás de ALB/Cloudflare revisar confianza en proxy de Express, cookies `Secure`, CSRF/origen, dominio y cabeceras HTTPS. Configurar escalamiento, logs y secretos sin incluir valores sensibles en el repositorio. El script `stack.mjs` no administra AWS y no reemplaza IaC ni CI/CD.
