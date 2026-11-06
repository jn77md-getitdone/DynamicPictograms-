// Turns a quick description of the day into an ordered list of steps.
//
//   "Breakfast, brush teeth, then bus to school at 8. After school swimming
//    with grandma, dinner, bath and bed"
//
// becomes Breakfast -> Brush teeth -> Bus (08:00) -> Swimming -> Dinner -> Bath -> Bed.
//
// Works fully offline, without AI. Pure functions so they can be unit-tested.

const STOP = new Set(('a an the to of for with and or in on at by my your our his her their ' +
  'og i på til med en et den det de så skal vi du kl klokken spise ' +
  'some it is are be will we you i he she they then go going get have has do does time now ' +
  'next later after before up off out into from this that there please also just eat drink watch take ' +
  'put wear use see some').split(' '));

// Phrases stripped from the start of a step ("we will go swimming" -> "go swimming")
const LEAD_FILLERS = [
  'and then', 'after that', 'afterwards', 'then', 'and', 'next', 'later', 'finally', 'first', 'firstly',
  'lastly', 'also', 'today', 'this morning', 'this afternoon', 'this evening', 'tonight', 'in the morning',
  'in the afternoon', 'in the evening', 'we are going to', "we're going to", 'we will', "we'll",
  'you are going to', "you're going to", 'you will', "you'll", 'he will', 'she will', 'they will',
  'he is going to', 'she is going to', 'is going to', 'are going to', 'going to', 'gonna',
  'i will', "i'll", 'we', 'you', 'it is time to', "it's time to", 'time to', 'time for', 'have to',
  'need to', 'must', 'can', 'should', 'please',
  // Danish
  'og så', 'så skal vi', 'så skal du', 'så skal', 'så', 'og', 'bagefter', 'derefter', 'efter det', 'til sidst', 'først',
  'vi skal', 'du skal', 'hun skal', 'han skal', 'skal', 'i dag', 'i morgen', 'om morgenen', 'om eftermiddagen', 'om aftenen',
];

export function stem(word) {
  let w = word.toLowerCase().replace(/[’']s$/, '').replace(/[’']/g, '');
  const undouble = s => (/([b-df-hj-np-tv-z])\1$/.test(s) && !/(ss|ll)$/.test(s) ? s.slice(0, -1) : s);
  if (w.length > 4 && w.endsWith('ing')) w = undouble(w.slice(0, -3));
  else if (w.length > 4 && w.endsWith('ed')) w = undouble(w.slice(0, -2));
  else if (w.length > 3 && w.endsWith('es')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

export function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}’']+/gu) || []).map(t => t.replace(/^[’']+|[’']+$/g, '')).filter(Boolean);
}

function withLabel(p) {
  const kws = p.keywords || [];
  const plain = kws.map(k => k.replace(/^~/, '').toLowerCase());
  return p.label && !plain.includes(p.label.toLowerCase()) ? kws.concat([p.label]) : kws;
}

// Transport and people are usually the "how" or "with whom", not the activity:
// "car to the dentist" -> Dentist, "swimming with grandma" -> Swimming.
const SECONDARY = new Set(['transport', 'family', 'others']);

// Prepare pictograms once for fast matching.
export function buildIndex(pictograms) {
  return pictograms.map(p => ({
    picto: p,
    keys: withLabel(p).map(k => {
      const weak = k.startsWith('~');
      const stems = tokenize(weak ? k.slice(1) : k).map(stem);
      return { weak, stems };
    }).filter(k => k.stems.length),
  }));
}

