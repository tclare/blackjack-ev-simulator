import _ from "lodash";

/**
 * One concrete, non-colliding 2-card rank realization for every PlayerHandClassification value
 * that's actually possible as a starting hand (hard 20 is excluded - the only way to make 20 with
 * two cards is T+T, which always classifies as the pair "TT", never hard "20").
 *
 * Hard totals use a low first card ("2".."9") paired with whatever second card completes the
 * total, which never accidentally matches the first card's rank and never includes an Ace (which
 * would otherwise flip the hand to SOFT).
 */
export const PLAYER_STARTING_HAND_RANKS: {
  [symbol: string]: [string, string];
} = {
  "5": ["2", "3"],
  "6": ["2", "4"],
  "7": ["2", "5"],
  "8": ["2", "6"],
  "9": ["2", "7"],
  "10": ["2", "8"],
  "11": ["2", "9"],
  "12": ["2", "T"],
  "13": ["3", "T"],
  "14": ["4", "T"],
  "15": ["5", "T"],
  "16": ["6", "T"],
  "17": ["7", "T"],
  "18": ["8", "T"],
  "19": ["9", "T"],
  A2: ["A", "2"],
  A3: ["A", "3"],
  A4: ["A", "4"],
  A5: ["A", "5"],
  A6: ["A", "6"],
  A7: ["A", "7"],
  A8: ["A", "8"],
  A9: ["A", "9"],
  "22": ["2", "2"],
  "33": ["3", "3"],
  "44": ["4", "4"],
  "55": ["5", "5"],
  "66": ["6", "6"],
  "77": ["7", "7"],
  "88": ["8", "8"],
  "99": ["9", "9"],
  TT: ["T", "T"],
  AA: ["A", "A"],
};

export const DEALER_UPCARD_RANK_SYMBOLS = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "T",
  "A",
];

export interface DealingScenario {
  playerRanks: [string, string];
  dealerRank: string;
}

function buildScenarioQueue(): DealingScenario[] {
  const scenarios: DealingScenario[] = [];
  for (const playerRanks of Object.values(PLAYER_STARTING_HAND_RANKS)) {
    for (const dealerRank of DEALER_UPCARD_RANK_SYMBOLS) {
      scenarios.push({ playerRanks, dealerRank });
    }
  }
  return scenarios;
}

let queue: DealingScenario[] = _.shuffle(buildScenarioQueue());
let queueIndex = 0;

/**
 * Returns the next dealing scenario from a shuffled, cycling queue covering every
 * (starting-hand-symbol, dealer-upcard) combination exactly once per full cycle - so rare but
 * important starting hands (pairs, in particular) get the same simulation attention as common
 * ones, instead of being sampled at their natural (much lower) card frequency!
 */
export function getNextScenario(): DealingScenario {
  if (queueIndex >= queue.length) {
    queue = _.shuffle(buildScenarioQueue());
    queueIndex = 0;
  }
  return queue[queueIndex++];
}
