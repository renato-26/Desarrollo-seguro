-- Read-only audit. Credentials are covered by row fingerprints, never exported.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '3s';
WITH business_rows AS (
  SELECT 'direcciones' AS tabla, id, to_jsonb(t) AS datos FROM public.direcciones t
  UNION ALL SELECT 'restautantes', id, to_jsonb(t) FROM public.restautantes t
  UNION ALL SELECT 'cartas', id, to_jsonb(t) FROM public.cartas t
  UNION ALL SELECT 'categorias', id, to_jsonb(t) FROM public.categorias t
  UNION ALL SELECT 'items', id, to_jsonb(t) - 'disponible' FROM public.items t
  UNION ALL SELECT 'usuarios', id, to_jsonb(t) - 'rol' FROM public.usuarios t
  UNION ALL SELECT 'comentarios', id, to_jsonb(t) FROM public.comentarios t
), counts AS (
  SELECT names.tabla, count(b.id) AS filas
    FROM (VALUES ('direcciones'),('restautantes'),('cartas'),('categorias'),('items'),('usuarios'),('comentarios')) AS names(tabla)
    LEFT JOIN business_rows b ON b.tabla=names.tabla GROUP BY names.tabla
), orphan_checks AS (
  SELECT 'restaurante_direccion' AS relacion, count(*) AS huerfanos FROM public.restautantes r LEFT JOIN public.direcciones d ON d.id=r.direcciones_id WHERE d.id IS NULL
  UNION ALL SELECT 'carta_restaurante',count(*) FROM public.cartas c LEFT JOIN public.restautantes r ON r.id=c.restautantes_id WHERE r.id IS NULL
  UNION ALL SELECT 'categoria_carta',count(*) FROM public.categorias c LEFT JOIN public.cartas p ON p.id=c.cartas_id WHERE p.id IS NULL
  UNION ALL SELECT 'item_categoria',count(*) FROM public.items i LEFT JOIN public.categorias c ON c.id=i.categorias_id WHERE c.id IS NULL
  UNION ALL SELECT 'comentario_restaurante',count(*) FROM public.comentarios c LEFT JOIN public.restautantes r ON r.id=c.id_restaurante WHERE c.id_restaurante IS NOT NULL AND r.id IS NULL
  UNION ALL SELECT 'comentario_usuario',count(*) FROM public.comentarios c LEFT JOIN public.usuarios u ON u.id=c.usuario_id WHERE c.usuario_id IS NOT NULL AND u.id IS NULL
  UNION ALL SELECT 'sesion_usuario',count(*) FROM public.auth_sessions s LEFT JOIN public.usuarios u ON u.id=s.usuario_id WHERE u.id IS NULL
), sequence_values AS (
  SELECT 'direcciones_id_seq' AS nombre,last_value,is_called FROM public.direcciones_id_seq
  UNION ALL SELECT 'restautantes_id_seq',last_value,is_called FROM public.restautantes_id_seq
  UNION ALL SELECT 'cartas_id_seq',last_value,is_called FROM public.cartas_id_seq
  UNION ALL SELECT 'categorias_id_seq',last_value,is_called FROM public.categorias_id_seq
  UNION ALL SELECT 'items_id_seq',last_value,is_called FROM public.items_id_seq
  UNION ALL SELECT 'usuarios_id_seq',last_value,is_called FROM public.usuarios_id_seq
  UNION ALL SELECT 'comentarios_id_seq',last_value,is_called FROM public.comentarios_id_seq
)
SELECT jsonb_build_object(
  'database',current_database(),
  'server_version',current_setting('server_version'),
  'transaction_read_only',current_setting('transaction_read_only'),
  'counts',(SELECT jsonb_object_agg(tabla,filas) FROM counts),
  'legacy_row_fingerprints',(SELECT jsonb_agg(jsonb_build_object('tabla',tabla,'id',id,'sha256',encode(sha256(convert_to(datos::text,'UTF8')),'hex')) ORDER BY tabla,id) FROM business_rows),
  'orphans',(SELECT jsonb_object_agg(relacion,huerfanos) FROM orphan_checks),
  'sequences',(SELECT jsonb_agg(to_jsonb(s) ORDER BY nombre) FROM sequence_values s),
  'restaurants',(SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.restautantes r),
  'addresses',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM public.direcciones d),
  'menus',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.cartas c),
  'categories',(SELECT jsonb_agg(to_jsonb(c) ORDER BY id) FROM public.categorias c),
  'products',(SELECT jsonb_agg(to_jsonb(i) - 'disponible' ORDER BY id) FROM public.items i),
  'roles',(SELECT jsonb_agg(jsonb_build_object('id',id,'rol',to_jsonb(u)->'rol','estado',estado,'requiere_cambio_password',requiere_cambio_password) ORDER BY id) FROM public.usuarios u),
  'availability',(SELECT jsonb_agg(jsonb_build_object('id',id,'disponible',to_jsonb(i)->'disponible') ORDER BY id) FROM public.items i),
  'assignments',/* assignment_rows */,
  'auth_sessions',jsonb_build_object('count',(SELECT count(*) FROM public.auth_sessions),'sha256',(SELECT encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,E'\n' ORDER BY token_hash),''),'UTF8')),'hex') FROM public.auth_sessions s)),
  'auth_attempts',jsonb_build_object('count',(SELECT count(*) FROM public.auth_attempts),'sha256',(SELECT encode(sha256(convert_to(coalesce(string_agg(to_jsonb(a)::text,E'\n' ORDER BY attempt_hash),''),'UTF8')),'hex') FROM public.auth_attempts a)),
  'history',(SELECT jsonb_agg(to_jsonb(h) ORDER BY name) FROM public.schema_history h),
  'columns',(SELECT jsonb_agg(jsonb_build_object('tabla',table_name,'columna',column_name,'tipo',data_type,'nullable',is_nullable,'default',column_default) ORDER BY table_name,ordinal_position) FROM information_schema.columns WHERE table_schema='public'),
  'constraints',(SELECT jsonb_agg(jsonb_build_object('tabla',r.relname,'nombre',c.conname,'validada',c.convalidated,'definicion',pg_get_constraintdef(c.oid)) ORDER BY r.relname,c.conname) FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public'),
  'indexes',(SELECT jsonb_agg(jsonb_build_object('tabla',tablename,'nombre',indexname,'definicion',indexdef) ORDER BY tablename,indexname) FROM pg_indexes WHERE schemaname='public')
);
COMMIT;
