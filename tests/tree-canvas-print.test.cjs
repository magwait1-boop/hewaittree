const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const ts = require('typescript');

function loadTypeScript(relativePath, mocks = {}) {
  const file = path.join(__dirname, relativePath);
  const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(name => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    return require(name);
  }, module, module.exports);
  return module.exports;
}

const printHelpers = loadTypeScript('../src/lib/treePrint.ts');
const TreeCanvas = loadTypeScript('../src/app/components/TreeCanvas.tsx', {
  react: {
    ...React,
    useRef: current => ({ current }),
    useState: initial => [initial, () => {}],
    useCallback: callback => callback,
    useEffect: () => {},
    useLayoutEffect: () => {},
  },
  '@/lib/familyData': { getGeneration: () => 1 },
  '@/lib/treePrint': printHelpers,
}).default;

const persons = [
  { id: 'root', name: 'Root', gender: 'ذكر', fatherId: '', manualX: 100, manualY: 100, cardBorderWidth: 5 },
  { id: 'child', name: 'Child', gender: 'أنثى', fatherId: 'root', manualX: 220, manualY: 300, cardBorderWidth: 2.5, edgeWidth: 3.75 },
  { id: 'offscreen', name: 'Far away', gender: 'ذكر', fatherId: 'child', manualX: 12000, manualY: -5000, edgeColor: '#123456', edgeWidth: 4 },
];

function createCanvas(overrides = {}) {
  return TreeCanvas({
    persons,
    view: { x: 0, y: 0, scale: 1 },
    setView: () => {},
    settings: {
      baseFontSize: 14,
      generationOverrides: {},
      maleShape: 'pill',
      femaleShape: 'ellipse',
      lineStyle: 'step',
    },
    searchMatches: [],
    selectedIds: new Set(),
    sidebarNodeId: null,
    onNodeClick: () => {},
    onNodeDblClick: () => {},
    onNodeDrag: () => {},
    canDrag: false,
    personMap: new Map(persons.map(person => [person.id, person])),
    childrenMap: new Map([['root', ['child']], ['child', ['offscreen']]]),
    ...overrides,
  });
}

function visit(element, predicate, ancestors = [], matches = []) {
  if (!React.isValidElement(element)) return matches;
  if (predicate(element)) matches.push({ element, ancestors });
  for (const child of React.Children.toArray(element.props.children)) {
    visit(child, predicate, [...ancestors, element], matches);
  }
  return matches;
}

function nodeElements(canvas) {
  return visit(canvas, element => element.props['data-node-id']).map(({ element }) => element);
}

function printSnapshot(canvas) {
  return {
    nodes: nodeElements(canvas).map(node => ({
      id: node.props['data-node-id'],
      filter: node.props.filter,
      children: React.Children.toArray(node.props.children).map(child => ({
        type: child.type,
        props: Object.fromEntries(Object.entries(child.props).filter(([key]) => key !== 'ref')),
      })),
    })),
    edges: visit(canvas, element => element.type === 'path' && element.props.stroke !== 'transparent')
      .map(({ element }) => ({ ...element.props })),
  };
}

function cardShape(node) {
  return React.Children.toArray(node.props.children).find(child => child.type === 'rect' || child.type === 'ellipse');
}

test('printing includes cards outside the current viewport and every connecting edge', () => {
  assert.deepEqual(nodeElements(createCanvas()).map(node => node.props['data-node-id']), ['root', 'child']);
  const printed = createCanvas({ isPrinting: true });
  assert.deepEqual(nodeElements(printed).map(node => node.props['data-node-id']), persons.map(person => person.id));
  const edges = visit(printed, element => element.type === 'path' && element.props.stroke !== 'transparent');
  assert.equal(edges.length, 2);
});

