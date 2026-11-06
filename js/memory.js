// Learning: remembers which picture is chosen for each activity.
//
// Every time a plan is used, the final picture of each step counts as a
// "pick" for that activity. Over time:
//   - the most-picked picture is preselected automatically,
//   - once an activity is "settled" (same picture picked at least twice in a
//     row), no new AI drawings are requested for it, which saves time and cost,
//   - earlier AI drawings are cached, so opening the options again is free.
//
// Pure functions over a plain `memory` object so they are easy to test.
// Shape: { picks: { [key]: { [imgId]: { image, count, last } } }, drawn: { [key]: { images, at } } }

import { tokenize, stem } from './parser.js';

const IGNORE = new Set(['a', 'an', 'the', 'to', 'go', 'time', 'for', 'your', 'my', 'on', 'eat', 'have']);

export function emptyMemory() { return { picks: {}, drawn: {} }; }

// Same activity -> same key, however it was phrased ("Swimming", "go swimming").
export function activityKey(label) {
  const stems = tokenize(label || '').filter(t => !IGNORE.has(t)).map(stem);
  return stems.length ? stems.join(' ') : (label || '').trim().toLowerCase();
}

export function imageId(image) {
  if (!image) return '';
  const str = `${image.type}:${image.value}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function recordPick(memory, key, image, now = Date.now()) {
  if (!key || !image) return;
  const bucket = (memory.picks[key] ||= {});
  const id = imageId(image);
  const entry = (bucket[id] ||= { image, count: 0, last: 0 });
  entry.count += 1;
  entry.last = now;
}

// Picks for an activity, best first (most picked, then most recent).
export function rankedPicks(memory, key) {
  const bucket = memory.picks[key];
  if (!bucket) return [];
  return Object.entries(bucket)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => b.count - a.count || b.last - a.last);
}

export function bestPick(memory, key) { return rankedPicks(memory, key)[0] || null; }

// Settled = the favourite picture has been chosen at least twice and was also the latest choice.
export function isSettled(memory, key) {
  const ranked = rankedPicks(memory, key);
  if (!ranked.length) return false;
  const latest = ranked.reduce((a, b) => (b.last > a.last ? b : a));
  return ranked[0].count >= 2 && latest.id === ranked[0].id;
}

export function cacheDrawn(memory, key, images, max = 120) {
  memory.drawn[key] = { images, at: Date.now() };
  const keys = Object.keys(memory.drawn);
  if (keys.length > max) {
    keys.sort((a, b) => memory.drawn[a].at - memory.drawn[b].at)
      .slice(0, keys.length - max)
      .forEach(k => delete memory.drawn[k]);
  }
}

export function getDrawn(memory, key) { return memory.drawn[key]?.images || null; }

// How much the app has learned, for the Settings screen.
export function memoryStats(memory) {
  const keys = Object.keys(memory.picks);
  return {
    activities: keys.length,
    settled: keys.filter(k => isSettled(memory, k)).length,
    drawings: Object.values(memory.drawn).reduce((n, d) => n + d.images.length, 0),
  };
}
