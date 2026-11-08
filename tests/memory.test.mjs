import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyMemory, activityKey, recordPick, bestPick, isSettled, rankedPicks, cacheDrawn, getDrawn, memoryStats } from '../js/memory.js';
import { sanitizeSvg } from '../js/ai.js';

const A = { type: 'emoji', value: '🏊' };
const B = { type: 'svg', value: 'data:image/svg+xml,...b' };

test('same activity, different phrasing -> same key', () => {
  assert.equal(activityKey('Swimming'), activityKey('go swimming'));
  assert.equal(activityKey('Rugbrød'), activityKey('rugbrød'));
  assert.notEqual(activityKey('Swimming'), activityKey('Dinner'));
});

test('learns the favourite picture and settles after repeated choice', () => {
  const m = emptyMemory();
  const k = activityKey('Swimming');
  assert.equal(bestPick(m, k), null);
  recordPick(m, k, A, 1);
  assert.deepEqual(bestPick(m, k).image, A);
  assert.equal(isSettled(m, k), false);
  recordPick(m, k, A, 2);
  assert.equal(isSettled(m, k), true);
  recordPick(m, k, B, 3); // changed their mind once
  assert.equal(isSettled(m, k), false);
  assert.deepEqual(rankedPicks(m, k).map(p => p.image), [A, B]);
  recordPick(m, k, B, 4); recordPick(m, k, B, 5);
  assert.deepEqual(bestPick(m, k).image, B);
  assert.equal(isSettled(m, k), true);
});

test('drawings are cached and the cache is bounded', () => {
  const m = emptyMemory();
  for (let i = 0; i < 5; i++) cacheDrawn(m, 'k' + i, [B], 3);
  assert.equal(Object.keys(m.drawn).length, 3);
  assert.deepEqual(getDrawn(m, 'k4'), [B]);
  assert.equal(memoryStats(m).drawings, 3);
});

test('SVG sanitiser removes anything active', () => {
  const evil = '<svg viewBox="0 0 200 200" onload="alert(1)"><script>alert(1)</script><circle cx="100" cy="100" r="50" fill="#f00" stroke="#2b2b2b" stroke-width="5"/><image href="http://x/y.png"/><a href="javascript:alert(1)"><rect width="10" height="10"/></a><rect x="1" y="1" width="50" height="50" fill="url(http://x)"/></svg>';
  const out = sanitizeSvg(evil);
  assert.ok(out.startsWith('<svg xmlns="http://www.w3.org/2000/svg"'));
  for (const bad of ['script', 'onload', '<image', 'href', 'javascript', 'url(']) assert.ok(!out.includes(bad), bad);
  assert.ok(out.includes('<circle'));
  assert.equal(sanitizeSvg('no svg here'), null);
});

test('every setup item links to a real library pictogram or has its own keywords', async () => {
  const { SETUP_ITEMS } = await import('../js/setup.js');
  const { BUILTIN_PICTOGRAMS } = await import('../js/library.js');
  const ids = new Set(BUILTIN_PICTOGRAMS.map(p => p.id));
  for (const i of SETUP_ITEMS) {
    if (i.baseId) assert.ok(ids.has(i.baseId), `unknown baseId ${i.baseId}`);
    else assert.ok(i.label && i.keywords?.length, `item ${i.id} needs label and keywords`);
    assert.ok(i.ask, `item ${i.id} needs a prompt`);
  }
});