// Score one chunk of text against the index. Returns best { picto, score, pos } or null.
export function matchChunk(text, index) {
  const stems = tokenize(text).map(stem);
  if (!stems.length) return null;
  let best = null;
  for (const entry of index) {
    for (const key of entry.keys) {
      const positions = key.stems.map(s => stems.indexOf(s));
      if (positions.some(p => p < 0)) continue;
      const contiguous = positions.every((p, i) => i === 0 || p === positions[i - 1] + 1);
      let score = key.weak ? key.stems.length : key.stems.length * 2 + (contiguous ? 1 : 0);
      if (!key.weak && SECONDARY.has(entry.picto.subcategory) && !entry.picto.custom) score -= 0.75;
      if (entry.picto.custom) score += 0.5; // the family's own pictograms win ties
      const pos = Math.min(...positions);
      if (!best || score > best.score || (score === best.score && pos < best.pos)) {
        best = { picto: entry.picto, score, pos, keyStems: key.stems };
      }
    }
  }
  return best;
}

// The best few different pictograms for a phrase, best first.
export function rankMatches(text, index, n = 3) {
  const results = [];
  for (const entry of index) {
    const m = matchChunk(text, [entry]);
    if (m) results.push(m);
  }
  results.sort((a, b) => b.score - a.score || a.pos - b.pos);
  const seen = new Set();
  return results.filter(r => {
    const k = r.picto.image.value;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  }).slice(0, n).map(r => r.picto);
}

function pad(n) { return String(n).padStart(2, '0'); }

// Finds a clock time in the text. Returns { time: 'HH:MM', rest } or { time: null, rest }.
export function extractTime(text) {
  let rest = text;
  let time = null;
  const named = rest.match(/\b(?:at\s+)?(noon|midday|midnight)\b/i);
  if (named) {
    time = named[1].toLowerCase() === 'midnight' ? '00:00' : '12:00';
    rest = rest.replace(named[0], ' ');
  } else {
    const re = /\b(?:at|by|around|from|klokken|kl\.?|@)?\s*(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?|o'?clock)?(?=\W|$)/ig;
    let m;
    while ((m = re.exec(rest))) {
      const hasPrefix = /^(at|by|around|from|klokken|kl|@)/i.test(m[0].trim());
      const hasSuffix = !!m[3];
      const hasMinutes = m[2] !== undefined;
      if (!hasPrefix && !hasSuffix && !hasMinutes) continue; // a bare number like "2 books"
      let h = parseInt(m[1], 10);
      const min = hasMinutes ? parseInt(m[2], 10) : 0;
      if (h > 23 || min > 59) continue;
      const suffix = (m[3] || '').toLowerCase().replace(/\./g, '');
      if (suffix === 'pm' && h < 12) h += 12;
      else if (suffix === 'am' && h === 12) h = 0;
      else if (!suffix.startsWith('a') && !suffix.startsWith('p') && h >= 1 && h <= 6) h += 12; // "at 3" in a day plan means 15:00
      if (/\b(afternoon|evening|tonight)\b/i.test(text) && h < 12 && !suffix.startsWith('a')) h += 12;
      time = `${pad(h)}:${pad(min)}`;
      rest = rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length);
      break;
    }
  }
  rest = rest.replace(/\b(in the (morning|afternoon|evening)|this (morning|afternoon|evening)|tonight)\b/ig, ' ');
  return { time, rest: rest.replace(/\s+/g, ' ').trim() };
}

export function cleanPhrase(text) {
  let t = ' ' + text.toLowerCase().replace(/[“”"]/g, '').replace(/\s+/g, ' ').trim() + ' ';
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of LEAD_FILLERS) {
      if (t.startsWith(' ' + f + ' ')) { t = t.slice(f.length + 1); changed = true; }
    }
  }
  t = t.trim().replace(/[\s,.;:!?-]+$/, '');
  return t;
}

