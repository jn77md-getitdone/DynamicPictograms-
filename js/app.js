import { CATEGORIES, BUILTIN_PICTOGRAMS, categoryById } from './library.js';
import { parsePlan, newId, stepFromPicto, buildIndex, matchChunk, rankMatches } from './parser.js';
import { activityKey, imageId, recordPick, rankedPicks, bestPick, isSettled, cacheDrawn, getDrawn, memoryStats, emptyMemory } from './memory.js';
import { getState, update, subscribe, exportBackup, importBackup, resetAll, todayKey } from './store.js';
import { speak, canSpeak, canListen, listen, getVoices, preferKeyboardDictation } from './speech.js';
import { planWithAI, drawPictograms, askQuestions, aiAvailable, aiStatus, detectClaude, aiErrorMessage, canSendPhotos, photoForAI } from './ai.js';
import { searchArasaac, ARASAAC_CREDIT } from './arasaac.js';
import { SETUP_GROUPS, SETUP_ITEMS } from './setup.js';

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

function toast(msg, { action = '', onAction = null } = {}) {
  const t = $('#toast');
  t.textContent = msg;
  if (action) {
    const b = document.createElement('button');
    b.className = 'toast-action';
    b.textContent = action;
    b.onclick = () => { t.classList.remove('show', 'has-action'); onAction?.(); };
    t.append(' ', b);
  }
  t.classList.toggle('has-action', !!action);
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show', 'has-action'), action ? 5000 : 2600);
}

function say(text) { speak(text, S().settings); }

function cloneSteps(steps) {
  return steps.map(s => ({ ...JSON.parse(JSON.stringify(s)), id: newId(), done: false }));
}


// In-app dialogs. Browser pop-ups (confirm/prompt) are blocked inside Claude, and these
// are bigger and easier to tap on a tablet anyway.
function askDialog({ title, message = '', input = null, ok = 'OK', cancel = 'Cancel', danger = false }) {
  return new Promise(resolve => {
    const dlg = $('#ask');
    dlg.innerHTML = `
      <form method="dialog" class="sheet ask-sheet">
        <h2>${esc(title)}</h2>
        ${message ? `<p>${esc(message)}</p>` : ''}
        ${input !== null ? `<input id="askInput" value="${esc(input)}" autocomplete="off">` : ''}
        <div class="row-actions">
          <button class="btn big" value="cancel" formnovalidate>${esc(cancel)}</button>
          <button class="btn big ${danger ? 'danger' : 'primary'}" value="ok">${esc(ok)}</button>
        </div>
      </form>`;
    dlg.onclose = () => {
      dlg.onclose = null;
      if (dlg.returnValue !== 'ok') return resolve(null);
      resolve(input !== null ? ($('#askInput', dlg).value.trim() || null) : true);
    };
    dlg.returnValue = '';
    dlg.showModal();
    if (input !== null) setTimeout(() => { const i = $('#askInput', dlg); i.focus(); i.select(); }, 50);
  });
}
const askConfirm = (title, ok = 'Yes') => askDialog({ title, ok, danger: /delete|clear|forget/i.test(title) });
const askText = (title, value = '') => askDialog({ title, input: value || '', ok: 'Save' });

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
    plan: 'Make a plan', routines: 'Saved routines', pictos: 'Pictograms', settings: 'Settings', setup: 'Your own photos',
  }[route]);
  $('#modeBtn').innerHTML = st.childMode
    ? '<span class="hold-ring"></span>🔒<span class="sr">Hold to unlock helper mode</span>'
    : '👀 <span class="btn-text">Show to person</span>';
  $('#modeBtn').title = st.childMode ? 'Hold for 2 seconds to unlock' : 'Switch to the simple view for the person';

  ({ today: renderToday, plan: renderPlan, routines: renderRoutines, pictos: renderPictos, settings: renderSettings, setup: renderSetup }[route])();
}

subscribe(() => { /* state saved; views re-render explicitly */ });

