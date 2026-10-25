// The game sounds as data, served at /api/sound and played by src/sound/synth.ts with the Web Audio API

export type SoundName = 'turn' | 'move' | 'dice' | 'gameOver' | 'timer';

export type SoundNote = { at: number; length: number; hz: number; type: 'sine' | 'triangle' | 'square' | 'sawtooth' };

// Noise has no pitch, so the dice rattle is described by its bursts instead of notes
export type SoundNoise = { bursts: number; spacingSec: number; lengthSec: number };

export type SoundDef = { name: SoundName; label: string; notes: SoundNote[]; noise?: SoundNoise };

export const SOUNDS: SoundDef[] = [
  { name: 'turn', label: 'Your turn chime', notes: [{ at: 0, length: 0.25, hz: 660, type: 'sine' }, { at: 0.15, length: 0.35, hz: 880, type: 'sine' }] },
  { name: 'move', label: 'Moves', notes: [{ at: 0, length: 0.03, hz: 300, type: 'triangle' }] },
  { name: 'dice', label: 'Dice', notes: [], noise: { bursts: 6, spacingSec: 0.044, lengthSec: 0.03 } },
  {
    name: 'gameOver',
    label: 'Game over',
    notes: [523, 659, 784, 1047].map((hz, i) => ({ at: i * 0.12, length: 0.2, hz, type: 'triangle' as const })),
  },
  { name: 'timer', label: 'Timer warnings', notes: [{ at: 0, length: 0.02, hz: 1000, type: 'square' }] },
];
