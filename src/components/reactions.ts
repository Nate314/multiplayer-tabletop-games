import type { Reaction } from '../../shared/reactions.ts'
import type { Seat } from '../../shared/types.ts'

export const DEFAULT_RECENT_REACTIONS = ['👍', '😂', '😮', '👏', '🎉']
const MAX_RECENT = 8

export function reactionLabel(reaction: Reaction, playerNames: Record<Seat, string>): string {
  const from = reaction.fromSpectator ? `${reaction.from} (watching)` : reaction.from
  return `${from} → ${playerNames[reaction.target]} ${reaction.emoji}`
}

export function rememberReaction(recent: string[], emoji: string): string[] {
  return [emoji, ...recent.filter(e => e !== emoji)].slice(0, MAX_RECENT)
}