// ---------- TODAY ----------
// Layout that never moves around: NOW is always the big card at the top, then
// NEXT, then the rest of the day. Finished steps leave the list and collect in a
// small "Done" row at the bottom, so the active picture is always in the same place.
function renderToday() {
  const st = S();
  const today = st.today;
  if (!today || !today.steps.length) {
    const noPhotos = !st.customPictos.some(c => c.setupId || c.image?.type === 'photo');
    main.innerHTML = `
      <section class="empty">
        <div class="empty-emoji">🗓️</div>
        <h2>Nothing planned yet</h2>
        ${st.childMode ? '' : `<p>Say what will happen today and the app makes the pictograms.</p>
        <button class="mic-hero" data-action="startTalk" aria-label="Tell me about today">🎤</button><strong>Tell me about today</strong>
        ${st.routines.length ? '<button class="btn big" data-go="routines">📚 Use a saved routine</button>' : ''}
        ${noPhotos ? `<div class="setup-invite">
          <strong>First time?</strong> Take photos of the things you use every day (the car, the table, the bed…), so the pictograms show their real world.
          <button class="btn primary" data-go="setup">📷 Set up with your own photos</button></div>` : ''}`}
      </section>`;
    return;
  }

  const steps = today.steps;
  const open = steps.filter(s => !s.done);
  const done = steps.filter(s => s.done);
  const [now, next, ...later] = open;
  const nowNextOnly = st.settings.view === 'nowNext';
  const showTime = s => s.time && st.settings.showTimes ? `<span class="time">🕒 ${esc(s.time)}</span>` : '';
  const detail = s => s.detail && s.detail.toLowerCase() !== s.label.toLowerCase() ? `<span class="detail">${esc(s.detail)}</span>` : '';

  main.innerHTML = `
    <section class="today">
      <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${steps.length}" aria-valuenow="${done.length}">
        <div class="bar" style="width:${(done.length / steps.length) * 100}%"></div>
        <span>${done.length} of ${steps.length} done</span>
      </div>

      ${now ? `
      <article class="now-card" style="--cat:${catColor(now.category)}" data-id="${now.id}">
        <span class="badge now">Now</span>
        <button class="now-main" data-action="speak" data-id="${now.id}" aria-label="${esc(now.label)}. Tap to hear.">
          <span class="pic">${imageHTML(now.image, now.label)}</span>
          <span class="label">${esc(now.label)}</span>
          ${detail(now)}${showTime(now)}
        </button>
        <button class="now-done" data-action="toggleDone" data-id="${now.id}">✓ Done</button>
      </article>` : `
      <div class="celebrate" data-action="speakText" data-text="All done! Well done!">🎉<strong>All done!</strong></div>`}

      ${next ? `
      <article class="next-card" style="--cat:${catColor(next.category)}">
        <button class="next-main" data-action="speak" data-id="${next.id}" aria-label="Next: ${esc(next.label)}. Tap to hear.">
          <span class="pic">${imageHTML(next.image, next.label)}</span>
          <span class="text"><span class="badge next">Next</span><span class="label">${esc(next.label)}</span>${detail(next)}${showTime(next)}</span>
        </button>
      </article>` : ''}

      ${later.length ? (nowNextOnly ? `
      <div class="later-strip" aria-label="Later">
        <span class="later-title">Later</span>
        ${later.map(s => `<button class="mini" style="--cat:${catColor(s.category)}" data-action="speak" data-id="${s.id}" aria-label="${esc(s.label)}">${imageHTML(s.image, s.label)}</button>`).join('')}
      </div>` : `
      <h3 class="section-title">Later</h3>
      <ol class="later-list">
        ${later.map(s => `<li><button class="later-row" style="--cat:${catColor(s.category)}" data-action="speak" data-id="${s.id}">
          <span class="pic">${imageHTML(s.image, s.label)}</span><span class="label">${esc(s.label)}</span>${showTime(s)}</button></li>`).join('')}
      </ol>`) : ''}

      ${done.length ? `
      <div class="done-row" aria-label="Done">
        <span class="later-title">✓ Done</span>
        ${done.map(s => `<button class="done-mini" style="--cat:${catColor(s.category)}" data-action="${st.childMode ? 'speak' : 'undoAsk'}" data-id="${s.id}" aria-label="${esc(s.label)}, done">
          ${imageHTML(s.image, s.label)}<span class="check">✓</span></button>`).join('')}
      </div>` : ''}

      ${st.childMode ? '' : `
        <div class="row-actions">
          <button class="btn" data-action="editToday">✏️ Change this plan</button>
          <button class="btn" data-action="resetToday">↺ Start over</button>
        </div>
        <p class="hint">Made for ${esc(fmtDate(today.date))}. Tap a picture to hear it. Tap ✓ Done when it is finished. Tap a done picture to undo it.</p>`}
    </section>`;
}

function findTodayStep(id) { return S().today?.steps.find(s => s.id === id); }

function setDone(id, value) {
  update(st => { const s = st.today.steps.find(x => x.id === id); if (s) s.done = value; });
}

function toggleDone(id) {
  const card = $(`.now-card[data-id="${id}"]`);
  const finish = () => {
    setDone(id, true);
    const next = S().today.steps.find(x => !x.done);
    if (S().settings.speakOnDone) say(next ? `Well done! Next: ${next.label}.` : 'All done! Well done!');
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    $('.now-card')?.classList.add('arrive');
    toast('Well done! ✓', { action: 'Undo', onAction: () => { setDone(id, false); render(); } });
  };
  // A short "done" moment on the card itself, then the next one takes its place.
  if (card && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    card.classList.add('finishing');
    setTimeout(finish, 450);
  } else finish();
}

// ---------- PLAN ----------
// Three phases:
//   1. talk       say (or type) what will happen; pictograms appear live as you speak
//   2. questions  the AI asks a few clarifying questions (skipped without AI)
//   3. edit       the ordered pictograms, with picture suggestions for each step

function aiReady() { return aiAvailable(S().settings); }

let phase = null;            // 'talk' | 'questions' | 'edit'
let talkMode = 'replace';    // 'replace' = new plan, 'append' = add to the list
let questions = null;        // [{ question, options, answer }] | null while loading
let questionsError = '';
let planBusy = false;

function currentPhase() {
  if (!phase) phase = S().draft.length ? 'edit' : 'talk';
  return phase;
}

function renderPlan() {
  const p = currentPhase();
  const steps = ['talk', 'questions', 'edit'];
  const names = { talk: '1. Talk', questions: '2. Questions', edit: '3. Pictograms' };
  const stepper = `<ol class="stepper">${steps.map(s => `<li class="${s === p ? 'on' : steps.indexOf(s) < steps.indexOf(p) ? 'done' : ''}">${names[s]}</li>`).join('')}</ol>`;
  main.innerHTML = `<section class="plan">${stepper}${p === 'talk' ? talkHTML() : p === 'questions' ? questionsHTML() : editHTML()}</section>`;
  if (p === 'talk') updateLivePreview();
}

