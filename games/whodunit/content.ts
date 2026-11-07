// The twenty-one cards: who, with what and where
export const SUSPECTS = [
  { id: 'commodore-brine', name: 'Commodore Brine', color: '--wd-suspect-1' },
  { id: 'madame-coral', name: 'Madame Coral', color: '--wd-suspect-2' },
  { id: 'doctor-tidewell', name: 'Doctor Tidewell', color: '--wd-suspect-3' },
  { id: 'miss-gull', name: 'Miss Gull', color: '--wd-suspect-4' },
  { id: 'professor-kelp', name: 'Professor Kelp', color: '--wd-suspect-5' },
  { id: 'baroness-pearl', name: 'Baroness Pearl', color: '--wd-suspect-6' }
] as const;

export const OBJECTS = [
  { id: 'harpoon', name: 'Harpoon' },
  { id: 'anchor-chain', name: 'Anchor Chain' },
  { id: 'boat-oar', name: 'Boat Oar' },
  { id: 'brass-telescope', name: 'Brass Telescope' },
  { id: 'marlinspike', name: 'Marlinspike' },
  { id: 'deck-mallet', name: 'Deck Mallet' }
] as const;

// Listed in board order: left to right, top to bottom
export const ROOMS = [
  { id: 'boathouse', name: 'Boathouse' },
  { id: 'grand-foyer', name: 'Grand Foyer' },
  { id: 'sun-terrace', name: 'Sun Terrace' },
  { id: 'salt-spa', name: 'Salt Spa' },
  { id: 'chart-room', name: 'Chart Room' },
  { id: 'signal-room', name: 'Signal Room' },
  { id: 'galley', name: 'Galley' },
  { id: 'card-parlor', name: 'Card Parlor' },
  { id: 'wine-cellar', name: 'Wine Cellar' }
] as const;

export type SuspectId = (typeof SUSPECTS)[number]['id'];
export type ObjectId = (typeof OBJECTS)[number]['id'];
export type RoomId = (typeof ROOMS)[number]['id'];
export type CardId = SuspectId | ObjectId | RoomId;

export const CARDS: readonly CardId[] = [...SUSPECTS, ...OBJECTS, ...ROOMS].map(c => c.id);

const ALL: readonly { id: CardId; name: string }[] = [...SUSPECTS, ...OBJECTS, ...ROOMS];

export function kindOf(card: CardId): 'suspect' | 'object' | 'room' {
  if (SUSPECTS.some(s => s.id === card)) return 'suspect';
  return OBJECTS.some(o => o.id === card) ? 'object' : 'room';
}

export function nameOf(card: CardId): string {
  return ALL.find(c => c.id === card)!.name;
}
