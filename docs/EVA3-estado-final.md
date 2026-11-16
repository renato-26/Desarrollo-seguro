# EVA 3 — Estado final local

Cierre operativo del 16-11-2026, zona America/Santiago, anterior a la publicación. Repositorio Desarrollo-seguro, rama `feature/fullstack-mvc`; el HEAD al realizar estas verificaciones era `6d6341c`, con cambios aún sin commit. Este informe conserva resultados de esa intervención, no datos vivos de instalaciones posteriores. Para el estado de la entrega Git y sus comprobaciones nuevas consultar [publicación](EVA3-publicacion.md) y la [guía del compañero](../GUIA_COMPANERO_EVA3.txt).

**DEV y QA están saludables y ejecutan exactamente la misma imagen React/Express. PostgreSQL conserva sus contenedores y volúmenes originales. La aceptación final pasó sin fallos; las escrituras de prueba ocurrieron exclusivamente en QA.**

## 1. React

Implementado y probado: diseño original pnkSecurity, siete restaurantes, cartas/categorías, platos, imágenes, precios CLP, destacados, carrito separado por restaurante, login/logout, comentarios persistentes, estados vacíos/errores y móvil. Express sirve el build Vite real incluido en la imagen; se comprobaron HTML, JS y CSS por HTTP en ambos entornos. Se inspeccionaron las capturas desktop/móvil generadas por Playwright.

La asociación de fotos existentes está implementada; no hay upload HTTP. El carrito pertenece a `sessionStorage`, sin pedidos/pagos servidor. [Componentes y funcionamiento](EVA3-react-admin.md).

## 2. CRUD administrativo

Restaurantes, cartas, categorías, productos y usuarios: alta, listado, consulta, edición y desactivación lógica. Verificados también orden de categorías, disponibilidad, cambio de precio público, cascada de publicación al desactivar/reactivar padres, asociación de foto y carga real en React, asignación de rol/restaurantes y dashboard PostgreSQL.

Argon2id, sesiones y CSRF reutilizados. Express valida rol y ámbito original/destino en transacciones; un administrador de restaurante no gestiona recursos ajenos ni usuarios. Las cuentas de prueba QA se desactivan al finalizar. No se creó una cuenta administrativa operativa DEV ni se elevó a los dos usuarios históricos: su identidad y contraseña inicial privadas requieren una decisión del responsable. [API y permisos](EVA3-api.md).

## 3. Resultados reales de pruebas

| Verificación de aceptación de la versión final | Aprobadas | Fallidas | Omitidas |
| --- | ---: | ---: | ---: |
| Unitarias | 48 | 0 | 0 |
| Integración PostgreSQL QA | 4 | 0 | 0 |
| Playwright checkout 3401 con DB QA | 10 | 0 | 0 |
| Playwright Docker QA real 3201 antes de DEV | 10 | 0 | 0 |
| Repetición Playwright Docker QA después de DEV | 10 | 0 | 0 |
| **Ejecuciones de aceptación** | **82** | **0** | **0** |

Son 62 casos distintos, con los diez casos E2E ejecutados en tres contextos/momentos de aceptación. No se suman los intentos iniciales ni las regresiones intencionalmente fallidas de RED→GREEN a este total. Los cinco casos auxiliares offline de diagnóstico y la regresión de huella también pasaron, separados de la suite del producto.

Cobertura: React, carrito, login/logout, comentarios persistentes y XSS como texto, CRUD, precios, orden, disponibilidad, imágenes, permisos, aislamiento entre restaurantes, SQLi, CSRF, sesiones/revocación por desactivación y móvil. Integración prueba historial/checksums, relaciones, catálogo original e instalación aislada revertida. Nuevas regresiones reales QA reprodujeron y corrigieron colisión correo/nombre y comentarios posteriores al límite de100.

`npm audit --audit-level=high`: 0 vulnerabilidades, incluidas moderadas/bajas. Compose productivo: sintaxis válida sin iniciar servicios ni conectar a RDS. GitHub Actions no se ejecutó remotamente. Las pruebas no certifican exhaustivamente cada combinación de permisos ni constituyen una auditoría de producción.

