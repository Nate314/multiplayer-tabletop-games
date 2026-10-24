import type { SoundName } from '../services/settings.ts';
import { getPreferences } from '../hooks/usePreferences.ts';
import { audible } from './sounds.ts';

let context: AudioContext | null = null;

// Browsers allow audio only after a click or key press, so the context is made then
export function unlockAudio(): void {
  if (typeof AudioContext === 'undefined') return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch {
    context = null;
  }
}

export function installAudioUnlock(target: Window): void {
  const events = ['pointerdown', 'keydown'];
  // The listeners stay, so a context the browser suspended later is revived by the next click or key press
  events.forEach(event => target.addEventListener(event, unlockAudio));
}

type Note = { at: number; length: number; hz: number; type: OscillatorType };

const NOTES: Partial<Record<SoundName, Note[]>> = {
  turn: [{ at: 0, length: 0.25, hz: 660, type: 'sine' }, { at: 0.15, length: 0.35, hz: 880, type: 'sine' }],
  move: [{ at: 0, length: 0.03, hz: 300, type: 'triangle' }],
  gameOver: [523, 659, 784, 1047].map((hz, i) => ({ at: i * 0.12, length: 0.2, hz, type: 'triangle' as const })),
  timer: [{ at: 0, length: 0.02, hz: 1000, type: 'square' }],
};

function tone(ctx: AudioContext, { at, length, hz, type }: Note, gain: number): void {
  const start = ctx.currentTime + at;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = hz;
  envelope.gain.setValueAtTime(gain, start);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(envelope).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + length);
}

// Six short noise bursts over 250 ms
function rattle(ctx: AudioContext, gain: number): void {
  for (let i = 0; i < 6; i++) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.03), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
    const source = ctx.createBufferSource();
    const envelope = ctx.createGain();
    envelope.gain.value = gain;
    source.buffer = buffer;
    source.connect(envelope).connect(ctx.destination);
    source.start(ctx.currentTime + i * 0.044);
  }
}

// Silently does nothing before the first click or key press, or without Web Audio; never throws into a render.
// A context the browser suspended or interrupted (Safari, iOS) is resumed first, and the sounds play once it runs.
export function playSounds(names: SoundName[]): void {
  const preferences = getPreferences();
  const heard = audible(names, preferences);
  if (!context || context.state === 'closed' || heard.length === 0) return;
  const ctx = context;
  if (ctx.state === 'running') {
    play(ctx, heard, preferences.volume);
    return;
  }
  try {
    void ctx.resume().then(() => play(ctx, heard, preferences.volume), () => {});
  } catch {
    // A failing audio device must not break the game
  }
}

function play(ctx: AudioContext, heard: SoundName[], volume: number): void {
  if (ctx.state !== 'running') return;
  const gain = volume * volume * 0.5;
  let offset = 0;
  try {
    heard.forEach(name => {
      if (name === 'dice') rattle(ctx, gain);
      else NOTES[name]?.forEach(note => tone(ctx, { ...note, at: note.at + offset }, gain));
      offset += 0.04;
    });
  } catch {
    // A failing audio device must not break the game
  }
}
