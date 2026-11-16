> Ejecución completada el 16-11-2026 bajo la autorización autónoma posterior. DEV y QA actualizados y verificados; consultar [estado final](../../EVA3-estado-final.md). El cuerpo siguiente conserva el procedimiento original revisado y sus anotaciones previas a la ejecución.

# Actualización reproducible DEV/QA con Docker Compose

> Estado: procedimiento preparado para revisión. **No autorizado ni ejecutado.** `tmp/refresh-existing.mjs` queda descartado: no se ejecutará ni se copiará código dentro de contenedores.
>
> Para ejecución posterior: seguir los controles de verificación de Superpowers. La autorización del usuario es requisito previo para cualquier construcción, parada, migración o recreación de servicios de este procedimiento.

**Goal:** activar la aplicación React/Express mediante una imagen Docker comprobada, conservando los datos, relaciones, sesiones, contenedores y volúmenes PostgreSQL existentes.

**Architecture:** construir una sola imagen con Compose, verificarla y probarla primero en QA; promover exactamente el mismo ID a DEV. Ejecutar la migración con el servicio `migrate` de esa imagen y recrear únicamente `backend`, con `--no-deps`.

**Tech Stack:** Node 24, React 19.3.1, Vite 8.3.8, Express 5.3.0, PostgreSQL 17, Docker Compose y Playwright 1.65.0.

**Spec:** petición del usuario del 16-11-2026 y revisión del procedimiento anterior. La aplicación implementada se documenta en `docs/EVA3-react-admin.md`.

## Restricciones

- Sólo `feature/fullstack-mvc`; conservar cambios locales. Sin commit, push, AWS ni infraestructura remota.
- Sin `docker cp`, ejecución del script anterior, seeds automáticos o pruebas con escritura en DEV.
- No ejecutar `down`, `down -v`, eliminación de volúmenes, `DROP`, `TRUNCATE` ni restauraciones automáticas.
- Los contenedores PostgreSQL, su imagen y sus montajes deben conservarse; no reconstruir ni recrear el servicio `db`.
- La recreación de `backend` es deliberada y quedará incluida en la autorización: cambia el contenedor de aplicación, no la base ni el volumen.
- No cambiar `.env`, `.env.qa`, contraseñas ni cuentas. El alta inicial de administrador queda fuera de esta actualización.
- Cualquier comando fallido o diferencia no prevista detiene la secuencia antes de avanzar al siguiente entorno.

## Revisión ya realizada, sin actualizar servicios

La captura `tmp/update-review-20261116/dev-baseline.json` se tomó con `default_transaction_read_only=on`, transacción REPEATABLE READ READ ONLY, timeouts y salida sin contraseñas ni hashes de acceso. Contiene:

| DEV | Filas |
| --- | ---: |
| restautantes | 7 |
| direcciones | 8 |
| cartas | 11 |
| categorias | 14 |
| items | 6 |
| usuarios | 2 |
| comentarios | 0 |

- Cero huérfanos en las relaciones restaurante/dirección, carta/restaurante, categoría/carta, producto/categoría, comentario/restaurante, comentario/usuario y sesión/usuario.
- Conservados los siete IDs y nombres originales y sus direcciones 2–8.
- Productos originales: IDs 1/2/3/4/5/7, precios CLP 3500/2000/3500/3500/12500/9900. El ID 3 conserva su eliminación histórica; no se reactiva. Se registraron categorías, orden, visibilidad, destacados, fotos, descripciones, fechas y valores restantes.
- Fotos corregidas por el seed ya aplicado: ID 2 `crema_espinacas.jpg`, ID 7 `item5.jpg`.
- Se guardaron huellas SHA-256 por fila de las siete tablas comerciales (incluyen internamente credenciales y comentarios sin exponer sus valores), secuencias `last_value/is_called`, esquema, índices, restricciones, historial, roles/disponibilidad y huellas de sesiones/intentos.
- DEV tiene migraciones 001–003; QA tiene 001–004. Los checksums de todas las migraciones y ambos seeds aplicados coinciden con sus archivos. No hay diferencias de los SQL históricos frente a `6d6341c`.
- Volúmenes distintos: `pnksecurity-dev_postgres_data` y `pnksecurity-qa_postgres_data`; ambos montados en `/var/lib/postgresql/data`. IDs de los dos contenedores PostgreSQL distintos y registrados completos en sus capturas.
- `npm.cmd ls --depth=0` confirmó dependencias instaladas sin faltantes. Se comprobaron sintaxis y comparadores locales; no se ejecutaron migración, backup, build, parada, recreación ni E2E en esta revisión.
- El contexto PowerShell se comprobó con un doble local de Docker: argumentos, puertos separados y restauración de variables funcionan sin ejecutar Docker. El comparador aceptó una simulación local de las adiciones de 004 y rechazó cambios de filas, privilegios, secuencias, contenedor, restricciones y sesiones. Esas simulaciones no aplicaron SQL ni sustituyen la verificación posterior a una migración real.

