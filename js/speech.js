// Text-to-speech (reading pictograms aloud) and speech-to-text (the helper
// describing the day). Both use the browser's built-in speech engines.
//
// Dictation is unreliable on some devices (iPad home-screen apps, pages shown
// inside another app, Siri/dictation turned off). So `listen` never trusts the
// engine to report back: Stop always finishes at once, and a watchdog ends a
// session that hears nothing, so the app can offer keyboard dictation instead
// (the 🎤 key on the iPhone/iPad keyboard works everywhere).

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
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
let inFrame = false;
try { inFrame = window.self !== window.top; } catch { inFrame = true; }

export function canListen() { return !!Recognition; }

// Where built-in dictation is known to be unreliable, go straight to keyboard dictation.
export function preferKeyboardDictation() {
  return !Recognition || (isIOS && isStandalone) || inFrame;
}

/**
 * Starts listening. Callbacks:
 *   onText(fullText)          live transcript so far
 *   onEnd({ text, reason })   exactly once; reason: 'stopped' | 'ended' | 'silent' | 'error'
 *   onError(message)          before onEnd when something went wrong
 * Returns stop(): finishes immediately with whatever was heard.
 */
export function listen({ lang = 'en-GB', onText, onEnd, onError, silenceMs = 7000 }) {
  let finished = false;
  let finalText = '';
  let interim = '';
  let heardAnything = false;
  let userStopped = false;
  let rec = null;
  let watchdog = null;

  const text = () => (finalText + ' ' + interim).replace(/\s+/g, ' ').trim();
  const finish = reason => {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    try { rec && rec.abort(); } catch { /* already stopped */ }
    onEnd?.({ text: text(), reason });
  };
  const armWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => finish(heardAnything ? 'ended' : 'silent'), heardAnything ? silenceMs * 2 : silenceMs);
  };

  if (!Recognition) {
    setTimeout(() => { onError?.('unsupported'); finish('error'); });
    return () => finish('stopped');
  }

  const start = () => {
    rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = true;
    // iOS handles one utterance at a time better; we restart it until the user taps Stop.
    rec.continuous = !isIOS;
    rec.onresult = e => {
      heardAnything = true;
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += (finalText ? ' ' : '') + r[0].transcript.trim();
        else interim += r[0].transcript;
      }
      armWatchdog();
      onText?.(text());
    };
    rec.onerror = e => {
      if (e.error === 'no-speech' || e.error === 'aborted') return; // onend follows
      onError?.(e.error || 'error');
      finish('error');
    };
    rec.onend = () => {
      if (finished) return;
      if (userStopped) return finish('stopped');
      // The engine stopped by itself (a pause). Keep listening until the user taps Stop.
      if (finalText || interim) { finalText = text(); interim = ''; }
      try { start(); } catch { finish('ended'); }
    };
    rec.start();
  };

  try { start(); armWatchdog(); }
  catch (e) { setTimeout(() => { onError?.(e.message || 'error'); finish('error'); }); }

  return () => {
    userStopped = true;
    try { rec && rec.stop(); } catch { /* ignore */ }
    // Do not wait for the engine: some never report back.
    setTimeout(() => finish('stopped'), 600);
  };
}
