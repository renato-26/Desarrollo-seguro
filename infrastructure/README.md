# Infraestructura: estado y preparación

La aplicación local DEV/QA está actualizada mediante Compose; PostgreSQL y sus volúmenes existentes se conservaron. El estado vigente está en [EVA3-estado-final.md](../docs/EVA3-estado-final.md).

- `compose.yaml`: entornos locales DEV/QA independientes. No convertirlo en un despliegue RDS cambiando sólo el nombre del entorno.
- `compose.production.yaml`: contenedores preparados para DB externa con TLS verificado, imagen validada en QA y CA montada. No contiene PostgreSQL, build ni migraciones automáticas. Sólo se validó sintaxis; no se inició producción.
- `infrastructure/env/*.env.example`: contratos orientativos existentes, sin recursos ni credenciales reales. No se modificaron archivos de credenciales durante el cierre.

La [guía AWS](../docs/EVA3-AWS.md) describe EC2, ALB, Auto Scaling, RDS privado, IAM/Secrets Manager, CA/TLS, Cloudflare/DNS/HTTPS, sesiones compartidas, almacenamiento, migraciones, observabilidad y checklist de aprobación. No se crearon ni modificaron recursos AWS/Cloudflare, dominios ni certificados. Los valores reales y la ejecución remota requieren una revisión posterior.

Las fotografías actuales forman parte de la imagen; no hay uploads. Las sesiones e intentos de acceso usan PostgreSQL compartido. El documento distingue estas funciones implementadas de futuras integraciones y pruebas multiinstancia. Ningún documento implica que existan recursos productivos.
