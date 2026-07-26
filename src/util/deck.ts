import _ from "lodash";
import { Card, CardRankImpl, CardSuit } from "../types/Card";
import { handToClassification } from "./hand";
import { BlackjackAction } from "../types/Action";
import { HandClassification, HandType } from "../types/HandClassification";
import { getNextScenario } from "./stratifiedDealing";
import { ExampleHandsTree, HandExample, PlayedHand } from "../types/HandExample";

export const HandRanks: CardRankImpl[]  = [
  { symbol: "2", longWord: "Two", values: [2], pairSymbol: "2"},
  { symbol: "3", longWord: "Three", values: [3], pairSymbol: "3" },
  { symbol: "4", longWord: "Four", values: [4], pairSymbol: "4" },
  { symbol: "5", longWord: "Five", values: [5], pairSymbol: "5" },
  { symbol: "6", longWord: "Six", values: [6], pairSymbol: "6" },
  { symbol: "7", longWord: "Seven", values: [7], pairSymbol: "7" },
  { symbol: "8", longWord: "Eight", values: [8], pairSymbol: "8" },
  { symbol: "9", longWord: "Nine", values: [9], pairSymbol: "9" },
  { symbol: "T", longWord: "Ten", values: [10], pairSymbol: "T" },
  { symbol: "J", longWord: "Jack", values: [10], pairSymbol: "T" },
  { symbol: "Q", longWord: "Queen", values: [10], pairSymbol: "T" },
  { symbol: "K", longWord: "King", values: [10], pairSymbol: "T" },
  { symbol: "A", longWord: "Ace", values: [1, 11], pairSymbol: "A" },
];

export const HandSuits: CardSuit[] = [
  { letter: "c", symbol: "♣️", word: "Clubs"},
  { letter: "d", symbol: "♦️", word: "Diamonds"},
  { letter: "s", symbol: "♠", word: "Spades"},
  { letter: "h", symbol: "♥", word: "Hearts"}
];


/** A shuffled deck of cards! */
export const Deck: () => Card[] = () => {
  let cards: Card[] = [];
  for (let r = 0; r < HandRanks.length; r++) {
    for (let s = 0; s < HandSuits.length; s++) {
      cards.push({ rank: HandRanks[r], suit: HandSuits[s] })
    }
  }
  return _.shuffle(cards);
}


export const NUM_DECKS = 8;
export const DECK_SIZE = HandRanks.length * HandSuits.length;

export const DECK_SETTINGS = {
  HIT_SOFT_17: true,
  LATE_SURRENDER_ALLOWED: false,
  DOUBLE_AFTER_SPLIT_ALLOWED: true,
  RESPLIT_ACES_ALLOWED: false,
}

export type DeckSettings = typeof DECK_SETTINGS;

function cardFromRankSymbol(rankSymbol: string, suit: CardSuit): Card {
  return { rank: HandRanks.find(r => r.symbol === rankSymbol)!, suit };
}

export let results: {[p: string]: {[d: string] : {[a: string]: number[]}}} = {};

// A concrete winning example round for each (playerSymbol, dealerSymbol, action) cell, kept purely
// for the popover's "Example Hand" display. Only overwritten by a win (evDelta > 0) whose total
// card count (all player hand(s) plus the dealer's) is smaller than whatever's currently stored -
// so the table converges on the simplest available example rather than the first or most recent
// one seen, which would often be needlessly bloated by a long hit-out. Surrender is the one
// exception: it always forfeits half the bet (evDelta is always negative), so it can never "win" -
// any recorded Surrender is kept regardless of evDelta, or no Surrender cell could ever show one.
export let exampleHands: ExampleHandsTree = {};

function totalCardCount(example: HandExample): number {
  return example.dealerCards.length + example.hands.reduce((n, h) => n + h.cards.length, 0);
}

