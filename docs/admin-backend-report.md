> Documento histórico: describe una iteración anterior. El estado vigente, las pruebas y las restricciones de operación están en [EVA3-estado-final.md](EVA3-estado-final.md).

# Backend administrativo EVA3 — 2026-11-16

> Estado posterior de integración: el agente principal completó build y verificación real PostgreSQL/Chromium, con 57 pruebas aprobadas (47 unitarias + 2 integración + 8 E2E). Los fallos de shell descritos abajo pertenecen a los intentos intermedios y se corrigieron. Ver EVA3-react-admin.md para estado final y activación local pendiente.

## Entrega

- `backend/src/models/auth.model.js`: proyección pública de rol, activo y asignaciones tanto al iniciar sesión como en cada consulta de sesión. El estado desactivado o cambio obligatorio de contraseña invalida el acceso.
- `backend/src/controllers/auth.controller.js`: usuario público ampliado, sin hash.
- `backend/src/routes/api.routes.js`: monta `/api/admin`.
- `backend/src/routes/admin.routes.js`: autenticación, roles y CSRF para las cinco colecciones, detalle, creación, edición y dashboard.
- `backend/src/controllers/admin.controller.js`: envelopes `{registros}` / `{registro}`, errores controlados, 201 al crear y 200 al editar; conflictos transaccionales 409.
- `backend/src/services/admin.service.js`: validación cerrada de campos y límites históricos, precios CLP enteros incluyendo cero, passwords de 12–1024 caracteres, autorización del propietario original y destino, hash Argon2id, fotografías y datos para borrado lógico.
- `backend/src/models/admin.model.js`: SQL parametrizado con identificadores internos permitidos, proyección explícita sin credenciales, ámbitos por restaurante, conteos de dashboard, transacciones SERIALIZABLE, bloqueo del actor y relaciones, usuarios/asignaciones atómicos, revocación de sesiones por desactivación o contraseña nueva.
- `backend/src/models/catalog.model.js`: expone disponibilidad y excluye productos no disponibles del catálogo público.
- `database/migrations/004_admin_roles.sql`: CLIENTE por defecto, tres roles permitidos, relación usuario/restaurante y disponibilidad de productos. No modifica migraciones anteriores ni eleva cuentas existentes.
- `scripts/create-admin.js`: operación explícita create-only para un ADMIN_GENERAL nuevo. Configuración mediante `loadConfig`; JSON `{nombre,email,password}` por stdin o `--nombre NOMBRE --email EMAIL` con password por stdin. Nunca contraseña en argumentos, actualización de cuenta existente ni credenciales en logs.
- `tests/unit/admin.test.js`, `tests/unit/admin-service.test.js`, `tests/unit/admin-bootstrap.test.js`: 17 pruebas nuevas. `tests/unit/auth.test.js`: expectativa de proyección ampliada.

## Seguridad y decisiones

`ADMIN_RESTAURANTE` consulta y modifica exclusivamente recursos de sus restaurantes asignados; no administra usuarios ni crea restaurantes. Cada escritura vuelve a leer rol, estado y asignaciones dentro de la transacción. El aislamiento serializable y bloqueos evitan mover relaciones basándose en propietarios cambiados concurrentemente; conflictos requieren reintentar desde el cliente. El dashboard devuelve `{dashboard:{recurso:{total,activos}}}` y omite usuarios para el administrador de restaurante.

Las fotografías se asocian por basename o ruta `/static/legacy/imagenes/codN/archivo.ext`. Deben existir en el mismo restaurante y tener extensión y firma JPG/JPEG, PNG o WebP, con tamaño máximo de 5 MiB. Se rechazan rutas transversales, URL externa, SVG, datos inline, archivos inexistentes y escapes mediante symlinks. Mover una carta/categoría a otro restaurante valida también las fotografías de sus descendientes. Los valores históricos no se revalidan al modificar un campo independiente; se permite limpiar una foto histórica inválida.

Las direcciones de restaurantes editados se clonan para no modificar accidentalmente una dirección compartida por otros registros históricos. No hay DELETE comercial; sólo se eliminan vínculos de asignaciones y sesiones cuando corresponde. Estado nulo de usuario no concede acceso. Los campos históricos opcionales nulos se toleran.

## Verificación ejecutada

1. `node --test tests/unit/admin.test.js`: RED inicial 0/4, fallos 404 frente a 401/403/400; GREEN 4/4 tras implementación.
2. `node --test tests/unit/admin-service.test.js tests/unit/admin-bootstrap.test.js`: RED de bootstrap ausente y PATCH de asignaciones vacío; GREEN 10/10 después del cambio.
3. Regresiones RED→GREEN para limpieza de foto histórica, foto de descendientes al mover categoría, estado nulo de usuario y formato/firma/tamaño raster.
4. `node --test tests/unit/admin*.test.js`: última ejecución 17/17, exit 0.
5. `npm.cmd test`: primera ejecución completa 41/42; sólo falló `React: carta y rutas administrativas sirven la compilación con módulos y CSP` durante trabajo concurrente en frontend.
6. `npm.cmd test`: última ejecución completa 42/45. Fallos durante compilación/integración concurrente: `API de restaurantes: status, contenido JSON y ausencia de encabezado de tecnología` (shell GET `/` 500), `frontend conserva nombre, clases, estilos y elementos de la interfaz de pnkSecurity` (shell 500), y `React: carta y rutas administrativas sirven la compilación con módulos y CSP` (shell 500). Los 17 tests administrativos y autenticación pasan. Se comunicaron al agente principal; éste completa build, shell y verificación final.

## Límites y pendientes de integración

No ejecuté migraciones, bootstrap real ni escrituras de base de datos. El agente principal debe verificar SQL real en PostgreSQL QA, CRUD HTTP, conteos, roles y revocación de sesiones con la migración 004 aplicada. Los tests unitarios de persistencia usan un doble de conexión para no escribir DEV; no sustituyen esa integración PostgreSQL. No se modificaron app, frontend, package, Docker ni pruebas de integración/E2E desde este subtrabajo. No se hicieron commits, push ni despliegues.
