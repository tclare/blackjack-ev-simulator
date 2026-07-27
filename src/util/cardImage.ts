import { Card } from "../types/Card";
import { HandRanks, HandSuits } from "./deck";

/** Card images live in `public/` as e.g. "10C.png" or "AH.png" - rank symbol "T" is spelled "10". */
export function cardImageUrl(card: Card): string {
  const rankPart = card.rank.symbol === "T" ? "10" : card.rank.symbol;
  const suitPart = card.suit.letter.toUpperCase();
  return `${process.env.PUBLIC_URL}/${rankPart}${suitPart}.png`;
}

export function cardLabel(card: Card): string {
  return `${card.rank.longWord} of ${card.suit.word}`;
}

/**
 * Warms the browser's image cache for all 52 cards up front, so the first example hand a worker
 * reports for a given rank/suit doesn't visibly flash while its image loads for the first time.
 */
export function preloadCardImages(): void {
  for (const rank of HandRanks) {
    for (const suit of HandSuits) {
      new Image().src = cardImageUrl({ rank, suit });
    }
  }
}