function recordExampleHand(
  playerSymbol: string,
  dealerSymbol: string,
  action: BlackjackAction,
  hands: PlayedHand[],
  dealerCards: Card[],
  evDelta: number,
) {
  if (action !== BlackjackAction.SURRENDER && evDelta <= 0) return;
  const candidate: HandExample = { dealerCards, hands };
  const existing = exampleHands[playerSymbol]?.[dealerSymbol]?.[action];
  if (existing && totalCardCount(existing) <= totalCardCount(candidate)) return;
  if (!exampleHands[playerSymbol]) exampleHands[playerSymbol] = {};
  if (!exampleHands[playerSymbol][dealerSymbol]) exampleHands[playerSymbol][dealerSymbol] = {};
  exampleHands[playerSymbol][dealerSymbol][action] = candidate;
}

let cardIndex = 0;
let cards = _.times(NUM_DECKS, _ => Deck()).flat();


export const randomCard: () => Card = () => {
  if (cardIndex >= NUM_DECKS * DECK_SIZE) {
    cardIndex = 0;
    cards = _.times(NUM_DECKS, _ => Deck()).flat();
  }
  return cards[cardIndex++];
}

export const BET_SIZE = 100;


export function legalActions() { 
  return [BlackjackAction.HIT, BlackjackAction.STAND]; 
}


export function playBlackjackHandPlayer(hand: Card[]): [number, number] {
  return [0, 0];
}

// A recorded outcome is already scored against the dealer: `evDelta` is the dollar profit/loss
// (positive, negative, or zero), and wins/losses/pushes are hand counts - normally 0 or 1 of each,
// but potentially 2 total for Split, which reports the *combined* result of both resulting hands
// in a single call. Keeping every call to one "decision" (regardless of how many hands or bet
// units it involved) is what lets Double (evDelta scaled to a bet of 2x) and Split (evDelta summed
// across two hands) compare fairly against Stand/Hit's plain single-hand evDelta, all relative to
// the same original bet.
// `isActual` distinguishes the one branch a round really followed from every other branch explored
// purely for the Hand Breakdown's EV comparison - e.g. a hard-7 hand always gets a hypothetical
// "what if you'd stood here" Stand outcome recorded alongside its Hit outcome, but only whichever one
// `bestKnownAction` actually picked is a real, complete playthrough worth remembering as an example.
type RecordOutcome = (playerSymbol: string, action: BlackjackAction, hands: PlayedHand[], dealerCards: Card[], isActual: boolean, evDelta: number, wins: number, losses: number, pushes: number) => void;

/** Scores a single resolved hand against the dealer's final hand, as an [evDelta, win, loss, push] tuple. */
function scoreAgainstDealer(value: number, bet: number, dealerHandResult: number): [number, number, number, number] {
  return [
    value > dealerHandResult ? bet : value === dealerHandResult ? 0 : -bet,
    value > dealerHandResult ? 1 : 0,
    value < dealerHandResult ? 1 : 0,
    value === dealerHandResult ? 1 : 0,
  ];
}

/**
 * Looks up the engine's current best-known action for a hand, among `candidates`, based on the
 * same `results` data the strategy table is rendered from - falling back to a simple "mimic the
 * dealer" Stand/Hit heuristic before any data exists for that cell yet.
 */
function bestKnownAction(
  playerSymbol: string,
  dealerSymbol: string,
  hc: HandClassification,
  candidates: BlackjackAction[] = [BlackjackAction.STAND, BlackjackAction.HIT],
): BlackjackAction {
  const known = results[playerSymbol]?.[dealerSymbol];
  const entries = known && Object.entries(known).filter(([a]) => candidates.includes(a as BlackjackAction));
  if (entries && entries.length) {
    return _.maxBy(entries, ([, v]) => v[0] / v[1])![0] as BlackjackAction;
  }
  return hc.type === HandType.SOFT
    ? (hc.value >= 18 ? BlackjackAction.STAND : BlackjackAction.HIT)
    : (hc.value >= 17 ? BlackjackAction.STAND : BlackjackAction.HIT);
}

