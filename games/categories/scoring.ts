// Answer matching and round scoring, shared by the browser and the server; holds no secrets
import { normalize } from '../../shared/guess.ts';
import type { Challenge, Seat, Verdict } from './types.ts';

export function withoutArticle(text: string): string {
  return text.trim().replace(/^(a|an|the)\s+(?=\S)/i, '');
}

// "Éclair" starts with E and matches "eclair"
const withoutAccents = (text: string): string => text.normalize('NFD').replace(/\p{M}/gu, '');

export function answerKey(text: string): string {
  return normalize(withoutAccents(withoutArticle(text)));
}

export function startsWithLetter(text: string, letter: string): boolean {
  return withoutAccents(withoutArticle(text)).charAt(0).toUpperCase() === letter;
}

export function verdicts(
  answers: Partial<Record<Seat, string[]>>, seats: Seat[], letter: string, challenges: Challenge[]
): Partial<Record<Seat, Verdict[]>> {
  const text = (seat: Seat, category: number) => answers[seat]?.[category] ?? '';
  const counted = (seat: Seat, category: number) => {
    const t = text(seat, category);
    return t.trim() !== '' && startsWithLetter(t, letter);
  };
  const result: Partial<Record<Seat, Verdict[]>> = {};
  for (const seat of seats) {
    const count = answers[seat]?.length ?? 0;
    result[seat] = Array.from({ length: count }, (_, category): Verdict => {
      const t = text(seat, category);
      if (t.trim() === '') return 'empty';
      if (!startsWithLetter(t, letter)) return 'wrongLetter';
      const key = answerKey(t);
      if (seats.some((other) => other !== seat && counted(other, category) && answerKey(text(other, category)) === key)) return 'duplicate';
      const challenge = challenges.find((c) => c.category === category && c.seat === seat);
      return challenge?.verdict === 'rejected' ? 'rejected' : 'valid';
    });
  }
  return result;
}

export function roundPoints(all: Partial<Record<Seat, Verdict[]>>): Partial<Record<Seat, number>> {
  const points: Partial<Record<Seat, number>> = {};
  for (const [seat, list] of Object.entries(all)) points[Number(seat) as Seat] = (list ?? []).filter((v) => v === 'valid').length;
  return points;
}
