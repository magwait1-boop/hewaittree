const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTs(relativePath, dependencies = {}) {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}

const validation = loadTs('src/lib/visitorFeedbackValidation.ts');
const input = { name: 'زائر تجريبي', phone: '+201012345678', message: 'مقترح تجريبي لعرض الشجرة' };

test('Arabic and Persian phone digits and international prefixes normalize correctly', () => {
  assert.equal(validation.normalizePhone('٠٠٢٠ (١٠) ١٢٣٤-٥٦٧٨'), '+201012345678');
  assert.equal(validation.normalizePhone('+۹۶۶ ۵۰ ۱۲۳ ۴۵۶۷'), '+966501234567');
  assert.deepEqual(validation.validateVisitorFeedback({ ...input, name: '  زائر   تجريبي ', phone: '٠٠٢٠ (١٠) ١٢٣٤-٥٦٧٨', message: `  ${input.message}  ` }).value, input);
});

test('missing and malformed values reject before submission', () => {
  assert.deepEqual(Object.keys(validation.validateVisitorFeedback({ name: ' ', phone: '', message: '\n' }).errors), ['name', 'phone', 'message']);
  for (const phone of ['abc1234567', '12+345678', '123456', '1234567890123456', '+12.3/45678']) {
    assert.equal(validation.validateVisitorFeedback({ ...input, phone }).valid, false);
  }
  for (const name of ['أ', '12345', 'اسم\u0000']) assert.equal(validation.validateVisitorFeedback({ ...input, name }).valid, false);
});

test('message length bounds and database-incompatible null bytes are rejected', () => {
  assert.equal(validation.validateVisitorFeedback({ ...input, message: 'x'.repeat(4000) }).valid, true);
  assert.equal(validation.validateVisitorFeedback({ ...input, message: 'x'.repeat(4001) }).valid, false);
  assert.equal(validation.validateVisitorFeedback({ ...input, message: 'مرحبا\u0000' }).valid, false);
});

function fixture(result, authUser = null, authError = null) {
  const calls = [];
  const query = new Proxy({}, {
    get(_target, name) {
      if (name === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      return (...args) => { calls.push([name, ...args]); return query; };
    },
  });
  const client = {
    auth: { getUser: async () => { calls.push(['getUser']); return { data: { user: authUser }, error: authError }; } },
    from: table => { calls.push(['from', table]); return query; },
  };
  const service = loadTs('src/lib/visitorFeedbackService.ts', {
    '@/lib/supabase/client': { createClient: () => client },
    '@/lib/visitorFeedbackValidation': validation,
  });
  return { service, calls };
}

test('visitor submission inserts only normalized fields and never selects private data', async () => {
  const { service, calls } = fixture({ data: null, error: null });
  await service.submitVisitorFeedback({ ...input, phone: '٠٠٢٠١٠١٢٣٤٥٦٧٨' });
  assert.deepEqual(calls, [['from', 'visitor_feedback'], ['insert', input]]);
});

test('invalid input never reaches the database; failed writes never report success', async () => {
  const { service, calls } = fixture({ data: null, error: { code: '42501' } });
  await assert.rejects(service.submitVisitorFeedback({ ...input, phone: 'abc' }), /رقم هاتف/);
  assert.deepEqual(calls, []);
  await assert.rejects(service.submitVisitorFeedback(input), /تعذر إتمام العملية/);
});

test('admin access requires a verified Supabase user and immutable DB membership', async () => {
  const noAuth = fixture({ data: { user_id: 'admin-id' }, error: null });
  assert.deepEqual(await noAuth.service.getFeedbackAdminAccess(), { signedIn: false, allowed: false, email: '' });
  assert.deepEqual(noAuth.calls, [['getUser']]);
  const unlisted = fixture({ data: null, error: null }, { id: 'ordinary-user', email: 'user@example.test' });
  assert.equal((await unlisted.service.getFeedbackAdminAccess()).allowed, false);
  assert.deepEqual(unlisted.calls.find(call => call[0] === 'eq'), ['eq', 'user_id', 'ordinary-user']);
  const listed = fixture({ data: { user_id: 'admin-id' }, error: null }, { id: 'admin-id', email: 'admin@example.test' });
  assert.equal((await listed.service.getFeedbackAdminAccess()).allowed, true);
  const denied = fixture({ data: null, error: { code: '42501' } }, { id: 'admin-id' });
  await assert.rejects(denied.service.getFeedbackAdminAccess(), /تعذر/);
});

test('inbox pagination detects a next page without dropping messages', async () => {
  const rows = Array.from({ length: 26 }, (_, index) => ({ id: String(index) }));
  const { service, calls } = fixture({ data: rows, error: null });
  const result = await service.fetchVisitorFeedback(2);
  assert.equal(result.messages.length, 25);
  assert.equal(result.hasMore, true);
  assert.deepEqual(calls.find(call => call[0] === 'range'), ['range', 50, 75]);
});

test('reviewing messages updates status only and detects revoked permissions', async () => {
  const { service, calls } = fixture({ data: { id: 'message-id' }, error: null });
  await service.markVisitorFeedbackReviewed('message-id');
  assert.deepEqual(calls.find(call => call[0] === 'update'), ['update', { status: 'reviewed' }]);
  assert.deepEqual(calls.find(call => call[0] === 'eq'), ['eq', 'id', 'message-id']);
  const revoked = fixture({ data: null, error: null });
  await assert.rejects(revoked.service.markVisitorFeedbackReviewed('message-id'), /صلاحية حسابك/);
});