/**
 * Plays a hand to completion (bust, 21, or a stand), recursing one card at a time. Every
 * intermediate hand reached along the way (e.g. K3 hitting a 7 to reach hard 20) gets its own
 * Stand/Hit outcome recorded via `record`, so hands that can only ever arise mid-play - not just
 * the two-card hands the player started with - still accumulate their own row in the results
 * table. The value *returned* still follows the engine's current best-known action at each node,
 * so the caller's own HIT comparison isn't diluted by averaging in every possible (including bad)
 * way the hand could subsequently have been played.
 */
interface PlayOutResult {
  value: number;
  cards: Card[];
}

function playOutWithCurrentPolicy(hand: Card[], bet: number, dealerCard: Card, dealerCards: Card[], dealerHandResult: number, record: RecordOutcome, ancestorActual: boolean = true): PlayOutResult {
  const hc = handToClassification(hand);
  if (hc.value >= 21) return { value: hc.value > 21 ? -Infinity : hc.value, cards: hand };

  // Decided upfront (before either branch below is recorded) so both records below can be tagged
  // with whether they're the one real continuation of this round, not just a hypothetical comparison.
  const chosen = bestKnownAction(hc.symbol, dealerCard.rank.pairSymbol, hc);

  record(hc.symbol, BlackjackAction.STAND, [{ cards: hand, action: BlackjackAction.STAND }], dealerCards, ancestorActual && chosen !== BlackjackAction.HIT, ...scoreAgainstDealer(hc.value, bet, dealerHandResult));
  const hitResult = playOutWithCurrentPolicy([...hand, randomCard()], bet, dealerCard, dealerCards, dealerHandResult, record, ancestorActual && chosen === BlackjackAction.HIT);
  record(hc.symbol, BlackjackAction.HIT, [{ cards: hitResult.cards, action: BlackjackAction.HIT }], dealerCards, ancestorActual && chosen === BlackjackAction.HIT, ...scoreAgainstDealer(hitResult.value, bet, dealerHandResult));

  return chosen === BlackjackAction.HIT ? hitResult : { value: hc.value, cards: hand };
}

/**
 * Evaluates a fresh two-card hand's Stand, Hit, and (when `allowDouble`) Double outcomes,
 * recording each for its own symbol, then returns the [value, bet] actually realized by following
 * whichever currently looks best. Shared by the player's original hand (which can always double)
 * and by each hand produced by a split (which can only double if double-after-split is allowed) -
 * both are otherwise "a fresh two-card hand vs. the dealer's upcard".
 */
interface TwoCardHandResult {
  value: number;
  bet: number;
  cards: Card[];
  action: BlackjackAction;
}

