// Optional AI features using Claude:
//   1. planWithAI      - turns a free description of the day into steps
//   2. drawPictograms  - draws new pictograms (SVG) for one step, in a fixed house style
//
// The helper pastes their own Anthropic API key in Settings; it is stored only
// on this device and sent only to Anthropic. Without a key the app works
// offline with the built-in planner and library.

import { CATEGORIES } from './library.js';
import { stepFromPicto, capitalise } from './parser.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.0.0/+esm';

let sdkPromise = null;
function loadSdk() {
  if (!sdkPromise) sdkPromise = import(SDK_URL).then(m => m.default || m.Anthropic).catch(e => { sdkPromise = null; throw e; });
  return sdkPromise;
}

async function callClaude(params, settings) {
  if (!settings.aiKey) throw new Error('Add your Anthropic API key in Settings to use AI.');
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey: settings.aiKey, dangerouslyAllowBrowser: true });
  const model = settings.aiModel || 'claude-opus-5-5';
  const full = { model, ...params };
  const response = model.startsWith('claude-haiku')
    ? await client.messages.create(full)
    // If a safety classifier declines the request, the API retries it on a suitable fallback model.
    : await client.beta.messages.create({ ...full, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });

  if (response.stop_reason === 'refusal') throw new Error('The AI declined this request.');
  if (response.stop_reason === 'max_tokens') throw new Error('The AI answer was too long.');
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('The AI returned nothing.');
  return JSON.parse(textBlock.text);
}

function regionLine(settings) {
  return settings.region
    ? `The person lives in ${settings.region}. Food, buildings, vehicles, clothes and everyday objects must look the way they do there.`
    : 'Use a neutral, international everyday look. Avoid American-specific items unless they are asked for.';
}

// ---------------------------------------------------------------- planning

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

function planSystemPrompt(pictograms, settings) {
  const lib = pictograms.map(p => `${p.id} | ${p.label} | ${p.category}`).join('\n');
  return `You turn a carer's quick spoken description of a day (or part of a day) into a visual schedule of pictograms for a person who relies on pictograms to understand what will happen${settings.personName ? ` (their name is ${settings.personName})` : ''}. Many users are children or adults with autism, intellectual disability or communication needs.

Rules:
- One step per concrete activity, in the order they will actually happen (re-order "before"/"after" phrases accordingly).
- Do not invent activities that were not mentioned. Ignore filler words and false starts from dictation.
- Use a library pictogram only when it really shows the same thing. If the activity is more specific (e.g. "rye bread with liver pâté" vs a generic "sandwich"), leave pictoId "" so a specific picture can be drawn. Pictograms whose ids start with "c" were made by the family; they are the most familiar, so prefer them when they match.
- label: 1-3 plain, concrete words in the language of the description.
- speech: one short, calm, concrete sentence spoken to the person, e.g. "Time to brush your teeth." Same language as the description.
- detail: only meaningful extra information (who, where); otherwise "".
- time: only if a time was stated, as 24h "HH:MM". Without am/pm use common sense for a day plan (e.g. "at 3" = 15:00).
- ${regionLine(settings)}

Pictogram library (id | label | category):
${lib}`;
}

export async function planWithAI(text, pictograms, settings) {
  const data = await callClaude({
    max_tokens: 8000,
    system: planSystemPrompt(pictograms, settings),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: PLAN_SCHEMA } },
    messages: [{ role: 'user', content: text }],
  }, settings);

  const byId = new Map(pictograms.map(p => [p.id, p]));
  return (data.steps || []).map(s => {
    const picto = s.pictoId ? byId.get(s.pictoId) : null;
    const time = /^\d{2}:\d{2}$/.test(s.time || '') ? s.time : null;
    if (picto) {
      return stepFromPicto(picto, { time, label: s.label || picto.label, detail: s.detail || '', speech: s.speech || picto.speech });
    }
    return stepFromPicto(null, {
      label: capitalise(s.label || 'Activity'),
      detail: s.detail || '',
      speech: s.speech || s.label,
      time,
      category: s.category || 'other',
      image: { type: 'emoji', value: s.emoji || '⭐' },
      needsPicture: false,
    });
  });
}

// ---------------------------------------------------------------- drawing

const DRAW_SCHEMA = {
  type: 'object',
  properties: {
    pictograms: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          idea: { type: 'string', description: 'one short sentence: what this picture shows' },
          svg: { type: 'string', description: 'the complete SVG document' },
        },
        required: ['idea', 'svg'],
        additionalProperties: false,
      },
    },
  },
  required: ['pictograms'],
  additionalProperties: false,
};

// A fixed style guide keeps every drawn pictogram looking like part of one set.
const STYLE_GUIDE = `You draw pictograms (AAC symbols) as SVG for people who rely on pictures to understand their day: children and adults with autism, intellectual disability or communication needs. Clarity matters more than detail.

House style. Follow it exactly so that all pictograms look like one consistent set:
- Root element: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">. No width/height attributes.
- Transparent background. No background rectangle and no frame. The app adds the card.
- Flat colours only. No gradients, shadows, filters, patterns, opacity tricks, text, letters, numbers or emoji.
- Every shape has the same dark outline: stroke="#2b2b2b" stroke-width="5" stroke-linejoin="round" stroke-linecap="round".
- Palette: skin #f5c9a0, #d9a074, #a86b45 or #6b4429 (vary skin tones across pictures); hair #5a3a22 or #e2b04a; clothes blue #4a90d9, orange #e8801e, green #2f9e55, pink #d6478c, yellow #f2c94c; wood #b07a45; metal/grey #b8c0cc; white #ffffff; water #7cc6f0; food in its natural colours.
- People: round head (circle radius about 22), simple rounded body, arms and legs as thick rounded lines (stroke-width 12 in the clothing or skin colour, plus the outline), friendly face with two dot eyes and a small smile. No fingers, no fine detail.
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

export async function drawPictograms(step, settings, count = 3) {
  const what = [step.label, step.detail && step.detail.toLowerCase() !== step.label.toLowerCase() ? step.detail : '', step.speech]
    .filter(Boolean).join(' | ');
  const variants = VARIANTS.slice(0, count).map((v, i) => `${i + 1}. ${v}`).join('\n');
  const data = await callClaude({
    max_tokens: 16000,
    system: `${STYLE_GUIDE}\n- ${regionLine(settings)}`,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: DRAW_SCHEMA } },
    messages: [{
      role: 'user',
      content: `Draw ${count} different pictograms for this activity: "${what}"\n\nMake each one a different kind of picture:\n${variants}`,
    }],
  }, settings);

  return (data.pictograms || [])
    .map(p => sanitizeSvg(p.svg))
    .filter(Boolean)
    .slice(0, count)
    .map(svg => ({ type: 'svg', value: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), source: 'ai' }));
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
