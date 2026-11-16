# EVA 3: revisión independiente final de código

Fecha: 16-11-2026. Rama `feature/fullstack-mvc`, base `6d6341c`. Alcance: implementación React/Express/PostgreSQL, incluidos archivos nuevos sin seguimiento, controles administrativos, autenticación, catálogo, migraciones, Docker, configuración y pruebas. Se leyó la solicitud adjunta completa y la especificación de diseño. Revisión de código y una comprobación offline de validación; no se ejecutaron Docker, servidores conectados a PostgreSQL, escrituras de BD ni lecturas de archivos de entorno. No se modificó implementación desde esta revisión.

La revisión encontró dos defectos funcionales P2, un requisito de TLS de producción que se comunicó al implementador y brechas de cobertura. No se identificó una vía concreta de SQL Injection, XSS renderizado por React o acceso administrativo a restaurantes ajenos en el código inspeccionado. Esto no certifica una instalación productiva ni sustituye la ejecución de QA.

## Hallazgos funcionales que requieren corrección

### P2: una coincidencia de nombre impide iniciar sesión con el correo de otra cuenta

Ubicación: `backend/src/models/auth.model.js:7-8`; validación relacionada: `backend/src/services/admin.service.js:29-33` y `146-150`.

La consulta mezcla `lower(email) = $1 OR lower(nombre) = $1` y elige el menor ID. El panel permite nombres libres, no únicos, y sólo verifica unicidad del correo. Si una cuenta A anterior tiene nombre `nuevo@qa.invalid` y correo `anterior@qa.invalid`, se puede crear una cuenta B con nombre `Nuevo` y correo `nuevo@qa.invalid`. Al iniciar sesión B con su correo y contraseña, la consulta devuelve A y se rechaza la contraseña de B. También pueden aparecer ambigüedades al usar nombres duplicados como identificador.

La función real `validateAdminInput` aceptó ambas entradas en una comprobación offline; no se crearon cuentas. La selección incorrecta se deduce directamente del predicado y `ORDER BY id`. Priorizar una coincidencia exacta de correo y definir un comportamiento seguro para nombres ambiguos; verificar creación de las dos cuentas y acceso correcto en QA.

### P2: los comentarios nuevos dejan de aparecer al superar 100 registros

Ubicación: `backend/src/models/catalog.model.js:57-64`; efecto visible en `frontend/src/components/Comments.jsx:15` y `22-23`.

La API devuelve siempre los primeros 100 comentarios por ID ascendente. Cuando un restaurante ya tiene 100, publicar otro devuelve 201 y React lo añade a la pantalla, pero recargar vuelve a cargar solamente los 100 antiguos. No existe paginación para recuperar el nuevo comentario. La persistencia en PostgreSQL existe, pero la funcionalidad visible parece perder comentarios a partir de ese umbral.

Devolver una ventana de los últimos 100, ordenada para presentación, o añadir paginación. Verificar en QA más de 100 comentarios de un restaurante de prueba, publicación, recarga y límite de respuesta. No se insertaron comentarios desde esta revisión.

## Producción: condición de bloqueo identificada

### P1 antes del despliegue: producción permitía PostgreSQL sin TLS

Estado observado al comenzar: `backend/src/config/env.js:5` usaba `disable` por defecto y `:15` admitía ese valor incluso para `APP_ENV=prod`; `backend/src/config/database.js:6` convierte ese modo en `ssl:false`. Un `DATABASE_URL` externo válido con `APP_ENV=prod` y `NODE_ENV=production`, sin `DB_SSL`, podía iniciar conexiones sin TLS. Se comunicó al implementador, que inició una corrección y pruebas de regresión mientras continuaba esta revisión. El resultado final de esa corrección debe constar en el informe de ejecución; no se debe mantener este apartado como defecto abierto si las pruebas posteriores lo resuelven.

