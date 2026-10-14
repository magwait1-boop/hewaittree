const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { performance } = require('node:perf_hooks');
const ts = require('typescript');

function loadTs(file) {
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    (name) =>
      name.startsWith('.') ? loadTs(path.resolve(path.dirname(file), `${name}.ts`)) : require(name),
    module,
    module.exports
  );
  return module.exports;
}
const { normalizeArabic, normalizeCompoundNames, buildNameIndex, searchPersons } = loadTs(
  path.join(__dirname, '../src/lib/arabicSearch.ts')
);
const person = (id, name) => ({
  id,
  name,
  fatherId: '',
  gender: '',
  branch: '',
  manualX: 0,
  manualY: 0,
});
function search(names, query) {
  const persons = names.map((name, i) => person(String(i), name));
  return searchPersons(query, persons, buildNameIndex(persons));
}

for (const [left, right] of [
  ['أحمد', 'احمد'],
  ['إبراهيم', 'ابراهيم'],
  ['آدم', 'ادم'],
  ['إسماعيل', 'اسماعيل'],
  ['آمنة', 'امنة'],
  ['ٱحمد', 'احمد'],
  ['علي', 'على'],
  ['مصطفى', 'مصطفي'],
  ['يحيى', 'يحيي'],
  ['موسى', 'موسي'],
  ['فاطمة', 'فاطمه'],
  ['حمزة', 'حمزه'],
  ['هبة', 'هبه'],
  ['مُحَمَّـد', 'محمد'],
  ['عَبْدُ الرَّحْمَن', 'عبد الرحمن'],
]) {
  test(`Arabic equivalence in both directions: ${left} / ${right}`, () => {
    assert.equal(normalizeArabic(left), normalizeArabic(right));
    assert.deepEqual(search([left], right), ['0']);
    assert.deepEqual(search([right], left), ['0']);
  });
}

for (const compound of [
  'عبد الرحمن',
  'عبد الله',
  'عبد العزيز',
  'عبد المجيد',
  'عبد الكريم',
  'عبد القادر',
  'عبد السلام',
  'عبد الحليم',
  'عبد الوهاب',
  'عبد الرزاق',
  'عبد الباسط',
  'عبد المحسن',
  'نور الدين',
  'صلاح الدين',
  'سيف الدين',
  'علاء الدين',
]) {
  test(`Compound spaces in both directions: ${compound}`, () => {
    const joined = compound.replaceAll(' ', '');
    assert.deepEqual(search([compound], joined), ['0']);
    assert.deepEqual(search([joined], compound), ['0']);
  });
}

test('combined rules, long names, and repeated whitespace', () => {
  const stored = 'أحمد عبد الرحمن السيد حويت';
  for (const query of [
    'احمد عبدالرحمن السيد حويت',
    'أحمد عبدالرحمن',
    'احمد عبد الرحمن',
    'احمد عبدالرحمن السيد',
    stored,
    '  أَحْمد\tعبد   الرحمن\nالسيد  حويت  ',
  ]) {
    assert.deepEqual(search([stored], query), ['0']);
  }
  for (const [left, right] of [
    ['عبدالله', 'عبد اللة'],
    ['عبدالهادي', 'عبد الهادى'],
    ['مصطفى عبدالعزيز', 'مصطفي عبد العزيز'],
    ['إبراهيم عبد الله', 'ابراهيم عبدالله'],
  ]) {
    assert.deepEqual(search([left], right), ['0']);
    assert.deepEqual(search([right], left), ['0']);
  }
});

test('no fuzzy spelling or arbitrary cross-word matches', () => {
  assert.deepEqual(search(['عبد الرحمن', 'عبدالرحمن'], 'عبدالرحمان'), []);
  assert.deepEqual(search(['عبد الرحمان', 'عبدالرحمان'], 'عبدالرحمن'), []);
  assert.deepEqual(search(['أحمد علي'], 'احمدعلي'), []);
  assert.deepEqual(search(['محمد'], 'محمو'), []);
  assert.equal(
    normalizeCompoundNames(normalizeArabic('عبد الرحمن أحمد علي')),
    'عبدالرحمن احمد علي'
  );
});

test('partial typing, first/parent names, and nonadjacent ancestor words', () => {
  const names = ['أحمد عبد الرحمن السيد حويت'];
  for (const query of [
    'أح',
    'احمد',
    'عبد الر',
    'عبدالر',
    'رحمن',
    'السيد',
    'احمد حويت',
    'السيد احمد',
    'حويت عبدالرحمن',
  ]) {
    assert.deepEqual(search(names, query), ['0'], query);
  }
});

test('ranks original exact, normalized exact, prefix, substring, then extra matches; ties stay stable', () => {
  assert.deepEqual(
    search(
      [
        'السيد أحمد',
        'محمد أحمد عبد الرحمن',
        'احمد عبدالرحمن السيد',
        'احمد عبدالرحمن',
        'أحمد عبد الرحمن',
        'أحمد حويت عبد الرحمن',
        'احمد عبدالرحمن موسى',
      ],
      'أحمد عبد الرحمن'
    ),
    ['4', '3', '2', '6', '1', '5', '0']
  );
});