// ---- 1. talk ----
function talkHTML() {
  const st = S();
  const listening = !!stopDictation;
  const keyboard = preferKeyboardDictation();
  return `
    <div class="hero ${listening ? 'listening' : ''}">
      <button class="mic-hero" id="micHero" data-action="dictate" aria-label="${listening ? 'Stop listening' : 'Start talking'}">${listening ? '⏹' : '🎤'}</button>
      <div class="hero-text">
        <strong>${listening ? 'Listening… tap ⏹ when you are done' : talkMode === 'append' ? 'What else will happen?' : 'Tell me about today'}</strong>
        <span>${keyboard
          ? 'Tap the microphone, then tap <b>🎤 on the keyboard</b> and speak. Tap <b>Next</b> when you are done.'
          : 'Tap the microphone and say what will happen, e.g. “breakfast, then school, swimming with Grandma, dinner and bed”.'}</span>
      </div>
    </div>
    <div class="say-box">
      <textarea id="planText" rows="4" placeholder="What you say appears here. You can also type or correct it.">${esc(st.draftText)}</textarea>
    </div>
    <div class="live" id="livePreview" aria-live="polite"></div>
    ${st.routines.length && talkMode === 'replace' ? `<div class="chips"><span class="chips-title">Or start from a routine:</span>
      ${st.routines.map(r => `<button class="chip" data-action="addRoutine" data-id="${r.id}">${esc(r.name)}</button>`).join('')}</div>` : ''}
    <div class="sticky-actions">
      ${S().draft.length ? '<button class="btn big" data-action="backToEdit">← Back to list</button>' : ''}
      <button class="btn primary big" data-action="talkNext" ${planBusy ? 'disabled' : ''}>${planBusy ? '<span class="spinner"></span> Working…' : 'Next →'}</button>
    </div>`;
}

// "Speech to pictogram": show the pictograms recognised so far, live, while talking or typing.
function updateLivePreview() {
  const el = $('#livePreview');
  const ta = $('#planText');
  if (!el || !ta) return;
  const text = ta.value.trim();
  if (!text) { el.innerHTML = ''; return; }
  const steps = applyMemory(parsePlan(text, allPictograms()));
  el.innerHTML = steps.length ? `<span class="live-title">I hear:</span>${steps.map(s => `
    <span class="live-item ${s.needsPicture ? 'unknown' : ''}" style="--cat:${catColor(s.category)}">
      <span class="pic">${imageHTML(s.image, s.label)}</span><span class="live-label">${esc(s.label)}</span>
    </span>`).join('')}` : '';
}

function dictate() {
  if (stopDictation) { stopDictation(); return; }
  const ta = $('#planText');
  if (preferKeyboardDictation()) {
    // Built-in dictation is unreliable here: use the keyboard's own microphone.
    ta.focus();
    toast('Tap 🎤 on the keyboard and speak.');
    return;
  }
  const before = ta.value.trim();
  const prefix = before ? before + ', ' : '';
  let text = prefix;
  const show = () => { const t = $('#planText'); if (t) t.value = text; updateLivePreview(); };
  stopDictation = listen({
    lang: S().settings.speechLang,
    onText: t => { text = prefix + t; show(); },
    onError: msg => {
      if (msg === 'not-allowed' || msg === 'service-not-allowed') toast('Microphone or dictation is not allowed. Use 🎤 on the keyboard instead, or allow it in Settings → Safari / Siri & Dictation.');
      else toast('Dictation did not work here. Tap in the box and use 🎤 on the keyboard instead.');
    },
    onEnd: ({ reason }) => {
      stopDictation = null;
      update(st => { st.draftText = text.replace(/,\s*$/, ''); });
      renderPlan();
      if (reason === 'silent') {
        toast('I could not hear anything. Tap in the box and use 🎤 on the keyboard instead.');
        $('#planText')?.focus();
      }
    },
  });
  renderPlan();
  show();
}

async function talkNext() {
  const text = ($('#planText')?.value || '').trim();
  update(st => { st.draftText = text; });
  if (!text) { toast('Say or type what is going to happen first.'); return; }
  if (stopDictation) { stopDictation(); }
  if (!aiReady()) { await makePlan(); return; }
  phase = 'questions';
  questions = null;
  questionsError = '';
  renderPlan();
  try {
    const qs = await askQuestions(text, S().settings);
    if (phase !== 'questions') return;
    questions = qs.map(q => ({ ...q, answer: '' }));
    if (!questions.length) { await makePlan(); return; }
  } catch (e) {
    console.error(e);
    questionsError = aiErrorMessage(e);
    questions = [];
  }
  renderPlan();
}