Además, `compose.yaml:13` fija `DB_SSL:disable` para todas las instancias locales, mientras `scripts/stack.mjs` anuncia `up prod`. Si se exige `verify-full` para producción, el comando PROD local con PostgreSQL sin TLS deja de poder iniciar migración/backend. La documentación debe reflejar ese límite, o distinguir explícitamente un entorno local de la configuración productiva, sin introducir una excepción que permita RDS sin TLS. Esta revisión no solicitó cambiar archivos de entorno ni iniciar PROD.

La conexión externa real, CA de confianza de RDS, hostname, HTTPS/ALB/Cloudflare, secretos y políticas de acceso siguen sin validación aquí. Son condiciones de despliegue pendiente, no fallos de la API local inferidos sin evidencia.

## Cobertura pendiente para afirmar CRUD completo verificado

`tests/e2e/react-admin.spec.js:70-132` cubre creación de los cinco recursos, edición de precio/observaciones y de nombre de usuario, comentario persistente y desactivación de producto. `:135-169` cubre varios permisos, reasignación y desactivación de usuario. La lectura del conjunto no encontró comprobaciones de los siguientes comportamientos exigidos:

- Editar y desactivar/reactivar restaurantes, cartas y categorías; confirmar su efecto en la carta pública y la conservación de descendientes.
- Cambiar el orden de al menos dos categorías y comprobar el orden público resultante.
- Cambiar `disponible` de verdadero a falso y después a verdadero, comprobando la carta pública.
- Asociar correctamente una fotografía existente y comprobar su imagen en el navegador; las pruebas actuales sólo rechazan fotos maliciosas o inspeccionan imágenes del catálogo inicial.
- Cambiar rol y contraseña de una cuenta con sesión abierta y comprobar permisos/sesión posteriores.
- Cambios de propiedad en ambas direcciones para todos los recursos relacionales en PostgreSQL real; existen pruebas unitarias para algunos casos, sin equivalencia completa en navegador/API QA.

Son brechas de evidencia, no defectos demostrados de esas capacidades. Deben ampliarse las pruebas o acotarse las afirmaciones de verificación. Esta revisión no repitió las suites completas del implementador ni verifica sus conteos reportados.

La comprobación de imágenes `tests/e2e/react-admin.spec.js:41` sólo considera imágenes que ya terminaron de cargar; una imagen todavía pendiente no cuenta como rota. Para demostrar carga real, esperar `complete && naturalWidth > 0` de las imágenes comprobadas.

## Mejoras opcionales y riesgos operativos documentables

- **P3, ya conocido: direcciones huérfanas.** `backend/src/models/admin.model.js:118-125` inserta una nueva dirección en cualquier PATCH del restaurante, incluso cambio exclusivo de teléfono o estado. Preserva correctamente direcciones compartidas, pero acumula filas sin referencia. Clonar sólo cuando cambie una dirección es una mejora independiente.
- **Proxy antes de AWS.** `backend/src/app.js` no configura proxies confiables y `backend/src/controllers/auth.controller.js:18-19` usa `req.ip` en la clave de intentos. Detrás de ALB, varios clientes pueden compartir la IP del proxy; cinco intentos erróneos para un identificador pueden bloquear a otros clientes del mismo proxy. Definir y probar la topología confiable antes de producción; no habilitar confianza indiscriminada de cabeceras desde Internet.
- **Retención de sesiones/intentos.** Las sesiones vencidas se ignoran correctamente al autenticar, pero no hay una tarea de limpieza de `auth_sessions` ni `auth_attempts` en el código inspeccionado. Documentar una política de mantenimiento para una operación sostenida.
- **Diagnóstico.** Los controladores administrativos y de autenticación capturan errores inesperados y devuelven 503 sin contexto de diagnóstico. Añadir registros sanitizados e identificadores de petición ayudaría a distinguir fallos SQL, de esquema o de archivos durante producción, sin registrar passwords, cookies, tokens ni URLs con credenciales.

## Controles comprobados mediante lectura

