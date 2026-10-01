import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const bundled = await build({
  stdin: { contents: `export * from './utils/toolSettings'; export * from './utils/appearance'; export * from './utils/callout'; export { resizeCanvasDocument } from './utils/canvasResize'; export { createDocumentSnapshot } from './utils/history'; export { getElementBounds, getResizeHandleType, isPointInElement, renderCanvas } from './utils/draw'; export { DEFAULT_TOOL_SETTINGS, DEFAULT_TOOL_SIZES } from './constants';`, resolveDir: root, loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const { DEFAULT_TOOL_SETTINGS, DEFAULT_TOOL_SIZES, getCreationSettings, getToolSize, getElementSize, getSettingsForElement, rememberToolSettings, restoreToolSettings, applyElementStyle, applyToolSettingsToElement, normalizeToolSize, getMinimumToolSize, getElementBounds, renderCanvas, createMaterialTheme, contrastRatio, THEME_COLORS, normalizeThemeColor } = api;
let checks = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const ok = (condition, message) => { assert.ok(condition, message); checks++; };

// Every independently configurable tool: change, switch, select, reload, then create again.
for (const tool of Object.keys(DEFAULT_TOOL_SIZES)) {
  let settings = structuredClone(DEFAULT_TOOL_SETTINGS);
  for (const size of [48, 96, 16]) {
    const next = getCreationSettings(tool, settings);
    settings = rememberToolSettings(tool, { ...next, ...(tool === 'text' || tool === 'callout' ? { fontSize: size } : { strokeWidth: size }) });
    equal(getToolSize(tool, settings), size, `${tool}: remembered size`);
    const creation = getCreationSettings(tool, settings);
    equal(tool === 'text' || tool === 'callout' ? creation.fontSize : creation.strokeWidth, size, `${tool}: creation size`);
    for (const other of Object.keys(DEFAULT_TOOL_SIZES).filter(other => other !== tool)) {
      equal(getToolSize(other, getCreationSettings(other, settings)), DEFAULT_TOOL_SIZES[other], `${tool} must not change ${other}`);
    }
    const element = { id: 'auto-selected', type: tool, color: '#ef4444', strokeWidth: size, fontSize: size, stampSize: size, highlighterWidth: size, symbol: '😀' };
    const selectedSettings = getSettingsForElement(element, settings);
    const edited = applyToolSettingsToElement(element, { ...selectedSettings, fontSize: 72, strokeWidth: 72 });
    equal(getElementSize(edited), 72, `${tool}: selected object editing`);
    equal(getToolSize(tool, settings), size, `${tool}: selection does not overwrite next-object defaults`);
    settings = restoreToolSettings(JSON.parse(JSON.stringify(settings)));
    equal(getToolSize(tool, settings), size, `${tool}: reload remembers size`);
  }
  equal(normalizeToolSize(tool, -5), getMinimumToolSize(tool), `${tool}: lower bound`);
  equal(normalizeToolSize(tool, NaN), DEFAULT_TOOL_SIZES[tool], `${tool}: invalid input`);
}

// The exact stamp/emoji regression: prior automatic selection must not hijack the next size.
for (const type of ['stamp', 'symbol']) {
  const old = { id: 'old', type, color: '#ef4444', strokeWidth: 32, stampSize: 32, symbol: '😀' };
  let settings = rememberToolSettings(type, { ...DEFAULT_TOOL_SETTINGS, strokeWidth: 96 });
  equal(getElementSize(old), 32, `${type}: changing creation defaults preserves existing objects`);
  for (let index = 0; index < 3; index++) {
    equal(getToolSize(type, settings), 96, `${type}: repeated placement ${index + 1}`);
    settings = restoreToolSettings(settings);
  }
  equal(getElementSize(applyElementStyle(old, { strokeWidth: 16 })), 16, `${type}: minimum never becomes a legacy diameter`);
  equal(getToolSize(type, settings), 96, `${type}: property panel does not change defaults`);
  const locked = { ...old, locked: true };
  equal(applyElementStyle(locked, { strokeWidth: 64 }), locked, `${type}: locked object`);
}
equal(getToolSize('stamp', restoreToolSettings({ toolSizes: { stamp: 4 } })), 28, 'Legacy stamp preset migration');
equal(getToolSize('stamp', restoreToolSettings({ toolSizes: { stamp: 16 } })), 16, 'Modern 16px stamp survives reload');
equal(getElementSize({ type: 'stamp', strokeWidth: 4 }), 28, 'Legacy stamp document');
equal(getElementSize({ type: 'highlighter', strokeWidth: 4 }), 12, 'Legacy highlighter appearance');
equal(getElementSize({ type: 'highlighter', strokeWidth: 4, highlighterWidth: 4 }), 4, 'New highlighter actual width');

function context(scale = 1) {
  const calls = [];
  const state = { canvas: { width: 800 * scale, height: 600 * scale }, globalAlpha: 1 };
  const stack = [];
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key in target) return target[key];
      if (key === 'save') return () => stack.push({ ...target });
      if (key === 'restore') return () => Object.assign(target, stack.pop());
      if (key === 'getTransform') return () => ({ a: scale, d: scale, e: 0, f: 0 });
      if (key === 'measureText') return text => ({ width: String(text).length * 10 });
      if (key === 'getImageData') return () => ({ width: 128, height: 128, data: Uint8ClampedArray.from({ length: 128 * 128 * 4 }, (_, i) => i % 256) });
      return (...args) => calls.push({ method: key, args, width: target.lineWidth, font: target.font, filter: target.filter });
    },
  });
  return { ctx, calls };
}

