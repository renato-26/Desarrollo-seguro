# EVA 3: contrato de la API REST

Contrato del código de `feature/fullstack-mvc`, revisado el 16-11-2026. Los resultados reales de ejecución pertenecen a [EVA3-estado-final.md](EVA3-estado-final.md); este contrato no declara que DEV, QA o AWS estén actualizados.

## Convenciones

Base relativa `/api`, JSON UTF-8. Express acepta cuerpos JSON de hasta `16kb`. En escrituras se envían `Content-Type: application/json` y `X-PNK-Request: 1`; las credenciales son una cookie del mismo origen. No se admiten tokens Bearer ni existe un endpoint de registro público.

Si se recibe `Origin`, debe tener protocolo `http:` o `https:` y el mismo host, incluido puerto, que `Host`. La cabecera propia se exige incluso en login/logout. La aplicación no habilita CORS. Los ejemplos JSON de este documento son formas de contrato, no instrucciones para ejecutar escrituras en DEV.

IDs de URL: decimal positivo, sin ceros iniciales, hasta `2147483647`. En cuerpos las FK deben ser números JSON enteros en ese rango. Los errores usan `{ "error": "mensaje" }`.

| HTTP | Significado |
| --- | --- |
| 200 | Consulta o edición correctas |
| 201 | Registro o comentario creado |
| 204 | Logout correcto, sin cuerpo |
| 400 | ID, JSON, campos o valores inválidos |
| 401 | Sesión requerida o credenciales incorrectas |
| 403 | CSRF/origen o permiso denegado |
| 404 | Ruta, restaurante del detalle público o registro administrativo inexistente |
| 409 | Conflicto de unicidad, FK o concurrencia administrativa |
| 413 | Cuerpo JSON mayor que el límite |
| 429 | Bloqueo temporal de login |
| 500 | Error interno no traducido; no expone detalles SQL |
| 503 | DB o servicio temporalmente no disponible |

## Salud y catálogo público

| Método | Ruta | Respuesta correcta |
| --- | --- | --- |
| GET | `/health` | `{ "status": "ok", "database": "up" }` |
| GET | `/restaurantes` | `{ "restaurantes": [...] }` |
| GET | `/restaurantes/:id/carta` | `{ "restaurante": {...}, "cartas": [...], "destacados": [...] }` |
| GET | `/restaurantes/:id/comentarios` | `{ "comentarios": [...] }` |
| POST | `/restaurantes/:id/comentarios` | 201, `{ "comentario": {...} }`; exige sesión y CSRF |

La salud usa `SELECT 1`; ante fallo responde 503 con `{ "status": "degraded", "database": "down" }`. No informa versiones ni secretos y no valida el historial de migraciones.

El listado de restaurantes activos, ordenado por ID, expone `id`, `nombre`, `foto`, `comuna`, `region`. El detalle público agrega `fono`, `email`, `calle` y `numero`. La carta devuelve sólo cartas/categorías visibles y sin desactivación, y productos visibles, disponibles y sin desactivación bajo esos padres. Un restaurante desactivado o inexistente produce 404 en `/carta`.

Cada carta contiene `id`, `nombre`, `orden`, `foto`, `categorias`. Cada categoría contiene `id`, `nombre`, `orden`, `cartas_id`, `productos`. Los productos exponen `id`, `nombre`, `descripcion`, `observaciones`, `tiempo`, `precio`, `foto`, `destacado`, `puntuacion`, `categorias_id`, `disponible`. El precio es un entero CLP; cero es válido. `destacados` contiene los productos publicados cuyo `destacado` es verdadero. Cartas/categorías y productos se ordenan por su `orden` y luego por ID; valores de orden nulos van al final.

Los comentarios exponen `id`, `usuario`, `comentario`. GET devuelve los últimos 100 por ID, presentados en orden cronológico, y no incorpora paginación. Para un ID válido inexistente/desactivado devuelve lista vacía. POST recibe únicamente el texto necesario:

```json
{ "comentario": "Texto del comentario" }
```

El texto se recorta y debe tener entre 1 y 1000 caracteres, sin los controles rechazados por el validador. El autor y su ID provienen de la sesión, aunque el cliente envíe otro nombre. Si el restaurante ya no está activo al insertar, responde 404. React renderiza el comentario como texto escapado; no interpreta HTML. No hay edición ni borrado de comentarios por API.

## Autenticación

| Método | Ruta | Contrato |
| --- | --- | --- |
| POST | `/auth/login` | `{ "identifier": "email o nombre", "password": "secreto" }` → `{ "usuario": {...} }` y `Set-Cookie` |
| GET | `/auth/me` | `{ "usuario": {...} }` o `{ "usuario": null }` si no hay sesión válida |
| POST | `/auth/logout` | Revoca el token recibido, borra cookie y devuelve 204; también admite ausencia de sesión |

