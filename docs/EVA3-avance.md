# EVA 3 — Registro de implementación de la carta digital MVC

## Alcance de esta iteración
- Base: ZIP de `feature/fullstack-mvc` del 14-11-2026.
- Se mantiene el PHP original como referencia histórica de EVA 1 y 2; **no se ejecuta ni publica por Express**.
- Se añade un frontend **nuevo**, estático, responsive y en español; consume una API de solo lectura.
- Rutas: `GET /`, `GET /carta/:id`, `GET /api/restaurantes`, `GET /api/restaurantes/:id/carta` y `GET /api/health`.
- Modelo SQL parametrizado, filtrando por restaurante y omitiendo cartas, categorías y productos eliminados u ocultos.
- Vistas del menú incluyen restaurantes, categorías, platos y destacados.
- Los archivos CSS/JS y las imágenes necesarias se copian a `frontend/public`; no se exponen las rutas PHP ni `Script_BD`.
- Se añade cobertura unitaria de validación de identificadores y composición del menú.

## Seguridad de la primera y segunda evaluación aplicada a esta fase
- Inyección SQL: se usan parámetros `$1` para acceder a PostgreSQL.
- XSS: el frontend usa `textContent` y DOM API, no inserta valores del usuario o DB mediante `innerHTML`.
- Cabeceras HTTP: `helmet` existente, y Express oculta `x-powered-by`.
- Aislamiento multirrestaurante: todas las consultas por ID limitan restaurante y estado visible/no eliminado.
- Contraseñas históricas: `password_hash IS NULL` en seed; no habilitar login hasta recuperación de cuentas.
- No se habilitan carrito, login, comentarios ni acciones de escritura, para no simular seguridad inexistente.

## Verificaciones y limitaciones
- Validar con `npm ci && npm test` y Docker Compose en un equipo con Docker Desktop.
- La entrega anterior no había verificado migraciones en PostgreSQL real. Hasta correr esas pruebas, **no afirmar que PostgreSQL ni el nuevo frontend están validados de extremo a extremo**.
- Sin AWS/Cloudflare desplegados, tampoco se pueden presentar capturas de producción como evidencia.

## Siguiente iteración prioritaria
1. Comprobar DEV en Docker con seed y navegación real (varios restaurantes, categorías, destacados).
2. Probar SQL/aislamiento en PostgreSQL real e integrar Playwright de navegador.
3. Implementar autenticación y recuperación seguras antes de funciones de escritura.
4. Carrito y comentarios con sesión, control por usuario/restaurante y anti-CSRF.
5. QA, deploy e infraestructura AWS RDS/ALB/Auto Scaling; Cloudflare DNS/HTTPS; manual PDF con evidencias reales.
