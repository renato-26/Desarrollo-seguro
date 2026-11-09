# PNKSecurity Full Stack MVC Implementation Plan

**Goal:** Preparar la evolución MVC del repositorio original desde origin/mejoras sin cambiar el frontend ni migrar aún las funciones PHP.

**Architecture:** Express modular, controlador y servicio de salud; modelo PostgreSQL para disponibilidad. Migraciones SQL transaccionales con historial y checksum. Datos originales versionados, sin importar contraseñas activas.

**Stack:** Node.js 24, Express 5, PostgreSQL 17, Docker Compose, Playwright y GitHub Actions.

## Restricciones

- Trabajar en feature/fullstack-mvc, base 7d321da; sin push, despliegues ni cambios de remotes.
- Preservar íntegros PHP, frontend y SQL originales.
- Mantener los identificadores y las relaciones existentes, incluso la grafía histórica restautantes.
- No activar las contraseñas del dump: usuarios bloqueados hasta recuperación segura futura.

## Tareas y verificación

- [x] API: escribir pruebas HTTP de salud, disponibilidad, 404 y errores sin filtraciones; comprobar fallo y luego implementar config, rutas, controlador, servicio y middleware. Ejecutar npm test.
- [ ] Datos: migración del esquema y seed fiel al dump; runner con bloqueo, transacciones y checksum. Integración con PostgreSQL real para conteos, IDs, FK, credenciales bloqueadas e idempotencia.
- [x] Entorno: Docker sin root para backend, PostgreSQL persistente, servicio de migración y health checks; plantillas DEV/QA/PROD sin secretos. Ejecución Docker pendiente por herramientas ausentes.
- [x] QA: Playwright contra servidor real y workflow con PostgreSQL; no publicar automáticamente. Workflow remoto pendiente.
- [x] Documentación: instalación, limitaciones actuales, fases de Cloudflare/AWS y resultados reales. Revisar git diff y verificar que frontend/PHP no cambiaron.

## Registro de cierre

Esquema, seed y prueba de integración escritos; validación en PostgreSQL real pendiente. Ver `docs/verification.md`. Revisión independiente sin hallazgos críticos/importantes; se corrigió la observación menor sobre efectos persistentes del test de checksum/secuencia. Inicialmente sin commit ni push; posteriormente el usuario autorizó publicar exclusivamente feature/fullstack-mvc tras revisar secretos, exclusiones y tamaños, sin merge ni pull request.

## Review focus

Configuración inválida debe impedir arranque; DB caída debe devolver 503 sin detalles; SQL modificado debe rechazar checksum; semillas no deben reescribir datos existentes; tablas relacionadas deben rechazar huérfanos. PostgreSQL y Docker se reportarán como no verificados localmente si faltan herramientas.
