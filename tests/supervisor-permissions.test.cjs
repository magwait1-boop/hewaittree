const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const ts = require('typescript');

function loadTs(relativePath, dependencies = {}) {
  const file = path.join(__dirname, '..', relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(name => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}

const permissions = loadTs('src/lib/familyPermissions.ts');
const keys = ['can_edit', 'can_delete', 'can_moderate', 'can_style'];
const denied = Object.fromEntries(keys.map(key => [key, false]));
const allowed = Object.fromEntries(keys.map(key => [key, true]));

test('admins retain all capabilities and guests have none', () => {
  assert.deepEqual(permissions.getPermissions({ username: 'admin', role: 'admin', ...denied }), allowed);
  assert.deepEqual(permissions.getPermissions(null), denied);
  assert.deepEqual(permissions.getPermissions({ username: 'legacy', role: 'supervisor' }), denied);
});

const hooks = { ...React, useMemo: callback => callback(), useRef: current => ({ current }) };
const familyData = { getGeneration: () => 1, getLineage: () => '', getTotalDescendants: () => 0 };
const dependencies = { react: hooks, '@/lib/familyData': familyData, '@/lib/familyPermissions': permissions };
const Toolbar = loadTs('src/app/components/TreeToolbar.tsx', dependencies).default;
const Sidebar = loadTs('src/app/components/TreeSidebar.tsx', dependencies).default;

function buttons(element, result = []) {
  if (Array.isArray(element)) element.forEach(child => buttons(child, result));
  else if (element && typeof element === 'object' && element.props) {
    if (element.type === 'button') result.push(element);
    buttons(element.props.children, result);
  }
  return result;
}
function content(element) {
  if (Array.isArray(element)) return element.map(content).join('');
  if (element?.props) return content(element.props.children);
  return typeof element === 'string' ? element : '';
}

test('all 16 supervisor combinations expose exactly their allowed tree actions', () => {
  for (let mask = 0; mask < 16; mask++) {
    const flags = Object.fromEntries(keys.map((key, index) => [key, !!(mask & (1 << index))]));
    const currentUser = { username: 'supervisor', role: 'supervisor', supervisorId: 'id-1', ...flags };
    assert.deepEqual(permissions.getPermissions(currentUser), flags);
    const toolbarButtons = buttons(Toolbar({ currentUser, persons: [], searchQuery: '', searchMatches: [], searchIndex: 0, pendingCount: 0 }));
    const toolbarHas = label => toolbarButtons.some(button => button.props['aria-label'] === label);
    assert.equal(toolbarHas('إضافة شخص'), flags.can_edit);
    assert.equal(toolbarHas('الضبط'), flags.can_style);
    assert.equal(toolbarHas('الطلبات'), flags.can_moderate);
    const sidebarButtons = buttons(Sidebar({ currentUser, nodeId: 'p1', persons: [], personMap: new Map([['p1', { id: 'p1', name: 'شخص', gender: 'ذكر' }]]), childrenMap: new Map() }));
    const sidebarHas = label => sidebarButtons.some(button => content(button).includes(label));
    assert.equal(sidebarHas('تعديل بيانات الشخص'), flags.can_edit);
    assert.equal(sidebarHas('إضافة ابن'), flags.can_edit);
    assert.equal(sidebarHas('حذف'), flags.can_delete);
    assert.equal(sidebarHas('تحديد الذرية'), flags.can_style);
  }
});

function serviceFixture(result) {
  const calls = [];
  const query = new Proxy({}, {
    get(_target, name) {
      if (name === 'then') return (resolve, reject) => Promise.resolve(result).then(resolve, reject);
      return (...args) => { calls.push([name, ...args]); return query; };
    },
  });
  const service = loadTs('src/lib/supervisorService.ts', {
    '@/lib/familyPermissions': permissions,
    '@/lib/supabase/client': { createClient: () => ({ from: table => { calls.push(['from', table]); return query; } }) },
  });
  return { calls, service };
}

test('creating a supervisor persists the requested defaults without reading passwords', async () => {
  const { calls, service } = serviceFixture({ data: { id: 'id-1' }, error: null });
  await service.addSupervisor('  supervisor  ', ' password ');
  assert.deepEqual(calls.find(call => call[0] === 'insert')[1], { username: 'supervisor', password: ' password ', can_edit: true, can_delete: false, can_moderate: true, can_style: false });
  assert.equal(calls.find(call => call[0] === 'select')[1].includes('password'), false);
});

test('permission updates write one flag and target the selected supervisor id', async () => {
  const { calls, service } = serviceFixture({ data: { id: 7, can_delete: true }, error: null });
  await service.updateSupervisorPermission(7, 'can_delete', true);
  assert.deepEqual(calls.find(call => call[0] === 'update'), ['update', { can_delete: true }]);
  assert.deepEqual(calls.find(call => call[0] === 'eq'), ['eq', 'id', 7]);
  assert.equal(calls.find(call => call[0] === 'select')[1].includes('password'), false);
});

test('supervisor login reads permissions while filtering exact credentials', async () => {
  const { calls, service } = serviceFixture({ data: null, error: null });
  assert.equal(await service.authenticateSupervisor('  user  ', ' password '), null);
  assert.deepEqual(calls.filter(call => call[0] === 'eq'), [['eq', 'username', 'user'], ['eq', 'password', ' password ']]);
  assert.equal(calls.find(call => call[0] === 'select')[1].includes('password'), false);
});

test('revoked or failed permission writes reject instead of reporting success', async () => {
  const { service } = serviceFixture({ data: null, error: { code: '42501' } });
  await assert.rejects(service.updateSupervisorPermission('id-1', 'can_style', true), /تعذر تحديث الصلاحية/);
});