test('print geometry and stroke widths are independent of screen zoom and pan', () => {
  const baseline = printSnapshot(createCanvas({ isPrinting: true }));
  for (const view of [
    { x: 987, y: -432, scale: 0.2 },
    { x: -15000, y: 8000, scale: 3 },
  ]) {
    const printed = createCanvas({ isPrinting: true, view });
    assert.deepEqual(printSnapshot(printed), baseline);
    for (const { ancestors } of visit(printed, element => element.props['data-node-id'])) {
      assert.ok(ancestors.every(element => !element.props.transform), 'screen transforms must not alter printed cards');
    }
  }
  const nodes = nodeElements(createCanvas({ isPrinting: true, view: { x: 900, y: 900, scale: 0.2 } }));
  assert.equal(cardShape(nodes[0]).props.strokeWidth, 5);
  assert.equal(cardShape(nodes[1]).props.strokeWidth, 2.5);
  assert.deepEqual(baseline.edges.map(edge => edge.strokeWidth), [3.75, 4]);
});

test('printing removes transient search and selection styling and applied filters', () => {
  const baseline = printSnapshot(createCanvas({ isPrinting: true }));
  const selected = createCanvas({
    isPrinting: true,
    searchMatches: ['root', 'child'],
    selectedIds: new Set(persons.map(person => person.id)),
    sidebarNodeId: 'offscreen',
  });
  assert.deepEqual(printSnapshot(selected), baseline);
  assert.ok(visit(selected, element => element.props.filter && element.props.filter !== 'none').length === 0);
});

test('white-paper printing uses a dark default edge while preserving a configured color', () => {
  const printed = createCanvas({ isPrinting: true });
  const edges = printSnapshot(printed).edges;
  const fallback = edges[0].stroke;
  assert.notEqual(fallback, 'rgba(255,255,255,0.25)');
  if (/^#[\da-f]{6}$/i.test(fallback)) {
    const channels = fallback.slice(1).match(/../g).map(value => parseInt(value, 16));
    assert.ok(channels.every(channel => channel < 200), `default edge should remain visible on white: ${fallback}`);
  } else {
    assert.ok(['black', '#000'].includes(fallback), `expected a dark printable edge, received ${fallback}`);
  }
  assert.equal(edges[1].stroke, '#123456');
});

function svgShape(tagName, bbox, attributes = {}) {
  const values = { fill: '#add7a0', stroke: 'none', 'stroke-width': '0', ...attributes };
  return {
    tagName,
    nodeName: tagName,
    style: {},
    getBBox: () => ({ ...bbox }),
    getAttribute: name => values[name] ?? null,
    getComputedStyle: () => ({
      fill: values.fill,
      stroke: values.stroke,
      strokeWidth: values['stroke-width'],
      display: 'inline',
      visibility: 'visible',
      opacity: '1',
    }),
  };
}

function svgContent(shapes) {
  const ownerDocument = {
    defaultView: { getComputedStyle: shape => shape.getComputedStyle() },
  };
  for (const shape of shapes) shape.ownerDocument = ownerDocument;
  return {
    ownerDocument,
    querySelectorAll: selector => shapes.filter(shape => selector.split(',').some(tag => tag.trim() === shape.tagName)),
  };
}

function attachViewBox(content, viewBox) {
  const attributes = new Map(viewBox === null ? [] : [['viewBox', viewBox]]);
  const svg = {
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
  };
  content.ownerSVGElement = svg;
  return svg;
}

test('artwork is measured without preview scaling and the exact original viewBox is restored', () => {
  for (const original of [' -20.125   3.5  400.75 800.25 ', null]) {
    const shape = svgShape('text', {});
    const content = svgContent([shape]);
    const svg = attachViewBox(content, original);
    shape.getBBox = () => {
      assert.equal(svg.getAttribute('viewBox'), null, 'preview viewBox must be absent during getBBox');
      return { x: -20, y: 4, width: 100, height: 50 };
    };
    assert.deepEqual(printHelpers.measurePrintBounds(content), { x: -21, y: 3, width: 102, height: 52 });
    assert.equal(svg.getAttribute('viewBox'), original);
  }
});

test('the original viewBox is restored even when browser artwork measurement throws', () => {
  for (const original of ['-100.5 -50.25 1000 500', null]) {
    const shape = svgShape('text', {});
    const content = svgContent([shape]);
    const svg = attachViewBox(content, original);
    const measurementError = new Error('SVG measurement unavailable');
    shape.getBBox = () => {
      assert.equal(svg.getAttribute('viewBox'), null);
      throw measurementError;
    };
    assert.throws(() => printHelpers.measurePrintBounds(content), error => error === measurementError);
    assert.equal(svg.getAttribute('viewBox'), original);
  }
});

