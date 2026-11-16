import test from 'node:test';
import assert from 'node:assert/strict';
import { validateImageDigest, validateCommit, validateBaseUrl, releaseEntry, nextState, rollbackState } from '../../scripts/release/release-lib.mjs';
const sha = 'a'.repeat(40), sha2 = 'b'.repeat(40);
const img1 = `123456789012.dkr.ecr.sa-east-1.amazonaws.com/pnksecurity@sha256:${'1'.repeat(64)}`;
const img2 = `123456789012.dkr.ecr.sa-east-1.amazonaws.com/pnksecurity@sha256:${'2'.repeat(64)}`;
test('solo admite imágenes inmutables por digest, nunca latest o tags móviles', () => {
  assert.equal(validateImageDigest(img1), img1);
  for (const invalid of ['pnksecurity:latest','repo:latest', 'repo@sha256:short', 'repo@sha256:'+'z'.repeat(64), 'repo\nsecret']) {
    assert.throws(() => validateImageDigest(invalid));
  }
});
test('exige SHA completo de Git', () => {
  assert.equal(validateCommit(sha), sha);
  assert.throws(() => validateCommit('6d6341c'));
  assert.throws(() => validateCommit('../escape'));
});
test('la URL de verificación nunca admite credenciales ni parámetros', () => {
  assert.equal(validateBaseUrl('https://pnk.example.com/'), 'https://pnk.example.com');
  assert.throws(() => validateBaseUrl('https://user:pass@pnk.example.com/'));
  assert.throws(() => validateBaseUrl('https://pnk.example.com/?token=abc'));
  assert.throws(() => validateBaseUrl('file:///etc/passwd'));
});
test('la historia conserva SHA, digest y permite rollback manual', () => {
  const old = releaseEntry(img1, sha, new Date('2026-11-16T00:00:00Z'));
  const fresh = releaseEntry(img2, sha2, new Date('2026-11-16T01:00:00Z'));
  const state1 = nextState(null, old);
  const state2 = nextState(state1, fresh);
  assert.equal(state2.current.commit, sha2);
  assert.equal(state2.previous.commit, sha);
  const rolledBack = rollbackState(state2, new Date('2026-11-16T02:00:00Z'));
  assert.equal(rolledBack.current.commit, sha);
  assert.equal(rolledBack.previous.commit, sha2);
  assert.equal(rolledBack.history.length, 3);
});
test('rollback sin versión anterior falla sin mutaciones', () => {
  const s = nextState(null, releaseEntry(img1, sha));
  assert.throws(() => rollbackState(s), /No existe una versión anterior/);
  assert.throws(() => nextState(s, releaseEntry(img1, sha)), /ya está desplegada/);
});
