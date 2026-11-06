// AI features using Claude:
//   askQuestions    - clarifying questions about what was said, before the plan is made
//   planWithAI      - turns the description (+ answers) into ordered steps
//   drawPictograms  - draws new pictograms (SVG) for one step, in a fixed house style,
//                     optionally from a photo ("make a cartoon of this real thing")
//
// Two ways to reach Claude, picked automatically:
//   1. Inside Claude (the app opened as a Claude artifact): uses the viewer's own
//      Claude account. No API key needed; Claude asks the viewer once to allow it.
//   2. Anywhere else: the helper's own Anthropic API key (Settings), sent only to Anthropic.
// Without either, the app works offline with its built-in planner and library.

import { CATEGORIES } from './library.js';
import { stepFromPicto, capitalise } from './parser.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.0.0/+esm';

// ---------------------------------------------------------------- backends

let claudeSample = null;      // the artifact `sample` function, when running inside Claude
let sampleImages = false;     // whether this view may send photos to Claude
export const aiStatus = { inClaude: false, ready: false };

// Resolves once we know whether we run inside Claude. Safe to call many times.
let detectPromise = null;
export function detectClaude() {
  if (!detectPromise) {
    detectPromise = (async () => {
      if (!window.claude || typeof window.claude.use !== 'function') return false;
      try {
        const s = await window.claude.use('sample');
        if (!s) return false;
        claudeSample = s;
        const limits = await s.limits().catch(() => null);
        sampleImages = !!limits?.images;
        aiStatus.inClaude = true;
        return true;
      } catch { return false; }
    })();
  }
  return detectPromise;
}

export function aiAvailable(settings) {
  if (aiStatus.inClaude) return settings.useClaude !== false;
  return !!(settings.aiEnabled && settings.aiKey);
}
export function canSendPhotos(settings) {
  return aiStatus.inClaude ? sampleImages : aiAvailable(settings);
}

let sdkPromise = null;
function loadSdk() {
  if (!sdkPromise) sdkPromise = import(SDK_URL).then(m => m.default || m.Anthropic).catch(e => { sdkPromise = null; throw e; });
  return sdkPromise;
}

// Friendly message for any failure from either backend.
export function aiErrorMessage(e) {
  const code = e?.code;
  if (code === 'not_granted') return 'Claude was not allowed for this page. You can allow it from the page’s Permissions menu.';
  if (code === 'rate_limited') return 'Claude is busy or your usage limit is reached. Try again in a little while.';
  if (code === 'session_expired') return 'Please sign in to Claude again.';
  if (code === 'refused') return 'Claude declined this request.';
  if (code === 'sampling_disabled') return 'Claude is not available for this account.';
  if (e?.status === 401) return 'The API key was not accepted. Check it in Settings.';
  return e?.message || 'Something went wrong with the AI.';
}

/**
 * One request to Claude.
 *   prompt   full instructions + data (string)
 *   system   optional standing instructions (API key path; folded into the prompt inside Claude)
 *   schema   JSON schema for a JSON answer (API key path enforces it; inside Claude it is described in the prompt)
 *   image    optional { blob, base64, mediaType }
 *   raw      true = return plain text instead of JSON
 */
async function ask({ prompt, system = '', schema = null, image = null, raw = false, heavy = false }, settings) {
  await detectClaude();
  if (claudeSample) {
    const input = (system ? system + '\n\n---\n\n' : '') + prompt;
    // Drawing benefits from the most capable model; questions and plans are fine on the default one.
    const opts = { modelTier: heavy && settings.drawQuality === 'best' ? 'complex' : 'default', cache: false };
    if (image && sampleImages) opts.images = [image.blob];
    if (raw) return (await claudeSample(input, opts)).text;
    return claudeSample.json(input, opts);
  }

  if (!settings.aiKey) throw new Error('Add your Anthropic API key in Settings, or open the app inside Claude.');
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey: settings.aiKey, dangerouslyAllowBrowser: true });
  const model = settings.aiModel || 'claude-opus-5-5';
  const content = image
    ? [{ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } }, { type: 'text', text: prompt }]
    : prompt;
  const params = {
    model,
    max_tokens: 16000,
    ...(system ? { system } : {}),
    output_config: { effort: 'low', ...(schema && !raw ? { format: { type: 'json_schema', schema } } : {}) },
    messages: [{ role: 'user', content }],
  };
  const response = model.startsWith('claude-haiku')
    ? await client.messages.create(params)
    // If a safety classifier declines the request, the API retries it on a suitable fallback model.
    : await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });

  if (response.stop_reason === 'refusal') throw Object.assign(new Error('The AI declined this request.'), { code: 'refused' });
  if (response.stop_reason === 'max_tokens') throw new Error('The AI answer was too long.');
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('The AI returned nothing.');
  return raw ? textBlock.text : JSON.parse(textBlock.text);
}

function regionLine(settings) {
  return settings.region
    ? `The person lives in ${settings.region}. Food, buildings, vehicles, clothes and everyday objects must look the way they do there.`
    : 'Use a neutral, international everyday look. Avoid American-specific items unless they are asked for.';
}