test('preserves legacy useful matches and extra whole-word matches', () => {
  const persons = [
    'محمد أحمد علي',
    'أحمد عبد الرحمن',
    'موسى أحمد السيد',
    'علي',
    'أحمد',
    'عبدالرحمن',
  ].map((name, i) => person(String(i), name));
  function legacy(query) {
    const q = query.trim();
    if (!q) return [];
    const index = new Map();
    for (const p of persons) {
      for (const key of [...p.name.split(' ').filter(Boolean), p.name]) {
        index.set(key, [...new Set([...(index.get(key) || []), p.id])]);
      }
    }
    if (index.has(q)) return index.get(q);
    return [
      ...new Set(
        [...index].filter(([key]) => key.includes(q) || q.includes(key)).flatMap(([, ids]) => ids)
      ),
    ];
  }
  const index = buildNameIndex(persons);
  for (const query of [
    'أحمد',
    'حمد',
    'أحمد علي',
    'موسى أحمد السيد',
    'عبدالرحمن',
    'أحمد السيد',
    'علي محمد',
    '',
  ]) {
    const matches = searchPersons(query, persons, index);
    for (const id of legacy(query)) assert.ok(matches.includes(id), `${query}: missing ${id}`);
  }
});

test('no duplicate ids, no mutation, and normalized-empty queries return nothing', () => {
  const persons = [
    Object.freeze(person('a', 'أحمد أحمد')),
    Object.freeze(person('a', 'أحمد أحمد')),
    Object.freeze(person('b', 'أحمد أحمد')),
  ];
  const before = JSON.stringify(persons);
  const index = buildNameIndex(persons);
  assert.deepEqual(searchPersons('احمد', persons, index), ['a', 'b']);
  for (const query of ['', '  \t\n', 'ـَُّ'])
    assert.deepEqual(searchPersons(query, persons, index), []);
  assert.equal(JSON.stringify(persons), before);
});

test('index updates add/edit/delete and reuses unchanged names and position-only updates', () => {
  const persons = [person('a', 'أحمد'), person('b', 'مصطفى')];
  const first = buildNameIndex(persons);
  assert.strictEqual(
    buildNameIndex(
      persons.map((p) => ({ ...p, manualX: 15 })),
      first
    ),
    first
  );
  const next = buildNameIndex(
    [person('a', 'إبراهيم'), persons[1], person('c', 'نور الدين')],
    first
  );
  assert.strictEqual(next.get('b'), first.get('b'));
  assert.notStrictEqual(next.get('a'), first.get('a'));
  assert.deepEqual(searchPersons('احمد', [], next), []);
  assert.deepEqual(searchPersons('ابراهيم', [], next), ['a']);
  assert.deepEqual(searchPersons('نورالدين', [], next), ['c']);
  const deleted = buildNameIndex([persons[1]], next);
  assert.deepEqual(searchPersons('ابراهيم', [], deleted), []);
  assert.deepEqual(searchPersons('مصطفي', [], deleted), ['b']);
  assert.deepEqual(searchPersons('احمد', [], first), ['a']);
});

test('familyData public API uses the improved search', () => {
  const api = loadTs(path.join(__dirname, '../src/lib/familyData.ts'));
  const persons = [person('a', 'مصطفى عبد العزيز')];
  assert.deepEqual(api.searchPersons('مصطفي عبدالعزيز', persons, api.buildNameIndex(persons)), [
    'a',
  ]);
});

test('20,000-person index supports repeated keystroke searches without rebuilding', (t) => {
  const persons = Array.from({ length: 20000 }, (_, i) =>
    person(String(i), `${i % 2 ? 'أحمد عبد الرحمن' : 'مصطفى نور الدين'} السيد حويت ${i}`)
  );
  const start = performance.now();
  const index = buildNameIndex(persons);
  const indexed = performance.now();
  const entry = index.get('0');
  const queries = ['احمد', 'احمد عبد', 'احمد عبدالرحمن', 'مصطفي نورالدين', 'حويت السيد'];
  for (let i = 0; i < 50; i++) {
    const result = searchPersons(queries[i % queries.length], persons, index);
    assert.ok(result.length >= 10000);
    assert.equal(new Set(result).size, result.length);
  }
  const elapsed = performance.now() - indexed;
  assert.strictEqual(index.get('0'), entry);
  t.diagnostic(
    `Index: ${(indexed - start).toFixed(1)}ms; 50 searches: ${elapsed.toFixed(1)}ms; average: ${(elapsed / 50).toFixed(1)}ms`
  );
  assert.ok(elapsed < 5000, '50 searches over 20,000 names should finish within 5 seconds');
});

test('compound spelling differences stay distinct in every spacing direction', () => {
  for (const stored of ['عبد الرحمن', 'عبدالرحمن']) {
    for (const query of ['عبد الرحمان', 'عبدالرحمان']) {
      assert.deepEqual(search([stored], query), []);
      assert.deepEqual(search([query], stored), []);
    }
  }
});

test('substring results beginning at a word boundary precede inner-word matches', () => {
  assert.deepEqual(search(['حسن عليان', 'حسن معلي', 'حسن علي'], 'علي'), ['0', '2', '1']);
});