// ---- 2. questions ----
function questionsHTML() {
  if (questions === null) {
    return `<div class="thinking"><span class="spinner"></span> Reading what you said and thinking of questions…</div>
      <div class="sticky-actions"><button class="btn big" data-action="skipQuestions">Skip questions →</button></div>`;
  }
  return `
    <p class="said">“${esc(S().draftText)}”</p>
    ${questionsError ? `<p class="hint error">${esc(questionsError)} You can still continue.</p>` : ''}
    ${questions.length ? '<h2 class="q-title">A few questions so the pictures are right</h2>' : ''}
    ${questions.map((q, i) => `
      <div class="q-card">
        <p class="q-text">${esc(q.question)}</p>
        <div class="chips">${q.options.map(o => `<button class="chip ${q.answer === o ? 'on' : ''}" data-action="answer" data-q="${i}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>
        <input class="q-other" data-q="${i}" value="${q.options.includes(q.answer) ? '' : esc(q.answer)}" placeholder="Other answer (type or use 🎤 on the keyboard)">
      </div>`).join('')}
    <div class="sticky-actions">
      <button class="btn big" data-action="backToTalk">← Back</button>
      <button class="btn primary big" data-action="makePlan" ${planBusy ? 'disabled' : ''}>${planBusy ? '<span class="spinner"></span> Making pictograms…' : 'Make pictograms →'}</button>
    </div>`;
}

// ---- 3. edit ----
function editHTML() {
  const st = S();
  const draft = st.draft;
  return `
    <div class="row-actions">
      <button class="btn" data-action="talkMore">🎤 Add more by talking</button>
      <button class="btn" data-action="newPlan">↺ New plan</button>
    </div>
    <div id="planStatus" class="plan-status" aria-live="polite">${statusText()}</div>
    ${draft.length ? '<p class="hint">Check the order (▲▼) and tap the best picture under each step. 📷 turns a photo of the real thing into a cartoon pictogram.</p>' : ''}
    <div id="draftList">${renderDraftList(draft)}</div>
    <div class="row-actions">
      <button class="btn" data-action="addStep">➕ Add a step</button>
    </div>
    ${draft.length ? `
    <div class="sticky-actions">
      <button class="btn primary big" data-action="useToday">▶️ Use for today</button>
      <button class="btn big" data-action="saveRoutine">💾 Save as routine</button>
    </div>` : ''}`;
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
      <button class="sg-item sg-action" data-action="photoStep" data-id="${step.id}">📷<span class="sg-tag">${canSendPhotos(S().settings) ? 'Photo → cartoon' : 'Photo'}</span></button>
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

function rerenderDraft() { const el = $('#draftList'); if (el) el.innerHTML = renderDraftList(S().draft); }

function setDraft(steps, mode) {
  update(st => { st.draft = mode === 'append' ? [...st.draft, ...steps] : steps; });
}

// Make the pictogram list from what was said (+ answers). Uses AI when available.
async function makePlan() {
  const text = S().draftText.trim();
  if (!text) { phase = 'talk'; renderPlan(); return; }
  planBusy = true;
  renderPlan();
  let steps = null;
  if (aiReady()) {
    try {
      steps = await planWithAI(text, allPictograms(), S().settings, questions || []);
    } catch (e) {
      console.error(e);
      toast(aiErrorMessage(e) + ' Using the offline planner.');
    }
  }
  if (!steps || !steps.length) steps = parsePlan(text, allPictograms());
  planBusy = false;
  if (!steps.length) { phase = 'talk'; renderPlan(); toast('No activities found. Try short phrases separated by commas.'); return; }
  applyMemory(steps);
  const mode = talkMode;
  if (mode !== 'append') sug.clear();
  setDraft(steps, mode);
  update(st => { st.draftText = ''; });
  phase = 'edit';
  talkMode = 'replace';
  questions = null;
  renderPlan();
  loadSuggestions(steps);
  toast(`${steps.length} steps made. Tap a picture to choose it.`);
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

// Photo of the real thing -> cartoon pictogram for a step.
async function photoForStep(id) {
  const step = draftStep(id);
  if (!step) return;
  const res = await openPicker({ title: `Photo of “${step.label}”`, startTab: 'photo', context: step });
  if (!res?.image) return;
  update(() => { step.image = res.image; step.needsPicture = false; step.userPicked = true; });
  const entry = suggestionsFor(step);
  if (res.image.source === 'photo-ai' || res.image.type === 'photo') entry.drawn = [res.image, ...(entry.drawn || []).filter(i => imageId(i) !== imageId(res.image))];
  rerenderDraft();
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
      <div class="setup-invite">
        <strong>Use your own photos</strong> of the car, the table, the bed, school and the people in their life. The pictograms then show their real world.
        <button class="btn primary" data-go="setup">📷 Set up with your own photos</button>
      </div>
      <div class="row-actions"><button class="btn" data-action="newPicto">➕ New pictogram</button></div>
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
      if (!(await askConfirm(`Delete “${draft.label}”?`))) return;
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
function openPicker({ allowLibrary = true, title = 'Choose a picture', initialQuery = '', startTab = null, context = null } = {}) {
  return new Promise(resolve => {
    const dlg = $('#picker');
    let tab = startTab || (allowLibrary ? 'library' : 'photo');
    let photoLarge = null; // bigger copy sent to the AI to draw a cartoon
    let cartoon = { results: null, error: '', loading: false };
    let cat = null, sub = null, query = initialQuery;
    let online = { q: initialQuery, results: null, error: '', loading: false };
    let photo = null;
    let drawState = { q: initialQuery, results: null, error: '', loading: false };
    const settings = S().settings;
    const finish = val => { resolve(val); dlg.close(); };

    const rememberBox = () => '';
    const cartoonOk = canSendPhotos(settings);

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
      <p class="hint">Take a photo of the real thing: their own cup, their school, their bus, Grandma.${cartoonOk ? ' The AI can turn it into a <strong>cartoon pictogram</strong> that matches the other pictures, so it is easy to recognise but still simple.' : ''}</p>
      <div class="photo-buttons">
        <label class="btn primary">📷 Take photo<input type="file" accept="image/*" capture="environment" data-photo hidden></label>
        <label class="btn">🖼️ Choose from device<input type="file" accept="image/*" data-photo hidden></label>
      </div>
      ${photo ? `<div class="photo-preview"><img src="${photo}" alt="Chosen photo"></div>
        <div class="row-actions">
          ${cartoonOk ? `<button class="btn ai big" data-use="cartoon" ${cartoon.loading ? 'disabled' : ''}>${cartoon.loading ? '<span class="spinner"></span> Drawing cartoon…' : '✨ Make cartoon version'}</button>` : ''}
          <button class="btn big" data-use="photo">Use the photo as it is</button>
        </div>
        ${cartoon.loading ? '<p class="hint">This can take up to a minute.</p>' : ''}
        ${cartoon.error ? `<p class="hint error">${esc(cartoon.error)}</p>` : ''}
        ${cartoon.results ? (cartoon.results.length ? `<div class="grid">${cartoon.results.map((img, i) => `
          <button class="tile" data-cartoon-index="${i}"><span class="pic">${imageHTML(img, 'Cartoon version')}</span><span class="tile-label">Use this</span></button>`).join('')}</div>`
          : '<p class="hint">No cartoon came back. Try again or use the photo.</p>') : ''}` : ''}`;

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
      const cPick = t.closest('[data-cartoon-index]');
      if (cPick) return finish({ image: cartoon.results[Number(cPick.dataset.cartoonIndex)] });
      const aiPick = t.closest('[data-ai-index]');
      if (aiPick) return finish({ image: drawState.results[Number(aiPick.dataset.aiIndex)] });
      const onl = t.closest('[data-online-url]');
      if (onl) return finish({ image: { type: 'url', value: onl.dataset.onlineUrl, source: 'arasaac' }, remember: remember() });
      const use = t.closest('[data-use]');
      if (use?.dataset.use === 'cartoon' && photoLarge && !cartoon.loading) {
        cartoon = { results: null, error: '', loading: true }; draw();
        const what = context || { label: $('#pictoForm [name=label]')?.value || '', detail: '', speech: '' };
        photoForAI(photoLarge)
          .then(img => drawPictograms(what, settings, 2, img))
          .then(r => { cartoon.results = r; })
          .catch(err => { console.error(err); cartoon.error = aiErrorMessage(err); })
          .finally(() => { cartoon.loading = false; if (dlg.open && tab === 'photo') draw(); });
        return;
      }
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
        try {
          photo = await resizeImage(e.target.files[0]);
          photoLarge = cartoonOk ? await resizeImage(e.target.files[0], 900, false) : null;
          cartoon = { results: null, error: '', loading: false };
          draw();
        }
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
          .catch(err => { drawState.error = `Could not draw: ${aiErrorMessage(err)}`; })
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
function resizeImage(file, size = 360, square = true) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      if (square) {
        const s = Math.min(img.width, img.height);
        c.width = c.height = size;
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      } else {
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
      }
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
    const label = await askText('What should the card say?', '') || 'Activity';
    step = stepFromPicto(null, { label, speech: label, image: res.image, needsPicture: false });
  }
  update(st => { st.draft.push(step); });
  renderPlan();
  loadSuggestions([step]);
  $(`.edit-row[data-id="${step.id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- SETUP: your own photos ----------
// Photograph the things and places that come up every day. Each photo becomes
// that pictogram from then on, so plans show the person's own world.

function setupPicto(item) {
  return S().customPictos.find(c => c.setupId === item.id)
    || (item.baseId && S().customPictos.find(c => c.baseId === item.baseId && (c.image?.type === 'photo' || c.image?.source === 'photo-ai')));
}

function setupLabel(item) {
  const base = item.baseId && BUILTIN_PICTOGRAMS.find(b => b.id === item.baseId);
  return item.label || base?.label || item.id;
}

function renderSetup() {
  const done = SETUP_ITEMS.filter(i => setupPicto(i)).length;
  const own = S().customPictos.filter(c => c.setupId?.startsWith('own-'));
  const cartoon = canSendPhotos(S().settings);
  const itemHTML = (item, picto) => {
    const base = item.baseId && BUILTIN_PICTOGRAMS.find(b => b.id === item.baseId);
    const image = picto ? picto.image : (base ? base.image : { type: 'emoji', value: item.emoji || '⭐' });
    const category = picto?.category || item.category || base?.category || 'other';
    return `
      <li class="setup-item ${picto ? 'has-photo' : ''}" style="--cat:${catColor(category)}">
        <span class="pic">${imageHTML(image, setupLabel(item))}${picto ? '<span class="check">✓</span>' : ''}</span>
        <span class="setup-text">
          <span class="setup-label">${esc(picto?.label || setupLabel(item))}</span>
          <span class="setup-ask">${picto ? 'Your photo is used' : `Photo of ${esc(item.ask)}`}</span>
        </span>
        <span class="setup-buttons">
          <label class="btn primary small" aria-label="Take a photo">📷<input type="file" accept="image/*" capture="environment" data-setup-photo="${item.id}" hidden></label>
          <label class="btn small" aria-label="Choose a photo from the device">🖼️<input type="file" accept="image/*" data-setup-photo="${item.id}" hidden></label>
          ${picto ? `<button class="btn small danger-text" data-action="setupRemove" data-id="${item.id}" aria-label="Remove photo">✕</button>` : ''}
        </span>
      </li>`;
  };
  main.innerHTML = `
    <section class="setup">
      <div class="setup-intro">
        <p><strong>Take photos of the things and places you use every day.</strong> Each photo becomes that pictogram from then on, so the plans show the person’s own world: your car, your table, their bed.${cartoon ? ' You can use the photo as it is, or let the AI turn it into a simple <strong>cartoon pictogram</strong>.' : ''}</p>
        <p class="hint">Skip anything you don’t use. You can come back here any time from Pictograms.</p>
        <div class="progress small" role="progressbar" aria-valuemin="0" aria-valuemax="${SETUP_ITEMS.length}" aria-valuenow="${done}">
          <div class="bar" style="width:${(done / SETUP_ITEMS.length) * 100}%"></div><span>${done} of ${SETUP_ITEMS.length} photographed</span>
        </div>
      </div>
      ${SETUP_GROUPS.map(g => `
        <h2 class="setup-group">${esc(g.title)}</h2>
        <ol class="setup-list">${g.items.map(item => itemHTML(item, setupPicto(item))).join('')}</ol>`).join('')}
      <h2 class="setup-group">Something else</h2>
      <ol class="setup-list">
        ${own.map(c => itemHTML({ id: c.setupId, label: c.label, ask: c.label }, c)).join('')}
        <li class="setup-item add">
          <span class="pic"><span class="emoji">➕</span></span>
          <span class="setup-text"><input id="setupNewLabel" placeholder="Name, e.g. Horse club, Grandma’s house" aria-label="Name of the new pictogram"></span>
          <span class="setup-buttons">
            <label class="btn primary small" aria-label="Take a photo">📷<input type="file" accept="image/*" capture="environment" data-setup-photo="__new" hidden></label>
            <label class="btn small" aria-label="Choose a photo from the device">🖼️<input type="file" accept="image/*" data-setup-photo="__new" hidden></label>
          </span>
        </li>
      </ol>
      <div class="row-actions"><button class="btn primary big" data-go="plan">Done, make a plan →</button></div>
    </section>`;
}

// Photo review: use it as it is, or turn it into a cartoon pictogram.
function openPhotoSheet(file, context) {
  return new Promise(async resolve => {
    const dlg = $('#dialog');
    let photo, large;
    try {
      photo = await resizeImage(file);
      large = await resizeImage(file, 900, false);
    } catch { toast('Could not read that picture.'); return resolve(null); }
    const cartoonOk = canSendPhotos(S().settings);
    let cartoon = { results: null, loading: false, error: '' };
    const draw = () => {
      dlg.innerHTML = `
        <div class="sheet">
          <header class="sheet-head"><h2>${esc(context.label)}</h2><button class="icon-btn" data-close aria-label="Close">✕</button></header>
          <div class="photo-preview"><img src="${photo}" alt="Your photo"></div>
          <div class="row-actions">
            <button class="btn primary big" data-pick="photo">✓ Use this photo</button>
            ${cartoonOk ? `<button class="btn ai big" data-cartoon ${cartoon.loading ? 'disabled' : ''}>${cartoon.loading ? '<span class="spinner"></span> Drawing…' : '✨ Make cartoon version'}</button>` : ''}
          </div>
          ${cartoon.loading ? '<p class="hint">Drawing a cartoon of your photo. This can take up to a minute.</p>' : ''}
          ${cartoon.error ? `<p class="hint error">${esc(cartoon.error)}</p>` : ''}
          ${cartoon.results ? `<div class="grid">${cartoon.results.map((img, i) => `
            <button class="tile" data-pick="${i}"><span class="pic">${imageHTML(img, 'Cartoon version')}</span><span class="tile-label">Use this</span></button>`).join('')}</div>` : ''}
        </div>`;
    };
    const done = val => { dlg.onclick = null; dlg.onclose = null; dlg.close(); resolve(val); };
    dlg.onclick = e => {
      if (e.target.closest('[data-close]')) return done(null);
      const pick = e.target.closest('[data-pick]');
      if (pick) return done(pick.dataset.pick === 'photo' ? { type: 'photo', value: photo } : cartoon.results[Number(pick.dataset.pick)]);
      if (e.target.closest('[data-cartoon]') && !cartoon.loading) {
        cartoon = { results: null, loading: true, error: '' }; draw();
        photoForAI(large)
          .then(img => drawPictograms({ label: context.label, detail: '', speech: context.speech || '' }, S().settings, 2, img))
          .then(r => { cartoon.results = r; if (!r.length) cartoon.error = 'No cartoon came back. Try again or use the photo.'; })
          .catch(err => { console.error(err); cartoon.error = aiErrorMessage(err); })
          .finally(() => { cartoon.loading = false; if (dlg.open) draw(); });
      }
    };
    dlg.onclose = () => done(null);
    draw();
    dlg.showModal();
  });
}

async function handleSetupPhoto(input) {
  const id = input.dataset.setupPhoto;
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  let item = SETUP_ITEMS.find(i => i.id === id) || (() => {
    const c = S().customPictos.find(x => x.setupId === id);
    return c ? { id, label: c.label, category: c.category, keywords: c.keywords, speech: c.speech } : null;
  })();
  if (id === '__new') {
    const label = $('#setupNewLabel')?.value.trim();
    if (!label) { toast('Write a name first, e.g. “Horse club”.'); $('#setupNewLabel')?.focus(); return; }
    item = { id: 'own-' + newId('s'), label, ask: label, category: 'other', speech: label, keywords: [label.toLowerCase()] };
  }
  if (!item) return;
  const image = await openPhotoSheet(file, { label: setupLabel(item), speech: item.speech });
  if (!image) return;
  saveSetupPhoto(item, image);
  toast(`Saved. “${setupLabel(item)}” now uses your picture.`);
  renderSetup();
}

function saveSetupPhoto(item, image) {
  const base = item.baseId && BUILTIN_PICTOGRAMS.find(b => b.id === item.baseId);
  update(st => {
    let c = st.customPictos.find(x => x.setupId === item.id) || (base && st.customPictos.find(x => x.baseId === base.id));
    if (!c) { c = { id: 'c' + newId('p'), custom: true }; st.customPictos.unshift(c); }
    Object.assign(c, {
      setupId: item.id,
      baseId: base ? base.id : null,
      label: item.label || base.label,
      speech: item.speech || base?.speech || item.label,
      category: item.category || base?.category || 'other',
      subcategory: item.subcategory || base?.subcategory || '',
      keywords: item.keywords || [...(base?.keywords || [])],
      image,
    });
    // The family's own photo wins from now on: make it the learned picture straight away.
    const key = activityKey(c.label);
    delete st.memory.picks[key];
    recordPick(st.memory, key, image);
    recordPick(st.memory, key, image);
  });
}

function removeSetupPhoto(id) {
  update(st => {
    const c = st.customPictos.find(x => x.setupId === id)
      || st.customPictos.find(x => x.baseId === SETUP_ITEMS.find(i => i.id === id)?.baseId);
    if (!c) return;
    delete st.memory.picks[activityKey(c.label)];
    st.customPictos = st.customPictos.filter(x => x !== c);
  });
  renderSetup();
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

        <fieldset><legend>Speech</legend>          ${canSpeak() ? '' : '<p class="hint error">This browser cannot speak aloud.</p>'}
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

        <fieldset><legend>AI</legend>
          ${aiStatus.inClaude ? `
          <p class="ai-ok">✅ Using your Claude account. No API key needed.</p>
          <p class="hint">The first time, Claude asks you to allow this page to use Claude. It uses your normal Claude usage.</p>
          <label class="check"><input type="checkbox" name="useClaude" ${s.useClaude !== false ? 'checked' : ''}> Use AI (questions, plans and drawings)</label>
          <label class="field-label">Drawing quality
            <select name="drawQuality"><option value="good" ${s.drawQuality !== 'best' ? 'selected' : ''}>Good and quicker</option><option value="best" ${s.drawQuality === 'best' ? 'selected' : ''}>Best (slower)</option></select></label>`
          : `
          <p class="hint">With AI, the app asks clarifying questions, makes the plan from what you said, and <strong>draws new pictograms</strong> for each step. <strong>Easiest:</strong> open the app inside Claude (the link you got from Claude), which uses your Claude login. <strong>Or</strong> paste your own Anthropic API key here; it is stored only on this device.</p>
          <label class="check"><input type="checkbox" name="aiEnabled" ${s.aiEnabled ? 'checked' : ''}> Use AI with my API key</label>
          <label class="field-label">Anthropic API key<input name="aiKey" type="password" autocomplete="off" value="${esc(s.aiKey)}" placeholder="sk-ant-..."></label>
          <label class="field-label">Model
            <select name="aiModel">${[['claude-opus-5-5', 'Claude Opus 5.5 (best)'], ['claude-sonnet-5-5', 'Claude Sonnet 5.5 (faster)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (fastest, cheapest)']]
              .map(([v, n]) => `<option value="${v}" ${s.aiModel === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`}
          <label class="check"><input type="checkbox" name="aiDraw" ${s.aiDraw ? 'checked' : ''}> Draw 3 new pictograms for each step</label>
          <label class="field-label">Country / culture <small>(so food, schools, buses… look familiar)</small><input name="region" value="${esc(s.region)}" placeholder="e.g. Denmark"></label>
        </fieldset>
        <div class="row-actions save-row">
          <button type="button" class="btn primary big" data-action="saveSettings">💾 Save settings</button>
          <span class="hint">Changes are also saved automatically.</span>
        </div>
      </form>

      <fieldset><legend>Your own photos</legend>
        <p class="hint">Photograph the car, the table, the bed, school and the people in their life, so the pictograms show their real world.</p>
        <button class="btn primary" data-go="setup">📷 Set up with your own photos</button>
      </fieldset>

      <fieldset><legend>What the app has learned</legend>
        ${(() => { const m = memoryStats(S().memory); return `<p>Knows the favourite picture for <strong>${m.activities}</strong> activities, <strong>${m.settled}</strong> of them are settled (no new drawings needed). <strong>${m.drawings}</strong> drawings are saved for reuse.</p>`; })()}
        <p class="hint">Each time a plan is used, the pictures in it count as chosen. A picture chosen twice in a row is used automatically from then on.</p>
        <button class="btn danger-text" data-action="forgetLearned">Forget learned pictures</button>
      </fieldset>

      <fieldset><legend>Backup</legend>
        <p class="hint">Everything is saved on this device only.${aiStatus.inClaude ? ' (Inside Claude, it is saved in this browser for this page.)' : ' Export a backup to move it to another phone or tablet.'}</p>
        <div class="row-actions">
          ${aiStatus.inClaude ? '' : '<button class="btn" data-action="export">⬇️ Export backup</button>'}
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
    s.personName = (s.personName || '').trim();
    s.aiKey = (s.aiKey || '').trim();
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
      const tapped = el.closest('.now-card, .next-card, .later-row, .mini, .done-mini');
      tapped?.classList.add('pulse');
      setTimeout(() => tapped?.classList.remove('pulse'), 600);
      break;
    }
    case 'speakText': say(el.dataset.text); break;
    case 'toggleDone': toggleDone(id); break;
    case 'undoAsk': {
      const s = findTodayStep(id);
      if (s && await askConfirm(`Mark “${s.label}” as not done?`)) { setDone(id, false); render(); }
      break;
    }
    case 'editToday':
      sug.clear();
      update(s => { s.draft = cloneSteps(s.today.steps); });
      phase = 'edit'; go('plan'); loadSuggestions(S().draft, { autoDraw: false }); break;
    case 'resetToday':
      if (!(await askConfirm('Mark every step as not done?'))) return;
      update(s => { s.today.steps.forEach(x => { x.done = false; }); });
      render(); break;

    case 'dictate': dictate(); break;
    case 'startTalk': phase = 'talk'; talkMode = 'replace'; go('plan'); dictate(); break;
    case 'talkNext': talkNext(); break;
    case 'skipQuestions': questions = []; makePlan(); break;
    case 'makePlan': makePlan(); break;
    case 'backToTalk': phase = 'talk'; renderPlan(); break;
    case 'backToEdit': if (stopDictation) stopDictation(); phase = 'edit'; talkMode = 'replace'; renderPlan(); break;
    case 'talkMore': phase = 'talk'; talkMode = 'append'; update(s => { s.draftText = ''; }); renderPlan(); break;
    case 'newPlan':
      if (st.draft.length && !(await askConfirm('Start a new plan? The current list will be cleared.'))) return;
      sug.clear(); update(s => { s.draft = []; s.draftText = ''; }); phase = 'talk'; talkMode = 'replace'; renderPlan(); break;
    case 'answer': {
      const q = questions?.[Number(el.dataset.q)];
      if (q) { q.answer = q.answer === el.dataset.value ? '' : el.dataset.value; renderPlan(); }
      break;
    }
    case 'photoStep': photoForStep(id); break;
    case 'pickSuggestion': pickSuggestion(id, Number(el.dataset.index)); break;
    case 'drawNew': { const s = draftStep(id); if (s) drawFor(s); break; }
    case 'openSuggest': {
      const s = draftStep(id);
      if (s) { suggestionsFor(s).open = true; loadSuggestions([s], { autoDraw: false }); refreshSuggest(id); }
      break;
    }
    case 'addRoutine': {
      const r = st.routines.find(x => x.id === id);
      if (r) { update(s => { s.draft.push(...cloneSteps(r.steps)); }); phase = 'edit'; renderPlan(); loadSuggestions(S().draft, { autoDraw: false }); toast(`Added “${r.name}”.`); }
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
      if (!(await askConfirm('Clear the whole list?'))) return;
      sug.clear(); update(s => { s.draft = []; s.draftText = ''; }); renderPlan(); break;
    case 'useToday': {
      if (st.draft.some(s => s.needsPicture) && !(await askConfirm('Some steps have no picture yet (⭐). Use the plan anyway?'))) return;
      learnFromSteps(st.draft);
      update(s => { s.today = { date: todayKey(), steps: cloneSteps(s.draft) }; });
      toast('Today’s plan is ready.');
      go('today'); break;
    }
    case 'saveRoutine': {
      const name = await askText('Name for this routine (e.g. “School morning”)', '');
      if (!name) return;
      update(s => { s.routines.unshift({ id: newId('r'), name: name.trim(), steps: cloneSteps(s.draft) }); });
      toast(`Saved “${name}”.`); break;
    }

    case 'routineToday': {
      const r = st.routines.find(x => x.id === id);
      if (st.today?.steps.length && !(await askConfirm('Replace today’s plan with this routine?'))) return;
      update(s => { s.today = { date: todayKey(), steps: cloneSteps(r.steps) }; });
      go('today'); break;
    }
    case 'routineEdit': {
      const r = st.routines.find(x => x.id === id);
      if (st.draft.length && !(await askConfirm('Replace the list you are editing in Plan?'))) return;
      sug.clear();
      update(s => { s.draft = cloneSteps(r.steps); });
      phase = 'edit'; go('plan'); loadSuggestions(S().draft, { autoDraw: false });
      toast(`Editing “${r.name}”. Save it again with the same name to keep changes.`);
      break;
    }
    case 'routineRename': {
      const r = st.routines.find(x => x.id === id);
      const name = await askText('New name', r.name);
      if (name) { update(() => { r.name = name.trim(); }); renderRoutines(); }
      break;
    }
    case 'routineDelete': {
      const r = st.routines.find(x => x.id === id);
      if (!(await askConfirm(`Delete “${r.name}”?`))) return;
      update(s => { s.routines = s.routines.filter(x => x.id !== id); }); renderRoutines(); break;
    }

    case 'newPicto': openPictoEditor(null); break;
    case 'setupRemove':
      if (await askConfirm('Remove this photo? The library picture is used again.', 'Remove')) removeSetupPhoto(id);
      break;
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
    case 'saveSettings': {
      const f = $('#settingsForm');
      if (f) saveSettingsFromForm(f);
      toast('Settings saved ✓');
      renderSettings();
      break;
    }
    case 'forgetLearned':
      if (!(await askConfirm('Forget which pictures were chosen? Your own pictograms are kept.'))) return;
      update(s => { s.memory = emptyMemory(); }); renderSettings(); break;
    case 'resetAll':
      if (!(await askConfirm('Delete all plans, routines and your own pictograms on this device?'))) return;
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
    updateLivePreview();
  } else if (el.classList.contains('q-other')) {
    const q = questions?.[Number(el.dataset.q)];
    if (q) {
      q.answer = el.value;
      document.querySelectorAll(`.chip[data-q="${el.dataset.q}"]`).forEach(c => c.classList.remove('on'));
    }
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
  if (el.matches?.('[data-setup-photo]')) { handleSetupPhoto(el); return; }
  if (el.id === 'importFile' && el.files[0]) {
    try {
      importBackup(await el.files[0].text());
      toast('Backup imported.');
      render();
    } catch (err) { toast(err.message || 'Could not import this file.'); }
  }
});

$('#nav').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) go(b.dataset.go); });

// Voices load asynchronously in some browsers.
if ('speechSynthesis' in window) window.speechSynthesis.addEventListener?.('voiceschanged', () => { if (route === 'settings') renderSettings(); });

// Offline support / install to home screen (not inside Claude, where the page is framed).
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.claude) {
  navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
}

setupModeButton();
render();
// Inside Claude, AI works with the viewer's own Claude account: light it up when known.
detectClaude().then(inClaude => { if (inClaude) render(); });

// Exposed for tests and debugging.
window.__app = { go, render, getState: S };