Estas capturas son evidencia de revisión. **Se tomarán capturas nuevas al ejecutar**, antes de modificar servicios, y otra captura estable con el backend del entorno detenido antes de migrar. No se usará una captura antigua para justificar datos que hayan cambiado legítimamente.

## Migración 004: alcance y controles

`004_admin_roles.sql` añade únicamente:

1. `usuarios.rol varchar(24) NOT NULL DEFAULT 'CLIENTE'`, con CHECK cerrado a `CLIENTE`, `ADMIN_GENERAL` y `ADMIN_RESTAURANTE`. No convierte cuentas históricas en administradores ni cambia contraseñas/estado.
2. `usuario_restaurantes`: ambas referencias NOT NULL, PK compuesta `(usuario_id, restaurante_id)`, dos FK con `ON DELETE RESTRICT` e índice por restaurante. Al aplicarse inicialmente en DEV debe quedar vacía.
3. `items.disponible boolean NOT NULL DEFAULT true`, que conserva la disponibilidad de la oferta existente sin cambiar `visible` ni `eliminado`.

No hay modificaciones ni borrados de filas comerciales, cambios de tipos históricos, renumeración de IDs ni reinicio de secuencias. Los ADD COLUMN requieren bloqueos de esquema; se hará una parada breve del backend del entorno y se detendrá el procedimiento si no se obtienen los locks o falla cualquier sentencia. PostgreSQL documenta este comportamiento en [ALTER TABLE 17](https://www.postgresql.org/docs/17/sql-altertable.html).

Se ejecutará **mediante `node database/run.js migrate`**, nunca aplicando el archivo SQL directamente: el runner comprueba checksums, obtiene advisory lock y usa BEGIN/COMMIT con ROLLBACK por migración. En QA, 004 ya aplicada se omite si coincide el checksum; en DEV debe ser la única migración pendiente. No se editará ese SQL, porque QA ya registra su checksum.

## Auxiliares preparados para revisión

| Archivo | Función | Estado de ejecución |
| --- | --- | --- |
| `scripts/maintenance/capture-snapshot.mjs` + `pre-update-snapshot.sql` | Sólo lectura; captura estado, filas/relaciones, esquema e identidad del volumen | Ejecutado para las capturas de revisión |
| `compare-snapshots.mjs` | Sólo compara archivos locales; admite validación de 004 y `--unchanged` | Comprobado con capturas existentes; no prueba una migración DEV |
| `compose-context.ps1` | Define funciones con ambientes separados y comprobación de códigos de salida | Sintaxis comprobada; sin ejecutar comandos de actualización |
| `backup-database.mjs` | `pg_dump -Fc` en sólo lectura, flujo binario a archivo nuevo e índice legible con `pg_restore --list` | Preparado, no ejecutado |
| `verify-image.mjs` | Comprueba build/dependencias en un contenedor efímero de auditoría sin conectar a PostgreSQL | Preparado, no ejecutado |
| `e2e-qa-docker.mjs` + `playwright.qa-docker.config.mjs` | E2E sobre Docker QA real, puerto 3201, sin servidor temporal | Preparado, no ejecutado |

El contexto Compose valida `.env` mediante las funciones existentes de `stack.mjs`, limpia temporalmente variables heredadas que podrían mezclar ambientes, fija proyecto/archivo/puertos y restaura el entorno del proceso al terminar. No imprime secretos ni usa `compose config` completo.

Se añadieron `tmp` y `temp` a `.dockerignore` para que capturas y backups no se envíen al contexto de construcción. Ya estaban excluidos de Git. Los backups contienen datos privados: no publicarlos ni adjuntarlos al repositorio.

## Comandos exactos, únicamente después de autorización

Ejecutar por bloques, en la misma terminal. No pegar toda la secuencia sin revisar los resultados y condiciones de cada bloque. Los comandos de construcción/migración/recreación de las secciones siguientes **no se han ejecutado**.

### 1. Preparar terminal y registrar ambos entornos

En este equipo PowerShell bloquea scripts por defecto. Abrir un proceso de terminal con política limitada a ese proceso; no modificar políticas permanentes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -NoExit
```

En esa terminal:

```powershell
Set-Location -LiteralPath 'C:\Users\renat\OneDrive\Escritorio\Desarrollo-seguro'
$ErrorActionPreference = 'Stop'
. ./scripts/maintenance/compose-context.ps1
if ((git branch --show-current).Trim() -ne 'feature/fullstack-mvc') { throw 'Rama incorrecta' }
$stamp = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
$auditDir = "tmp/compose-update-$stamp"
New-Item -ItemType Directory -Path $auditDir | Out-Null
git status --short | Set-Content -Encoding UTF8 "$auditDir/git-status.txt"
$historicalChanges = git diff 6d6341c -- database/migrations/001_initial_schema.sql database/migrations/002_auth_sessions.sql database/migrations/003_comments_user.sql database/seeds
if ($historicalChanges) { throw 'Cambios no permitidos en SQL historico' }
Invoke-PnkDocker -DockerArgs @('compose','version')
if ($env:DOCKER_HOST -and -not $env:DOCKER_HOST.StartsWith('npipe://')) { throw 'DOCKER_HOST remoto no permitido' }
$dockerContext = (Invoke-PnkDocker -DockerArgs @('context','show')).Trim()
$dockerEndpoint = (Invoke-PnkDocker -DockerArgs @('context','inspect',$dockerContext,'--format','{{.Endpoints.docker.Host}}')).Trim()
if (-not $dockerEndpoint.StartsWith('npipe://')) { throw 'Se requiere Docker Desktop local en este equipo Windows' }
if ((Invoke-PnkDocker -DockerArgs @('info','--format','{{.OSType}}')).Trim() -ne 'linux') { throw 'Se requieren contenedores Linux' }
Invoke-PnkNode -NodeArgs @('--version')
& npm.cmd ls --depth=0
if ($LASTEXITCODE -ne 0) { throw 'Dependencias incompletas' }
Invoke-PnkCompose -Target dev -ComposeArgs @('config','--quiet')
Invoke-PnkCompose -Target qa -ComposeArgs @('config','--quiet')
Invoke-PnkCompose -Target dev -ComposeArgs @('ps','-a')
Invoke-PnkCompose -Target qa -ComposeArgs @('ps','-a')
Invoke-PnkNode -NodeArgs @('scripts/maintenance/capture-snapshot.mjs','dev',"$auditDir/dev-initial.json")
Invoke-PnkNode -NodeArgs @('scripts/maintenance/capture-snapshot.mjs','qa',"$auditDir/qa-initial.json")
$devInitial = Get-Content -Encoding UTF8 -Raw "$auditDir/dev-initial.json" | ConvertFrom-Json
$qaInitial = Get-Content -Encoding UTF8 -Raw "$auditDir/qa-initial.json" | ConvertFrom-Json
foreach ($snapshot in @($devInitial,$qaInitial)) {
    if (@($snapshot.database.orphans.PSObject.Properties.Value | Where-Object { $_ -ne 0 }).Count -ne 0) { throw 'Relaciones huerfanas: detener' }
}
$devVolume = @($devInitial.dbIdentity.mounts | Where-Object Destination -eq '/var/lib/postgresql/data')[0].Name
$qaVolume = @($qaInitial.dbIdentity.mounts | Where-Object Destination -eq '/var/lib/postgresql/data')[0].Name
if ($devInitial.dbIdentity.id -eq $qaInitial.dbIdentity.id -or $devVolume -eq $qaVolume) { throw 'DEV/QA comparten PostgreSQL o volumen' }
$sourceFingerprint = Get-PnkSourceFingerprint
$sourceFingerprint | Set-Content -Encoding UTF8 "$auditDir/source.sha256"
$oldDevImage = (Invoke-PnkDocker -DockerArgs @('inspect','--format','{{.Image}}','pnksecurity-dev-backend-1')).Trim()
$oldQaImage = (Invoke-PnkDocker -DockerArgs @('inspect','--format','{{.Image}}','pnksecurity-qa-backend-1')).Trim()
Invoke-PnkDocker -DockerArgs @('image','tag',$oldDevImage,"pnksecurity:rollback-dev-$stamp")
Invoke-PnkDocker -DockerArgs @('image','tag',$oldQaImage,"pnksecurity:rollback-qa-$stamp")
```

**Puerta:** confirmar conteos/valores, roles existentes, CHECK/FK e historial de las capturas. DEV debe conservar los siete originales y sólo 001–003; QA debe tener 004 con checksum correcto. Si aparece otra migración, un seed pendiente, un estado incoherente o actividad de otro cliente, detener y revisar. No ejecutar seeds para corregir una diferencia.

El contexto local se comprueba antes de operar para evitar dirigir la intervención a un Docker remoto. Los logs/capturas no incluyen el bloque de variables de entorno con credenciales.

### 2. Construir una vez con Compose y comprobar la imagen

```powershell
Invoke-PnkCompose -Target qa -ComposeArgs @('build','backend')
$releaseImage = (Invoke-PnkDocker -DockerArgs @('image','inspect','pnksecurity-qa-backend','--format','{{.Id}}')).Trim()
$releaseTag = "pnksecurity:eva3-$stamp"
Invoke-PnkDocker -DockerArgs @('image','tag',$releaseImage,$releaseTag)
Invoke-PnkDocker -DockerArgs @('image','tag',$releaseImage,'pnksecurity-qa-migrate')
if ((Get-PnkSourceFingerprint) -ne $sourceFingerprint) { throw 'Fuentes modificadas durante el build' }
$imageUser = (Invoke-PnkDocker -DockerArgs @('image','inspect',$releaseTag,'--format','{{.Config.User}}')).Trim()
$imageCmd = (Invoke-PnkDocker -DockerArgs @('image','inspect',$releaseTag,'--format','{{json .Config.Cmd}}')) | ConvertFrom-Json
if ($imageUser -ne 'node' -or ($imageCmd -join ' ') -ne 'node backend/src/server.js') { throw 'Usuario o comando de arranque incorrecto' }
$auditMount = (Join-Path (Get-Location).Path 'scripts/maintenance').Replace('\','/') + ':/audit:ro'
Invoke-PnkCompose -Target qa -ComposeArgs @('run','--no-deps','--pull','never','-T','--name',"pnksecurity-qa-image-audit-$stamp",'--volume',$auditMount,'backend','node','/audit/verify-image.mjs')
@{ tag=$releaseTag; image=$releaseImage; source=$sourceFingerprint; rollbackDev=$oldDevImage; rollbackQa=$oldQaImage } | ConvertTo-Json | Set-Content -Encoding UTF8 "$auditDir/release.json"
```

El Dockerfile usa `npm ci` con `package-lock.json`, compila Vite en una etapa y copia `frontend/dist` a la imagen final. La auditoría exige JS/CSS referenciados realmente presentes, estilos originales, Node 24, usuario `node`, Argon2 nativo funcional, dependencias de runtime sin faltantes, ausencia de `.env` y ausencia de Vite/Playwright en runtime. Su bind mount es sólo de auditoría y de sólo lectura; no cambia código dentro de la aplicación ni conecta a la DB.

**Reproducibilidad de la entrega:** QA y DEV usarán el mismo ID de imagen verificado y conservado con etiqueta de release; no se reconstruye entre ambos. `node:24-alpine` sigue siendo una etiqueta de base móvil en el Dockerfile actual: para reproducir byte a byte una construcción futura habría que fijar también su digest. No se promete que una reconstrucción de esa etiqueta otro día produzca el mismo ID. La actualización aprobada sí queda ligada al ID exacto registrado.

### 3. QA: backup, migración controlada y conservación de datos

Pausar escrituras externas a QA durante este bloque. Mantener DEV funcionando.

```powershell
Invoke-PnkCompose -Target qa -ComposeArgs @('stop','backend')
Invoke-PnkNode -NodeArgs @('scripts/maintenance/capture-snapshot.mjs','qa',"$auditDir/qa-before-migrate.json")
Invoke-PnkNode -NodeArgs @('scripts/maintenance/backup-database.mjs','qa',"$auditDir/qa-before.dump")
Get-FileHash -Algorithm SHA256 -LiteralPath "$auditDir/qa-before.dump" | Format-List
if ((Invoke-PnkDocker -DockerArgs @('image','inspect','pnksecurity-qa-migrate','--format','{{.Id}}')).Trim() -ne $releaseImage) { throw 'Imagen de migracion incorrecta' }
Invoke-PnkCompose -Target qa -ComposeArgs @('run','--no-deps','--pull','never','-T','--name',"pnksecurity-qa-migrate-004-$stamp",'migrate','node','database/run.js','migrate')
Invoke-PnkNode -NodeArgs @('scripts/maintenance/capture-snapshot.mjs','qa',"$auditDir/qa-after-migrate.json")
Invoke-PnkNode -NodeArgs @('scripts/maintenance/compare-snapshots.mjs',"$auditDir/qa-before-migrate.json","$auditDir/qa-after-migrate.json")
Invoke-PnkCompose -Target qa -ComposeArgs @('up','-d','--no-deps','--no-build','--pull','never','--force-recreate','--wait','--wait-timeout','120','backend')
if ((Invoke-PnkDocker -DockerArgs @('inspect','--format','{{.Image}}','pnksecurity-qa-backend-1')).Trim() -ne $releaseImage) { throw 'QA no usa la imagen validada' }
Invoke-PnkNode -NodeArgs @('scripts/stack.mjs','check','qa')
```

El backup custom se captura sin conversión de texto PowerShell y sin sobrescribir archivos. Se valida cabecera e índice con `pg_restore --list`; **eso no equivale a una restauración probada**. No se ejecuta ninguna restauración. Ver [pg_dump 17](https://www.postgresql.org/docs/17/app-pgdump.html).

La comparación exige los mismos datos comerciales por fila, valores públicos, contraseñas por huella, sesiones/intentos, secuencias, relaciones y volumen. Si 004 ya existía, exige además que esquema y asignaciones permanezcan exactamente iguales. En esta QA se espera que el runner informe omisión/idempotencia, no una segunda aplicación.

### 4. QA: salud, React y E2E reales antes de tocar DEV

```powershell
Invoke-PnkNode -NodeArgs @('scripts/stack.mjs','test','qa')
Invoke-PnkNode -NodeArgs @('scripts/maintenance/e2e-qa-docker.mjs')
Invoke-PnkNode -NodeArgs @('scripts/maintenance/capture-snapshot.mjs','dev',"$auditDir/dev-after-qa.json")
Invoke-PnkNode -NodeArgs @('scripts/maintenance/compare-snapshots.mjs',"$auditDir/dev-initial.json","$auditDir/dev-after-qa.json",'--unchanged')
```

`stack.mjs test qa` conserva la suite de unitarias/integración y su servidor de checkout 3401, siempre con DB QA 5434. La segunda ejecución dirige Playwright a la imagen servida por Docker en **3201**, desactiva `webServer` y verifica antes las etiquetas/red y variables no secretas de conexión del backend QA. Así se evita que incluso un login fallido de las pruebas escriba `auth_attempts` en DEV.

Los nuevos fixtures se crean/desactivan sólo en QA. Comparar los datos QA antes y después de la migración se hace **antes** de las pruebas; después se permiten sus registros adicionales. La suite verifica los siete originales. DEV debe permanecer idéntico durante todo este bloque.

**Puerta:** si falla cualquier prueba, la salud, React o la comparación de DEV, no actualizar DEV. Registrar el fallo y conservar los backups e imágenes; no modificar datos para forzar un resultado verde.

### 5. DEV: promover la misma imagen y aplicar sólo 004

Pausar cualquier escritura de otros clientes durante la ventana DEV. No ejecutar login, CRUD, seeds o pruebas en DEV.

```powershell
if ((Get-PnkSourceFingerprint) -ne $sourceFingerprint) { throw 'Fuentes distintas de las probadas en QA' }
if ((Invoke-PnkDocker -DockerArgs @('image','inspect',$releaseTag,'--format','{{.Id}}')).Trim() -ne $releaseImage) { throw 'Release modificada' }
Invoke-PnkDocker -DockerArgs @('image','tag',$releaseImage,'pnksecurity-dev-backend')
Invoke-PnkDocker -DockerArgs @('image','tag',$releaseImage,'pnksecurity-dev-migrate')
Invoke-PnkCompose -Target dev -ComposeArgs @('stop','backend')
Invoke-PnkNode -NodeArgs @('scripts/maintenance/capture-snapshot.mjs','dev',"$auditDir/dev-before-migrate.json")
Invoke-PnkNode -NodeArgs @('scripts/maintenance/backup-database.mjs','dev',"$auditDir/dev-before.dump")
Get-FileHash -Algorithm SHA256 -LiteralPath "$auditDir/dev-before.dump" | Format-List
if ((Invoke-PnkDocker -DockerArgs @('image','inspect','pnksecurity-dev-migrate','--format','{{.Id}}')).Trim() -ne $releaseImage) { throw 'Imagen de migracion incorrecta' }
Invoke-PnkCompose -Target dev -ComposeArgs @('run','--no-deps','--pull','never','-T','--name',"pnksecurity-dev-migrate-004-$stamp",'migrate','node','database/run.js','migrate')
Invoke-PnkNode -NodeArgs @('scripts/maintenance/capture-snapshot.mjs','dev',"$auditDir/dev-after-migrate.json")
Invoke-PnkNode -NodeArgs @('scripts/maintenance/compare-snapshots.mjs',"$auditDir/dev-before-migrate.json","$auditDir/dev-after-migrate.json")
Invoke-PnkCompose -Target dev -ComposeArgs @('up','-d','--no-deps','--no-build','--pull','never','--force-recreate','--wait','--wait-timeout','120','backend')
if ((Invoke-PnkDocker -DockerArgs @('inspect','--format','{{.Image}}','pnksecurity-dev-backend-1')).Trim() -ne $releaseImage) { throw 'DEV no usa el mismo ID que QA' }
Invoke-PnkNode -NodeArgs @('scripts/stack.mjs','check','dev')
Invoke-PnkNode -NodeArgs @('scripts/stack.mjs','check','qa')
```

La comparación DEV debe admitir exclusivamente las adiciones de esquema esperadas y el registro nuevo de 004 en el historial: todos los usuarios anteriores `CLIENTE`, asignaciones vacías y disponibilidad inicial verdadera. Ninguna fila comercial, precio, visibilidad, eliminación, relación, credencial, sesión o secuencia previa puede cambiar. No se aplicará 004 si falta alguna migración histórica esperada o si no coincide su checksum.

### 6. Verificación final: GET en DEV, E2E sólo en QA

```powershell
$devCarta = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3101/carta/1'
$devAdmin = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3101/admin/login'
if ($devCarta.StatusCode -ne 200 -or $devCarta.Content -notmatch 'id="root"' -or $devAdmin.StatusCode -ne 200) { throw 'Shell React DEV incorrecto' }
Invoke-PnkNode -NodeArgs @('scripts/maintenance/capture-snapshot.mjs','dev',"$auditDir/dev-before-final-qa.json")
Invoke-PnkNode -NodeArgs @('scripts/maintenance/e2e-qa-docker.mjs')
Invoke-PnkNode -NodeArgs @('scripts/maintenance/capture-snapshot.mjs','dev',"$auditDir/dev-final.json")
Invoke-PnkNode -NodeArgs @('scripts/maintenance/compare-snapshots.mjs',"$auditDir/dev-before-final-qa.json","$auditDir/dev-final.json",'--unchanged')
Invoke-PnkNode -NodeArgs @('scripts/maintenance/compare-snapshots.mjs',"$auditDir/dev-before-migrate.json","$auditDir/dev-final.json")
Invoke-PnkCompose -Target dev -ComposeArgs @('ps','-a')
Invoke-PnkCompose -Target qa -ComposeArgs @('ps','-a')
```

GET de salud/carta/login no crea sesiones ni modifica registros en este backend. No se iniciará sesión ni se creará la primera cuenta administrativa en DEV dentro de este procedimiento.

## Qué ocurre si falla

- Antes de migrar: detener. Las aplicaciones antiguas y las bases siguen disponibles salvo que se haya llegado a la parada explícita del backend.
- Durante 004: el runner revierte la transacción fallida. Inspeccionar el resultado antes de arrancar/reintentar; no editar `schema_history` ni el SQL para ocultar un fallo.
- Después de migrar, si sólo falla la aplicación: el rollback previsto es de imagen, conservando el esquema aditivo. No se deshacen columnas ni se restaura automáticamente PostgreSQL.
- Si cambian datos o identidad del volumen: detener, preservar evidencia y pedir una autorización específica para recuperar. No ejecutar comandos destructivos como supuesto rollback.

Comandos de rollback de **aplicación** previstos, sólo si se decide expresamente usarlos dentro de la intervención autorizada (elegir el entorno que falló):

```powershell
# QA, no afecta PostgreSQL ni aplica una migracion inversa.
Invoke-PnkDocker -DockerArgs @('image','tag',"pnksecurity:rollback-qa-$stamp",'pnksecurity-qa-backend')
Invoke-PnkCompose -Target qa -ComposeArgs @('up','-d','--no-deps','--no-build','--pull','never','--force-recreate','--wait','--wait-timeout','120','backend')
Invoke-PnkNode -NodeArgs @('scripts/stack.mjs','check','qa')

# DEV, no afecta PostgreSQL ni aplica una migracion inversa.
Invoke-PnkDocker -DockerArgs @('image','tag',"pnksecurity:rollback-dev-$stamp",'pnksecurity-dev-backend')
Invoke-PnkCompose -Target dev -ComposeArgs @('up','-d','--no-deps','--no-build','--pull','never','--force-recreate','--wait','--wait-timeout','120','backend')
Invoke-PnkNode -NodeArgs @('scripts/stack.mjs','check','dev')
```

Los contenedores one-off de auditoría/migración se dejan disponibles para revisar logs; no se borran automáticamente. No se ejecutan limpiezas ni `prune`. Las copias permanecen en `tmp/` y las imágenes de rollback se conservan hasta revisión posterior.

Compose documenta que `up` recrea servicios modificados preservando volúmenes; aquí se limita a `backend` mediante `--no-deps`: [up](https://docs.docker.com/reference/cli/docker/compose/up/). Los comandos one-off con `run --no-deps` no publican los puertos del servicio ni arrancan sus dependencias: [run](https://docs.docker.com/reference/cli/docker/compose/run/).

## Criterios de aceptación y estado

- [x] Revisados código/migración, dependencias y comandos actuales.
- [x] Registradas capturas de revisión DEV y QA con lectura forzada.
- [x] Preparados auxiliares y comandos exactos, sin ejecutar actualizaciones.
- [ ] Autorización del usuario para el procedimiento.
- [ ] Capturas nuevas, backup e imagen de rollback antes de migrar cada entorno.
- [ ] Imagen validada, QA actualizada y E2E contra Docker 3201 aprobadas.
- [ ] DEV con mismo ID de imagen y 004 aplicada; datos/relaciones/volumen conservados.
- [ ] Salud de ambos entornos y E2E finales exclusivamente QA; DEV intacto durante las pruebas.

La ejecución se detiene aquí hasta recibir autorización. Los resultados históricos de 57 pruebas corresponden a la implementación anterior a esta preparación; no se presentan como verificación de una actualización todavía no ejecutada.
