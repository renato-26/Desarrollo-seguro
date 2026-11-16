-- Ninguna cuenta histórica recibe privilegios administrativos.
ALTER TABLE usuarios ADD COLUMN rol varchar(24) NOT NULL DEFAULT 'CLIENTE'
  CHECK (rol IN ('CLIENTE', 'ADMIN_GENERAL', 'ADMIN_RESTAURANTE'));
CREATE TABLE usuario_restaurantes (
  usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  restaurante_id integer NOT NULL REFERENCES restautantes(id) ON DELETE RESTRICT,
  PRIMARY KEY (usuario_id, restaurante_id)
);
CREATE INDEX usuario_restaurantes_restaurante_idx ON usuario_restaurantes(restaurante_id);
ALTER TABLE items ADD COLUMN disponible boolean NOT NULL DEFAULT true;
