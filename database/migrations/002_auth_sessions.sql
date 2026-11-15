-- EVA 3: sesiones opacas; nunca se almacenan tokens en texto claro.
CREATE TABLE auth_sessions (
  token_hash char(64) PRIMARY KEY,
  usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(usuario_id);
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);

-- Límite de intentos persistente, apto para múltiples procesos de Express.
CREATE TABLE auth_attempts (
  attempt_hash char(64) PRIMARY KEY,
  failures integer NOT NULL DEFAULT 0,
  last_failure timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);
CREATE INDEX auth_attempts_expiry_idx ON auth_attempts(last_failure);