function playTwoCardHand(hand: Card[], bet: number, dealerCard: Card, dealerCards: Card[], dealerHandResult: number, record: RecordOutcome, allowDouble: boolean = true, ancestorActual: boolean = true): TwoCardHandResult {
  const hc = handToClassification(hand);

  // Decided upfront (before any of Stand/Hit/Double is recorded below) so each can be tagged with
  // whether it's the one real path this hand actually followed, not just an EV comparison point.
  const candidates = allowDouble
    ? [BlackjackAction.STAND, BlackjackAction.HIT, BlackjackAction.DOUBLE]
    : [BlackjackAction.STAND, BlackjackAction.HIT];
  const chosen = bestKnownAction(hc.symbol, dealerCard.rank.pairSymbol, hc, candidates);

  // Stand
  record(hc.symbol, BlackjackAction.STAND, [{ cards: hand, action: BlackjackAction.STAND }], dealerCards, ancestorActual && chosen === BlackjackAction.STAND, ...scoreAgainstDealer(hc.value, bet, dealerHandResult));

  // Hit once, then continue playing out the hand using the engine's current best-known strategy.
  const hitResult = playOutWithCurrentPolicy([...hand, randomCard()], bet, dealerCard, dealerCards, dealerHandResult, record, ancestorActual && chosen === BlackjackAction.HIT);
  record(hc.symbol, BlackjackAction.HIT, [{ cards: hitResult.cards, action: BlackjackAction.HIT }], dealerCards, ancestorActual && chosen === BlackjackAction.HIT, ...scoreAgainstDealer(hitResult.value, bet, dealerHandResult));

  // Double down - exactly one more card, then the hand is over. Not legal on a split hand unless
  // double-after-split is allowed.
  let doubleValue: number = -Infinity;
  let doubleCards: Card[] = hand;
  if (allowDouble) {
    doubleCards = [...hand, randomCard()];
    const doubleHc = handToClassification(doubleCards);
    doubleValue = doubleHc.value > 21 ? -Infinity : doubleHc.value;
    record(hc.symbol, BlackjackAction.DOUBLE, [{ cards: doubleCards, action: BlackjackAction.DOUBLE }], dealerCards, ancestorActual && chosen === BlackjackAction.DOUBLE, ...scoreAgainstDealer(doubleValue, bet * 2, dealerHandResult));
  }

  switch (chosen) {
    case BlackjackAction.HIT: return { value: hitResult.value, bet, cards: hitResult.cards, action: BlackjackAction.HIT };
    case BlackjackAction.DOUBLE: return { value: doubleValue, bet: bet * 2, cards: doubleCards, action: BlackjackAction.DOUBLE };
    default: return { value: hc.value, bet, cards: hand, action: BlackjackAction.STAND };
  }
}

/**
 * Resolves one hand produced by splitting aces: unlike any other pair, casinos deal exactly one
 * more card and offer no further action at all (no hit, no double, no stand/hit comparison) - the
 * hand is simply whatever those two cards add up to. Not recorded into the per-cell `results`
 * table, since Stand/Hit/Double were never actually legal options for this hand - recording them
 * would incorrectly suggest that symbol supports those choices when reached this way.
 *
 * If the dealt card happens to complete another pair of aces, real tables only allow splitting it
 * again when they specifically permit re-splitting aces (uncommon) - otherwise the pair is simply
 * kept as-is, forced-stood like any other ace-split hand. Returns the combined [evDelta, wins,
 * losses, pushes] across however many hands this one ace ultimately resolved into (exactly 1,
 * unless re-split aces is allowed and kept chaining).
 */
interface AceSplitResult {
  evDelta: number;
  wins: number;
  losses: number;
  pushes: number;
  hands: PlayedHand[];
}

function resolveAceSplitHand(aceCard: Card, bet: number, dealerCard: Card, dealerHandResult: number): AceSplitResult {
  const hand = [aceCard, randomCard()];
  const hc = handToClassification(hand);
  if (hc.type === HandType.PAIR && DECK_SETTINGS.RESPLIT_ACES_ALLOWED) {
    const firstOutcome = resolveAceSplitHand(hand[0], bet, dealerCard, dealerHandResult);
    const secondOutcome = resolveAceSplitHand(hand[1], bet, dealerCard, dealerHandResult);
    return {
      evDelta: firstOutcome.evDelta + secondOutcome.evDelta,
      wins: firstOutcome.wins + secondOutcome.wins,
      losses: firstOutcome.losses + secondOutcome.losses,
      pushes: firstOutcome.pushes + secondOutcome.pushes,
      hands: [...firstOutcome.hands, ...secondOutcome.hands],
    };
  }
  // No hit/stand/double choice is ever actually offered on a dealt ace-split hand, so there's no
  // real action to attach - labeled STAND for display purposes since the hand is simply held as-is.
  const [evDelta, wins, losses, pushes] = scoreAgainstDealer(hc.value, bet, dealerHandResult);
  return { evDelta, wins, losses, pushes, hands: [{ cards: hand, action: BlackjackAction.STAND }] };
}

