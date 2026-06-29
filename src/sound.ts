// Default macOS alert sound, used when no Error Sound URL is configured in admin.
const DEFAULT_ERROR_SOUND_URL =
  "https://froods.ca/~dschaub/AppleSounds/Sound%20Effects/Sosumi.wav";

// Configurable from the admin Settings tab (about.errorSoundUrl). Accepts .wav or .mp3.
let configuredUrl = "";
let audio: HTMLAudioElement | null = null;
let urlFailed = false;

export const setErrorSoundUrl = (url?: string) => {
  const next = (url || "").trim();
  if (next === configuredUrl) return;
  configuredUrl = next;
  audio = null; // rebuild with the new source on next play
  urlFailed = false;
};

// Synthesised fallback so there's always audible feedback even if the URL is unreachable.
const beep = () => {
  try {
    const AC: typeof AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    /* ignore */
  }
};

export const playErrorSound = () => {
  if (urlFailed) { beep(); return; }
  try {
    if (!audio) {
      audio = new Audio(configuredUrl || DEFAULT_ERROR_SOUND_URL);
      audio.volume = 0.6;
      audio.addEventListener("error", () => { urlFailed = true; });
    }
    audio.currentTime = 0;
    const p = audio.play();
    if (p && typeof p.catch === "function") p.catch(() => beep());
  } catch {
    beep();
  }
};