export function capitalise(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

// Split the whole description into raw chunks, in the order they will happen.
export function splitIntoChunks(text) {
  const sentences = text
    .replace(/\r/g, '')
    .split(/\n+|[.!?;]+(?=\s|$)|•|•/)
    .map(s => s.trim()).filter(Boolean);

  const chunks = [];
  for (const sentence of sentences) {
    // Leading clause with a comma:
    //   "before dinner, wash hands" -> wash hands, dinner
    //   "after school, swimming"    -> (school), swimming
    let m = sentence.match(/^before\s+([^,]+),\s*(.+)$/i);
    if (m) { chunks.push(...splitPart(m[2]), ...splitPart(m[1])); continue; }
    let s = sentence;
    m = s.match(/^after\s+(?!that\b)([^,]+?),\s*(.+)$/i);
    if (!m || m[1].split(' ').length > 3) m = s.match(/^after\s+(?!that\b)(\S+)\s+(.+)$/i);
    if (m) {
      chunks.push({ text: m[1], context: true }); // may already be in the plan; deduplicated later
      s = m[2];
    }
    chunks.push(...splitPart(s));
  }
  return chunks;
}

// Split on "then", commas, etc. and handle "A before B" / "A after B" inside each part.
function splitPart(s) {
  const parts = s.split(/,|\band then\b|\bthen\b|\bafter that\b|\bafterwards\b|\bnext\b|\bfollowed by\b|\bfinally\b|\blater\b|\bog så\b|\bbagefter\b|\bderefter\b|\befter det\b|(?:^|\s)så(?=\s)/i)
    .map(x => x.trim()).filter(x => x && /[a-z0-9]/i.test(x));
  const out = [];
  for (const p of parts) {
    let m = p.match(/^(.+?)\s+before\s+(.+)$/i);
    if (m) { out.push({ text: m[1] }, { text: m[2] }); continue; }
    m = p.match(/^(.+?)\s+after\s+(.+)$/i);
    if (m && m[2].split(' ').length <= 3) { out.push({ text: m[2], context: true }, { text: m[1] }); continue; }
    out.push({ text: p });
  }
  return out;
}

let idCounter = 0;
export function newId(prefix = 's') {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function stepFromPicto(picto, extra = {}) {
  return {
    id: newId(),
    pictoId: picto ? picto.id : null,
    label: picto ? picto.label : '',
    detail: '',
    speech: picto ? (picto.speech || picto.label) : '',
    image: picto ? { ...picto.image } : { type: 'emoji', value: '⭐' },
    category: picto ? picto.category : 'other',
    time: null,
    done: false,
    needsPicture: !picto,
    ...extra,
  };
}

// Main entry point: description text -> steps.
export function parsePlan(text, pictograms) {
  const index = buildIndex(pictograms);
  const steps = [];
  const pushStep = (step, isContext) => {
    if (isContext && steps.some(s => s.pictoId && s.pictoId === step.pictoId)) return;
    steps.push(step);
  };

  for (const chunk of splitIntoChunks(text)) {
    const { time, rest } = extractTime(chunk.text);
    const cleaned = cleanPhrase(rest);
    if (!cleaned || !tokenize(cleaned).some(t => !STOP.has(t))) continue;

    // "bath and bed" -> two steps, but only if each half is a known activity
    const halves = cleaned.split(/\s+(?:and|og|&|\+)\s+/);
    if (halves.length > 1) {
      const matches = halves.map(h => matchChunk(h, index));
      const distinct = new Set(matches.map(m => m && m.picto.id));
      if (matches.every(Boolean) && distinct.size === halves.length) {
        halves.forEach((h, i) => pushStep(makeStep(h, matches[i], i === 0 ? time : null), chunk.context));
        continue;
      }
    }
    pushStep(makeStep(cleaned, matchChunk(cleaned, index), time), chunk.context);
  }
  return steps;
}

function makeStep(phrase, match, time) {
  if (!match) {
    return stepFromPicto(null, { label: capitalise(phrase), speech: capitalise(phrase), time, needsPicture: true });
  }
  // Keep the library label (so the same activity always looks the same), and
  // keep any extra words ("with grandma") as a detail line and in the speech.
  const extra = tokenize(phrase).filter(t => !STOP.has(t) && !match.keyStems.includes(stem(t)));
  const hasDetail = extra.length > 0;
  return stepFromPicto(match.picto, {
    time,
    detail: hasDetail ? capitalise(phrase) : '',
    speech: hasDetail ? capitalise(phrase) : (match.picto.speech || match.picto.label),
  });
}
