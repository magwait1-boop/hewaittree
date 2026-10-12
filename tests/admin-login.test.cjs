const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { randomBytes, scryptSync } = require('node:crypto');
const ts = require('typescript');

function loadTs(relativePath, dependencies = {}) {
  const file = path.join(__dirname, '..', relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    name => dependencies[name] ?? require(name), module, module.exports
  );
  return module.exports;
}

const verifier = loadTs('src/lib/server/legacyAdmin.ts', { 'server-only': {} });
const route = loadTs('src/app/api/admin-login/route.ts', {
  '@/lib/server/legacyAdmin': verifier,
});

function request(body, headers = {}) {
  return new Request('https://tree.example/api/admin-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://tree.example', ...headers },
    body: JSON.stringify(body),
  });
}

test('administrator verification uses a server-only salted verifier and rejects incorrect credentials', async () => {
  const oldUsername = process.env.FAMILY_ADMIN_USERNAME;
  const oldHash = process.env.FAMILY_ADMIN_PASSWORD_HASH;
  const password = randomBytes(24).toString('hex');
  const salt = randomBytes(16).toString('hex');
  process.env.FAMILY_ADMIN_USERNAME = 'test-administrator';
  process.env.FAMILY_ADMIN_PASSWORD_HASH = `${salt}:${scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex')}`;
  try {
    assert.equal(await verifier.verifyLegacyAdmin(' test-administrator ', password), true);
    assert.equal(await verifier.verifyLegacyAdmin('different-user', password), false);
    assert.equal(await verifier.verifyLegacyAdmin('test-administrator', 'incorrect'), false);
    assert.equal(await verifier.verifyLegacyAdmin('test-administrator', 'x'.repeat(513)), false);
    const success = await route.POST(request({ username: 'test-administrator', password }));
    assert.equal(success.status, 200);
    assert.equal(success.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await success.json(), { authenticated: true });
    const rejected = await route.POST(request({ username: 'test-administrator', password: 'incorrect' }));
    assert.equal(rejected.status, 401);
    assert.deepEqual(await rejected.json(), { authenticated: false });
    process.env.FAMILY_ADMIN_PASSWORD_HASH = 'malformed';
    assert.equal((await route.POST(request({ username: 'test-administrator', password }))).status, 503);
  } finally {
    if (oldUsername === undefined) delete process.env.FAMILY_ADMIN_USERNAME;
    else process.env.FAMILY_ADMIN_USERNAME = oldUsername;
    if (oldHash === undefined) delete process.env.FAMILY_ADMIN_PASSWORD_HASH;
    else process.env.FAMILY_ADMIN_PASSWORD_HASH = oldHash;
  }
});

test('administrator login rejects cross-origin requests, non-JSON payloads and invalid shapes', async () => {
  assert.equal((await route.POST(request({}, { origin: 'https://untrusted.example' }))).status, 403);
  assert.equal((await route.POST(request({}, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await route.POST(request({ username: 'admin', password: null }))).status, 400);
  assert.equal((await route.POST(request({ username: 'admin', password: 'x'.repeat(4100) }))).status, 413);
  assert.equal((await route.POST(new Request('https://tree.example/api/admin-login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{invalid',
  }))).status, 400);
});