const CONTEXT = `The app makes visual schedules of pictograms for a person who relies on pictures to understand what will happen. Many users are children or adults with autism, intellectual disability or communication needs. A carer describes the day out loud (dictation, so expect missing punctuation and small recognition errors).`;

// ---------------------------------------------------------------- 1. questions

const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
        },
        required: ['question', 'options'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

export async function askQuestions(text, settings) {
  const prompt = `${CONTEXT}

The carer said:
"""${text}"""

Before the pictograms are made, ask the carer up to 4 short clarifying questions, but ONLY where the answer changes what the pictograms should show or their order. Good reasons: what exactly will be eaten (so the food picture is right), where something happens, who is there, how they travel, an unclear order, a vague word ("we do something fun"), or an activity that may be misheard. Do not ask about things that are already clear. If everything is clear, return an empty list.

Each question: one short sentence, plus 2-4 likely short answers the carer can tap. Write in the same language the carer used. ${regionLine(settings)}

Reply with only JSON: {"questions": [{"question": "...", "options": ["...", "..."]}]}`;
  const data = await ask({ prompt, schema: QUESTIONS_SCHEMA }, settings);
  return (data?.questions || [])
    .filter(q => q && typeof q.question === 'string' && q.question.trim())
    .slice(0, 4)
    .map(q => ({ question: q.question.trim(), options: (Array.isArray(q.options) ? q.options : []).map(String).filter(Boolean).slice(0, 4) }));
}

// ---------------------------------------------------------------- 2. planning

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pictoId: { type: 'string', description: 'id of the best matching pictogram from the library, or "" if none fits well' },
          label: { type: 'string', description: '1-3 word caption for the card' },
          detail: { type: 'string', description: 'optional short extra detail, e.g. "with Grandma", or ""' },
          speech: { type: 'string', description: 'short, friendly sentence read aloud to the person' },
          time: { type: 'string', description: '24h time "HH:MM" if one was given, otherwise ""' },
          emoji: { type: 'string', description: 'one emoji that shows the activity (used if pictoId is "")' },
          category: { type: 'string', enum: CATEGORIES.map(c => c.id) },
        },
        required: ['pictoId', 'label', 'detail', 'speech', 'time', 'emoji', 'category'],
        additionalProperties: false,
      },
    },
  },
  required: ['steps'],
  additionalProperties: false,
};