`identifier` se recorta y compara en minúsculas, de 1 a 255 caracteres. Se prioriza una coincidencia de correo; el nombre sólo identifica una cuenta cuando es inequívoco. La contraseña de login admite 1–1024 caracteres; no aplica la longitud mínima de alta a una comprobación de contraseña. Sólo pueden entrar usuarios activos, con hash Argon2id y sin obligación de cambio pendiente.

El objeto público de usuario es `id`, `nombre`, `email`, `rol`, `activo`, `restaurantes` (array de IDs). No incluye hash ni contraseña. La cookie `pnk_session` contiene 64 caracteres hexadecimales, dura ocho horas, es `HttpOnly`, `SameSite=Lax` y `Secure` en `APP_ENV=prod`. PostgreSQL guarda el hash SHA-256 del token y su vencimiento.

A partir del quinto fallo, el contador bloquea temporalmente la combinación IP/identificador durante quince minutos. Se reinicia si el último fallo ocurrió hace más de quince minutos y se limpia tras acceso correcto; vive en PostgreSQL. Actualmente no se configura `trust proxy`; detrás de ALB la IP utilizada será la del proxy hasta implementar y verificar esa configuración.

La API fija `Cache-Control: no-store` al entrar al router, incluido `/auth/me`, catálogo y salud. La preparación AWS exige además excluir `/api/*` de la caché compartida y evitar reglas CDN que ignoren esa directiva. No hay recuperación de contraseña, MFA ni rotación automática de credenciales implementadas.

## Administración y permisos

Base `/api/admin`. Todas las rutas requieren sesión activa y rol administrativo; una sesión ausente/inactiva produce 401 y un cliente sin rol administrativo, 403.

| Capacidad | `ADMIN_GENERAL` | `ADMIN_RESTAURANTE` |
| --- | --- | --- |
| Dashboard | Todos los recursos | Sólo asignados; sin estadística de usuarios |
| Consultar/editar/desactivar restaurante | Todos | Sólo asignados |
| Crear restaurante | Sí | No |
| Cartas/categorías/productos | Todos | Sólo dentro de restaurantes asignados |
| Consultar/crear/editar/desactivar usuarios | Sí | No |
| Cambiar rol/asignaciones | Sí | No |

Se comprueba el alcance de origen y destino al mover una carta/categoría/producto. Un ID existente fuera del alcance produce 403; uno inexistente, 404. En cada escritura se vuelve a leer el actor dentro de una transacción, por lo que una sesión abierta no conserva permisos revocados.

Para cada `RECURSO` en `restaurantes`, `cartas`, `categorias`, `productos`, `usuarios`:

| Método | Ruta | Respuesta |
| --- | --- | --- |
| GET | `/admin/RECURSO` | 200, `{ "registros": [...] }`, incluye activos/inactivos permitidos |
| GET | `/admin/RECURSO/:id` | 200, `{ "registro": {...} }` |
| POST | `/admin/RECURSO` | 201, `{ "registro": {...} }` |
| PATCH | `/admin/RECURSO/:id` | 200, `{ "registro": {...} }`, edición parcial |
| GET | `/admin/dashboard` | 200, `{ "dashboard": { "recurso": { "total": 0, "activos": 0 } } }` |

Los listados se ordenan por ID. Búsqueda y filtros del panel se realizan en React: la API no implementa parámetros de filtrado/paginación. `PATCH { "activo": false }` desactiva y `PATCH { "activo": true }` reactiva lógicamente. No existen PUT ni DELETE. El dashboard cuenta el estado propio del recurso; no interpreta un hijo activo como desactivado automáticamente cuando se desactiva su padre.

### Campos de escritura

Los cuerpos administrativos deben ser objetos JSON no vacíos. Se rechaza cualquier campo desconocido, incluidos `id`, `restaurante_id` resuelto y hashes. En PATCH se envían sólo los campos modificados. Los campos obligatorios de la tabla se exigen al crear y, si se incluyen en PATCH, deben seguir siendo válidos.

| Recurso | Obligatorios al crear | Opcionales admitidos |
| --- | --- | --- |
| `restaurantes` | `nombre`, `rut`, `fono`, `calle`, `numero`, `comuna` | `email`, `mapa`, `foto`, `region`, `activo` |
| `cartas` | `nombre`, `restautantes_id` | `orden`, `foto`, `activo` |
| `categorias` | `nombre`, `cartas_id` | `orden`, `foto`, `activo` |
| `productos` | `nombre`, `categorias_id`, `precio` | `descripcion`, `observaciones`, `tiempo`, `foto`, `orden`, `destacado`, `disponible`, `activo` |
| `usuarios` | `nombre`, `email`, `password` | `rol`, `restaurantes`, `activo` |