// The aggregate "how is my bankroll actually doing" tally: [evSum, handsPlayed, wins, losses,
// pushes], updated exactly once per round (never per intermediate node or per exploratory action),
// so it can never drift out of the sensible relationship (wins+losses+pushes === handsPlayed) the
// way summing across the `results` table would - that table deliberately records many exploratory
// outcomes per round (every action considered, plus every intermediate hand reached while hitting)
// so the per-cell strategy comparisons converge quickly, which makes it unsuitable for "how many
// hands have actually been played" accounting. `handCount` is 2 for a round resolved by splitting
// (two physical hands played from one round) and 1 otherwise, so it always exactly matches however
// many wins+losses+pushes that round's outcome contributes.
export let roundOutcome: [number, number, number, number, number] = [0, 0, 0, 0, 0];

function recordRoundOutcome(evDelta: number, wins: number, losses: number, pushes: number, handCount: number = 1) {
  roundOutcome = [
    roundOutcome[0] + evDelta,
    roundOutcome[1] + handCount,
    roundOutcome[2] + wins,
    roundOutcome[3] + losses,
    roundOutcome[4] + pushes,
  ];
}

/**
 * Evaluates the player's initial two-card hand by trying all legal opening actions (stand, hit,
 * double, surrender, and - when the two cards share a rank - split) and reporting each resulting
 * outcome via `record`. Also tallies the round's *single* real outcome (whichever one action
 * currently looks best, matching what a real player following this strategy would experience)
 * into `roundOutcome`.
 */
