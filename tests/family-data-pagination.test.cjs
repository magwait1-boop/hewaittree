const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadService(createClient) {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/famNodeService.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'console', outputText)(name => {
    if (name === '@/lib/supabase/client') return { createClient };
    throw new Error(`Unexpected dependency: ${name}`);
  }, module, module.exports, { log() {}, error() {} });
  return module.exports;
}

function rowsFor(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `person-${String(index).padStart(5, '0')}`,
    name: `شخص ${index}`,
    gender: 'ذكر',
    father_id: '',
    manual_x: index * 10,
    manual_y: 100,
  }));
}

function fixture(rows, { errorOnPage, throwOnPage } = {}) {
  const ranges = [];
  const client = {
    from(table) {
      assert.equal(table, 'fam_nodes');
      const orders = [];
      const query = {
        select(columns) {
          assert.equal(columns, '*');
          return query;
        },
        order(column, options) {
          orders.push({ column, ascending: options.ascending });
          return query;
        },
        async range(start, end) {
          ranges.push([start, end]);
          const page = ranges.length;
          if (page === throwOnPage) throw new Error('Connection interrupted');
          if (page === errorOnPage) return { data: null, error: { message: 'Database unavailable' } };

          // SQL may return equal sort keys in a different order on every query.
          // Reverse the tie order between requests; a unique secondary key must
          // override this to keep offset pagination from repeating/skipping IDs.
          const orderedRows = page % 2 === 0 ? [...rows].reverse() : [...rows];
          orderedRows.sort((left, right) => {
            for (const { column, ascending } of orders) {
              if (left[column] === right[column]) continue;
              const comparison = left[column] < right[column] ? -1 : 1;
              return ascending ? comparison : -comparison;
            }
            return 0;
          });
          return { data: orderedRows.slice(start, end + 1), error: null };
        },
      };
      return query;
    },
  };
  return { service: loadService(() => client), ranges };
}

function assertComplete(persons, rows) {
  assert.ok(Array.isArray(persons));
  assert.equal(persons.length, rows.length);
  assert.equal(new Set(persons.map(person => person.id)).size, rows.length);
  assert.deepEqual(persons.map(person => person.id).sort(), rows.map(row => row.id).sort());
  for (const person of persons) {
    const index = Number(person.id.slice('person-'.length));
    assert.equal(person.name, rows[index].name);
    assert.equal(person.manualX, rows[index].manual_x);
    assert.equal(person.manualY, rows[index].manual_y);
  }
}

test('loads all 2,767 cards exactly once when every row has the same manual Y position', async () => {
  const rows = rowsFor(2767);
  const { service, ranges } = fixture(rows);
  assertComplete(await service.fetchAllPersons(), rows);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]]);
});

for (const count of [1000, 5001, 10000]) {
  test(`loads all ${count.toLocaleString('en-US')} cards as the tree grows and stops at the end`, async () => {
    const rows = rowsFor(count);
    const { service, ranges } = fixture(rows);
    assertComplete(await service.fetchAllPersons(), rows);
    // A full last page needs one empty query; a partial last page needs none.
    const expectedPages = Math.floor(count / 1000) + 1;
    assert.deepEqual(ranges, Array.from({ length: expectedPages }, (_, index) => [index * 1000, index * 1000 + 999]));
  });
}

test('an empty tree returns an empty list after one request', async () => {
  const { service, ranges } = fixture([]);
  assert.deepEqual(await service.fetchAllPersons(), []);
  assert.deepEqual(ranges, [[0, 999]]);
});

test('a later-page database error returns null instead of a silently incomplete tree', async () => {
  const { service, ranges } = fixture(rowsFor(2767), { errorOnPage: 3 });
  assert.equal(await service.fetchAllPersons(), null);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test('a later-page connection failure returns null instead of the first 1,000 cards', async () => {
  const { service, ranges } = fixture(rowsFor(2767), { throwOnPage: 2 });
  assert.equal(await service.fetchAllPersons(), null);
  assert.deepEqual(ranges, [[0, 999], [1000, 1999]]);
});