- `authorizedRecord` comprueba el ámbito original y el padre destino; el guardado relee y bloquea el actor dentro de una transacción SERIALIZABLE. El administrador de restaurante no crea restaurantes ni administra usuarios.
- Listados y dashboard filtran por asignaciones; el administrador acotado no recibe conteos globales de usuarios. Roles, estado y asignaciones vigentes se leen al resolver sesiones. Password nuevo y desactivación revocan sesiones.
- Valores SQL parametrizados e identificadores elegidos de listas internas; campos desconocidos, enteros inválidos y estados no booleanos se rechazan. Las proyecciones públicas no incluyen hashes.
- Sesiones opacas de 256 bits, hash SHA-256 almacenado, expiración, cookie HttpOnly/SameSite y Secure en producción. Escrituras requieren cabecera dedicada y origen permitido. No hay CORS permisivo.
- Fotografías existentes restringidas al restaurante, extensión/firma raster, tamaño y rutas reales; movimientos de cartas/categorías validan también fotografías descendientes. No existe un servicio de uploads y no se presupone almacenamiento mutable compartido.
- React muestra texto escapado y reutiliza CSS, Bootstrap, recursos y estructura originales; los controles de carrito, errores, vacíos y rutas públicas están presentes. La disponibilidad y desactivación se filtran en la consulta pública; el orden se aplica en SQL.
- Migración 004 incremental, CLIENTE por defecto y sin elevación de cuentas históricas. Fixtures de E2E e integración comprueban la base QA antes de escrituras. Docker compila React, sirve Express como usuario `node` e incluye health check.

## Dictamen

La implementación cubre el conjunto funcional solicitado y conserva la separación MVC y los controles de seguridad principales. Corregir los dos P2, cerrar el requisito TLS y completar la evidencia de CRUD/orden/disponibilidad antes de declararla totalmente verificada. El inicio de una preparación AWS es posible con esos resultados y una guía de operación completa; un despliegue productivo sigue condicionado a la configuración y validación externa indicada. Esta revisión no autoriza ni ejecuta cambios en DEV, PostgreSQL, credenciales, infraestructura, Git remoto o archivos de entorno.

## Cierre de hallazgos por el implementador

Estado al finalizar el 16-11-2026; evidencia en `EVA3-estado-final.md`. Este apartado actualiza el estado inicial de los hallazgos anteriores, sin presentar una segunda revisión independiente.

- Colisión correo/nombre: corregida priorizando correo y rechazando nombres ambiguos; regresión PostgreSQL QA reproducida y aprobada, incluida en4 integraciones verdes.
- Comentarios después de100: corregidos mediante últimos100 ordenados cronológicamente; regresión real QA con105 inserciones revertidas aprobada.
- TLS productivo: obligatorio `verify-full`; regresión unitaria aprobada. Se añadió Compose externo y se bloqueó el `up prod` local incompatible, sin excepciones inseguras de TLS ni archivos de entorno modificados.
- Cobertura ampliada: edición/desactivación/reactivación de jerarquía, orden, disponibilidad, rol/asignaciones y asociación/carga real de fotografía. Diez E2E pasaron tanto en checkout como Docker QA y después de promover DEV. No se afirma haber probado todas las combinaciones de cambio de contraseña/rol con sesiones abiertas ni todos los movimientos relacionales; permanecen límites de cobertura, no defectos demostrados.
- API `no-store`, incluido `/auth/me`, comprobada por regresión unitaria.
- Proxy/IP, retención de sesiones, logging productivo y direcciones innecesarias quedaron documentados. Los aspectos de topología real se resolverán y validarán antes de despliegue AWS; no se activó confianza indiscriminada de proxies.

Aceptación final:48 unitarias +4 integración +10 E2E checkout +10 E2E Docker +10 E2E Docker posteriores a DEV =82 ejecuciones aprobadas,0 fallidas/omitidas. Los diez casos E2E son los mismos repetidos. DEV y QA saludables, misma imagen, datos previos y PostgreSQL preservados. AWS no ejecutado.