export function playBlackjackRecursivePlayer(
  hand: Card[],
  bet: number,
  dealerCard: Card,
  dealerCards: Card[],
  dealerHasBlackjack: boolean,
  dealerHandResult: number,
  record: RecordOutcome,
): void {
  // Once the dealer's peek confirms a natural blackjack, the round is already over before the
  // player acts: every action loses the same original bet, so none of them carry any signal
  // about which action is actually best. Recording them here would compare Stand/Hit/Double
  // (averaged over every dealt round) against Surrender (only ever offered, and so only ever
  // recorded, in rounds without a dealer blackjack) - an apples-to-oranges mismatch that skews
  // hard against Stand/Hit/Double whenever the dealer's upcard can make a blackjack. It's still a
  // real round with a real (guaranteed) outcome, though, so it still counts toward the aggregate.
  if (dealerHasBlackjack) {
    recordRoundOutcome(...scoreAgainstDealer(-Infinity, bet, dealerHandResult));
    return;
  }

  const hc = handToClassification(hand);

  // Decided upfront, before any branch below is played out or recorded, so every record below can
  // be tagged with whether it's the one real path this round actually took - not just one of several
  // hypothetical alternatives compared for the Hand Breakdown. Candidate eligibility only depends on
  // structural facts known immediately (hand type, settings) - never on the branches' own computed
  // outcomes - so this doesn't need to wait for them to be evaluated.
  const candidates = [
    BlackjackAction.STAND, BlackjackAction.HIT, BlackjackAction.DOUBLE,
    ...(DECK_SETTINGS.LATE_SURRENDER_ALLOWED ? [BlackjackAction.SURRENDER] : []),
    ...(hc.type === HandType.PAIR ? [BlackjackAction.SPLIT] : []),
  ];
  const chosenAction = bestKnownAction(hc.symbol, dealerCard.rank.pairSymbol, hc, candidates);

  // Stand, hit, and double - shared with how any two-card hand (including a split hand) is played.
  const { value: standHitDoubleValue, bet: standHitDoubleBet } = playTwoCardHand(
    hand, bet, dealerCard, dealerCards, dealerHandResult, record, true,
    chosenAction !== BlackjackAction.SURRENDER && chosenAction !== BlackjackAction.SPLIT,
  );

  // Surrender - forfeit half the bet to end the hand immediately. Only legal on the original hand.
  if (DECK_SETTINGS.LATE_SURRENDER_ALLOWED) {
    record(hc.symbol, BlackjackAction.SURRENDER, [{ cards: hand, action: BlackjackAction.SURRENDER }], dealerCards, chosenAction === BlackjackAction.SURRENDER, ...scoreAgainstDealer(-Infinity, bet / 2, dealerHandResult));
  }

  // Split - only legal when the two starting cards share a rank (T/J/Q/K all count as one rank).
  // Turns the one bet into two hands of the same bet, each starting with one of the shared-rank
  // cards plus a freshly dealt card. Aces are a special case: real tables deal exactly one more
  // card to each and offer no further action (no hit, no double) at all, unlike every other pair,
  // which plays out each new hand exactly like any other two-card hand. Either way, the split
  // action's EV is the *combined* result of both hands, scored against the same original bet - not
  // the average of each hand's own per-unit EV, which would ignore that splitting risks two units
  // instead of one and so overstate how attractive splitting is (exactly the way Double's EV is
  // scored against the original bet even though it also risks two units).
  let splitOutcome: [number, number, number, number] | undefined;
  let splitHands: PlayedHand[] = [];
  if (hc.type === HandType.PAIR) {
    const splitIsActual = chosenAction === BlackjackAction.SPLIT;
    if (hc.symbol === "AA") {
      const firstOutcome = resolveAceSplitHand(hand[0], bet, dealerCard, dealerHandResult);
      const secondOutcome = resolveAceSplitHand(hand[1], bet, dealerCard, dealerHandResult);
      splitOutcome = [
        firstOutcome.evDelta + secondOutcome.evDelta,
        firstOutcome.wins + secondOutcome.wins,
        firstOutcome.losses + secondOutcome.losses,
        firstOutcome.pushes + secondOutcome.pushes,
      ];
      splitHands = [...firstOutcome.hands, ...secondOutcome.hands];
    } else {
      const allowDouble = DECK_SETTINGS.DOUBLE_AFTER_SPLIT_ALLOWED;
      const firstResult = playTwoCardHand([hand[0], randomCard()], bet, dealerCard, dealerCards, dealerHandResult, record, allowDouble, splitIsActual);
      const secondResult = playTwoCardHand([hand[1], randomCard()], bet, dealerCard, dealerCards, dealerHandResult, record, allowDouble, splitIsActual);
      const [firstEv, firstWin, firstLoss, firstPush] = scoreAgainstDealer(firstResult.value, firstResult.bet, dealerHandResult);
      const [secondEv, secondWin, secondLoss, secondPush] = scoreAgainstDealer(secondResult.value, secondResult.bet, dealerHandResult);
      splitOutcome = [firstEv + secondEv, firstWin + secondWin, firstLoss + secondLoss, firstPush + secondPush];
      splitHands = [
        { cards: firstResult.cards, action: firstResult.action },
        { cards: secondResult.cards, action: secondResult.action },
      ];
    }
    record(hc.symbol, BlackjackAction.SPLIT, splitHands, dealerCards, splitIsActual, ...splitOutcome);
  }

  // Everything above was recorded purely for strategy-table comparison; a real round only ever has
  // ONE outcome. Tally only the action already chosen upfront, so the aggregate reflects "if you
  // always follow the recommended strategy" rather than summing every hypothetical alternative
  // considered.
  if (chosenAction === BlackjackAction.SURRENDER) {
    recordRoundOutcome(...scoreAgainstDealer(-Infinity, bet / 2, dealerHandResult));
  } else if (chosenAction === BlackjackAction.SPLIT && splitOutcome) {
    // Normally exactly 2 hands, but a re-split-aces chain can resolve into more - wins+losses+
    // pushes already sums to the true hand count either way, since each terminal hand contributes
    // exactly 1 to it.
    recordRoundOutcome(...splitOutcome, splitOutcome[1] + splitOutcome[2] + splitOutcome[3]);
  } else {
    recordRoundOutcome(...scoreAgainstDealer(standHitDoubleValue, standHitDoubleBet, dealerHandResult));
  }
}


