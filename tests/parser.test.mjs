import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, extractTime, stem, cleanPhrase } from '../js/parser.js';
import { BUILTIN_PICTOGRAMS } from '../js/library.js';

const ids = text => parsePlan(text, BUILTIN_PICTOGRAMS).map(s => s.pictoId);

test('splits a typical day into steps in order', () => {
  assert.deepEqual(
    ids('Breakfast, brush teeth, then bus to school at 8. After school swimming with grandma, dinner, bath and bed'),
    ['breakfast', 'brush-teeth', 'bus', 'school', 'swimming', 'dinner', 'bath', 'bed'],
  );
});

test('keeps extra words as detail and speech, but library label on the card', () => {
  const steps = parsePlan('swimming with grandma', BUILTIN_PICTOGRAMS);
  assert.equal(steps[0].label, 'Swimming');
  assert.equal(steps[0].detail, 'Swimming with grandma');
  assert.equal(steps[0].speech, 'Swimming with grandma');
});

test('reorders "before" and "after"', () => {
  assert.deepEqual(ids('Before lunch, wash your hands'), ['wash-hands', 'lunch']);
  assert.deepEqual(ids('wash hands before dinner'), ['wash-hands', 'dinner']);
  assert.deepEqual(ids('play football after school'), ['school', 'football']);
});

test('does not repeat a step mentioned as "after X"', () => {
  assert.deepEqual(ids('school. after school, swimming'), ['school', 'swimming']);
});

test('activity wins over transport and people', () => {
  assert.deepEqual(ids('car to the dentist'), ['dentist']);
  assert.deepEqual(ids('go to the zoo with dad'), ['zoo']);
  assert.deepEqual(ids('visit grandma'), ['grandma']);
});

test('specific beats generic', () => {
  assert.deepEqual(ids('play football'), ['football']);
  assert.deepEqual(ids('eat cereal'), ['cereal']);
});

test('splits "and" only when both halves are known activities', () => {
  assert.deepEqual(ids('bath and bed'), ['bath', 'bed']);
  assert.deepEqual(ids('brush teeth and hair'), ['brush-teeth', 'brush-hair']);
  assert.equal(parsePlan('mac and cheese', BUILTIN_PICTOGRAMS).length, 1);
});

test('unknown activities are kept and flagged for a picture', () => {
  const [s] = parsePlan('zorbing in the hall', BUILTIN_PICTOGRAMS);
  assert.equal(s.label, 'Zorbing in the hall');
  assert.equal(s.needsPicture, true);
});

test('custom pictograms are preferred and found by their keywords', () => {
  const custom = { id: 'c1', custom: true, label: 'Horse club', speech: 'Horse club', category: 'play', keywords: ['horse club', 'stable'], image: { type: 'emoji', value: '🐎' } };
  assert.deepEqual(parsePlan('stable at 3', [custom, ...BUILTIN_PICTOGRAMS]).map(s => [s.pictoId, s.time]), [['c1', '15:00']]);
});

test('times', () => {
  assert.equal(extractTime('bus at 8').time, '08:00');
  assert.equal(extractTime('dentist at 10:30').time, '10:30');
  assert.equal(extractTime('pyjamas at 7pm').time, '19:00');
  assert.equal(extractTime('swimming at 3').time, '15:00');
  assert.equal(extractTime('lunch at noon').time, '12:00');
  assert.equal(extractTime('read 2 books').time, null);
});

test('helpers', () => {
  assert.equal(stem('swimming'), stem('swim'));
  assert.equal(stem('shoes'), stem('shoe'));
  assert.equal(stem('brushing'), stem('brush'));
  assert.equal(cleanPhrase('and then we are going to go swimming.'), 'go swimming');
});

test('every built-in pictogram has a valid category and subcategory', async () => {
  const { CATEGORIES } = await import('../js/library.js');
  const seen = new Set();
  for (const p of BUILTIN_PICTOGRAMS) {
    assert.ok(!seen.has(p.id), `duplicate id ${p.id}`); seen.add(p.id);
    const c = CATEGORIES.find(x => x.id === p.category);
    assert.ok(c, `bad category for ${p.id}`);
    assert.ok(c.subs.some(s => s.id === p.subcategory), `bad subcategory for ${p.id}`);
  }
});
