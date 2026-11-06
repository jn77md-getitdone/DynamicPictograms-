import { CATEGORIES, BUILTIN_PICTOGRAMS, categoryById } from './library.js';
import { parsePlan, newId, stepFromPicto, buildIndex, matchChunk, rankMatches } from './parser.js';
import { activityKey, imageId, recordPick, rankedPicks, bestPick, isSettled, cacheDrawn, getDrawn, memoryStats, emptyMemory } from './memory.js';
import { getState, update, subscribe, exportBackup, importBackup, resetAll, todayKey } from './store.js';
import { speak, canSpeak, canListen, listen, getVoices } from './speech.js';
import { planWithAI, drawPictograms } from './ai.js';
import { searchArasaac, ARASAAC_CREDIT } from './arasaac.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const main = $('#main');
const S = () => getState();

let route = 'today';
let stopDictation = null;

// ---------- helpers ----------
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function imageHTML(img, alt = '') {
  if (!img) return '<span class="emoji" aria-hidden="true">⭐</span>';
  if (img.type === 'emoji') return `<span class="emoji" aria-hidden="true">${esc(img.value)}</span>`;
  return `<img src="${esc(img.value)}" alt="${esc(alt)}" loading="lazy" draggable="false">`;
}

function catColor(id) { return categoryById(id).color; }

// All pictograms: the family's own first; a custom version replaces the built-in it is based on.
function allPictograms() {
  const custom = S().customPictos;
  const overridden = new Set(custom.map(c => c.baseId).filter(Boolean));
  return [...custom, ...BUILTIN_PICTOGRAMS.filter(b => !overridden.has(b.id))];
}

function fmtDate(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

function say(text) { speak(text, S().settings); }

function cloneSteps(steps) {
  return steps.map(s => ({ ...JSON.parse(JSON.stringify(s)), id: newId(), done: false }));
}

// ---------- navigation ----------
function go(to) {
  route = to;
  if (stopDictation) { stopDictation(); stopDictation = null; }
  render();
  window.scrollTo(0, 0);
}

function render() {
  const st = S();
  document.body.classList.toggle('child-mode', st.childMode);
  if (st.childMode) route = 'today';
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.go === route));
  const name = st.settings.personName.trim();
  $('#title').textContent = route === 'today' ? (name ? `${name}'s day` : 'My day') : ({
    plan: 'Make a plan', routines: 'Saved routines', pictos: 'Pictograms', settings: 'Settings',
  }[route]);
  $('#modeBtn').innerHTML = st.childMode
    ? '<span class="hold-ring"></span>🔒<span class="sr">Hold to unlock helper mode</span>'
    : '👀 <span class="btn-text">Show to person</span>';
  $('#modeBtn').title = st.childMode ? 'Hold for 2 seconds to unlock' : 'Switch to the simple view for the person';

  ({ today: renderToday, plan: renderPlan, routines: renderRoutines, pictos: renderPictos, settings: renderSettings }[route])();
  if (route === 'today') {
    const now = $('.card.now');
    if (now && $('.card.done')) requestAnimationFrame(() => now.scrollIntoView({ block: 'center' }));
  }
}

subscribe(() => { /* state saved; views re-render explicitly */ });

// ---------- TODAY ----------
function renderToday() {
  const st = S();
  const today = st.today;
  if (!today || !today.steps.length) {
    main.innerHTML = `
      <section class="empty">
        <div class="empty-emoji">🗓️</div>
        <h2>Nothing planned yet</h2>
        ${st.childMode ? '' : `<p>Say what will happen today and the app makes the pictograms.</p>
        ${canListen() ? '<button class="mic-hero" data-action="startTalk" aria-label="Tell me about today">🎤</button><strong>Tell me about today</strong>' : ''}
        <button class="btn ${canListen() ? '' : 'primary big'}" data-go="plan">✏️ ${canListen() ? 'Type it instead' : 'Make a plan'}</button>
        ${st.routines.length ? '<button class="btn big" data-go="routines">📚 Use a saved routine</button>' : ''}`}
      </section>`;
    return;
  }

  const steps = today.steps;
  const doneCount = steps.filter(s => s.done).length;
  const currentIdx = steps.findIndex(s => !s.done);
  const nextIdx = currentIdx < 0 ? -1 : steps.findIndex((s, i) => i > currentIdx && !s.done);
  const allDone = currentIdx < 0;
  const nowNext = st.settings.view === 'nowNext';

  const card = (s, i) => {
    const state = s.done ? 'done' : i === currentIdx ? 'now' : i === nextIdx ? 'next' : 'later';
    const badge = state === 'now' ? '<span class="badge now">Now</span>' : state === 'next' ? '<span class="badge next">Next</span>' : '';
    return `
      <li class="card ${state}" style="--cat:${catColor(s.category)}" data-id="${s.id}">
        <button class="card-main" data-action="speak" data-id="${s.id}" aria-label="${esc(s.label)}. Tap to hear.">
          <span class="pic">${imageHTML(s.image, s.label)}${s.done ? '<span class="tick">✓</span>' : ''}</span>
          <span class="text">
            ${badge}
            <span class="label">${esc(s.label)}</span>
            ${s.detail && s.detail.toLowerCase() !== s.label.toLowerCase() ? `<span class="detail">${esc(s.detail)}</span>` : ''}
            ${s.time && st.settings.showTimes ? `<span class="time">🕒 ${esc(s.time)}</span>` : ''}
          </span>
        </button>
        <button class="done-btn" data-action="toggleDone" data-id="${s.id}" aria-label="${s.done ? 'Not done yet' : 'Done'}">
          ${s.done ? '↺' : '✓'}
        </button>
      </li>`;
  };

  let list;
  if (nowNext && !allDone) {
    const later = steps.map((s, i) => ({ s, i })).filter(({ s, i }) => !s.done && i !== currentIdx && i !== nextIdx);
    list = `
      <ol class="cards nownext">
        ${card(steps[currentIdx], currentIdx)}
        ${nextIdx >= 0 ? card(steps[nextIdx], nextIdx) : ''}
      </ol>
      ${later.length ? `<div class="later-strip" aria-label="Later">
        <span class="later-title">Later</span>
        ${later.map(({ s }) => `<button class="mini" style="--cat:${catColor(s.category)}" data-action="speak" data-id="${s.id}" aria-label="${esc(s.label)}">${imageHTML(s.image, s.label)}</button>`).join('')}
      </div>` : ''}`;
  } else {
    list = `<ol class="cards">${steps.map(card).join('')}</ol>`;
  }

  main.innerHTML = `
    <section class="today">
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="${doneCount}">
        <div class="bar" style="width:${(doneCount / steps.length) * 100}%"></div>
        <span>${doneCount} of ${steps.length} done</span>
      </div>
      ${allDone ? `<div class="celebrate" data-action="speakText" data-text="All done! Well done!">🎉<strong>All done!</strong></div>` : ''}
      ${list}
      ${st.childMode ? '' : `
        <div class="row-actions">
          <button class="btn" data-action="editToday">✏️ Change this plan</button>
          <button class="btn" data-action="resetToday">↺ Start over</button>
        </div>
        <p class="hint">Made for ${esc(fmtDate(today.date))}. Tap a picture to hear it. Tap ✓ when it is done.</p>`}
    </section>`;
}

