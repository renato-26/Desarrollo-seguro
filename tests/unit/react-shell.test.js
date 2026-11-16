import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../../backend/src/app.js';

test('React: carta y rutas administrativas sirven la compilación con módulos y CSP', async () => {
  const server = createApp({ checkDatabase: async () => true }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/carta/1', '/carrito/1', '/admin/login', '/admin/dashboard', '/admin/productos']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 200, path);
      const html = await response.text();
      assert.match(html, /id="root"/);
      assert.match(html, /type="module"[^>]*src="\/assets\//);
      assert.doesNotMatch(html, /<script[^>]+(?:jquery|legacy-app|bootstrap\.bundle)/i);
      assert.match(response.headers.get('content-security-policy'), /script-src 'self'/);
    }
    assert.equal((await fetch(base + '/frontend/src/main.jsx')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