// Assert the real canvas renderer consumes the same size as the controls, including export scale.
globalThis.window = { devicePixelRatio: 5 }; // Must not determine an export's mosaic size.
globalThis.document = { createElement: () => ({ getContext: () => context().ctx }) };
for (const size of [16, 32, 64, 96]) {
  for (const type of ['stamp', 'symbol', 'highlighter', 'pen', 'rect', 'circle', 'triangle', 'diamond', 'line', 'arrow', 'text', 'callout']) {
    const element = { id: 'test', type, color: '#ef4444', opacity: 1, x: 150, y: 150, width: 200, height: 150, text: '測試文字', points: [{ x: 10, y: 10 }, { x: 100, y: 10 }], strokeWidth: size, stampSize: size, fontSize: size, highlighterWidth: size, symbol: '😀' };
    const { ctx, calls } = context();
    renderCanvas(ctx.canvas, ctx, null, [element], null, null, 1, 1);
    if (type === 'stamp') equal(calls.find(call => call.method === 'arc').args[2], size / 2, `${type}: rendered radius`);
    else if (type === 'symbol' || type === 'text' || type === 'callout') ok(calls.some(call => call.method === 'fillText' && call.font.includes(`${size}px`)), `${type}: rendered font`);
    else ok(calls.some(call => ['stroke', 'strokeRect'].includes(call.method) && call.width === size), `${type}: rendered line width`);
    if (type === 'stamp' || type === 'symbol') equal(getElementBounds(element).w, size, `${type}: bounds match rendering`);
  }
}
for (const scale of [1, 2, 3]) {
  const { ctx, calls } = context(scale);
  renderCanvas(ctx.canvas, ctx, null, [{ id: 'blur', type: 'pixelate', pixelateStyle: 'blur', color: '#000', strokeWidth: 12, width: 100, height: 100 }], null, null, 1, scale);
  ok(calls.some(call => call.method === 'drawImage' && call.filter === `blur(${12 * scale}px)`), `Blur export scale ${scale}`);
  const mosaic = context(scale);
  renderCanvas(mosaic.ctx.canvas, mosaic.ctx, null, [{ id: 'mosaic', type: 'pixelate', color: '#000', strokeWidth: 12, width: 100, height: 100 }], null, null, 1, scale);
  const pixels = mosaic.calls.find(call => call.method === 'putImageData').args[0].data;
  const expected = ((Math.floor(12 * scale / 2) * 128 + Math.floor(12 * scale / 2)) * 4) % 256;
  equal(pixels[0], expected, `Mosaic export block size ${scale}`);
}

// Selected swatches, custom colors and both brightness modes must retain readable foregrounds.
for (const seed of [...THEME_COLORS.map(preset => preset.color), '#ffffff', '#000000', '#ffff00', '#ff0000', '#00ff00', '#0000ff']) {
  for (const dark of [false, true]) {
    const theme = createMaterialTheme(seed, dark);
    for (const [background, foreground] of [['--md-primary', '--md-on-primary'], ['--md-primary-container', '--md-on-primary-container'], ['--md-secondary-container', '--md-on-secondary-container']]) {
      ok(contrastRatio(theme[background], theme[foreground]) >= 4.5, `${seed}/${dark}: readable ${background}`);
    }
  }
}
equal(normalizeThemeColor('#123ABC'), '#123abc', 'Custom color normalization');
equal(normalizeThemeColor('invalid'), '#6750a4', 'Custom color validation');
console.log(`Passed ${checks} assertions across ${Object.keys(DEFAULT_TOOL_SIZES).length} independently sized tools, canvas rendering/export and theme colors.`);