function findTodayStep(id) { return S().today?.steps.find(s => s.id === id); }

function toggleDone(id) {
  let spoken = '';
  update(st => {
    const s = st.today.steps.find(x => x.id === id);
    if (!s) return;
    s.done = !s.done;
    if (s.done) {
      const next = st.today.steps.find(x => !x.done);
      spoken = next ? `Well done! Next: ${next.label}.` : 'All done! Well done!';
    }
  });
  if (spoken && S().settings.speakOnDone) say(spoken);
  render();
  if (spoken) {
    const now = $('.card.now');
    if (now) now.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ---------- PLAN ----------
// Dictation first: tap the big microphone, say what will happen, and the list
// of pictograms appears when you stop talking. Each step then shows suggested
// pictures to choose from: learned ones, library ones and new AI drawings.

function aiReady() { const s = S().settings; return !!(s.aiEnabled && s.aiKey); }

function renderPlan() {
  const st = S();
  const draft = st.draft;
  const listening = !!stopDictation;
  main.innerHTML = `
    <section class="plan">
      <div class="hero ${listening ? 'listening' : ''}">
        ${canListen() ? `<button class="mic-hero" id="micHero" data-action="dictate" aria-label="${listening ? 'Stop listening' : 'Tap and tell me about today'}">${listening ? '⏹' : '🎤'}</button>` : ''}
        <div class="hero-text">
          <strong>${listening ? 'Listening… tap ⏹ when you are done' : 'Tell me about today'}</strong>
          <span>${canListen() ? 'Tap the microphone and say what will happen, for example' : 'Type what will happen, for example'} “breakfast, then school, swimming with Grandma, dinner and bed”.</span>
        </div>
      </div>
      <div class="say-box">
        <textarea id="planText" rows="3" placeholder="…or type it here">${esc(st.draftText)}</textarea>
      </div>
      <div class="row-actions">
        <button class="btn primary" data-action="generate" data-mode="replace">${aiReady() ? '✨' : '🧩'} ${draft.length ? 'Make new list' : 'Make pictograms'}</button>
        ${draft.length ? '<button class="btn" data-action="generate" data-mode="append">➕ Add to list</button>' : ''}
      </div>
      ${st.routines.length ? `<div class="chips"><span class="chips-title">Add a routine:</span>
        ${st.routines.map(r => `<button class="chip" data-action="addRoutine" data-id="${r.id}">${esc(r.name)}</button>`).join('')}</div>` : ''}

      <div id="planStatus" class="plan-status" aria-live="polite">${statusText()}</div>
      <div id="draftList">${renderDraftList(draft)}</div>

      <div class="row-actions">
        <button class="btn" data-action="addStep">➕ Add a step</button>
        ${draft.length ? '<button class="btn danger-text" data-action="clearDraft">🗑️ Clear</button>' : ''}
      </div>
      ${draft.length ? `
      <div class="sticky-actions">
        <button class="btn primary big" data-action="useToday">▶️ Use for today</button>
        <button class="btn big" data-action="saveRoutine">💾 Save as routine</button>
      </div>` : ''}
    </section>`;
}

function renderDraftList(draft) {
  if (!draft.length) return '';
  return `<ol class="editor">${draft.map((s, i) => `
    <li class="edit-row ${s.needsPicture ? 'needs' : ''}" style="--cat:${catColor(s.category)}" data-id="${s.id}">
      <div class="edit-top">
        <button class="pic-btn" data-action="changePic" data-id="${s.id}" aria-label="More pictures">
          ${imageHTML(s.image, s.label)}
          <span class="pic-hint">${s.needsPicture ? 'Choose' : 'More…'}</span>
        </button>
        <div class="edit-fields">
          <input class="in-label" data-field="label" data-id="${s.id}" value="${esc(s.label)}" aria-label="Words on the card">
          <input class="in-detail" data-field="detail" data-id="${s.id}" value="${esc(s.detail)}" placeholder="Extra detail (optional)" aria-label="Extra detail">
          <div class="edit-line">
            <input type="time" data-field="time" data-id="${s.id}" value="${esc(s.time || '')}" aria-label="Time (optional)">
            <button class="icon-btn" data-action="preview" data-id="${s.id}" aria-label="Hear it">🔊</button>
            <button class="icon-btn" data-action="toggleSpeech" data-id="${s.id}" aria-label="Edit what is said">💬</button>
          </div>
          <input class="in-speech" data-field="speech" data-id="${s.id}" value="${esc(s.speech)}" placeholder="What is said aloud" aria-label="What is said aloud" hidden>
        </div>
        <div class="order-btns">
          <button class="icon-btn" data-action="up" data-id="${s.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">▲</button>
          <button class="icon-btn" data-action="down" data-id="${s.id}" ${i === draft.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>
          <button class="icon-btn del" data-action="remove" data-id="${s.id}" aria-label="Remove">✕</button>
        </div>
      </div>
      <div class="suggest" id="sg-${s.id}">${renderSuggest(s)}</div>
    </li>`).join('')}</ol>`;
}

// ---- suggestions per step ----
// sug: stepId -> { library: [image], online: [image]|null, drawn: [image]|null, drawing, error, open }
const sug = new Map();

function suggestionsFor(step) {
  let entry = sug.get(step.id);
  if (!entry) {
    entry = { library: libraryCandidates(step), online: null, drawn: getDrawn(S().memory, activityKey(step.label)), drawing: false, error: '', open: false };
    sug.set(step.id, entry);
  }
  return entry;
}

function libraryCandidates(step) {
  const out = [];
  const own = step.pictoId && pictoById(step.pictoId);
  if (own) out.push(own.image);
  const query = [step.label, step.detail].filter(Boolean).join(' ');
  for (const p of rankMatches(query, buildIndex(allPictograms()), 3)) out.push(p.image);
  return out;
}

function candidateList(step, entry) {
  const key = activityKey(step.label);
  const groups = [
    ['learned', rankedPicks(S().memory, key).slice(0, 2).map(p => p.image)],
    ['library', [...entry.library.slice(0, 1), ...(entry.online || []).slice(0, 1), ...entry.library.slice(1)].slice(0, 2)],
    ['drawn', entry.drawn || []],
  ];
  const seen = new Set();
  const out = [];
  for (const [kind, images] of groups) {
    for (const image of images) {
      const id = imageId(image);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ kind, image, id });
    }
  }
  return out;
}

function renderSuggest(step) {
  const entry = suggestionsFor(step);
  const key = activityKey(step.label);
  const settled = isSettled(S().memory, key);
  const current = imageId(step.image);
  if (settled && !entry.open) {
    return `<div class="sg-learned"><span>⭐ Learned picture</span>
      <button class="link-btn" data-action="openSuggest" data-id="${step.id}">Show other pictures</button></div>`;
  }
  const items = candidateList(step, entry);
  const tag = { learned: 'Chosen before', library: 'Library', drawn: 'New' };
  const drawingSlots = entry.drawing ? Math.max(0, 3 - (entry.drawn || []).length) : 0;
  return `
    <div class="sg-strip" role="list">
      ${items.map((c, i) => `
        <button class="sg-item ${c.id === current ? 'on' : ''} kind-${c.kind}" role="listitem" data-action="pickSuggestion" data-id="${step.id}" data-index="${i}"
          aria-label="${esc(tag[c.kind])} picture ${i + 1}" aria-pressed="${c.id === current}">
          ${imageHTML(c.image, '')}<span class="sg-tag">${tag[c.kind]}</span>
        </button>`).join('')}
      ${Array.from({ length: drawingSlots }, () => '<span class="sg-item loading" aria-hidden="true"><span class="spinner"></span><span class="sg-tag">Drawing…</span></span>').join('')}
      ${!entry.drawing && aiReady() && S().settings.aiDraw ? `<button class="sg-item sg-action" data-action="drawNew" data-id="${step.id}">✨<span class="sg-tag">${entry.drawn?.length ? 'Draw again' : 'Draw'}</span></button>` : ''}
    </div>
    ${entry.error ? `<p class="hint error">${esc(entry.error)}</p>` : ''}`;
}

function refreshSuggest(stepId) {
  const step = draftStep(stepId);
  const el = document.getElementById('sg-' + stepId);
  if (step && el) el.innerHTML = renderSuggest(step);
  const status = $('#planStatus');
  if (status) status.innerHTML = statusText();
}

function statusText() {
  const drawing = S().draft.filter(s => sug.get(s.id)?.drawing).length;
  return drawing ? `<span class="spinner"></span> Drawing new pictures for ${drawing} step${drawing > 1 ? 's' : ''}… you can keep editing.` : '';
}

// A small queue so we never fire too many requests at once.
function makeQueue(limit) {
  let running = 0;
  const waiting = [];
  const next = () => {
    if (running >= limit || !waiting.length) return;
    running++;
    const { fn, resolve, reject } = waiting.shift();
    fn().then(resolve, reject).finally(() => { running--; next(); });
  };
  return fn => new Promise((resolve, reject) => { waiting.push({ fn, resolve, reject }); next(); });
}
const drawQueue = makeQueue(3);
const onlineQueue = makeQueue(4);

// Look up library + online + AI pictures for steps. Settled activities are skipped
// (the app already knows the picture), and earlier drawings are reused from memory.
function loadSuggestions(steps, { autoDraw = true } = {}) {
  const settings = S().settings;
  for (const step of steps) {
    const entry = suggestionsFor(step);
    const key = activityKey(step.label);
    const settled = isSettled(S().memory, key);
    if (settings.onlineSearch && navigator.onLine !== false && entry.online === null && !settled) {
      entry.online = [];
      const own = step.pictoId && pictoById(step.pictoId);
      const query = own && !own.custom ? own.label : step.label;
      onlineQueue(() => searchArasaac(query, settings.arasaacLang))
        .then(results => { entry.online = results.slice(0, 2).map(r => ({ type: 'url', value: r.url, source: 'arasaac' })); refreshSuggest(step.id); })
        .catch(() => { /* offline or no results: library pictures are enough */ });
    }
    if (autoDraw && aiReady() && settings.aiDraw && !settled && !entry.drawn && !entry.drawing) drawFor(step);
  }
}

function drawFor(step) {
  const entry = suggestionsFor(step);
  entry.drawing = true;
  entry.error = '';
  refreshSuggest(step.id);
  const key = activityKey(step.label);
  drawQueue(() => drawPictograms(step, S().settings, 3))
    .then(images => {
      entry.drawn = images;
      if (images.length) update(st => cacheDrawn(st.memory, key, images));
      // A step without a real picture gets the first drawing straight away.
      const live = draftStep(step.id);
      const autoOk = live && !live.userPicked && !bestPick(S().memory, key) && (live.needsPicture || !live.pictoId);
      if (autoOk && images.length) {
        update(() => { live.image = images[0]; live.needsPicture = false; });
        const row = $(`.edit-row[data-id="${step.id}"]`);
        if (row) { row.classList.remove('needs'); $('.pic-btn', row).innerHTML = imageHTML(live.image, live.label) + '<span class="pic-hint">More…</span>'; }
      }
    })
    .catch(e => { console.error(e); entry.error = e?.status === 401 ? 'The API key was not accepted. Check it in Settings.' : `Could not draw: ${e.message || e}`; })
    .finally(() => { entry.drawing = false; refreshSuggest(step.id); });
}

function pickSuggestion(stepId, index) {
  const step = draftStep(stepId);
  if (!step) return;
  const c = candidateList(step, suggestionsFor(step))[index];
  if (!c) return;
  update(() => { step.image = c.image; step.needsPicture = false; step.userPicked = true; });
  const row = $(`.edit-row[data-id="${stepId}"]`);
  if (row) { row.classList.remove('needs'); $('.pic-btn', row).innerHTML = imageHTML(step.image, step.label) + '<span class="pic-hint">More…</span>'; }
  refreshSuggest(stepId);
}

// Pre-select what the app has learned for each activity.
function applyMemory(steps) {
  const mem = S().memory;
  for (const s of steps) {
    const best = bestPick(mem, activityKey(s.label));
    if (best) { s.image = best.image; s.needsPicture = false; }
  }
  return steps;
}

// Called when a plan is used: every final picture counts as a choice.
function learnFromSteps(steps) {
  update(st => {
    for (const s of steps) {
      const key = activityKey(s.label);
      if (!key || !s.image) continue;
      recordPick(st.memory, key, s.image);
      upsertLearnedPicto(st, s, key, bestPick(st.memory, key).image);
    }
  });
}

// Keep "My pictograms" in step with what was learned, so the planner finds it next time.
function upsertLearnedPicto(st, step, key, image) {
  const builtin = step.pictoId && BUILTIN_PICTOGRAMS.find(b => b.id === step.pictoId);
  const existing = st.customPictos.find(c => c.id === step.pictoId)
    || (builtin && st.customPictos.find(c => c.baseId === builtin.id))
    || st.customPictos.find(c => c.learnedKey === key);
  if (existing) { existing.image = image; existing.uses = (existing.uses || 0) + 1; return; }
  if (builtin && imageId(builtin.image) === imageId(image)) return; // library picture is already right
  st.customPictos.unshift({
    id: 'c' + newId('p'),
    custom: true,
    learned: true,
    learnedKey: key,
    baseId: builtin ? builtin.id : null,
    label: builtin ? builtin.label : step.label,
    speech: builtin ? builtin.speech : (step.speech || step.label),
    category: step.category || (builtin && builtin.category) || 'other',
    subcategory: builtin ? builtin.subcategory : '',
    keywords: builtin ? [...builtin.keywords] : [step.label.toLowerCase()],
    image,
    uses: 1,
  });
}

function rerenderDraft() { $('#draftList').innerHTML = renderDraftList(S().draft); }

function setDraft(steps, mode) {
  update(st => { st.draft = mode === 'append' ? [...st.draft, ...steps] : steps; });
}

async function generate(mode, btn) {
  const text = $('#planText').value.trim();
  update(st => { st.draftText = text; });
  if (!text) { toast('Tap the microphone or type what is going to happen first.'); return; }
  let steps = null;
  if (aiReady()) {
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Thinking…'; }
    try {
      steps = await planWithAI(text, allPictograms(), S().settings);
    } catch (e) {
      console.error(e);
      toast((e?.status === 401 ? 'The API key was not accepted.' : (e.message || 'AI planning failed.')) + ' Using the offline planner.');
    }
  }
  if (!steps || !steps.length) steps = parsePlan(text, allPictograms());
  if (!steps.length) { renderPlan(); toast('No activities found. Try short phrases separated by commas.'); return; }
  applyMemory(steps);
  setDraft(steps, mode);
  if (mode !== 'append') sug.clear();
  renderPlan();
  loadSuggestions(steps);
  const missing = steps.filter(s => s.needsPicture).length;
  toast(missing && !aiReady() ? `${steps.length} steps made. ${missing} need a picture.` : `${steps.length} steps made. Tap a picture to choose it.`);
}

function draftStep(id) { return S().draft.find(s => s.id === id); }

function moveStep(id, delta) {
  update(st => {
    const i = st.draft.findIndex(s => s.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= st.draft.length) return;
    [st.draft[i], st.draft[j]] = [st.draft[j], st.draft[i]];
  });
  rerenderDraft();
}

function dictate() {
  if (stopDictation) { stopDictation(); return; }
  const before = ($('#planText')?.value || '').trim();
  const draftWasEmpty = !S().draft.length;
  // A new day plan starts from an empty text; adding to a list keeps what was typed.
  const prefix = draftWasEmpty ? '' : (before ? before + ', ' : '');
  let text = prefix;
  const show = () => { const ta = $('#planText'); if (ta) ta.value = text; };
  stopDictation = listen({
    lang: S().settings.speechLang,
    onText: t => { text = prefix + t; show(); },
    onEnd: () => {
      stopDictation = null;
      const heard = text.trim() !== prefix.trim();
      update(st => { st.draftText = text; });
      renderPlan();
      if (heard && S().settings.autoPlanAfterDictation && draftWasEmpty) generate('replace', $('[data-action=generate]'));
    },
    onError: e => { toast(e.message === 'not-allowed' ? 'Microphone permission was denied. Allow it in the browser settings.' : `Dictation: ${e.message}`); },
  });
  renderPlan();
  show();
}

// ---------- ROUTINES ----------
function renderRoutines() {
  const rs = S().routines;
  main.innerHTML = `
    <section class="routines">
      <p class="hint">Routines are lists you use again and again, like “Morning” or “Swimming day”. Make a list in <strong>Plan</strong> and tap <strong>Save as routine</strong>.</p>
      ${rs.length ? rs.map(r => `
        <article class="routine">
          <header><h3>${esc(r.name)}</h3><span class="count">${r.steps.length} steps</span></header>
          <div class="strip">${r.steps.map(s => `<span class="mini" style="--cat:${catColor(s.category)}" title="${esc(s.label)}">${imageHTML(s.image, s.label)}</span>`).join('')}</div>
          <div class="row-actions">
            <button class="btn primary" data-action="routineToday" data-id="${r.id}">▶️ Use for today</button>
            <button class="btn" data-action="routineEdit" data-id="${r.id}">✏️ Edit</button>
            <button class="btn" data-action="routineRename" data-id="${r.id}">Rename</button>
            <button class="btn danger-text" data-action="routineDelete" data-id="${r.id}">Delete</button>
          </div>
        </article>`).join('') : '<div class="empty"><div class="empty-emoji">📚</div><p>No saved routines yet.</p><button class="btn primary" data-go="plan">✏️ Make a plan</button></div>'}
    </section>`;
}

// ---------- PICTOGRAMS ----------
function renderPictos(filterCat = renderPictos.cat || null) {
  renderPictos.cat = filterCat;
  const custom = S().customPictos;
  const lib = allPictograms().filter(p => !p.custom);
  const shown = filterCat ? lib.filter(p => p.category === filterCat) : lib;
  main.innerHTML = `
    <section class="pictos">
      <div class="row-actions"><button class="btn primary" data-action="newPicto">➕ New pictogram</button></div>
      <h2>My pictograms</h2>
      ${custom.length ? `<div class="grid">${custom.map(p => tile(p, 'editPicto')).join('')}</div>`
        : '<p class="hint">Pictograms you make or change appear here and are used first when you make a plan. Tip: take a photo of the real thing (their own toothbrush, their school bus, Grandma).</p>'}
      <h2>Library</h2>
      <div class="chips">
        <button class="chip ${!filterCat ? 'on' : ''}" data-action="pictoCat" data-cat="">All</button>
        ${CATEGORIES.filter(c => c.id !== 'other').map(c => `<button class="chip ${filterCat === c.id ? 'on' : ''}" style="--cat:${c.color}" data-action="pictoCat" data-cat="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('')}
      </div>
      <div class="grid">${shown.map(p => tile(p, 'editPicto')).join('')}</div>
    </section>`;
}

function tile(p, action) {
  return `<button class="tile" style="--cat:${catColor(p.category)}" data-action="${action}" data-id="${esc(p.id)}">
    <span class="pic">${imageHTML(p.image, p.label)}</span><span class="tile-label">${esc(p.label)}</span></button>`;
}

function pictoById(id) { return allPictograms().find(p => p.id === id) || BUILTIN_PICTOGRAMS.find(p => p.id === id); }

function openPictoEditor(p) {
  const isBuiltin = p && !p.custom;
  const draft = p ? JSON.parse(JSON.stringify(p)) : {
    label: '', speech: '', category: 'other', subcategory: '', keywords: [], image: { type: 'emoji', value: '⭐' },
  };
  const dlg = $('#dialog');
  const draw = () => {
    const cat = categoryById(draft.category);
    dlg.innerHTML = `
      <form method="dialog" class="sheet" id="pictoForm">
        <header class="sheet-head"><h2>${p ? (isBuiltin ? 'Make your own version' : 'Edit pictogram') : 'New pictogram'}</h2>
          <button class="icon-btn" value="cancel" formnovalidate aria-label="Close">✕</button></header>
        ${isBuiltin ? '<p class="hint">Changes are saved as your own pictogram and will be used instead of the library one.</p>' : ''}
        <div class="picto-preview" style="--cat:${cat.color}">
          <button type="button" class="tile big" data-act="pickImg" aria-label="Change picture">
            <span class="pic">${imageHTML(draft.image, draft.label)}</span><span class="tile-label">${esc(draft.label || 'Name')}</span>
          </button>
          <button type="button" class="btn" data-act="pickImg">🖼️ Change picture</button>
          <button type="button" class="btn" data-act="hear">🔊 Hear</button>
        </div>
        <label class="field-label">Words on the card<input name="label" value="${esc(draft.label)}" required></label>
        <label class="field-label">What is said aloud<input name="speech" value="${esc(draft.speech)}" placeholder="e.g. Time to go swimming"></label>
        <label class="field-label">Category
          <select name="category">${CATEGORIES.map(c => `<option value="${c.id}" ${c.id === draft.category ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field-label">Group
          <select name="subcategory">${cat.subs.map(s => `<option value="${s.id}" ${s.id === draft.subcategory ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
        <label class="field-label">Words that should find this pictogram <small>(comma separated)</small>
          <input name="keywords" value="${esc((draft.keywords || []).map(k => k.replace(/^~/, '')).join(', '))}" placeholder="e.g. swimming, pool, swim"></label>
        <div class="row-actions">
          <button class="btn primary" value="save">Save</button>
          ${p && !isBuiltin ? '<button type="button" class="btn danger-text" data-act="delete">Delete</button>' : ''}
        </div>
      </form>`;
  };
  const readForm = () => {
    const f = $('#pictoForm');
    draft.label = f.label.value.trim();
    draft.speech = f.speech.value.trim();
    draft.category = f.category.value;
    draft.subcategory = f.subcategory.value;
    draft.keywords = f.keywords.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  };
  draw();
  dlg.onclick = async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    readForm();
    if (act === 'pickImg') {
      const res = await openPicker({ allowLibrary: false, title: 'Choose a picture' });
      if (dlg.open === false) dlg.showModal();
      if (res?.image) draft.image = res.image;
      draw();
    } else if (act === 'hear') {
      say(draft.speech || draft.label);
    } else if (act === 'delete') {
      if (!confirm(`Delete “${draft.label}”?`)) return;
      update(st => { st.customPictos = st.customPictos.filter(c => c.id !== p.id); });
      dlg.close(); renderPictos();
    }
  };
  dlg.onchange = e => { if (e.target.name === 'category') { readForm(); draft.subcategory = categoryById(draft.category).subs[0].id; draw(); } };
  dlg.onclose = () => {
    dlg.onclick = null; dlg.onchange = null; dlg.onclose = null;
    if (dlg.returnValue !== 'save') return;
    readForm();
    if (!draft.label) return;
    if (!draft.keywords.length) draft.keywords = [draft.label.toLowerCase()];
    if (!draft.speech) draft.speech = draft.label;
    update(st => {
      if (p && p.custom) {
        const i = st.customPictos.findIndex(c => c.id === p.id);
        st.customPictos[i] = { ...st.customPictos[i], ...draft };
      } else {
        st.customPictos.unshift({ ...draft, id: 'c' + newId('p'), custom: true, builtin: false, baseId: isBuiltin ? p.id : null });
      }
    });
    toast('Pictogram saved.');
    renderPictos();
  };
  dlg.returnValue = '';
  dlg.showModal();
}

// ---------- PICTURE PICKER ----------
// Resolves to { picto } (library choice), { image, remember } (new picture), or null.
function openPicker({ allowLibrary = true, title = 'Choose a picture', stepLabel = '', initialQuery = '' } = {}) {
  return new Promise(resolve => {
    const dlg = $('#picker');
    let tab = allowLibrary ? 'library' : 'photo';
    let cat = null, sub = null, query = initialQuery;
    let online = { q: initialQuery, results: null, error: '', loading: false };
    let photo = null;
    let drawState = { q: initialQuery, results: null, error: '', loading: false };
    const settings = S().settings;
    const finish = val => { resolve(val); dlg.close(); };

    const rememberBox = () => stepLabel ? `<label class="check"><input type="checkbox" id="remember" checked> Use this picture every time for “${esc(stepLabel)}”</label>` : '';

    const libraryBody = () => {
      const pics = allPictograms();
      if (query.trim()) {
        const idx = buildIndex(pics);
        const q = query.trim().toLowerCase();
        const scored = pics.map(p => {
          const m = matchChunk(q, idx.filter(x => x.picto === p));
          const text = (p.label + ' ' + (p.keywords || []).join(' ')).toLowerCase();
          return { p, s: (m ? m.score : 0) + (text.includes(q) ? 1 : 0) };
        }).filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.p);
        return scored.length ? `<div class="grid">${scored.map(p => tile(p, 'pick')).join('')}</div>`
          : `<p class="hint">Nothing found in the library.${settings.onlineSearch ? ' Try the <strong>Online</strong> tab.' : ''}</p>`;
      }
      if (!cat) {
        return `<div class="grid cats">${CATEGORIES.map(c => `<button class="tile cat" style="--cat:${c.color}" data-pick-cat="${c.id}">
          <span class="pic"><span class="emoji">${c.icon}</span></span><span class="tile-label">${esc(c.name)}</span></button>`).join('')}</div>`;
      }
      const c = categoryById(cat);
      const inCat = pics.filter(p => p.category === cat);
      const subs = c.subs.filter(s => inCat.some(p => p.subcategory === s.id));
      const shown = sub ? inCat.filter(p => p.subcategory === sub) : inCat;
      return `
        <div class="crumbs"><button class="chip" data-pick-cat="">← All</button><strong style="color:${c.color}">${c.icon} ${esc(c.name)}</strong></div>
        ${subs.length > 1 ? `<div class="chips">
          <button class="chip ${!sub ? 'on' : ''}" data-pick-sub="">All</button>
          ${subs.map(s => `<button class="chip ${sub === s.id ? 'on' : ''}" data-pick-sub="${s.id}">${esc(s.name)}</button>`).join('')}</div>` : ''}
        <div class="grid">${shown.map(p => tile(p, 'pick')).join('')}</div>`;
    };

    const photoBody = () => `
      <p class="hint">A photo of the real thing (their own cup, their school, Grandma) is often the easiest to understand.</p>
      <div class="photo-buttons">
        <label class="btn primary">📷 Take photo<input type="file" accept="image/*" capture="environment" data-photo hidden></label>
        <label class="btn">🖼️ Choose from device<input type="file" accept="image/*" data-photo hidden></label>
      </div>
      ${photo ? `<div class="photo-preview"><img src="${photo}" alt="Chosen photo"></div>${rememberBox()}
        <button class="btn primary big" data-use="photo">Use this photo</button>` : ''}`;

    const onlineBody = () => `
      <form class="search-row" data-online-form><input type="search" name="q" value="${esc(online.q)}" placeholder="Search, e.g. swimming" enterkeyhint="search">
        <button class="btn primary">Search</button></form>
      ${online.loading ? '<p class="hint"><span class="spinner"></span> Searching…</p>' : ''}
      ${online.error ? `<p class="hint error">${esc(online.error)}</p>` : ''}
      ${online.results ? (online.results.length ? `${rememberBox()}<div class="grid">${online.results.map(r => `
        <button class="tile" data-online-url="${esc(r.url)}"><span class="pic"><img src="${esc(r.url)}" alt="${esc(r.label)}" loading="lazy"></span><span class="tile-label">${esc(r.label)}</span></button>`).join('')}</div>` : '<p class="hint">No pictograms found. Try another word.</p>') : ''}
      <p class="credit">${esc(ARASAAC_CREDIT)}</p>`;

    const emojiBody = () => `
      <p class="hint">Type or paste any emoji (on iPhone/iPad use the 🌐 or 😀 key on the keyboard).</p>
      <input class="emoji-input" id="emojiInput" maxlength="16" placeholder="🙂" aria-label="Emoji">
      ${rememberBox()}
      <button class="btn primary big" data-use="emoji">Use this emoji</button>`;

    const aiBody = () => `
      <p class="hint">Describe the picture you want, as specifically as you like, e.g. “girl in a wheelchair at the swimming pool” or “rye bread with cheese”.</p>
      <form class="search-row" data-ai-form><input type="search" name="q" value="${esc(drawState.q)}" placeholder="What should it show?">
        <button class="btn ai">✨ Draw</button></form>
      ${drawState.loading ? '<p class="hint"><span class="spinner"></span> Drawing 3 pictures… this can take up to a minute.</p>' : ''}
      ${drawState.error ? `<p class="hint error">${esc(drawState.error)}</p>` : ''}
      ${drawState.results ? `<div class="grid">${drawState.results.map((img, i) => `
        <button class="tile" data-ai-index="${i}"><span class="pic">${imageHTML(img, 'Drawn picture')}</span><span class="tile-label">Use this</span></button>`).join('')}</div>` : ''}`;

    const draw = () => {
      const tabs = [allowLibrary && ['library', '🗂️ Library'], aiReady() && ['ai', '✨ AI draw'], ['photo', '📷 Photo'], settings.onlineSearch && ['online', '🌐 Online'], ['emoji', '😀 Emoji']].filter(Boolean);
      dlg.innerHTML = `
        <div class="sheet">
          <header class="sheet-head"><h2>${esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></header>
          <div class="tabs" role="tablist">${tabs.map(([id, name]) => `<button role="tab" class="tab ${tab === id ? 'on' : ''}" data-tab="${id}" aria-selected="${tab === id}">${name}</button>`).join('')}</div>
          ${tab === 'library' ? `<input type="search" class="lib-search" id="libSearch" value="${esc(query)}" placeholder="Search the library">` : ''}
          <div class="picker-body">${{ library: libraryBody, ai: aiBody, photo: photoBody, online: onlineBody, emoji: emojiBody }[tab]()}</div>
        </div>`;
    };

    const remember = () => !!$('#remember', dlg)?.checked;

    const doOnline = async q => {
      online = { q, results: null, error: '', loading: true }; draw();
      try { online.results = await searchArasaac(q, settings.arasaacLang); }
      catch (e) { online.error = navigator.onLine ? `Could not search: ${e.message}` : 'You are offline. Online search needs internet.'; }
      online.loading = false; draw();
    };

    dlg.onclick = e => {
      const t = e.target;
      if (t.closest('[data-close]')) return finish(null);
      const tabBtn = t.closest('[data-tab]');
      if (tabBtn) {
        tab = tabBtn.dataset.tab; draw();
        if (tab === 'online' && online.q && !online.results) doOnline(online.q);
        return;
      }
      const catBtn = t.closest('[data-pick-cat]');
      if (catBtn) { cat = catBtn.dataset.pickCat || null; sub = null; draw(); return; }
      const subBtn = t.closest('[data-pick-sub]');
      if (subBtn) { sub = subBtn.dataset.pickSub || null; draw(); return; }
      const pick = t.closest('[data-action="pick"]');
      if (pick) return finish({ picto: pictoById(pick.dataset.id) });
      const aiPick = t.closest('[data-ai-index]');
      if (aiPick) return finish({ image: drawState.results[Number(aiPick.dataset.aiIndex)] });
      const onl = t.closest('[data-online-url]');
      if (onl) return finish({ image: { type: 'url', value: onl.dataset.onlineUrl, source: 'arasaac' }, remember: remember() });
      const use = t.closest('[data-use]');
      if (use?.dataset.use === 'photo' && photo) return finish({ image: { type: 'photo', value: photo }, remember: remember() });
      if (use?.dataset.use === 'emoji') {
        const v = $('#emojiInput', dlg).value.trim();
        if (!v) return toast('Type an emoji first.');
        return finish({ image: { type: 'emoji', value: v }, remember: remember() });
      }
    };
    dlg.oninput = e => {
      if (e.target.id === 'libSearch') {
        query = e.target.value;
        $('.picker-body', dlg).innerHTML = libraryBody();
      }
    };
    dlg.onchange = async e => {
      if (e.target.matches('[data-photo]') && e.target.files[0]) {
        try { photo = await resizeImage(e.target.files[0]); draw(); }
        catch { toast('Could not read that picture.'); }
      }
    };
    dlg.onsubmit = e => {
      if (e.target.matches('[data-online-form]')) { e.preventDefault(); doOnline(e.target.q.value); }
      if (e.target.matches('[data-ai-form]')) {
        e.preventDefault();
        const q = e.target.q.value.trim();
        if (!q) return;
        drawState = { q, results: null, error: '', loading: true }; draw();
        drawPictograms({ label: q, detail: '', speech: '' }, settings, 3)
          .then(r => { drawState.results = r; })
          .catch(err => { drawState.error = `Could not draw: ${err.message || err}`; })
          .finally(() => { drawState.loading = false; if (dlg.open && tab === 'ai') draw(); });
      }
    };
    dlg.oncancel = () => { resolve(null); };
    dlg.onclose = () => { dlg.onclick = dlg.oninput = dlg.onchange = dlg.onsubmit = dlg.oncancel = dlg.onclose = null; resolve(null); };

    draw();
    dlg.showModal();
    if (tab === 'online' && online.q) doOnline(online.q);
  });
}

// Square-crop and shrink photos so they store small and look consistent.
function resizeImage(file, size = 360) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

async function changeStepPicture(id) {
  const step = draftStep(id);
  if (!step) return;
  const res = await openPicker({ title: `Picture for “${step.label}”` });
  if (!res) return;
  if (res.picto) {
    const p = res.picto;
    update(st => {
      const s = st.draft.find(x => x.id === id);
      const keepOwnWords = s.label && !s.needsPicture;
      Object.assign(s, {
        pictoId: p.id, image: { ...p.image }, category: p.category, needsPicture: false, userPicked: true,
        label: keepOwnWords ? s.label : p.label,
        speech: keepOwnWords ? s.speech : p.speech,
      });
      if (!keepOwnWords) s.detail = s.detail || '';
    });
  } else if (res.image) {
    update(st => {
      const s = st.draft.find(x => x.id === id);
      Object.assign(s, { image: res.image, needsPicture: false, userPicked: true });
    });
  }
  rerenderDraft();
}

async function addStep() {
  const res = await openPicker({ title: 'Add a step' });
  if (!res) return;
  let step;
  if (res.picto) step = stepFromPicto(res.picto);
  else {
    const label = prompt('What should the card say?', '') || 'Activity';
    step = stepFromPicto(null, { label, speech: label, image: res.image, needsPicture: false });
  }
  update(st => { st.draft.push(step); });
  renderPlan();
  loadSuggestions([step]);
  $(`.edit-row[data-id="${step.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- SETTINGS ----------
function renderSettings() {
  const s = S().settings;
  const voices = getVoices();
  const langPrefix = (s.speechLang || 'en').slice(0, 2);
  const matching = voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
  main.innerHTML = `
    <section class="settings">
      <form id="settingsForm">
        <fieldset><legend>The person</legend>
          <label class="field-label">Name <small>(shown as “Name’s day”)</small><input name="personName" value="${esc(s.personName)}"></label>
          <label class="field-label">How the day is shown
            <select name="view">
              <option value="list" ${s.view === 'list' ? 'selected' : ''}>The whole day as a list</option>
              <option value="nowNext" ${s.view === 'nowNext' ? 'selected' : ''}>Only “Now” and “Next” (simpler)</option>
            </select></label>
          <label class="check"><input type="checkbox" name="showTimes" ${s.showTimes ? 'checked' : ''}> Show times on cards</label>
        </fieldset>

        <fieldset><legend>Speech</legend>
          <label class="check"><input type="checkbox" name="autoPlanAfterDictation" ${s.autoPlanAfterDictation ? 'checked' : ''}> Make the pictograms as soon as I stop talking</label>
          ${canSpeak() ? '' : '<p class="hint error">This browser cannot speak aloud.</p>'}
          <label class="check"><input type="checkbox" name="speakOnTap" ${s.speakOnTap ? 'checked' : ''}> Say the pictogram aloud when it is tapped</label>
          <label class="check"><input type="checkbox" name="speakOnDone" ${s.speakOnDone ? 'checked' : ''}> Praise and say what is next when something is done</label>
          <label class="field-label">Language
            <select name="speechLang">${[['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['en-AU', 'English (Australia)'], ['da-DK', 'Dansk'], ['de-DE', 'Deutsch'], ['nl-NL', 'Nederlands'], ['sv-SE', 'Svenska'], ['nb-NO', 'Norsk'], ['fr-FR', 'Français'], ['es-ES', 'Español']]
              .map(([v, n]) => `<option value="${v}" ${s.speechLang === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="field-label">Voice
            <select name="voiceURI"><option value="">Default voice</option>
              ${(matching.length ? matching : voices).map(v => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === s.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></label>
          <label class="field-label">Speed <input type="range" name="speechRate" min="0.5" max="1.3" step="0.05" value="${s.speechRate}"></label>
          <button type="button" class="btn" data-action="speakText" data-text="Hello! Time to brush your teeth.">🔊 Test voice</button>
        </fieldset>

        <fieldset><legend>Online pictograms</legend>
          <label class="check"><input type="checkbox" name="onlineSearch" ${s.onlineSearch ? 'checked' : ''}> Allow searching ARASAAC pictograms online</label>
          <label class="field-label">Search language
            <select name="arasaacLang">${[['en', 'English'], ['da', 'Dansk'], ['de', 'Deutsch'], ['nl', 'Nederlands'], ['sv', 'Svenska'], ['nb', 'Norsk'], ['fr', 'Français'], ['es', 'Español']]
              .map(([v, n]) => `<option value="${v}" ${s.arasaacLang === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <p class="credit">${esc(ARASAAC_CREDIT)} Free for non-commercial use.</p>
        </fieldset>

        <fieldset><legend>AI (optional)</legend>
          <p class="hint">Without AI, the app makes pictograms on the device from its library. With AI (Claude), it understands free, spoken descriptions and <strong>draws new pictograms</strong> for each step. You need your own Anthropic API key. The key is stored only on this device; your description is sent to Anthropic when a plan is made.</p>
          <label class="check"><input type="checkbox" name="aiEnabled" ${s.aiEnabled ? 'checked' : ''}> Use AI to make plans</label>
          <label class="check"><input type="checkbox" name="aiDraw" ${s.aiDraw ? 'checked' : ''}> Draw 3 new pictograms for each step</label>
          <label class="field-label">Country / culture <small>(so food, schools, buses… look familiar)</small><input name="region" value="${esc(s.region)}" placeholder="e.g. Denmark"></label>
          <label class="field-label">Anthropic API key<input name="aiKey" type="password" autocomplete="off" value="${esc(s.aiKey)}" placeholder="sk-ant-..."></label>
          <label class="field-label">Model
            <select name="aiModel">${[['claude-opus-5-5', 'Claude Opus 5.5 (best)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (faster)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (fastest, cheapest)']]
              .map(([v, n]) => `<option value="${v}" ${s.aiModel === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        </fieldset>
      </form>

      <fieldset><legend>What the app has learned</legend>
        ${(() => { const m = memoryStats(S().memory); return `<p>Knows the favourite picture for <strong>${m.activities}</strong> activities, <strong>${m.settled}</strong> of them are settled (no new drawings needed). <strong>${m.drawings}</strong> drawings are saved for reuse.</p>`; })()}
        <p class="hint">Each time a plan is used, the pictures in it count as chosen. A picture chosen twice in a row is used automatically from then on.</p>
        <button class="btn danger-text" data-action="forgetLearned">Forget learned pictures</button>
      </fieldset>

      <fieldset><legend>Backup</legend>
        <p class="hint">Everything is saved on this device only. Export a backup to move it to another phone or tablet.</p>
        <div class="row-actions">
          <button class="btn" data-action="export">⬇️ Export backup</button>
          <label class="btn">⬆️ Import backup<input type="file" accept="application/json,.json" id="importFile" hidden></label>
          <button class="btn danger-text" data-action="resetAll">Delete everything</button>
        </div>
      </fieldset>
    </section>`;
}

function saveSettingsFromForm(form) {
  update(st => {
    const s = st.settings;
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === 'checkbox') s[el.name] = el.checked;
      else if (el.type === 'range') s[el.name] = parseFloat(el.value);
      else s[el.name] = el.value;
    }
    s.personName = s.personName.trim();
    s.aiKey = s.aiKey.trim();
  });
}

// ---------- mode switching (helper <-> person) ----------
let holdTimer = null;
function setupModeButton() {
  const btn = $('#modeBtn');
  const startHold = e => {
    if (!S().childMode) return;
    e.preventDefault();
    btn.classList.add('holding');
    holdTimer = setTimeout(() => {
      btn.classList.remove('holding');
      update(st => { st.childMode = false; });
      route = 'today';
      render();
      toast('Helper mode unlocked.');
    }, 2000);
  };
  const endHold = () => { clearTimeout(holdTimer); btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', startHold);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, endHold));
  btn.addEventListener('contextmenu', e => e.preventDefault());
  btn.addEventListener('click', () => {
    if (S().childMode) { toast('Hold the lock for 2 seconds to unlock.'); return; }
    update(st => { st.childMode = true; });
    go('today');
  });
}

// ---------- events ----------
document.addEventListener('click', async e => {
  const goBtn = e.target.closest('[data-go]');
  if (goBtn && !goBtn.closest('dialog')) { go(goBtn.dataset.go); return; }
  const el = e.target.closest('[data-action]');
  if (!el || el.closest('dialog')) return;
  const { action, id } = el.dataset;
  const st = S();

  switch (action) {
    case 'speak': {
      const s = findTodayStep(id);
      if (s && st.settings.speakOnTap) say(s.speech || s.label);
      el.closest('.card, .mini')?.classList.add('pulse');
      setTimeout(() => el.closest('.card, .mini')?.classList.remove('pulse'), 600);
      break;
    }
    case 'speakText': say(el.dataset.text); break;
    case 'toggleDone': toggleDone(id); break;
    case 'editToday':
      sug.clear();
      update(s => { s.draft = cloneSteps(s.today.steps); });
      go('plan'); loadSuggestions(S().draft, { autoDraw: false }); break;
    case 'resetToday':
      if (!confirm('Mark every step as not done?')) return;
      update(s => { s.today.steps.forEach(x => { x.done = false; }); });
      render(); break;

    case 'generate': generate(el.dataset.mode, el); break;
    case 'dictate': dictate(); break;
    case 'startTalk': go('plan'); dictate(); break;
    case 'pickSuggestion': pickSuggestion(id, Number(el.dataset.index)); break;
    case 'drawNew': { const s = draftStep(id); if (s) drawFor(s); break; }
    case 'openSuggest': {
      const s = draftStep(id);
      if (s) { suggestionsFor(s).open = true; loadSuggestions([s], { autoDraw: false }); refreshSuggest(id); }
      break;
    }
    case 'addRoutine': {
      const r = st.routines.find(x => x.id === id);
      if (r) { update(s => { s.draft.push(...cloneSteps(r.steps)); }); renderPlan(); loadSuggestions(S().draft, { autoDraw: false }); toast(`Added “${r.name}”.`); }
      break;
    }
    case 'changePic': changeStepPicture(id); break;
    case 'preview': { const s = draftStep(id); if (s) say(s.speech || s.label); break; }
    case 'toggleSpeech': { const inp = $(`.in-speech[data-id="${id}"]`); inp.hidden = !inp.hidden; if (!inp.hidden) inp.focus(); break; }
    case 'up': moveStep(id, -1); break;
    case 'down': moveStep(id, 1); break;
    case 'remove': sug.delete(id); update(s => { s.draft = s.draft.filter(x => x.id !== id); }); renderPlan(); break;
    case 'addStep': addStep(); break;
    case 'clearDraft':
      if (!confirm('Clear the whole list?')) return;
      sug.clear(); update(s => { s.draft = []; s.draftText = ''; }); renderPlan(); break;
    case 'useToday': {
      if (st.draft.some(s => s.needsPicture) && !confirm('Some steps have no picture yet (⭐). Use the plan anyway?')) return;
      learnFromSteps(st.draft);
      update(s => { s.today = { date: todayKey(), steps: cloneSteps(s.draft) }; });
      toast('Today’s plan is ready.');
      go('today'); break;
    }
    case 'saveRoutine': {
      const name = prompt('Name for this routine (e.g. “School morning”)', '');
      if (!name) return;
      update(s => { s.routines.unshift({ id: newId('r'), name: name.trim(), steps: cloneSteps(s.draft) }); });
      toast(`Saved “${name}”.`); break;
    }

    case 'routineToday': {
      const r = st.routines.find(x => x.id === id);
      if (st.today?.steps.length && !confirm('Replace today’s plan with this routine?')) return;
      update(s => { s.today = { date: todayKey(), steps: cloneSteps(r.steps) }; });
      go('today'); break;
    }
    case 'routineEdit': {
      const r = st.routines.find(x => x.id === id);
      if (st.draft.length && !confirm('Replace the list you are editing in Plan?')) return;
      sug.clear();
      update(s => { s.draft = cloneSteps(r.steps); });
      go('plan'); loadSuggestions(S().draft, { autoDraw: false });
      toast(`Editing “${r.name}”. Save it again with the same name to keep changes.`);
      break;
    }
    case 'routineRename': {
      const r = st.routines.find(x => x.id === id);
      const name = prompt('New name', r.name);
      if (name) { update(() => { r.name = name.trim(); }); renderRoutines(); }
      break;
    }
    case 'routineDelete': {
      const r = st.routines.find(x => x.id === id);
      if (!confirm(`Delete “${r.name}”?`)) return;
      update(s => { s.routines = s.routines.filter(x => x.id !== id); }); renderRoutines(); break;
    }

    case 'newPicto': openPictoEditor(null); break;
    case 'editPicto': openPictoEditor(pictoById(id)); break;
    case 'pictoCat': renderPictos(el.dataset.cat || null); break;

    case 'export': {
      const blob = new Blob([exportBackup()], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `pictograms-backup-${todayKey()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      break;
    }
    case 'forgetLearned':
      if (!confirm('Forget which pictures were chosen? Your own pictograms are kept.')) return;
      update(s => { s.memory = emptyMemory(); }); renderSettings(); break;
    case 'resetAll':
      if (!confirm('Delete all plans, routines and your own pictograms on this device?')) return;
      resetAll(); go('today'); break;
  }
});

// Save edits to draft fields as the helper types.
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.field && el.dataset.id) {
    update(st => {
      const s = st.draft.find(x => x.id === el.dataset.id);
      if (!s) return;
      s[el.dataset.field] = el.value || (el.dataset.field === 'time' ? null : '');
      if (el.dataset.field === 'label' && !s.speechEdited && !s.detail) s.speech = el.value;
      if (el.dataset.field === 'speech') s.speechEdited = true;
    });
    if (el.dataset.field === 'label') {
      const sp = $(`.in-speech[data-id="${el.dataset.id}"]`);
      const s = draftStep(el.dataset.id);
      if (sp && s) sp.value = s.speech;
    }
  } else if (el.id === 'planText') {
    update(st => { st.draftText = el.value; });
  } else if (el.closest('#settingsForm')) {
    saveSettingsFromForm(el.closest('#settingsForm'));
  }
});

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.closest('#settingsForm')) {
    saveSettingsFromForm(el.closest('#settingsForm'));
    if (el.name === 'speechLang') { update(st => { st.settings.voiceURI = ''; }); renderSettings(); }
  }
  if (el.id === 'importFile' && el.files[0]) {
    try {
      importBackup(await el.files[0].text());
      toast('Backup imported.');
      render();
    } catch (err) { alert(err.message || 'Could not import this file.'); }
  }
});

$('#nav').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

// Voices load asynchronously in some browsers.
if ('speechSynthesis' in window) window.speechSynthesis.addEventListener?.('voiceschanged', () => { if (route === 'settings') renderSettings(); });

// Offline support / install to home screen.
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
}

setupModeButton();
render();

// Exposed for tests and debugging.
window.__app = { go, render, getState: S };