## 4. DEV

- Carta: http://127.0.0.1:3101/carta/1. Administración: http://127.0.0.1:3101/admin/login.
- Backend Docker saludable, React/JS/CSS disponibles y API administrativa protegida con401 sin sesión.
- La actualización se hizo sólo después de validar QA, backup, conservación, recuperación y checksums. Se promovió el mismo ID, sin reconstruir para DEV.
- Sólo se aplicó004 mediante runner. No se ejecutaron seeds, login, CRUD ni pruebas de escritura en DEV.
- Capturas antes/después de la actualización preservan datos históricos, valores, contraseñas por huella, sesiones, intentos, secuencias y relaciones. Durante las E2E QA finales, DEV permaneció completamente idéntico a su captura posterior a004.

| Tabla DEV | Antes | Después |
| --- | ---: | ---: |
| restautantes | 7 | 7 |
| direcciones | 8 | 8 |
| cartas | 11 | 11 |
| categorias | 14 | 14 |
| items | 6 | 6 |
| usuarios | 2 | 2 |
| comentarios | 0 | 0 |

Se conservaron IDs/nombres/direcciones y valores comerciales originales; productos IDs1/2/3/4/5/7 y precios3500/2000/3500/3500/12500/9900. El producto3 mantiene su eliminación histórica. Ambos usuarios quedaron `CLIENTE`, asignaciones vacías; la nueva disponibilidad verdadera no altera visibilidad ni eliminación anteriores.

## 5. QA

- Carta: http://127.0.0.1:3201/carta/1. Administración: http://127.0.0.1:3201/admin/login.
- Backend actualizado por Compose y saludable, con la misma imagen que DEV.
-004 ya existía: el runner verificó checksums y no duplicó migraciones. La captura antes/después de migrar fue idéntica en datos/esquema/historial.
- Después de pruebas, todas las filas QA preexistentes conservan sus huellas. Se añadieron fixtures de prueba desactivados; no se borraron registros para volver a los conteos iniciales.
- Captura final:44 restaurantes,60 direcciones,53 cartas,61 categorías,37 items,43 usuarios y9 comentarios. Estos totales incluyen fixtures y no sustituyen los siete originales.

## 6. PostgreSQL

DEV `pnk_security` en5433 y QA `pnk_security_qa` en5434, PostgreSQL17. Ambos contenedores siguen saludables, con los mismos IDs, imágenes y montajes iniciales. Volúmenes distintos `pnksecurity-dev_postgres_data` y `pnksecurity-qa_postgres_data`, destino `/var/lib/postgresql/data`. Redes Compose separadas por entorno.

Cero relaciones FK huérfanas en las comprobaciones. Se conservaron todos los datos anteriores; no se recreó/detuvo PostgreSQL, no se eliminaron volúmenes ni se ejecutaron DROP/TRUNCATE/down-v/restauraciones. Las capturas SQL usaron transacciones de sólo lectura.

## 7. Migraciones

| Entorno | Inicial | Final | Acción de este cierre |
| --- | --- | --- | --- |
| QA |001–004|001–004|Runner omitió las ya aplicadas, con checksum correcto|
| DEV |001–003|001–004|Aplicó únicamente `migrate/004_admin_roles.sql`|

Los SQL001–003 y seeds históricos coinciden con Git y sus checksums.004 agrega `usuarios.rol NOT NULL DEFAULT CLIENTE` con CHECK cerrado, tabla de asignaciones con PK/FK restrictivas e índice, e `items.disponible NOT NULL DEFAULT true`. Se comprobó el esquema real y que las cuentas históricas no recibieran privilegios. Nunca se aplicó SQL004 directamente ni se editó un historial para ocultar errores.

## 8. Resguardos y evidencias

Directorio privado local: `tmp/eva3-final-20261116T071809Z/`, excluido de Git y Docker. El usuario informó además respaldos externos; no se sustituyen por este directorio.

