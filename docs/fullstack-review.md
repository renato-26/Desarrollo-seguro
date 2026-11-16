> Documento histórico: describe una iteración anterior. El estado vigente, las pruebas y las restricciones de operación están en [EVA3-estado-final.md](EVA3-estado-final.md).

# Revisión independiente React + administración

> Disposición posterior del implementador: ambos P2 se reprodujeron y corrigieron. Pruebas de formulario PATCH y publicación de observaciones pasaron RED→GREEN; límite UI de contraseña unificado a 1024. La suite posterior pasó 47 unitarias, 2 integración y 8 E2E. La clonación de direcciones queda como optimización menor diferida. El texto siguiente conserva el informe original del revisor.

Fecha: 2026-11-16. Base: `6d6341c`; implementación local sin commit. Revisión del diff, archivos nuevos, especificación y plan. Sin cambios de implementación, escrituras de BD, red ni operaciones Docker. No se repitieron las suites del implementador.

## Hallazgos importantes

1. **P2 — El formulario bloquea modificaciones ordinarias de seis restaurantes históricos.** `frontend/src/admin/resources.js:19-24` genera un PATCH con todos los campos, incluida la fotografía intacta. `backend/src/services/admin.service.js:152-153` revalida cualquier fotografía presente. Los restaurantes originales 2–7 conservan `resto2.png` o `logo_empresa_comodin.png`, ausentes de sus respectivas carpetas `codN`. Reproducción: abrir el restaurante 3, cambiar únicamente Teléfono y guardar; devuelve 400 «La fotografía debe existir en el restaurante». Se confirmó mediante imports reales de `initialRecord`, `formPayload`, `validateAdminInput` y `validateAdminPhoto`, sin BD: los seis archivos se rechazan. Enviar solamente diferencias al editar permite conservar datos históricos, incluidos nulos, y mantiene la validación estricta al cambiar la foto.

2. **P2 — Las observaciones administradas nunca llegan a la carta pública.** `frontend/src/admin/resources.js:13` ofrece y guarda Observaciones; `frontend/src/components/Catalog.jsx` intenta mostrarlas. Sin embargo, `backend/src/models/catalog.model.js:44-45` omite `i.observaciones` de la consulta pública. Reproducción propuesta para QA: guardar una observación distintiva en un producto visible, consultar `/api/restaurantes/:id/carta` y abrir su carta; el campo falta en JSON y texto público. Confirmado por seguimiento de la proyección SQL y ensamblado sin transformaciones adicionales; no se hicieron escrituras para reproducirlo. Aunque la omisión de la consulta existía antes, la nueva función de edición queda incompleta. Incluir el campo en la proyección pública.

## Hallazgos menores

- `backend/src/models/admin.model.js:118-125`: cualquier PATCH de restaurante crea otra dirección, incluso `{activo:false}` o un cambio exclusivo de teléfono. La clonación protege direcciones compartidas, pero debería ejecutarse sólo si cambian campos de dirección; actualmente deja filas huérfanas en cada cambio de estado.
- `frontend/src/components/Shared.jsx:49` y `frontend/src/admin/resources.js:14`: el límite HTML de contraseña es 128, mientras API y bootstrap aceptan hasta 1024. Una cuenta creada mediante el bootstrap con más de 128 caracteres no puede introducir su contraseña completa en el login. Unificar el contrato.

## Cumplimiento y calidad

La arquitectura y los controles principales cumplen la especificación: React reutiliza Bootstrap/CSS/fotografías, conserva rutas públicas y panel; Express MVC sirve el build; Docker usa compilación multietapa y usuario `node`; migración 004 incremental con CLIENTE por defecto; SQL parametrizado y DTO explícito sin hashes; borrado lógico comercial; bootstrap create-only. La asociación de raster existentes satisface la alternativa autorizada de fotografías.

El backend comprueba tanto restaurante original como destino, bloquea relaciones al escribir y relee actor/asignaciones. Las sesiones consultan estado y rol vigentes; desactivación y cambio de contraseña revocan sesiones. El validador rechaza campos desconocidos, precios negativos/fraccionarios/fuera de rango, URLs externas, SVG, traversal, archivos inexistentes y firmas/extensiones incompatibles. Cero se acepta. El renderizado permite cartas vacías y valores opcionales nulos. Las pruebas QA comprueban el nombre real de la BD antes de escribir y mantienen fixtures originales.

**Veredicto:** sin hallazgos críticos de seguridad en el alcance inspeccionado; corregir los dos P2 antes de dar por completa la integración. Calidad general buena, con separación modelo/servicio/controlador y controles defensivos claros. Las suites reportadas por el implementador (45 unitarias, integración PostgreSQL y API real) no se ejecutaron aquí; la validación visual y el flujo de navegador permanecen a cargo de su ejecución Playwright actual. Falta cobertura de edición de registros históricos con fotografía inválida y de publicación de observaciones.