/** Plays the dealer's hand to completion and returns its final cards (not just the resulting value). */
export function playBlackjackRecursiveDealer(hand: Card[]): Card[] {
  const hc = handToClassification(hand);
  return (
    // Dealer stands on a bust, hard 17+ (better odds), or soft 18+
    hc.value > 21 ? hand
    : hc.value >= 18 || (hc.value === 17 && (hc.type === HandType.HARD || !DECK_SETTINGS["HIT_SOFT_17"])) ? hand
    // Dealer hits on anything else
    : playBlackjackRecursiveDealer([...hand, randomCard()])
  );
}

/** A dealer bust (hand value > 21) scores as 0 against the player, same convention as before. */
function dealerHandValue(cards: Card[]): number {
  const hc = handToClassification(cards);
  return hc.value > 21 ? 0 : hc.value;
}


export function playBlackjackRecursive() {
  // The player's starting hand and the dealer's upcard are drawn from a stratified queue (every
  // starting-hand-symbol x dealer-upcard combination in equal rotation) rather than natural card
  // frequency, so rare-but-important starting hands (pairs especially) get simulated just as often
  // as common ones. Everything after these 3 cards - the dealer's hole card, and every subsequent
  // hit/double/split card - still comes from the ordinary shared shoe.
  const scenario = getNextScenario();
  const playerCards = [
    cardFromRankSymbol(scenario.playerRanks[0], HandSuits[0]),
    cardFromRankSymbol(scenario.playerRanks[1], HandSuits[1]),
  ];
  const dealerCard = cardFromRankSymbol(scenario.dealerRank, HandSuits[0]);
  const dealerHoleCard = randomCard();

  // TODO: Ignore blackjacks for now, fix later.
  if (handToClassification(playerCards).value === 21) return;

  const dealerHasBlackjack = handToClassification([dealerCard, dealerHoleCard]).value === 21;
  const dealerCards = dealerHasBlackjack ? [dealerCard, dealerHoleCard] : playBlackjackRecursiveDealer([dealerCard, dealerHoleCard]);
  const dealerHandResult = dealerHasBlackjack ? 21 : dealerHandValue(dealerCards);

  playBlackjackRecursivePlayer(playerCards, BET_SIZE, dealerCard, dealerCards, dealerHasBlackjack, dealerHandResult, (playerSymbol, action, hands, actualDealerCards, isActual, evDelta, wins, losses, pushes) => {
    const dealerSymbol = dealerCard.rank.pairSymbol;
    // Deliberately built with plain object literals rather than `_.set(results, [playerSymbol,
    // dealerSymbol, action], ...)`: lodash's `_.set` auto-vivifies each intermediate level as an
    // ARRAY instead of a plain object whenever the *next* path segment looks like a valid array
    // index - and dealer symbols "2".."9" are exactly that. Depending on which dealer symbol a
    // given player-symbol cell happens to see first, `results[playerSymbol]` would silently end up
    // an array in some cases and a plain object in others - harmless with a single shared table,
    // but fatal once results from independently-ordered worker replicas need to be merged together.
    if (!results[playerSymbol]) results[playerSymbol] = {};
    if (!results[playerSymbol][dealerSymbol]) results[playerSymbol][dealerSymbol] = {};
    const res = results[playerSymbol][dealerSymbol][action];
    results[playerSymbol][dealerSymbol][action] = res ? [
      res[0] + evDelta,
      res[1] + 1,
      res[2] + wins,
      res[3] + losses,
      res[4] + pushes
    ] : [evDelta, 1, wins, losses, pushes];

    // Only the branch that actually happened (not every hypothetical comparison point) is worth
    // remembering as a concrete example - see the RecordOutcome/isActual comment above.
    if (isActual) {
      recordExampleHand(playerSymbol, dealerSymbol, action, hands, actualDealerCards, evDelta);
    }
  });
}

export function playBlackjack() {
  _.times(10000, playBlackjackRecursive);
}

export function clearResults() {
  results = {};
  exampleHands = {};
  roundOutcome = [0, 0, 0, 0, 0];
}