test('print bounds tightly include card outlines, curved connections, text overflow and negative coordinates', () => {
  const content = svgContent([
    svgShape('rect', { x: -100, y: -50, width: 20, height: 30 }, { stroke: '#000', 'stroke-width': '6' }),
    svgShape('ellipse', { x: 10, y: -15, width: 50, height: 20 }, { stroke: '#000', 'stroke-width': '4' }),
    svgShape('path', { x: -80, y: 10, width: 30, height: 40 }, { fill: 'none', stroke: '#475569', 'stroke-width': '8' }),
    svgShape('text', { x: -130, y: -60, width: 70, height: 14 }),
  ]);
  assert.deepEqual(printHelpers.measurePrintBounds(content), { x: -131, y: -61, width: 193, height: 115 });
});

test('fractional glyph and border bounds round outward so edge details cannot clip', () => {
  const content = svgContent([
    svgShape('rect', { x: -10.125, y: -3.25, width: 20.5, height: 8.5 }, { stroke: '#000', 'stroke-width': '1.5' }),
    svgShape('text', { x: -10.063, y: -5.937, width: 20.126, height: 12 }),
  ]);
  const bounds = printHelpers.measurePrintBounds(content);
  assert.deepEqual(bounds, { x: -12, y: -7, width: 24, height: 15 });
  const actualEdges = [
    { value: -10.063, isText: true },
    { value: -5.937, isText: true },
    { value: 11.125, isText: false },
    { value: 6.063, isText: true },
  ];
  const pageEdges = [bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height];
  for (let index = 0; index < actualEdges.length; index++) {
    const { value, isText } = actualEdges[index];
    const margin = index < 2 ? value - pageEdges[index] : pageEdges[index] - value;
    const protectivePadding = isText ? 1 : 0;
    assert.ok(margin >= protectivePadding && margin < protectivePadding + 1, 'only text edges should receive a protective pixel before outward rounding');
  }
});

test('integer card outlines keep exact page limits when all text fits inside them', () => {
  const content = svgContent([
    svgShape('rect', { x: -10, y: -20, width: 40, height: 50 }, { stroke: '#000', 'stroke-width': '2' }),
    svgShape('text', { x: -8, y: -18, width: 20, height: 10 }),
  ]);
  assert.deepEqual(printHelpers.measurePrintBounds(content), { x: -11, y: -21, width: 42, height: 52 });
});

test('invisible pointer targets do not add empty space to print bounds', () => {
  const content = svgContent([
    svgShape('rect', { x: -10, y: -20, width: 40, height: 50 }, { stroke: '#000', 'stroke-width': '2' }),
    svgShape('path', { x: -5000, y: -5000, width: 10000, height: 10000 }, { fill: 'none', stroke: 'transparent', 'stroke-width': '14' }),
  ]);
  assert.deepEqual(printHelpers.measurePrintBounds(content), { x: -11, y: -21, width: 42, height: 52 });
});

function almostEqual(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);
}

test('print page uses natural SVG size and preserves aspect ratio instead of forcing an A0 sheet', () => {
  const page = printHelpers.getPrintPageSize({ x: -100, y: -50, width: 960, height: 480 });
  almostEqual(page.widthMm, 254);
  almostEqual(page.heightMm, 127);
  almostEqual(page.widthMm / page.heightMm, 2);
});

test('oversized print pages scale both dimensions together to the PDF limit', () => {
  for (const bounds of [
    { x: 0, y: 0, width: 38400, height: 9600 },
    { x: -500, y: -200, width: 9600, height: 38400 },
  ]) {
    const page = printHelpers.getPrintPageSize(bounds);
    assert.equal(Math.max(page.widthMm, page.heightMm), 5080);
    almostEqual(page.widthMm / page.heightMm, bounds.width / bounds.height);
  }
});
