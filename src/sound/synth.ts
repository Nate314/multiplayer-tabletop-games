import type { SoundDef, SoundName, SoundNoise, SoundNote } from '../../shared/sounds.ts';
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

let sounds = new Map<SoundName, SoundDef>();

// Fetched once at startup, so the first sound has no delay; until it arrives, or if it fails, every sound is silent
export async function loadSounds(): Promise<void> {
  try {
    const response = await fetch('/api/sound');
    if (!response.ok) return;
    const list = (await response.json()) as SoundDef[];
    sounds = new Map(list.map(sound => [sound.name, sound]));
  } catch {
    // Offline or a server error: the game plays on without sound
  }
}

function tone(ctx: AudioContext, { at, length, hz, type }: SoundNote, gain: number): void {
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

function rattle(ctx: AudioContext, { bursts, spacingSec, lengthSec }: SoundNoise, at: number, gain: number): void {
  for (let i = 0; i < bursts; i++) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * lengthSec), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
    const source = ctx.createBufferSource();
    const envelope = ctx.createGain();
    envelope.gain.value = gain;
    source.buffer = buffer;
    source.connect(envelope).connect(ctx.destination);
    source.start(ctx.currentTime + at + i * spacingSec);
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
      const sound = sounds.get(name);
      sound?.notes.forEach(note => tone(ctx, { ...note, at: note.at + offset }, gain));
      if (sound?.noise) rattle(ctx, sound.noise, offset, gain);
      offset += 0.04;
    });
  } catch {
    // A failing audio device must not break the game
  }
}
