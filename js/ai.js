// Optional AI planner using Claude. The helper pastes their own Anthropic API
// key in Settings; it is stored only on this device and sent only to Anthropic.
// Without a key, the app uses the offline planner in parser.js.

import { CATEGORIES } from './library.js';
import { stepFromPicto, capitalise } from './parser.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.0.0/+esm';

let sdkPromise = null;
function loadSdk() {
  if (!sdkPromise) sdkPromise = import(SDK_URL).then(m => m.default || m.Anthropic);
  return sdkPromise;
}

const SCHEMA = {
  type: 'object',
  properties: {
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pictoId: { type: 'string', description: 'id of the best matching pictogram from the library, or "" if none fits' },
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

function systemPrompt(pictograms, personName) {
  const lib = pictograms.map(p => `${p.id} | ${p.label} | ${p.category}`).join('\n');
  return `You turn a carer's quick description of a day (or part of a day) into a visual schedule of pictograms for a person who relies on pictograms to understand what will happen${personName ? ` (their name is ${personName})` : ''}. Many users are children or adults with autism, intellectual disability or communication needs.

Rules:
- One step per concrete activity, in the order they will actually happen (re-order "before"/"after" phrases accordingly).
- Do not invent activities that were not mentioned. Do not add steps for filler words.
- Prefer a pictogram from the library below whenever it reasonably fits, so the same activity always looks the same. Pictograms the family made themselves (ids starting with "c") are the most familiar, so prefer them when they match.
- label: 1-3 plain words, concrete, no punctuation.
- speech: one short, calm, concrete sentence spoken to the person, e.g. "Time to brush your teeth." or "We go swimming with Grandma.". Use the same language as the description.
- detail: only meaningful extra information (who, where); otherwise "".
- time: only if a time was stated, as 24h "HH:MM". If no am/pm is given, use common sense for a day plan (e.g. "at 3" = 15:00).

Pictogram library (id | label | category):
${lib}`;
}

export async function planWithAI(text, pictograms, settings) {
  if (!settings.aiKey) throw new Error('Add your Anthropic API key in Settings to use the AI planner.');
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey: settings.aiKey, dangerouslyAllowBrowser: true });
  const model = settings.aiModel || 'claude-opus-5-5';

  const params = {
    model,
    max_tokens: 8000,
    system: systemPrompt(pictograms, settings.personName),
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: text }],
  };

  let response;
  if (model.startsWith('claude-haiku')) {
    response = await client.messages.create(params);
  } else {
    // If the request is declined by a safety classifier, let the API retry it on a suitable fallback model.
    response = await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  }

  if (response.stop_reason === 'refusal') throw new Error('The AI could not make this plan. Try the offline planner instead.');
  if (response.stop_reason === 'max_tokens') throw new Error('The plan was too long for the AI. Try splitting it into parts.');
  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('The AI returned no plan.');
  const data = JSON.parse(textBlock.text);

  const byId = new Map(pictograms.map(p => [p.id, p]));
  return (data.steps || []).map(s => {
    const picto = s.pictoId ? byId.get(s.pictoId) : null;
    const time = /^\d{2}:\d{2}$/.test(s.time || '') ? s.time : null;
    if (picto) {
      return stepFromPicto(picto, {
        time,
        detail: s.detail || '',
        speech: s.speech || picto.speech,
      });
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
