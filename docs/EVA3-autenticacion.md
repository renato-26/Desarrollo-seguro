> Documento histórico: describe una iteración anterior. El estado vigente, las pruebas y las restricciones de operación están en [EVA3-estado-final.md](EVA3-estado-final.md).

# EVA 3 · Autenticación segura (iteración 3)

Se incorporó inicio de sesión con hash Argon2id, cookie HTTP-only, token aleatorio de 256 bits (hash SHA-256 en PostgreSQL), tiempo de vida de 8 horas y revocación al cerrar sesión. Se impide crear sesiones para usuarios sin contraseña activada. El formulario conserva el diseño PHP original, pero opera sobre Express/PostgreSQL.

## Instalación y pruebas

- `npm install argon2` (realizado en el equipo del alumno).
- `npm run db:migrate` sobre `.env` de desarrollo, para agregar `002_auth_sessions.sql`. No editar migraciones anteriores.
- Para habilitar **un usuario de laboratorio** existente: `node --env-file=.env scripts/set-user-password.js 1` y elegir una contraseña NUEVA de al menos 12 caracteres sin introducirla en el chat ni en el historial de comandos. Usuario de prueba: `admin@gmail.com` o `Administrador` según el seed.
- Arranque con `PORT=3100 npm start`, abrir `http://127.0.0.1:3100/?id=1` y entrar con la contraseña nueva.
- `npm test` para pruebas unitarias; `node --env-file=.env.qa database/run.js migrate` antes de cualquier prueba de integración QA.

## Seguridad y límites

- Las contraseñas de la antigua aplicación PHP no se migran; en `usuarios` había `password_hash` NULL y `requiere_cambio_password=true`.
- Intentos fallidos limitados con tabla en PostgreSQL (5 intentos / bloqueo de 15 minutos por IP e identificador). El usuario recibe mensajes genéricos.
- Los endpoints POST requieren cabecera `X-PNK-Request: 1` y, si el navegador la envía, un Origin que coincida con el host.
- Nunca registrar tokens, contraseñas o `DATABASE_URL`. `.env` y `.env.qa` están ignorados por Git.
- La cookie solo es `Secure` en `APP_ENV=prod`; para producción se requerirá HTTPS correcto y un proxy confiable. No se ha validado aún en AWS/Cloudflare.
- **Pendiente:** integrar envío de comentarios autenticado, automatizar expiración de sesiones/bloqueos antiguos, pruebas E2E y políticas adicionales contra fuerza bruta distribuida.
