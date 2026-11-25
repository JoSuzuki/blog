import cardsFile from './cards.json'
import type { CardFace } from './room'

// The deck: 988 Portuguese cards from the 2020 prototype (JoSuzuki/taboo),
// cleaned up (duplicates removed, spacing and two typos fixed). Server only:
// whoever has the deck can read every card, and a player must only see the
// card on the table when the rules say so. A card's id is its index here, so
// add new cards at the end.

const cards = cardsFile as Array<[string, string[]]>

export const CARD_COUNT = cards.length

export const getCard = (id: number): CardFace => {
  const [word, taboo] = cards[id] ?? ['?', []]
  return { id, word, taboo }
}
