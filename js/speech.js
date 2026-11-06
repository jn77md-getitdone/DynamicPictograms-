// Text-to-speech (reading pictograms aloud) and speech-to-text (the helper
// describing the day). Both use the browser's built-in speech engines, which
// work on iPhone/iPad (Safari) and Android (Chrome), mostly offline.

let voices = [];
function loadVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = window.speechSynthesis.getVoices();
}
if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export function canSpeak() { return 'speechSynthesis' in window; }

export function getVoices() { loadVoices(); return voices; }

export function speak(text, settings = {}) {
  if (!canSpeak() || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // a new tap interrupts the previous sentence
  const u = new SpeechSynthesisUtterance(text);
  const voice = voices.find(v => v.voiceURI === settings.voiceURI);
  if (voice) { u.voice = voice; u.lang = voice.lang; }
  else if (settings.speechLang) u.lang = settings.speechLang;
  u.rate = settings.speechRate || 0.9;
  u.pitch = 1;
  synth.speak(u);
}

export function stopSpeaking() { if (canSpeak()) window.speechSynthesis.cancel(); }

// ---- Dictation ----
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
export function canListen() { return !!Recognition; }

// Starts listening; calls onText(fullText, isFinal). Returns a stop() function.
export function listen({ lang = 'en-GB', onText, onEnd, onError }) {
  if (!Recognition) { onError?.(new Error('Dictation is not supported in this browser.')); return () => {}; }
  const rec = new Recognition();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = true;
  let finalText = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += (finalText ? ' ' : '') + r[0].transcript.trim();
      else interim += r[0].transcript;
    }
    onText?.((finalText + ' ' + interim).trim(), !interim);
  };
  rec.onerror = e => onError?.(new Error(e.error || 'Dictation error'));
  rec.onend = () => onEnd?.(finalText);
  try { rec.start(); } catch (e) { onError?.(e); }
  return () => { try { rec.stop(); } catch { /* already stopped */ } };
}
