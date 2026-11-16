> Documento histórico: describe una iteración anterior. El estado vigente, las pruebas y las restricciones de operación están en [EVA3-estado-final.md](EVA3-estado-final.md).

# EVA 3 — Recuperación del frontend original (main)

## Motivo
El docente requiere conservar el aspecto del frontend de `pnkSecurity/index.php` de la rama `main`, modificando el backend.

## Origen de recursos
- `Desarrollo-seguro-main.zip`: `pnkSecurity/index.php`, `css/style.css`, `img/`, `imagenes/` y librerías de `vendors/`.
- El HTML en `frontend/public/index.html` usa las mismas clases y jerarquía principales del original: encabezado con inicio de sesión, logos, carrito, destacados, pestañas de cartas, categorías, ítems, comentarios y pie institucional.
- Archivos estáticos originales se encuentran en `frontend/public/legacy/` y se publican exclusivamente bajo `/static/legacy/`.

## Adaptación y seguridad
- No se sirve PHP: el backend es Express y PostgreSQL.
- La vista obtiene datos mediante `GET /api/restaurantes/:id/carta` y comentarios mediante `GET /api/restaurantes/:id/comentarios`.
- Todas las entradas de datos se insertan con `textContent`, sin `innerHTML`; identificadores verificados y SQL parametrizado.
- Mismas rutas visibles en `/` (`id=1` predeterminado), `/?id=N` y `/carta/N`.
- `GET /carrito/N`: selección de productos guardada solo para esa sesión del navegador (sessionStorage), **no persistida en servidor**. Es un paso intermedio; falta sesión/cesta backend.
- El login original se muestra visualmente, pero su envío se bloquea con aviso explícito hasta implementar autenticación segura. Comentarios públicos solo lectura; falta autenticación y creación de comentarios.
- No hay scripts del PHP original ni `controladorajax.js` (hacía POST a `carrito.php`). No ejecutar PHP en Express.

## Verificación local
1. En la rama `feature/fullstack-mvc`, integrar este paquete sin borrar `.env` ni sobrescribir migraciones.
2. Usar el PostgreSQL ya instalado y con las migraciones/datos cargados.
3. `PORT=3100 npm start` en Git Bash (el puerto 3000 está ocupado por Live Preview de VS Code).
4. Abrir `http://127.0.0.1:3100/?id=1` y revisar aspecto, destacados, cartas y carrito. Probar `?id=2`.
5. `npm test`; `npm run test:db` requiere PostgreSQL real.
6. Capturar pantallas comparativas. No hacer commit hasta revisar.

## Pendientes
Autenticación, comentarios de escritura, persistencia del carrito en backend, comprobaciones visuales con el profesor, Docker/QA/PROD, AWS, Cloudflare y manual final.