export async function planWithAI(text, pictograms, settings, answers = []) {
  const lib = pictograms.map(p => `${p.id} | ${p.label} | ${p.category}`).join('\n');
  const qa = answers.filter(a => a.answer).map(a => `- ${a.question} → ${a.answer}`).join('\n');
  const prompt = `${CONTEXT}${settings.personName ? ` The person's name is ${settings.personName}.` : ''}

The carer said:
"""${text}"""
${qa ? `\nThe carer's answers to clarifying questions:\n${qa}\n` : ''}
Turn this into the schedule.

Rules:
- One step per concrete activity, in the order they will actually happen (re-order "before"/"after" phrases accordingly). Use the answers above to make steps specific.
- Do not invent activities that were not mentioned. Ignore filler words and dictation errors.
- Use a library pictogram only when it really shows the same thing. If the activity is more specific (e.g. "rye bread with liver pâté" vs a generic "sandwich"), leave pictoId "" so a specific picture can be drawn. Pictograms whose ids start with "c" were made by the family; prefer them when they match.
- label: 1-3 plain, concrete words in the language of the description.
- speech: one short, calm, concrete sentence spoken to the person, e.g. "Time to brush your teeth." Same language as the description.
- detail: only meaningful extra information (who, where); otherwise "".
- time: only if a time was stated, as 24h "HH:MM". Without am/pm use common sense for a day plan (e.g. "at 3" = 15:00).
- category: one of ${CATEGORIES.map(c => c.id).join(', ')}.
- ${regionLine(settings)}

Pictogram library (id | label | category):
${lib}

Reply with only JSON: {"steps": [{"pictoId": "", "label": "", "detail": "", "speech": "", "time": "", "emoji": "", "category": ""}]}`;
  const data = await ask({ prompt, schema: PLAN_SCHEMA }, settings);

  const byId = new Map(pictograms.map(p => [p.id, p]));
  const cats = new Set(CATEGORIES.map(c => c.id));
  return (data?.steps || []).filter(s => s && s.label).map(s => {
    const picto = s.pictoId ? byId.get(s.pictoId) : null;
    const time = /^\d{2}:\d{2}$/.test(s.time || '') ? s.time : null;
    if (picto) {
      return stepFromPicto(picto, { time, label: s.label || picto.label, detail: s.detail || '', speech: s.speech || picto.speech });
    }
    return stepFromPicto(null, {
      label: capitalise(String(s.label)),
      detail: s.detail || '',
      speech: s.speech || s.label,
      time,
      category: cats.has(s.category) ? s.category : 'other',
      image: { type: 'emoji', value: s.emoji || '⭐' },
      needsPicture: false,
    });
  });
}

// ---------------------------------------------------------------- 3. drawing

// A fixed style guide keeps every drawn pictogram looking like part of one set.
const STYLE_GUIDE = `You draw pictograms (AAC symbols) as SVG for people who rely on pictures to understand their day: children and adults with autism, intellectual disability or communication needs. Clarity matters more than detail.

House style. Follow it exactly so that all pictograms look like one consistent set:
- Root element: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">. No width/height attributes.
- Transparent background. No background rectangle and no frame. The app adds the card.
- Flat colours only. No gradients, shadows, filters, patterns, opacity tricks, text, letters, numbers or emoji.
- Every shape has the same dark outline: stroke="#2b2b2b" stroke-width="5" stroke-linejoin="round" stroke-linecap="round".
- Palette: skin #f5c9a0, #d9a074, #a86b45 or #6b4429 (vary skin tones across pictures); hair #5a3a22 or #e2b04a; clothes blue #4a90d9, orange #e8801e, green #2f9e55, pink #d6478c, yellow #f2c94c; wood #b07a45; metal/grey #b8c0cc; white #ffffff; water #7cc6f0; food in its natural colours.
- People: round head (circle radius about 22), simple rounded body, arms and legs as thick rounded lines, friendly face with two dot eyes and a small smile. No fingers, no fine detail.
- One clear idea. Large and centred, using about 80% of the canvas, with at most 3-4 objects. It must still be recognisable at 60x60 pixels.
- For an action, show a person doing it (a person brushing their teeth, not only a toothbrush).
- Keep each SVG compact (under 3500 characters). Use only path, circle, ellipse, rect, line, polyline, polygon and g.
- Never use <script>, <style>, <image>, <foreignObject>, <a>, <use>, event attributes or external references.`;

const VARIANTS = [
  'A person doing the activity (the action clearly visible).',
  'The key object, food or thing close up, large and simple.',
  'The place or a simple scene where it happens, with a small person.',
  'A different, even simpler version of the person doing it.',
];

/**
 * Draw pictograms for a step. With `photo` ({ blob, base64, mediaType }) Claude
 * looks at the real thing and draws a cartoon version of it in the house style.
 */
export async function drawPictograms(step, settings, count = 3, photo = null) {
  const what = [step.label, step.detail && step.detail.toLowerCase() !== String(step.label).toLowerCase() ? step.detail : '', step.speech]
    .filter(Boolean).join(' | ');
  const task = photo
    ? `The attached photo shows the real ${what ? `"${what}"` : 'thing'} from the person's own life. Draw ${count} pictograms of exactly this, as a simplified cartoon in the house style. Keep what makes it recognisable to the person: its colours, shape and distinctive details (for a person: hair colour and style, glasses, typical clothes; for a place: its colour and shape). Leave out background clutter. Make the versions differ a little (closer / simpler / with a small person using it).`
    : `Draw ${count} different pictograms for this activity: "${what}"\n\nMake each one a different kind of picture:\n${VARIANTS.slice(0, count).map((v, i) => `${i + 1}. ${v}`).join('\n')}`;
  const prompt = `${task}\n\n${regionLine(settings)}\n\nReply with only the ${count} SVG documents, one after another, nothing else.`;
  const text = await ask({ prompt, system: STYLE_GUIDE, image: photo, raw: true, heavy: true }, settings);
  return extractSvgs(text).slice(0, count)
    .map(svg => ({ type: 'svg', value: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), source: photo ? 'photo-ai' : 'ai' }));
}

export function extractSvgs(text) {
  const found = String(text || '').match(/<svg[\s\S]*?<\/svg>/gi) || [];
  return found.map(sanitizeSvg).filter(Boolean);
}

// Keep only safe, simple SVG. The app also shows SVGs through <img>, which never runs scripts.
const ALLOWED_TAGS = new Set(['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon']);
export function sanitizeSvg(svg) {
  if (typeof svg !== 'string') return null;
  const start = svg.indexOf('<svg');
  const end = svg.lastIndexOf('</svg>');
  if (start < 0 || end < 0) return null;
  let s = svg.slice(start, end + 6);
  // Remove disallowed elements entirely (with content), then any remaining unknown tags.
  s = s.replace(/<(script|style|foreignObject|image|a|use|iframe|object|embed)[\s\S]*?(<\/\1>|\/>)/gi, '');
  s = s.replace(/<\/?([a-zA-Z][\w:-]*)[^>]*>/g, (tag, name) => (ALLOWED_TAGS.has(name.toLowerCase()) ? tag : ''));
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');
  s = s.replace(/\s(xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi, '');
  s = s.replace(/url\([^)]*\)/gi, 'none');
  if (!/viewBox/.test(s)) s = s.replace('<svg', '<svg viewBox="0 0 200 200"');
  if (!/xmlns=/.test(s)) s = s.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  return s.length > 200 ? s : null;
}

// Turn a data URL (from the camera) into what both backends need.
export async function photoForAI(dataUrl) {
  const [head, base64] = dataUrl.split(',');
  const mediaType = (head.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return { blob: new Blob([bytes], { type: mediaType }), base64, mediaType };
}