| Resguardo | Bytes | SHA-256 |
| --- | ---: | --- |
| `qa-before.dump` |30223|`9f48fb7b179410099a5d9f9420097e42a2655430455d02949f80d1582af71333`|
| `dev-live-before.dump` |23792|`75df0c548413a9a5dcdb5988df535f825a9bda58d4d347e63cccce8e62b55094`|
| `dev-before.dump`, backend pausado |23792|`17fff1e5da30cbd9130cbb0d8cfb5386fd0c74fcfbe74aafc3d08daeeaf00466`|
| `dev-recovery-image.tar` |74984448|`5f29675d0c5976667b95110dac4d1cbc96b0f5f1e07ef41cb7da05ef0048bd78`|

Los dumps custom tienen cabecera e índice legibles por `pg_restore --list`, archivos no vacíos y SHA-256 guardado y comprobado al final. **No se probó una restauración PostgreSQL** y no se ejecutó ninguna automáticamente.

La imagen anterior DEV ausente no se recuperó con su ID original. Se resolvió una recuperación de aplicación equivalente: la imagen antigua QA disponible coincide con DEV en961 archivos/symlinks de `/app`, runtime Node/OS/binario/UID y metadatos de usuario/directorio/entrypoint/comando. Arrancó Express/carta/CSS en un contenedor separado sin red, con DB deliberadamente inaccesible. Se conservó como `pnksecurity:rollback-dev-20261116T071809Z` y archivo tar; la imagen antigua QA tiene también su etiqueta de rollback. No fue necesario detener DEV para esa comprobación. El archivo conserva la imagen mediante [Docker image save](https://docs.docker.com/reference/cli/docker/image/save/); no es un backup del volumen PostgreSQL.

Evidencias principales en ese directorio:

- `release.json`, `source.sha256`, `final-containers.json`, `final-integrity.json`.
- Capturas DEV/QA iniciales, antes/después de migración y finales; resultados de backup y recuperación.
- `qa-reportsfix-full-v2.log`, `qa-reportsfix-docker-v2.log`, `qa-final-docker-e2e.log`, `final-test-summary.json`.
- `final-http-checks.json`, validación sintáctica productiva y auditoría Git.

Capturas visuales: `test-results/carta-desktop.png`, `carta-mobile.png`, `admin-desktop.png`, `admin-mobile.png`. Informe Playwright Docker: `playwright-report/qa-docker/index.html`. Permanecen locales e ignorados, igual que los contenedores one-off de auditoría/migración retenidos para diagnóstico.

## 9. Cambios de código y build

Imagen final de ambos backends:

```text
sha256:698dbde3d786450faad50f6b47c1834f5ce51bd6bd45ab2a814df784c3258872
pnksecurity:eva3-20261116T071809Z
fuentes SHA-256: e2daebda4c537730996acf26824df57641e60e1a362e9af6e4c79dbcb7c8161c
```

Build mediante Docker Compose, `npm ci`/lockfile, React compilado, runtime de producción sin herramientas de build, Node24 no root y Argon2 hash/verify real aprobados. Se preservaron recursos originales y separación MVC.

Correcciones del cierre: prioridad de correo/nombres ambiguos en login; ventana de comentarios recientes; TLS obligatorio prod; `Cache-Control:no-store` de API; manifiesto externo de producción; protección contra `up prod` local sin TLS; ruta absoluta de informes Playwright y exclusión de artefactos de la huella. Se amplió integración y E2E para regresiones, orden, disponibilidad, jerarquía y fotos.

Se corrigió además JSON de evidencia Docker: Node recibe `docker inspect` directamente y serializa JSON, evitando pérdida de comillas por PowerShell. La evidencia original se conservó y cada diagnóstico usa una carpeta nueva. El registro nativo de tests evita tratar advertencias de stderr como excepciones de PowerShell.

## 10. Riesgos y límites pendientes

- Alta inicial de administrador DEV pendiente; no se eligieron ni publicaron credenciales. Las cuentas históricas requieren activación privada conforme al procedimiento, sin elevarlas automáticamente.
- Backups íntegros y aplicación recuperable no equivalen a restauración PostgreSQL probada. Hace falta ensayo aislado antes de producción.
- `node:24-alpine` es una etiqueta base móvil: QA/DEV comparten el ID exacto registrado, pero una reconstrucción futura no promete el mismo ID. Fijar el digest base y publicar una release inmutable forma parte de preparación productiva.
- Proxy/IP, confianza en cabeceras, TLS real/CA/hostname RDS, secretos, dos instancias, retención de sesiones y observabilidad requieren pruebas/configuración de la futura topología AWS. No existe `TRUST_PROXY` ni integración automática Secrets Manager.
- Ediciones de restaurantes crean direcciones nuevas incluso en ciertos cambios sin dirección; es una mejora menor pendiente, sin pérdida de datos ni alteración de direcciones compartidas. Los fixtures QA acumulan registros desactivados, deliberadamente sin limpieza destructiva.
- No hay upload, S3, pedidos/pagos, recuperación de contraseña ni despliegue automatizado AWS. No se presentan como funciones comprobadas.

## 11. Git al finalizar el cierre operativo

Rama obligatoria conservada, HEAD sin cambiar, modificaciones y archivos nuevos sin commit. No se hizo staging, push, merge ni cambios en otras ramas. La verificación de cierre revisa `git diff --check`, archivos preparados, secretos locales en candidatos y exclusión de credenciales, dumps/tar/temporales/reportes. Se verificaron cero archivos preparados, cero coincidencias de secretos o artefactos privados en los candidatos y enlaces/whitespace correctos. Los resultados se guardan en `git-audit-final.json`; no se adjuntan secretos ni respaldos al repositorio.

La solicitud posterior autorizó publicar la entrega con `feat(eva3): complete React CRUD and teammate setup guide`. Las validaciones de esa fase se documentan por separado en [publicación](EVA3-publicacion.md).

## 12. Preparación AWS

[Guía AWS](EVA3-AWS.md), [arquitectura](EVA3-arquitectura.md), API, README y `compose.production.yaml` preparados. El manifiesto usa imagen validada, DB externa, TLS verificado y CA montada sin incluir secretos; tiene migrador explícito sin servicio PostgreSQL. Su sintaxis pasó con valores de validación; no se conectó a RDS ni se inició producción.

Documentados EC2, ALB, Auto Scaling, Cloudflare/DNS/HTTPS, RDS privado, secretos/IAM, sesiones PostgreSQL compartidas, almacenamiento actual/futuro, migraciones y health/logs. Ningún recurso, dominio o certificado se creó o modificó.

**Listo para comenzar la fase AWS de configuración y validación revisada. Aún no listo para habilitar tráfico productivo:** faltan valores reales, infraestructura autorizada y pruebas de TLS/proxy/múltiples instancias/recuperación y operación. No existe un despliegue remoto verificado.

## 13. Decisiones registradas al finalizar el cierre operativo

1. Autorizar y definir nombre/correo de la primera cuenta `ADMIN_GENERAL` DEV; introducir una contraseña privada mediante stdin, sin guardarla en comandos/Git. No se modificaron contraseñas durante este cierre.
2. La publicación fue autorizada posteriormente únicamente en `feature/fullstack-mvc`; no se autorizó merge. Véase el informe de publicación para sus controles.
3. Elegir cuenta/región AWS, presupuesto, dominio, capacidad, red y política de recuperación. Autorizar explícitamente creación/cambios EC2/ALB/ASG/RDS/IAM/secretos/Cloudflare/DNS/HTTPS y publicación de imagen antes de ejecutarlos.
4. Proporcionar secretos y endpoints reales por mecanismos privados y aprobar la ventana de migración/despliegue productivo, ensayo de recuperación aislado y pruebas a través de los proxies reales. No compartir credenciales por el informe.
5. Sólo si se quiere upload de imágenes o pedidos/pagos: acordar ese alcance y almacenamiento; no son requisitos cumplidos por la asociación actual ni por el carrito local.

La revisión automática rechazó inicialmente la parada DEV por basarse en la autorización anterior limitada a QA. Se aportó la solicitud posterior y evidencia de las siete condiciones; el mismo comando fue aceptado después. No se eludió el control ni se usó otra vía. La actualización y sus comparaciones posteriores terminaron correctamente.
