import { Card } from "../types/Card";

/** Card images live in `public/` as e.g. "10C.png" or "AH.png" - rank symbol "T" is spelled "10". */
export function cardImageUrl(card: Card): string {
  const rankPart = card.rank.symbol === "T" ? "10" : card.rank.symbol;
  const suitPart = card.suit.letter.toUpperCase();
  return `${process.env.PUBLIC_URL}/${rankPart}${suitPart}.png`;
}

export function cardLabel(card: Card): string {
  return `${card.rank.longWord} of ${card.suit.word}`;
}
