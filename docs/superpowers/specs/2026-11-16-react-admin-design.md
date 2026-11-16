# EVA 3: React y administración

Especificación de ejecución derivada de la solicitud adjunta del usuario del 16-11-2026.

## Objetivo y restricciones

Convertir el frontend existente a React + Vite y añadir administración real de restaurantes, cartas, categorías, productos y usuarios. Conservar Express MVC, PostgreSQL 17, Argon2id, sesiones opacas, defensa CSRF, carrito, comentarios, siete restaurantes y presentación original de Africa Restobar.

Trabajar únicamente en feature/fullstack-mvc desde 6d6341c. No push, AWS, infraestructura de pago, DROP, TRUNCATE, borrado de volúmenes ni pruebas de escritura en DEV. No cambiar migraciones históricas, secretos ni archivos PHP históricos. No elevar automáticamente usuarios existentes.

## Arquitectura elegida

SPA React compilada por Vite, servida por Express en el mismo origen. Se reutilizan CSS, Bootstrap y fotografías de frontend/public/legacy; las interacciones pasan a React sin jQuery. Una aplicación separada en otro origen añadiría complejidad de cookies/CORS; reconstruir backend o catálogo perdería trabajo existente.

Conservar /carta/:id y /carrito/:id. Panel /admin/login, /admin/dashboard, /admin/restaurantes, /admin/cartas, /admin/categorias, /admin/productos, /admin/usuarios. El login utiliza exclusivamente /api/auth/login y /api/auth/me.

Migración 004 incremental: usuarios.rol con CLIENTE como valor seguro por defecto, roles ADMIN_GENERAL y ADMIN_RESTAURANTE, tabla usuario_restaurantes y disponibilidad de productos. Estado de restaurante mediante eliminado; cartas/categorías/productos mediante visible y sus campos históricos de eliminación. Ningún borrado físico comercial.

API /api/admin: GET dashboard; GET/POST colecciones restaurantes, cartas, categorias, productos, usuarios; GET/PATCH /:recurso/:id. Respuestas {registros:[...]} y {registro:{...}}. Los registros incluyen activo booleano. Relación pública histórica restautantes_id; se mantiene este nombre en formularios/API de cartas y se expone restaurante_id resuelto para aislamiento. Usuarios incluyen restaurantes: [id], rol, activo y nunca hashes. ADMIN_RESTAURANTE no puede administrar usuarios ni crear restaurantes; sólo recursos de restaurantes asignados. Comprobar tanto relación original como destino al editar.

Fotografías: asociación a archivos raster existentes por nombre seguro o ruta /static/legacy/imagenes/codN/archivo.ext del mismo restaurante. No aceptar URLs remotas, SVG, rutas transversales o datos inline. El panel permite asociar fotografía y documenta el límite de longitud; no requiere subida porque la solicitud admite asociar o subir.

## Verificación

Pruebas unitarias reales del contrato HTTP, validación, permisos y CSRF. Integración PostgreSQL únicamente con APP_ENV=qa y nombre de base QA comprobado; conservar fixtures originales sin depender del total global. Playwright contra Express real con PostgreSQL QA: React, navegación de siete restaurantes, carrito, login/logout, comentarios y CRUD integral con cambio público del precio; roles y ataques SQLi/XSS/CSRF.

Docker compila frontend en etapa de construcción y ejecuta Express como usuario node. Mantener puertos 3101/3201/3301 y scripts/stack.mjs. Ningún servidor Vite en producción. Documentar bootstrap explícito de administrador sin contraseñas en Git.
