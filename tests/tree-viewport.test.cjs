const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTypeScript(relativePath, mocks = {}) {
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(name => mocks[name] ?? require(name), module, module.exports);
  return module.exports;
}

const family = loadTypeScript('../src/lib/familyData.ts');
const viewport = loadTypeScript('../src/lib/treeViewport.ts', { './familyData': family });
const settings = { ...family.DEFAULT_SETTINGS };

function person(id, manualX, manualY, extras = {}) {
  return { id, name: 'حويت', gender: 'ذكر', fatherId: '', branch: '', manualX, manualY, ...extras };
}

function assertWholeTreeFits(persons, appearance, size) {
  const map = new Map(persons.map(person => [person.id, person]));
  const bounds = viewport.getTreeBounds(persons, appearance, map);
  const fit = viewport.getFitView(bounds, size);
  const minimum = viewport.getMinimumZoom(bounds, size);
  assert.ok(minimum <= fit.scale && minimum > 0);
  assert.equal(viewport.clampTreeZoom(fit.scale, minimum), fit.scale, 'full-tree fit must survive the zoom clamp');
  for (const p of persons) {
    const card = viewport.getNodeBounds(p, viewport.getNodeDimensions(p, appearance, map));
    assert.ok(card.left * fit.scale + fit.x >= 0);
    assert.ok(card.right * fit.scale + fit.x <= size.w);
    assert.ok(card.top * fit.scale + fit.y >= 0);
    assert.ok(card.bottom * fit.scale + fit.y <= size.h);
    assert.ok(viewport.intersectsViewport(card, fit, size));
  }
  return fit;
}

test('fit includes dimensions and generation styling rather than only node centers', () => {
  const persons = [
    person('root', -200, -100, { cardWidth: 800, cardHeight: 240, nodeScale: 2 }),
    person('child', 300, 50, { fatherId: 'root', cardWidth: 600, cardHeight: 400, cardFontSize: 12 }),
  ];
  const appearance = { ...settings, generationOverrides: { '2': { color: '#123456', scale: 4, fontSize: 24 } } };
  const map = new Map(persons.map(p => [p.id, p]));
  assert.deepEqual(viewport.getNodeDimensions(persons[1], appearance, map), { w: 2400, h: 1600, fs: 96, scale: 4 });
  const bounds = viewport.getTreeBounds(persons, appearance, map);
  assert.equal(bounds.left, -1000);
  assert.equal(bounds.right, 1500);
  assert.equal(bounds.top, -750);
  assert.equal(bounds.bottom, 850);
  for (const size of [{ w: 1440, h: 900 }, { w: 390, h: 600 }]) assertWholeTreeFits(persons, appearance, size);
});

test('large trees on phones and desktops can fit well below the previous 20% floor', () => {
  const persons = Array.from({ length: 5000 }, (_, index) => person(`p-${index}`, index * 250 - 620000, (index % 70) * 300 - 12000, { cardWidth: 240, cardHeight: 80 }));
  for (const size of [{ w: 1920, h: 900 }, { w: 390, h: 600 }, { w: 844, h: 280 }]) {
    const fit = assertWholeTreeFits(persons, settings, size);
    assert.ok(fit.scale < 0.01);
  }
});

test('one oversized card, coincident positions and long labels all remain inside the fit', () => {
  const persons = [
    person('small', 100, 100, { name: 'اسم طويل جدًا لا يتسع داخل البطاقة الصغيرة', cardWidth: 1, cardHeight: 1, cardFontSize: 36 }),
    person('huge', 100, 100, { cardWidth: 14000, cardHeight: 8000 }),
  ];
  assertWholeTreeFits(persons, settings, { w: 360, h: 520 });
});

test('zooming with buttons preserves the tree point at the canvas center', () => {
  const previous = { x: -450, y: 380, scale: 0.08 };
  const center = { x: 195, y: 280 };
  const next = viewport.zoomAtPoint(previous, 0.01, center, 0.002);
  assert.equal(next.scale, 0.01);
  assert.ok(Math.abs((center.x - next.x) / next.scale - (center.x - previous.x) / previous.scale) < 1e-8);
  assert.ok(Math.abs((center.y - next.y) / next.scale - (center.y - previous.y) / previous.scale) < 1e-8);
});

test('empty and nonfinite node coordinates do not make fitting produce invalid values', () => {
  assert.equal(viewport.getTreeBounds([], settings, new Map()), null);
  const invalid = [person('bad', NaN, Infinity)];
  assert.equal(viewport.getTreeBounds(invalid, settings, new Map(invalid.map(p => [p.id, p]))), null);
  assert.deepEqual(viewport.getFitView(null, { w: 390, h: 600 }), { x: 195, y: 300, scale: 0.5 });
  assert.equal(viewport.clampTreeZoom(NaN, 0.002), 1);
  assert.equal(viewport.clampTreeZoom(0.001, 0.002), 0.002);
  assert.equal(viewport.clampTreeZoom(30, 0.002), 3);
});
