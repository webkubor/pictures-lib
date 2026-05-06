const json = (payload, status = 200) => (
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
);

const readAdminToken = (request) => {
  const authorization = request.headers.get('authorization') || '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return request.headers.get('x-admin-token') || '';
};

const safeEqual = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;

  let mismatch = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
};

const validateR2Key = (path) => {
  if (typeof path !== 'string') return 'path must be a string.';
  if (!path || path.length > 1024) return 'path is empty or too long.';
  if (path.startsWith('/')) return 'path must be an R2 object key, not an absolute path.';
  if (/[\0-\x1F\x7F]/.test(path)) return 'path contains control characters.';
  if (path.split('/').includes('..')) return 'path traversal is not allowed.';
  return null;
};

async function parseJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function onRequestPost(context) {
  const adminToken = context.env.PICTURES_ADMIN_TOKEN;
  if (!adminToken) {
    return json({ ok: false, error: 'Delete token is not configured.' }, 500);
  }

  const requestToken = readAdminToken(context.request);
  if (!safeEqual(requestToken, adminToken)) {
    return json({ ok: false, error: 'Unauthorized.' }, 401);
  }

  if (!context.env.PICTURES_R2) {
    return json({ ok: false, error: 'R2 binding is not configured.' }, 500);
  }

  const body = await parseJson(context.request);
  if (!body) {
    return json({ ok: false, error: 'Invalid JSON body.' }, 400);
  }

  if (body.source !== 'r2') {
    return json({ ok: false, error: 'Only R2 deletion is supported.' }, 400);
  }

  const pathError = validateR2Key(body.path);
  if (pathError) {
    return json({ ok: false, error: pathError }, 400);
  }

  const existing = await context.env.PICTURES_R2.head(body.path);
  if (!existing) {
    return json({ ok: false, error: 'R2 object not found.' }, 404);
  }

  await context.env.PICTURES_R2.delete(body.path);
  return json({ ok: true, deleted: { source: 'r2', path: body.path } });
}
