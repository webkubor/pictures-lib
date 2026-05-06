import assert from 'node:assert/strict';
import { onRequestPost } from '../functions/api/assets/delete.js';

const request = (body, token = 'secret') => new Request('https://pictures-lib.test/api/assets/delete', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
});

async function call({ body, token = 'secret', env = {} }) {
  const response = await onRequestPost({
    request: request(body, token),
    env: {
      PICTURES_ADMIN_TOKEN: 'secret',
      PICTURES_R2: {
        async head(path) {
          return path === 'exists.png' ? { size: 1 } : null;
        },
        async delete(path) {
          env.deleted = path;
        },
      },
      ...env,
    },
  });

  return {
    status: response.status,
    body: await response.json(),
    deleted: env.deleted,
  };
}

assert.equal((await call({ body: { source: 'r2', path: 'exists.png' }, token: 'bad' })).status, 401);
assert.equal((await call({ body: { source: 'github', path: 'exists.png' } })).status, 400);
assert.equal((await call({ body: { source: 'r2', path: '../exists.png' } })).status, 400);
assert.equal((await call({ body: { source: 'r2', path: 'missing.png' } })).status, 404);

const deleted = await call({ body: { source: 'r2', path: 'exists.png' } });
assert.equal(deleted.status, 200);
assert.equal(deleted.body.ok, true);
assert.equal(deleted.deleted, 'exists.png');

console.log('R2 delete function tests passed.');
