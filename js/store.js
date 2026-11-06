// Everything is stored on the device (localStorage). Nothing is sent anywhere
// unless the helper turns on the optional AI planner or online pictogram search.

const KEY = 'dynamic-pictograms.v1';

export const DEFAULT_SETTINGS = {
  personName: '',
  view: 'list',            // 'list' | 'nowNext'
  speakOnTap: true,
  speakOnDone: true,
  voiceURI: '',
  speechRate: 0.9,
  speechLang: 'en-GB',
  showTimes: true,
  onlineSearch: true,      // ARASAAC pictogram search
  arasaacLang: 'en',
  aiEnabled: false,
  aiKey: '',
  aiModel: 'claude-opus-5-5',
  aiDraw: true,            // AI draws new pictograms for each step
  region: '',              // e.g. 'Denmark' - the AI draws food, places etc. as they look there
  autoPlanAfterDictation: true,
  useClaude: true,         // inside Claude: use the viewer's Claude account
  drawQuality: 'good',     // 'good' | 'best'
};

function emptyState() {
  return {
    settings: { ...DEFAULT_SETTINGS },
    customPictos: [],   // pictograms the helper made or adjusted
    routines: [],       // saved lists: { id, name, steps }
    today: null,        // { date, title, steps }
    draft: [],          // the plan being edited
    draftText: '',
    childMode: false,
    memory: { picks: {}, drawn: {} }, // what the app has learned (see memory.js)
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const data = JSON.parse(raw);
    const base = emptyState();
    return { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) }, memory: { ...base.memory, ...(data.memory || {}) } };
  } catch {
    return emptyState();
  }
}

export function getState() { return state; }

export function update(fn) {
  fn(state);
  save();
  listeners.forEach(l => l(state));
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('Could not save', e);
    // Only warn about a full device once; storage can also be blocked entirely (private mode).
    if (e && e.name === 'QuotaExceededError' && !save.warned) {
      save.warned = true;
      alert('The device storage is full. Try removing some photo pictograms, or export a backup in Settings.');
    }
    return false;
  }
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function exportBackup() {
  const copy = JSON.parse(JSON.stringify(state));
  copy.settings.aiKey = ''; // never put the key in a file that may be shared
  return JSON.stringify({ app: 'dynamic-pictograms', version: 1, exportedAt: new Date().toISOString(), data: copy }, null, 2);
}

export function importBackup(text) {
  const parsed = JSON.parse(text);
  if (!parsed || parsed.app !== 'dynamic-pictograms' || !parsed.data) throw new Error('This is not a Dynamic Pictograms backup file.');
  const keepKey = state.settings.aiKey;
  const base = emptyState();
  state = { ...base, ...parsed.data, settings: { ...base.settings, ...(parsed.data.settings || {}), aiKey: keepKey } };
  save();
  listeners.forEach(l => l(state));
}

export function resetAll() {
  state = emptyState();
  save();
  listeners.forEach(l => l(state));
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