Todos los registros de catálogo administrativo devuelven `id`, sus campos públicos de edición, `activo` y `restaurante_id`; conservan también su FK histórica. Usuarios devuelven `id`, `nombre`, `email`, `rol`, `restaurantes`, `activo` y nunca `password` ni `password_hash`.

| Validación | Regla |
| --- | --- |
| Texto | Se recorta; sin carácter NUL; máximo según tabla siguiente |
| `email` | Sintaxis de correo si no está vacío; correo de usuario único ignorando mayúsculas |
| `precio`, `orden` | Números JSON enteros entre 0 y `2147483647`; sin decimales ni cadenas numéricas |
| FK | Números enteros positivos y relación existente/autorizada |
| Booleanos | `true`/`false` JSON, no `"true"`, `0` o `1` |
| `rol` | `CLIENTE`, `ADMIN_GENERAL` o `ADMIN_RESTAURANTE` |
| `restaurantes` de usuario | Array sin duplicados, hasta 1000 IDs enteros válidos y existentes |
| `password` de alta/cambio | 12–1024 caracteres, sin NUL; se transforma a Argon2id |

| Recurso | Longitudes máximas de texto |
| --- | --- |
| `restaurantes` | `nombre` 200, `rut` 11, `fono` 45, `email` 100, `mapa`/`foto` 200, `calle`/`comuna`/`region` 100, `numero` 15 |
| `cartas` | `nombre` 45, `foto` 200 |
| `categorias` | `nombre` 100, `foto` 200 |
| `productos` | `nombre`/`tiempo` 100, `descripcion`/`observaciones` 300, `foto` 200 |
| `usuarios` | `nombre`/`email` 255 |

`null` se admite en `email` de restaurante, `mapa`, `foto`, `region`, `orden`, `descripcion`, `observaciones` y `tiempo`. El email de usuario no admite `null` ni cadena vacía. El RUT se comprueba como texto con longitud y presencia, sin verificación de dígito. Al crear, `activo` toma `true`; usuario toma `CLIENTE` y asignaciones `[]`; producto toma `disponible:true` y `destacado:false`.

Cambiar `password` o desactivar un usuario revoca sus sesiones. Cambiar rol/asignaciones afecta la siguiente consulta de sesión. El alta inicial de un `ADMIN_GENERAL` se hace mediante el comando interno `scripts/create-admin.js`, no por una ruta pública; sólo crea una identidad nueva y recibe la contraseña por stdin. Su ejecución en un entorno real es una acción de identidad separada.

### Fotografías

`foto` admite nombre simple, por ejemplo `plato.jpg`, o ruta local `/static/legacy/imagenes/codID/plato.jpg` correspondiente al restaurante del registro. El archivo ya debe existir en la imagen: JPG/JPEG, PNG o WebP, firma inicial coherente y entre 4 bytes y 5 MiB. Se comprueba `realpath` para evitar escapes y symlinks fuera del directorio autorizado. `null` o `""` quitan la asociación.

No se aceptan URL externa, SVG, data URI, traversal ni una foto de otro restaurante. Si se cambia de restaurante una carta o categoría, se validan también las fotos descendientes. No hay endpoint multipart ni subida al disco/S3. Un restaurante recién creado puede dejar `foto` vacía mientras no exista su directorio en una nueva imagen.

Ejemplo de edición parcial, únicamente ilustrativo:

```json
{ "precio": 8900, "disponible": true }
```

### Concurrencia y errores

Cada guardado administrativo usa una transacción `SERIALIZABLE`, bloqueos de registros y revisión de permisos vigente. Se traduce a 409 el email repetido, las violaciones SQL previstas y los conflictos de serialización/deadlock; no existe reintento automático de la transacción. No se devuelven consultas ni detalles internos. Campos requeridos inválidos, fotos rechazadas y asignaciones inexistentes producen 400.

La creación/edición de restaurante usa dirección propia para no modificar una dirección histórica compartida. Las ediciones pueden dejar direcciones anteriores sin referencia; no hay proceso automático de limpieza. El frontend publica errores y permite revisar datos antes de reenviar.

Para arquitectura, migraciones y producción: [EVA3-arquitectura.md](EVA3-arquitectura.md), [EVA3-AWS.md](EVA3-AWS.md) y [documentación React/CRUD](EVA3-react-admin.md).