const { createCalloutDraft, getCalloutWorldTip, withCalloutWorldTip, getCalloutTailGeometry, getResizeHandleType, isPointInElement, resizeCanvasDocument, createDocumentSnapshot } = api;
const calloutStart = { x: 100, y: 100 };
const calloutSettings = { ...DEFAULT_TOOL_SETTINGS, fontSize: 18 };
const targets = [
  [{ x: 30, y: 129 }, 'left'], [{ x: 500, y: 129 }, 'right'],
  [{ x: 240, y: 30 }, 'top'], [{ x: 240, y: 300 }, 'bottom'],
  [{ x: 30, y: 30 }, null], [{ x: 500, y: 30 }, null],
  [{ x: 30, y: 300 }, null], [{ x: 500, y: 300 }, null],
];
for (const [tip, side] of targets) {
  const draft = createCalloutDraft(calloutStart, tip, calloutSettings, 800, 600);
  equal(getCalloutWorldTip(draft), tip, 'Callout endpoint equals release position in every direction');
  equal({ x: draft.x, y: draft.y, width: draft.width, height: draft.height }, { x: 100, y: 100, width: 280, height: 58 }, 'Drag changes arrow, not text-box dimensions');
  const tail = getCalloutTailGeometry(draft);
  equal(tail.tip, tip, 'Tail geometry never approximates the endpoint');
  if (side) equal(tail.side, side, 'Automatic attachment direction');
  const { ctx, calls } = context();
  renderCanvas(ctx.canvas, ctx, null, [draft], null, null, 1, 1);
  ok(calls.some(call => call.method === 'lineTo' && call.args[0] === tip.x && call.args[1] === tip.y), 'Canvas renderer uses exact release coordinate');
  equal(getResizeHandleType(tip.x, tip.y, draft), 'callout-tip', 'Endpoint adjustment handle');
  ok(isPointInElement(tip.x, tip.y, draft, ctx), 'Arrow can be selected outside the text box');
  const insideTail = { x: (tail.base1.x + tail.base2.x + tail.tip.x) / 3, y: (tail.base1.y + tail.base2.y + tail.tip.y) / 3 };
  ok(isPointInElement(insideTail.x, insideTail.y, draft, ctx), 'Tail triangle is clickable');
  equal(getCalloutWorldTip(JSON.parse(JSON.stringify(draft))), tip, 'Arrow survives save/restore');
  equal(getCalloutWorldTip(createDocumentSnapshot({ elements: [draft], imageDataUrl: null, canvasWidth: 800, canvasHeight: 600 }).elements[0]), tip, 'History snapshots preserve arrow coordinates');
  const resized = withCalloutWorldTip({ ...draft, x: 80, width: 350, height: 95 }, tip);
  equal(getCalloutWorldTip(resized), tip, 'Resizing text box can preserve the pointed-at location');
  const translated = { ...draft, x: draft.x + 20, y: draft.y + 30 };
  equal(getCalloutWorldTip(translated), { x: tip.x + 20, y: tip.y + 30 }, 'Moving a callout moves the whole annotation');
  const expanded = await resizeCanvasDocument({ elements: [draft], imageDataUrl: null }, 1000, 800, 200, 150);
  equal(getCalloutWorldTip(expanded.elements[0]), { x: tip.x + 200, y: tip.y + 150 }, 'Adding top/left blank space translates arrow and body together');
  equal(getResizeHandleType(tip.x, tip.y, { ...draft, locked: true }), null, 'Locked callout arrow cannot be dragged');
  for (const rotation of [Math.PI / 2, Math.PI, -Math.PI / 3]) {
    const rotated = withCalloutWorldTip({ ...draft, rotation }, tip);
    const world = getCalloutWorldTip(rotated);
    ok(Math.abs(world.x - tip.x) < 1e-8 && Math.abs(world.y - tip.y) < 1e-8, 'Rotated callout can point at an exact canvas location');
    equal(getResizeHandleType(tip.x, tip.y, rotated), 'callout-tip', 'Rotated endpoint handle hit test');
  }
  for (const ratio of [1, 2, 3]) {
    const exported = context(ratio);
    renderCanvas(exported.ctx.canvas, exported.ctx, null, [draft], null, null, 1, ratio);
    ok(exported.calls.some(call => call.method === 'lineTo' && call.args[0] === tip.x && call.args[1] === tip.y), 'Export keeps logical arrow position at every resolution');
  }
}
equal(getCalloutTailGeometry(createCalloutDraft(calloutStart, { x: 180, y: 120 }, calloutSettings, 800, 600)), null, 'Endpoint inside box does not create an inverted tail');
equal(getCalloutTailGeometry({ type: 'callout', x: 100, y: 100, width: 280, height: 58, strokeWidth: 2, fontSize: 18, calloutTail: 'top-left' }), null, 'Legacy fixed-corner callouts retain their renderer');
console.log(`Passed ${checks} total assertions including free-endpoint callouts, legacy compatibility, transforms, history and exports.`);
