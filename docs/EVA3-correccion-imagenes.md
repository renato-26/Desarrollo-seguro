> Documento histórico: describe una iteración anterior. El estado vigente, las pruebas y las restricciones de operación están en [EVA3-estado-final.md](EVA3-estado-final.md).

# EVA 3 — Correccion de imagenes del catalogo

## Problema detectado

En los recursos heredados de `main`, `item2.jpg` y `item5.jpg` muestran lomo a lo pobre, mientras que `item3.jpg` muestra porotos granados. Los registros de la base de datos vinculaban indebidamente `item2.jpg` con **Crema de espinacas** (ID 2) e `item3.jpg` con el segundo **Lomo a lo Pobre** (ID 7).

## Correccion implementada

- Se agrega la imagen ilustrativa original generada para **Crema de espinacas** (`crema_espinacas.jpg`) al frontend heredado y al directorio de recursos del frontend anterior. No es una fotografia real del restaurante.
- El archivo SQL versionado `database/seeds/002_corregir_fotos_catalogo.sql` corrige ID 2 -> `crema_espinacas.jpg` e ID 7 -> `item5.jpg`.
- El seed original `001_original_data.sql` no se modifica, pues su checksum ya esta registrado.
- Las sentencias `UPDATE` comprueban el identificador, el nombre y la foto previa para no alterar accidentalmente otros productos.
- Se agregan pruebas unitarias de presencia, firma JPEG y asociaciones SQL.

## Aplicar y verificar

1. Copiar este paquete en la raiz del repositorio (`package.json`).
2. Ejecutar `npm test`.
3. DEV local: `npm run db:seed` (solo si usas la base de desarrollo fuera de Docker).
4. DEV Docker: `DB_PORT=5433 PORT=3101 docker compose build && DB_PORT=5433 PORT=3101 docker compose run --rm migrate node database/run.js seed && DB_PORT=5433 PORT=3101 docker compose up -d`.
5. QA Docker: `APP_ENV=qa PORT=3201 DB_PORT=5434 docker compose --env-file .env.qa build && APP_ENV=qa PORT=3201 DB_PORT=5434 docker compose --env-file .env.qa run --rm migrate node database/run.js seed && APP_ENV=qa PORT=3201 DB_PORT=5434 docker compose --env-file .env.qa up -d`.
6. PROD local Docker: `docker compose --env-file .env.prod build && docker compose --env-file .env.prod run --rm migrate node database/run.js seed && docker compose --env-file .env.prod up -d`.
7. Verificar en `/carta/1` y validar la consulta a PostgreSQL: `SELECT id,nombre,foto FROM items WHERE id IN (2,7) ORDER BY id;`

**No ejecutar** `docker compose down -v` ni borrar volumenes. DEV, QA y PROD deben seguir separados. El despliegue real en AWS requiere revisar imagenes y condiciones de licencia antes de publicar.
