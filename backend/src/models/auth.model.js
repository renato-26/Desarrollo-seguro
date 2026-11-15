export async function findUserForLogin(db, identifier) {
  const result = await db.query(
    `SELECT id, nombre, email, password_hash, requiere_cambio_password
       FROM usuarios
      WHERE estado = '1' AND (lower(email) = $1 OR lower(nombre) = $1)
      ORDER BY id LIMIT 1`, [identifier.toLowerCase()]);
  return result.rows[0] ?? null;
}

export async function isBlocked(db, attemptHash) {
  const result = await db.query(
    `SELECT (blocked_until IS NOT NULL AND blocked_until > now()) AS blocked
       FROM auth_attempts WHERE attempt_hash = $1`, [attemptHash]);
  return result.rows[0]?.blocked === true;
}

export async function recordFailure(db, attemptHash) {
  const result = await db.query(
    `INSERT INTO auth_attempts(attempt_hash, failures, last_failure, blocked_until)
     VALUES($1, 1, now(), NULL)
     ON CONFLICT(attempt_hash) DO UPDATE SET
       failures = CASE WHEN auth_attempts.last_failure < now() - interval '15 minutes' THEN 1
                       ELSE auth_attempts.failures + 1 END,
       blocked_until = CASE WHEN (CASE WHEN auth_attempts.last_failure < now() - interval '15 minutes' THEN 1
                                        ELSE auth_attempts.failures + 1 END) >= 5
                             THEN now() + interval '15 minutes' ELSE NULL END,
       last_failure = now()
     RETURNING (blocked_until IS NOT NULL AND blocked_until > now()) AS blocked`, [attemptHash]);
  return result.rows[0]?.blocked === true;
}

export async function clearFailures(db, attemptHash) {
  await db.query('DELETE FROM auth_attempts WHERE attempt_hash = $1', [attemptHash]);
}

export async function insertSession(db, tokenHash, userId, ttlSeconds) {
  await db.query(
    `INSERT INTO auth_sessions(token_hash, usuario_id, expires_at)
     VALUES($1, $2, now() + $3 * interval '1 second')`, [tokenHash, userId, ttlSeconds]);
}

export async function findSession(db, tokenHash) {
  const result = await db.query(
    `SELECT u.id, u.nombre, u.email
       FROM auth_sessions s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_hash = $1 AND s.expires_at > now()
        AND u.estado = '1' AND NOT u.requiere_cambio_password
      LIMIT 1`, [tokenHash]);
  return result.rows[0] ?? null;
}

export async function revokeSession(db, tokenHash) {
  await db.query('DELETE FROM auth_sessions WHERE token_hash = $1', [tokenHash]);
}
