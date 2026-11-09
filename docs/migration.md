# Migración y decisiones de datos

Origen: `Script_BD/pnk_security.sql` de `origin/mejoras` (7d321da). El dump MySQL se conserva sin cambios. La migración inicial PostgreSQL no ejecuta DROP ni sobrescribe tablas existentes.

| Tabla original | Filas esperadas | Tratamiento |
| --- | ---: | --- |
| restautantes | 7 | IDs 1–7 y datos originales |
| direcciones | 8 | Se conserva también la dirección sin restaurante |
| cartas | 11 | Se conserva el hueco del ID 9 |
| categorias | 14 | Relaciones a cartas |
| items | 6 | IDs 1, 2, 3, 4, 5 y 7, incluidos eliminados lógicos |
| usuarios | 2 | IDs/nombre/email/estado originales; password_hash NULL y requiere_cambio_password=true |
| comentarios | 0 | El dump contiene la tabla, sin filas |

Se conserva `restautantes` y `restautantes_id`, errores ortográficos históricos, para que cada dato sea cotejable. Los bit pasan a boolean; datetime a timestamp sin zona, para no inventar un huso horario del dump. Se mantienen timestamps históricos, incluidos los valores de 1899. Los IDs se importan explícitamente y se reajustan las secuencias.

La única excepción a la conservación de datos es la contraseña. No se copia, cifra ni convierte el secreto conocido del dump en una credencial válida. Las cuentas importadas carecen de password_hash y requieren recuperación segura antes de usarse. La autenticación todavía no está implementada. El campo `estado` se conserva como dato histórico y nunca debe interpretarse como autorización sin verificar también el bloqueo de credenciales.

Se añaden claves foráneas y restricciones de precio/puntuación compatibles con los datos originales. `comentarios.usuario` continúa siendo texto porque el dump no define una relación a usuarios: no se inventa una asociación. La relación restaurante se mantiene nullable como en el original. Las eliminaciones referenciadas se restringen.

`database/runner.js` serializa procesos mediante advisory lock y aplica cada archivo SQL con su entrada en `schema_history` en la misma transacción. El checksum SHA-256 normaliza CRLF para poder ejecutar en Windows y Linux. Un archivo aplicado no se modifica: crear una nueva migración numerada. El seed se ejecuta una vez y falla ante conflictos; no hace upsert que altere datos de negocio. No hay rollback destructivo automatizado; usar backup y una migración correctiva revisada.

DEV puede importar el seed explícitamente. QA usa una DB desechable. PROD debe separar usuario migrador y usuario de ejecución con permisos mínimos; no ejecutar el seed comercial ni habilitar cuentas automáticamente. Compose es una configuración local, no un despliegue productivo.
