# Finalización local EVA 3

Autorización: solicitud adjunta del 16-11-2026, finalización autónoma antes de AWS.

Se continúa en `feature/fullstack-mvc`, conservando cambios locales, sin commit/push/merge ni cambios de credenciales. No se opera AWS/Cloudflare. No se recrea PostgreSQL ni se eliminan datos/volúmenes. Las escrituras de prueba son exclusivas de QA.

1. Revisar el diagnóstico existente y tomar capturas actuales DEV/QA, identidad de contenedores, historial/checksums y credenciales por huella. Conservar la imagen anterior de QA sin depender de la imagen ausente de DEV.
2. Revisar implementación React/CRUD y seguridad de producción, corregir defectos con regresiones locales o QA. Completar documentación de API, arquitectura y AWS sin aprovisionar recursos.
3. Construir una imagen mediante Compose QA, verificar runtime Node/Argon2/dependencias/build React. Registrar ID y huella de fuentes. Si el código cambia después, reconstruir y volver a validar QA.
4. Detener únicamente backend QA; captura estable, backup custom verificado e íntegro con SHA-256; runner de migraciones; comparar datos/esquema/volumen antes/después; recrear únicamente backend QA con `--no-deps --no-build` y comprobar salud.
5. Ejecutar unitarias, integración PostgreSQL y Playwright sobre checkout y Docker QA. Corregir regresiones y repetir sólo lo necesario. Capturar DEV y exigir identidad completa respecto del inicio.
6. Investigar recuperación del backend DEV mediante lecturas y artefactos locales. No detenerlo/recrearlo sin recuperación verificable. Si no se obtiene, documentar bloqueo y completar todas las tareas independientes. Actualizar DEV sólo si se cumplen las siete condiciones de la solicitud; sin pruebas de escritura.
7. Verificar Git, secretos/artefactos excluidos y documentación vigente. Escribir `docs/EVA3-estado-final.md` con evidencia real y límites, y dejar propuesta de commit sin ejecutarlo.

## Decisiones y registro

El registro de ejecución se conserva en `tmp/eva3-final-progress.md` y los artefactos privados en una carpeta de auditoría nueva indicada allí. Los comandos de actualización usan los auxiliares ya revisados del plan Compose; el script `tmp/refresh-existing.mjs` continúa descartado.

La nueva autorización permite corregir errores y continuar tareas independientes, sustituyendo la instrucción anterior de terminar después de QA. Las condiciones previas de DEV siguen siendo obligatorias. Los respaldos externos informados por el usuario no se consideran una restauración probada.
