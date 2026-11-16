# EVA 3 — Entrega para el equipo

Revisión del 16-11-2026 para publicar exclusivamente en `feature/fullstack-mvc`, repositorio [renato-26/Desarrollo-seguro](https://github.com/renato-26/Desarrollo-seguro/tree/feature/fullstack-mvc). La solicitud autoriza commit y push ordinario, sin merge ni cambios en `main`/`mejoras`.

La [GUIA_COMPANERO_EVA3.txt](../GUIA_COMPANERO_EVA3.txt) contiene las secciones A–N: herramientas, clon, configuración privada por entorno, instalación, administrador por stdin, esquema y respaldos, React/CRUD, pruebas, Git, diagnóstico y preparación AWS. Los comandos de instalación son para el computador y las bases propias del compañero; no se ejecutaron para reinstalar los entornos existentes durante esta publicación.

## Cambios de preparación

- Plantillas DEV/QA congruentes con el automatizador: HTTP 3101/3201, PostgreSQL host 5433/5434, usuario local `pnk_app` y bases separadas. Se corrigió el usuario QA de ejemplo y las URLs/puertos host; las credenciales reales no se editaron.
- Regresión unitaria que analiza las plantillas con credenciales sintéticas en memoria y verifica el contrato de un clon nuevo.
- Ayuda de `stack.mjs` coherente con el bloqueo de `up prod` y URLs correctas en `start-dev.ps1`.
- Exclusiones Docker para directorios de herramientas, credenciales y llaves privadas, además de `.env`, temporales y dependencias host ya excluidos.
- README y cierre operativo enlazan el estado de publicación sin presentar resultados históricos como ejecuciones nuevas.

## Validación de esta publicación

| Verificación nueva | Resultado |
| --- | --- |
| `npm.cmd ci` | 145 paquetes instalados desde lockfile; 0 vulnerabilidades informadas |
| `npm.cmd audit --audit-level=high` | 0 vulnerabilidades |
| `npm.cmd test`, incluido build Vite | 49 aprobadas, 0 fallidas, 0 omitidas |
| Playwright `health.spec.js` contra Docker QA 3201, sin servidor temporal | 3 aprobadas, 0 fallidas; exclusivamente GET |
| Compose DEV/QA `config --quiet` | Configuración válida, sin imprimir secretos |
| Build Compose con etiqueta de publicación separada | Correcto; no recreó servicios DEV/QA |
| Auditoría de imagen sin red y con sistema de archivos de solo lectura | Node 24, usuario `node`, dependencias runtime/Argon2id y frontend compilado correctos |
| Salud HTTP y catálogo DEV/QA | Correctos mediante GET; sin login ni fixtures |
| Bloque PowerShell de alta de administrador, offline | Sintaxis y JSON UTF-8 correctos, incluidos caracteres no ASCII; llamada Docker sustituida por consumidor local |
| Capturas PostgreSQL antes/después, ambos entornos | Datos, relaciones, esquema, historial y secuencias sin cambios |
| Identidad de servicios y credenciales | IDs/imágenes/inicio de backend, contenedores/montajes PostgreSQL y hashes de archivos privados sin cambios |

Las advertencias Vite de CSS histórico son rutas servidas por Express en runtime. Los recursos se conservan en la imagen; no son errores de compilación. La advertencia Playwright `NO_COLOR/FORCE_COLOR` no afectó resultados.

La imagen de auditoría es `pnksecurity:publication-20261116t103122z`, ID Docker:

```text
sha256:464af0dc207ff1ff62dacdf41e1c6bbf121e921c4275ed05aaff0884edbdb6f2
```

Es una etiqueta local separada, no una promoción ni una imagen publicada en un registro. El build aprovechó capas válidas de la caché; la auditoría posterior comprobó el contenido y ejecutó un hash/verify real Argon2id. La etiqueta base `node:24-alpine` sigue siendo móvil: una reconstrucción futura puede tener otro ID. Para producción debe fijarse y conservarse un digest de release.

El [cierre operativo anterior](EVA3-estado-final.md) conserva 82 ejecuciones aprobadas: 48 unitarias, 4 integración QA y tres ejecuciones de 10 E2E en distintos contextos/momentos; 62 casos distintos. **No se repitieron integración ni CRUD E2E con escritura durante esta publicación**, por la condición de conservar las bases existentes. Las nuevas 49 unitarias incluyen la regresión adicional de plantillas; las 3 HTTP son solo smoke de lectura y no sustituyen la cobertura CRUD anterior.

## Conservación y seguridad

Las capturas privadas de esta fase están en `tmp/eva3-publication-20261116T103122Z/`, fuera de Git y del contexto Docker. La comparación terminó correctamente: datos, relaciones, valores, huellas, secuencias, sesiones, esquema e historial idénticos mediante transacciones de solo lectura, junto con IDs/imágenes/montajes PostgreSQL e identidad de los backends. No se publican las filas particulares de DEV ni sus credenciales.

No se ejecutaron migraciones, seeds, bootstrap de administrador, restauraciones, recreaciones de servicios ni pruebas de escritura en DEV o QA para esta entrega. No se eliminaron contenedores PostgreSQL ni volúmenes. Los hashes privados de `.env`, `.env.qa` y `.env.prod` permiten comprobar que sus archivos se conservaron.

Antes del commit se revisan candidatos e índice: exclusión de `.env` reales, credenciales AWS, tokens, llaves, dumps, `tmp`, dependencias, builds y capturas privadas; búsqueda de secretos reales locales sin imprimirlos; `git diff --check` y enlaces internos. Los archivos de ejemplo documentan campos vacíos/marcadores, no secretos compartidos. No se modifica ni reescribe el historial Git existente.

La publicación usa el mensaje solicitado `feat(eva3): complete React CRUD and teammate setup guide` y push ordinario a la rama autorizada. El hash definitivo se obtiene del commit y se contrasta con la referencia remota; el blob remoto de la guía debe coincidir con el local. No se realiza merge, force push ni despliegue.

## Continuidad

El compañero debe seguir la guía en su equipo y ejecutar las suites completas en su propia QA. Clonar Git descarga código y datos semilla académicos, no imágenes Docker locales ni las bases privadas del autor.

AWS y Cloudflare siguen pendientes de infraestructura y pruebas reales. [La preparación AWS](EVA3-AWS.md) documenta RDS/TLS, EC2/ALB/Auto Scaling, sesiones compartidas, secretos, fotos y recuperación. No se crearon recursos con costo, no se desplegó y no se publicaron secretos ni respaldos.
