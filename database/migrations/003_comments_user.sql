-- EVA3: trazabilidad de autor sin perder comentarios históricos.
ALTER TABLE comentarios
  ADD COLUMN usuario_id integer REFERENCES usuarios(id) ON DELETE RESTRICT;
ALTER TABLE comentarios
  ADD COLUMN creado_en timestamptz NOT NULL DEFAULT now();
CREATE INDEX comentarios_usuario_idx ON comentarios(usuario_id);
