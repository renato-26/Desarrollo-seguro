# Ambientes e infraestructura futura

DEV usa `.env.example`. QA usa `env/qa.env.example`, otro nombre de proyecto Compose, puerto y volumen. PROD tiene `env/prod.env.example` como contrato de configuración; faltan infraestructura, secretos, roles de DB, backup/restauración, TLS, observabilidad y revisión de despliegue. No reutilizar el usuario administrador de Compose en PROD.

PostgreSQL local se ejecuta exclusivamente mediante Docker Compose, con la imagen oficial estable `postgres:17-alpine`; CI usa la misma imagen. No instalar embedded-postgres ni versiones beta. Si Docker no está disponible, conservar la configuración preparada y seguir posteriormente los pasos DEV/QA del README. La ausencia de Docker impide verificar localmente arranque de PostgreSQL, migraciones e imagen del backend.

## Cloudflare primero

No se crean recursos ni se publica en esta fase. El frontend actual contiene PHP y no se puede publicar tal cual como contenido estático. Primero migrar las vistas de forma incremental conservando diseño, recursos y comportamiento. Luego evaluar Workers con compatibilidad Node y adaptación de Express; la conexión PostgreSQL puede usar Hyperdrive contra una DB alojada externamente. Workers no ejecuta el contenedor de Compose ni aloja PostgreSQL. Validar el adaptador, sesiones, cookies, secretos, TLS y rutas antes de preparar un despliegue revisable.

Referencias oficiales consultadas:
- [Compatibilidad Node.js en Workers](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- [PostgreSQL con Hyperdrive](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/)

## AWS después

Propuesta posterior: imagen Express en ECS/Fargate, PostgreSQL en RDS privado, secretos en Secrets Manager, logs en CloudWatch y red con permisos mínimos. Cloudflare puede permanecer como DNS/proxy. No hay Terraform aplicado, credenciales, cuentas ni recursos provisionados. Elegir región, presupuesto y recuperación de datos antes de escribir infraestructura desplegable.
