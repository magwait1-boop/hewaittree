const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const React = require('react');
const ts = require('typescript');

const file = path.join(__dirname, '../src/app/components/TreeCanvas.tsx');
const { outputText } = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  },
});

function createCanvas(overrides = {}) {
  const updates = [];
  const calls = { click: [], doubleClick: [], drag: [], background: 0 };
  const hooks = {
    ...React,
    useRef: current => ({ current }),
    useState: initial => [initial, () => {}],
    useCallback: callback => callback,
    useEffect: () => {},
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(name => {
    if (name === 'react') return hooks;
    if (name === '@/lib/familyData') return { getGeneration: () => 1 };
    return require(name);
  }, module, module.exports);
  const canvas = module.exports.default({
    persons: [],
    view: { x: 0, y: 0, scale: 1 },
    setView: update => updates.push(update),
    settings: { baseFontSize: 14, generationOverrides: {}, maleShape: 'pill', femaleShape: 'ellipse' },
    searchMatches: [],
    selectedIds: new Set(),
    sidebarNodeId: null,
    onNodeClick: id => calls.click.push(id),
    onNodeDblClick: id => calls.doubleClick.push(id),
    onNodeDrag: (...args) => calls.drag.push(args),
    onBgClick: () => calls.background++,
    canDrag: false,
    personMap: new Map(),
    childrenMap: new Map(),
    ...overrides,
  });
  const target = {
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    setPointerCapture: () => {},
  };
  canvas.props.ref.current = target;
  const event = (pointerId, clientX, clientY = 120, currentTarget = target) => ({
    pointerId, clientX, clientY, currentTarget, pointerType: 'touch', stopPropagation() {},
  });
  return {
    handlers: canvas.props,
    canvas,
    target,
    event,
    updates,
    calls,
    flush(view = { x: 0, y: 0, scale: 1 }) {
      for (const update of updates.splice(0)) view = typeof update === 'function' ? update(view) : update;
      return view;
    },
  };
}

test('queued pinch update remains safe after both fingers lift', () => {
  const { handlers, event, flush } = createCanvas();
  handlers.onPointerDown(event(1, 100));
  handlers.onPointerDown(event(2, 200));
  handlers.onPointerMove(event(2, 220));
  handlers.onPointerUp(event(2, 220));
  handlers.onPointerUp(event(1, 100));
  const view = flush();
  assert.equal(view.scale, 1.2);
  assert.equal(view.x, -18);
  assert.equal(view.y, -20);
});

test('successive queued moves retain their own midpoint snapshots', () => {
  const { handlers, event, flush } = createCanvas();
  handlers.onPointerDown(event(1, 100));
  handlers.onPointerDown(event(2, 200));
  handlers.onPointerMove(event(2, 220));
  handlers.onPointerMove(event(2, 240));
  handlers.onPointerUp(event(2, 240));
  const view = flush();
  assert.ok(Math.abs(view.scale - 1.4) < 1e-10);
  assert.ok(Math.abs(view.x + 36) < 1e-10);
  assert.ok(Math.abs(view.y + 40) < 1e-10);
});

test('missing, non-finite, and untracked pointer positions are ignored', () => {
  const { handlers, event, updates, flush } = createCanvas();
  for (const invalid of [undefined, NaN, Infinity, '100']) {
    handlers.onPointerDown(event(1, invalid));
    handlers.onPointerDown(event(1, 100, invalid));
  }
  handlers.onPointerMove(event(99, 220));
  assert.equal(updates.length, 0);
  handlers.onPointerDown(event(1, 100));
  handlers.onPointerDown(event(2, 200));
  handlers.onPointerMove(event(2, NaN));
  handlers.onPointerMove(event(2, 220, Infinity));
  assert.equal(updates.length, 0);
  handlers.onPointerMove(event(2, 220));
  assert.equal(flush().scale, 1.2);
});

test('coincident fingers and distances below 15px do not zoom', () => {
  const { handlers, event, updates, flush } = createCanvas();
  handlers.onPointerDown(event(1, 100));
  handlers.onPointerDown(event(2, 100));
  handlers.onPointerMove(event(2, 100));
  handlers.onPointerMove(event(2, 110));
  handlers.onPointerMove(event(2, 120));
  assert.equal(updates.length, 0);
  handlers.onPointerMove(event(2, 125));
  assert.equal(flush().scale, 1.25);
  handlers.onPointerMove(event(2, 110));
  handlers.onPointerMove(event(2, 120));
  assert.equal(updates.length, 0);
});

test('extreme scale jumps are rejected and the next valid movement rebases', () => {
  for (const distance of [50, 200, 300]) {
    const { handlers, event, updates, flush } = createCanvas();
    handlers.onPointerDown(event(1, 100));
    handlers.onPointerDown(event(2, 200));
    handlers.onPointerMove(event(2, 100 + distance));
    assert.equal(updates.length, 0);
    handlers.onPointerMove(event(2, 100 + distance * 1.2));
    assert.equal(flush().scale, 1.2);
  }
});

test('zoom stays within 0.2 to 3 and invalid previous view values recover', () => {
  for (const [previous, distance, expected] of [
    [{ x: 0, y: 0, scale: 2.9 }, 150, 3],
    [{ x: 0, y: 0, scale: 0.21 }, 60, 0.2],
    [{ x: NaN, y: Infinity, scale: NaN }, 120, 1.2],
  ]) {
    const { handlers, event, flush } = createCanvas();
    handlers.onPointerDown(event(1, 100));
    handlers.onPointerDown(event(2, 200));
    handlers.onPointerMove(event(2, 100 + distance));
    const view = flush(previous);
    assert.equal(view.scale, expected);
    assert.ok(Number.isFinite(view.x) && Number.isFinite(view.y));
  }
});

test('cancellation and lost capture clear pinch tracking without firing taps', () => {
  for (const cancel of ['onPointerCancel', 'onLostPointerCapture']) {
    const { handlers, event, calls, updates, flush } = createCanvas();
    handlers.onPointerDown(event(1, 100));
    handlers.onPointerDown(event(2, 200));
    handlers.onPointerMove(event(2, 220));
    handlers[cancel](event(2, 220));
    handlers.onPointerUp(event(1, 100));
    assert.equal(flush().scale, 1.2);
    assert.equal(calls.background, 0);
    handlers.onPointerDown(event(3, 100));
    handlers.onPointerDown(event(4, 200));
    handlers.onPointerMove(event(4, 220));
    assert.equal(updates.length, 1);
    assert.equal(flush().scale, 1.2);
  }
});

test('unsupported or expired pointer capture does not throw', () => {
  for (const capture of [undefined, () => { throw new Error('Pointer no longer active'); }]) {
    const { handlers, event, target, flush } = createCanvas();
    target.setPointerCapture = capture;
    handlers.onPointerDown(event(1, 100));
    handlers.onPointerDown(event(2, 200));
    handlers.onPointerMove(event(2, 220));
    assert.equal(flush().scale, 1.2);
  }
});

function findNode(element) {
  if (!React.isValidElement(element)) return null;
  if (element.props['data-node-id']) return element;
  for (const child of React.Children.toArray(element.props.children)) {
    const found = findNode(child);
    if (found) return found;
  }
  return null;
}

test('pinch starting on nodes cancels dragging and never triggers double tap', () => {
  const person = { id: 'node', name: 'Test', gender: '', fatherId: '', manualX: 100, manualY: 100 };
  const { canvas, handlers, event, calls, flush } = createCanvas({
    persons: [person], personMap: new Map([[person.id, person]]), canDrag: true,
  });
  const node = findNode(canvas);
  const target = { getAttribute: () => person.id };
  node.props.onPointerDown(event(1, 100, 120, target));
  node.props.onPointerDown(event(2, 200, 120, target));
  handlers.onPointerMove(event(2, 220));
  handlers.onPointerUp(event(2, 220));
  handlers.onPointerUp(event(1, 100));
  assert.equal(flush().scale, 1.2);
  assert.deepEqual(calls.doubleClick, []);
  assert.deepEqual(calls.drag, []);
  assert.deepEqual(calls.click, []);
});

test('single-finger background pan and taps still work', () => {
  const { handlers, event, calls, flush } = createCanvas();
  handlers.onPointerDown(event(1, 100));
  handlers.onPointerMove(event(1, 120, 130));
  handlers.onPointerUp(event(1, 120, 130));
  assert.deepEqual(flush(), { x: 20, y: 10, scale: 1 });
  assert.equal(calls.background, 0);
  handlers.onPointerDown(event(2, 100));
  handlers.onPointerUp(event(2, 100));
  assert.equal(calls.background, 1);
});
