import { Card, CardSuitValue } from "../types/Card";
import { HandClassification, HandType } from "../types/HandClassification";


export function handToValues(cards: Card[]): number[] {
  return [];
}

// AA2 = soft 14
// A5 = soft 16
// A29 = hard 12
// A7 = soft 18
// A54 = soft 20
// A55 = "soft" 21
// T56 = "hard" 21
// T57 = "hard" 22

// T9 = hard 19
// Q8 = hard 18
// 57 = hard 12

export function handToClassification(cards: Card[]): HandClassification {

  const nAces = cards.filter(c => c.rank.symbol === "A").length;
  const nonAceCount = cards.filter(c => c.rank.symbol !== "A").reduce((p, c) => p + c.rank.values[0], 0);

  if (cards.length === 2 && cards[0].rank.pairSymbol === cards[1].rank.pairSymbol) {
    const pairSymbol = cards[0].rank.pairSymbol;
    return {
      type: HandType.PAIR,
      value: pairSymbol === "A" ? 12 : 2 * cards[0].rank.values[0],
      symbol: `${pairSymbol}${pairSymbol}`,
    }
  }

  const soft = nAces && (nAces + nonAceCount <= 11);
  const hardAceCount = nAces - 1;

  return {
    type: soft ? HandType.SOFT : HandType.HARD,
    value: soft ? 11 + nonAceCount + hardAceCount : (nonAceCount + nAces),
    symbol: soft ? `A${nonAceCount + hardAceCount}` : (nonAceCount + nAces).toString(),
  }
}
