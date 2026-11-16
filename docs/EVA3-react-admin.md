# EVA 3: React y panel administrativo

Estado actualizado al 16-11-2026. El [informe final](EVA3-estado-final.md) registra los resultados efectivos y sustituye los estados anteriores de actualización pendiente. DEV y QA sirven React/Express desde la misma imagen Docker validada; ambos tienen migraciones 001–004. Los contenedores PostgreSQL y volúmenes se conservaron.

## Frontend

React se monta en `frontend/src/main.jsx`. `PublicApp` comparte `AuthProvider`, `SessionBar`, `Login`, `Loading`, `Empty`, `ErrorMessage` y `Photo`. Carta: `Header`, `RestaurantInfo`, `Product`, `FeaturedProducts`, `Category`, `Menus` y `Footer`. Carrito: `Cart`/`useCart`. Comentarios: `Comments`.

Se conservan logotipos, fondos, tipografías, Bootstrap, colores y estructura originales, con los recursos en `frontend/public/legacy`. No se ejecutan PHP ni jQuery sobre el árbol React. Las capturas desktop/móvil y las pruebas verifican el diseño, navegación, imágenes y ausencia de desbordamiento móvil.

Rutas públicas: `/`, `/?id=N`, `/carta/N`, `/carrito/N`. El selector obtiene los restaurantes activos de PostgreSQL; los siete originales se preservan. Cartas, categorías y productos se ordenan en SQL. Se muestran precios CLP, destacados, descripciones, observaciones y tiempos. Los productos no disponibles/desactivados o con padres desactivados no se publican.

El carrito mantiene selección por restaurante en `sessionStorage` con la clave histórica `pnk.cesta.v1.ID`. No constituye un pedido persistido, pago o reserva de stock. Login/logout reutilizan sesiones opacas de PostgreSQL y Argon2id; los comentarios requieren sesión y CSRF y se renderizan como texto. La consulta conserva los últimos cien comentarios en orden cronológico, sin paginación.

## Administración

Rutas: `/admin/login`, `/admin/dashboard`, `/admin/restaurantes`, `/admin/cartas`, `/admin/categorias`, `/admin/productos`, `/admin/usuarios`.

`AdminApp`, `Dashboard`, `ResourcePage` y `ResourceForm` implementan formularios, búsquedas, filtros, carga, errores, detalle, edición y confirmación de estado. Los campos se describen en `frontend/src/admin/resources.js`; al editar, PATCH envía sólo diferencias y conserva campos históricos que no se cambiaron.

| Recurso | Funciones |
| --- | --- |
| Restaurantes | Crear, listar, consultar, editar y desactivar/reactivar |
| Cartas | Crear, listar, consultar, editar, ordenar y desactivar/reactivar |
| Categorías | Crear, listar, consultar, editar, ordenar y desactivar/reactivar |
| Productos | Crear, listar, consultar, editar, cambiar precio, foto existente, orden, destacado, disponibilidad y estado |
| Usuarios | Crear, listar, consultar, editar, asignar roles/restaurantes y desactivar; contraseña nunca se devuelve |
| Dashboard | Totales/activos desde PostgreSQL filtrados por alcance |

`ADMIN_GENERAL` administra todos los recursos. `ADMIN_RESTAURANTE` sólo los restaurantes asignados y sus descendientes, sin alta de restaurantes ni administración de usuarios. `CLIENTE` carece de acceso administrativo. Express comprueba permisos actuales y padres originales/destino dentro de transacciones SERIALIZABLE; la UI no es el control de seguridad.

Detalles, campos, estados HTTP y formatos se encuentran en el [contrato REST](EVA3-api.md). Arquitectura y sesiones en [EVA3-arquitectura.md](EVA3-arquitectura.md).

## Fotografías

Se implementó la asociación a archivos existentes del mismo restaurante. Se admiten JPG/JPEG, PNG y WebP de hasta 5 MiB, con extensión/firma concordantes y ruta real bajo la carpeta autorizada. Se rechazan archivos inexistentes, SVG, URLs remotas, datos inline y escapes de directorio. El frontend tiene fallback para fotos históricas ausentes.

No existe upload HTTP. Para restaurantes nuevos sin carpeta de recursos se puede trabajar sin foto. Una subida futura exige API, controles y almacenamiento compartido; no se afirma integración S3. El ciclo de asociación y carga real de una foto se comprobó en navegador contra Docker QA.

## Build y ejecución

`npm.cmd run build` genera `frontend/dist`. Express sirve el shell y `/assets` compilados, además de recursos históricos por `/static`. La imagen multietapa contiene ambos; no publica PHP, SQL original ni credenciales. Para desarrollo opcional, Vite 5173 apunta al backend DEV3101. Producción sirve siempre el build, sin Vite.

Se auditó Node24, usuario no root, dependencias de runtime y hash/verificación Argon2 nativa dentro de la imagen. DEV y QA usan exactamente el ID indicado en el informe final. La separación productiva/RDS está preparada en `compose.production.yaml`, con TLS obligatorio en `APP_ENV=prod`; su ejecución real sigue pendiente.

## Verificación y límites

Aceptación: 48 unitarias +4 integración QA +10 E2E checkout +10 E2E Docker QA =72 ejecuciones aprobadas. Después de promover DEV se aprobaron otras10 E2E QA, con captura DEV idéntica antes/después. Las integraciones nuevas reprodujeron y verificaron correcciones de colisión correo/nombre y límite de comentarios. Las E2E incluyen CRUD completo, orden, disponibilidad, foto real, roles, aislamiento, SQLi/XSS/CSRF, comentarios persistentes, carrito y móvil.

Los fixtures QA se desactivan sin borrar registros. En DEV sólo se hicieron GET y auditorías de lectura, además de la migración004 autorizada y la promoción del backend. Se preservaron los dos usuarios históricos sin crear ni elevar una cuenta administrativa. El alta inicial requiere una identidad privada elegida por el responsable y `scripts/create-admin.js` mediante stdin; no se ejecutó en DEV.

Quedan fuera de lo comprobado: RDS/TLS remoto, ALB/Cloudflare, sesiones entre múltiples EC2, upload y operación productiva sostenida. No hay recuperación de contraseña ni API de pedidos. Se documentó como mejora menor la creación innecesaria de direcciones al editar restaurantes, que no altera direcciones compartidas pero acumula filas sin referencia. Ver el [cierre de revisión](EVA3-revision-final.md) y la [guía AWS](EVA3-AWS.md).
