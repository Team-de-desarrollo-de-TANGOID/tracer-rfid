/**
 * One clear beep when a tag is successfully loaded into the alta list.
 * Hardware R3 buzzer stays OFF (setBeep(0)) to avoid continuous noise.
 */

let audioCtx: AudioContext | null = null;
let unlocked = false;

type RacketClubApi = { isElectron?: boolean; beep?: () => void };

function getRacketApi(): RacketClubApi | undefined {
  return (window as unknown as { racketClub?: RacketClubApi }).racketClub;
}

function getCtx(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    return audioCtx;
  } catch {
    return null;
  }
}

/** Call once on user gesture (click/keydown) so Web Audio is allowed. */
export function unlockTagBeep(): void {
  unlocked = true;
  const ctx = getCtx();
  if (ctx?.state === 'suspended') void ctx.resume();
  // Prime Electron / OS beep path too.
  try {
    getRacketApi()?.beep?.();
  } catch {
    /* ignore */
  }
}

function playWebBeep(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();

  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, t0);
  // Audible but short — one confirmation chirp.
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.22, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.15);
}

/**
 * Exactly one confirmation beep when a NEW tag was added to the program list.
 */
export function playTagLoadedBeep(): void {
  try {
    // Prefer system beep in Electron (always works), plus Web Audio.
    getRacketApi()?.beep?.();
  } catch {
    /* ignore */
  }
  try {
    playWebBeep();
  } catch {
    /* ignore */
  }
}

/** @deprecated use playTagLoadedBeep */
export function playTagBeep(): void {
  playTagLoadedBeep();
}

/** @deprecated use playTagLoadedBeep — kept for compatibility */
export function playTagBeepThrottled(): void {
  playTagLoadedBeep();
}
