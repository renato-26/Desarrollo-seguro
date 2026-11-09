# Verificación local — 2026-11-09

## Git

- Repositorio: https://github.com/renato-26/Desarrollo-seguro.git; contiene `pnkSecurity/` y `Script_BD/`, no africa-rest.
- Estado inicial: limpio, rama main, origin/main.
- `origin/mejoras` contiene commits de seguridad VUL-01 a VUL-10.
- Rama creada: `feature/fullstack-mvc`, base `7d321da7fe9b50cc7ce66fefe91d1a3709f4742c`.
- `main`/`origin/main` permanecen en `a209122ba93246cb227330bdbb835a2a31b25b23`; `origin/mejoras` permanece en la base anterior.
- PHP/frontend/dump/configuración originales intactos. Durante la implementación inicial no se realizó push, merge, reset ni cambio de remote; los cambios quedaron sin commit para revisión.

## Resultados ejecutados

| Verificación | Resultado |
| --- | --- |
| Node / npm | 24.14.1 / 11.11.0 |
| `npm test` | 7 aprobadas, 0 fallidas |
| `npm run test:e2e` | 2 aprobadas, salida 0; cliente HTTP Playwright sobre Express real |
| Express inicia y `/api/health` responde | Verificado por Playwright; 503 con DB inaccesible |
| Salud 200 | Prueba HTTP con comprobador DB inyectado; no equivale a PostgreSQL real |
| Datos comerciales del seed | Comparación exacta contra INSERT originales, salvo bit→boolean y sintaxis de identificadores |
| `node --check` | Runner SQL y servidor válidos |
| `git diff --check` | Sin errores |
| `npm audit --audit-level=high` | 0 vulnerabilidades informadas |
| `npm run test:db` | 1 fallida: ECONNREFUSED contra conexión de prueba inaccesible; sin PostgreSQL local |
| Docker / Compose / imagen | No verificado: comando docker no disponible |
| GitHub Actions | Archivo preparado, no ejecutado remotamente |

Las pruebas del esquema, claves foráneas, seed e historial necesitan PostgreSQL real. Se prepararon en `tests/integration/database.test.js` y CI; no se declaran aprobadas.

## Problemas del entorno

El entorno restringido bloqueó escritura de Git y descarga de npm; se completaron con permisos aprobados. El primer intento Playwright ejecutó ambos casos pero quedó esperando el cierre del servidor: Playwright usa taskkill en Windows. Se interrumpió y se repitió fuera del entorno restringido, con resultado final 2/2 y salida 0. Avisos NO_COLOR/FORCE_COLOR del entorno no afectaron los resultados.

Se intentó obtener PostgreSQL temporal para completar la integración sin Docker. La versión estable `embedded-postgres@17` no existe; se consultaron versiones y la descarga posterior de la versión publicada no fue autorizada. No se instaló PostgreSQL ni se creó un servicio. No se volvió a intentar por otra vía.

Decisión posterior del usuario: usar únicamente PostgreSQL mediante Docker Compose e imagen oficial estable; no instalar embedded-postgres ni versiones beta. Se comprobó que package.json y package-lock.json no contienen esa dependencia. Compose y CI usan `postgres:17-alpine`. Docker continúa sin estar disponible en PATH; las migraciones siguen sin verificarse. El README documenta cómo arrancar DEV y validar QA cuando Docker esté disponible.

## Próxima fase

## Revisión previa a publicación de rama

El usuario autorizó crear el commit de esta fase y publicar exclusivamente `feature/fullstack-mvc`, sin merge ni pull request. Se amplió `.gitignore` para excluir archivos de entorno reales, credenciales, claves privadas, datos locales, logs y temporales. Se revisaron los 35 archivos nuevos/modificados: sin binarios nuevos ni archivos grandes (máximo aproximado 37 KB, package-lock.json). El análisis de patrones de claves privadas/tokens no produjo coincidencias. Las credenciales literales nuevas corresponden a marcadores de ejemplo o pruebas desechables de CI; no se incorporaron secretos activos. Los archivos originales se conservan y ya pertenecen al historial remoto.

Se repitió `npm test`: 7 aprobadas. Las migraciones continúan sin verificación local. `git ls-remote` confirmó antes de publicar que main y mejoras conservan los hashes anteriores y que la rama feature no existe todavía en origin. El resultado del commit/push se confirmará por su hash remoto.

## Siguiente fase funcional

Ejecutar Compose y la integración SQL en un equipo con Docker/PostgreSQL; comprobar el workflow después de un push autorizado. Luego migrar una ruta de lectura de la carta reutilizando sus vistas, verificar aislamiento multirrestaurante y ampliar Playwright a navegación con navegador. Autenticación y recuperación segura deben preceder a cualquier activación de cuentas o publicación.
