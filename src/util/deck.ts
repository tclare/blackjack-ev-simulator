import _, { random } from "lodash";
import { Card, CardRankImpl, CardSuit } from "../types/Card";
import { handToClassification } from "./hand";
import { BlackjackAction } from "../types/Action";
import { HandType } from "../types/HandClassification";

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
  HIT_SOFT_17: true
}


export interface BlackjackResults {

}
export let results: {[p: string]: {[d: string] : {[a: string]: number[]}}} = {};

let cardIndex = 0;
let cards = _.times(DECK_SIZE, _ => Deck()).flat();


export const randomCard: () => Card = () => {
  if (cardIndex >= NUM_DECKS * DECK_SIZE) {
    cardIndex = 0;
    cards = _.times(DECK_SIZE, _ => Deck()).flat();
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

/**
 * Returns a tuple of [handValue, finishingBet] pairs. Once all possible hand paths are evaluated,
 * 
 */
export function playBlackjackRecursivePlayer(
  hand: Card[], 
  bet: number, 
  actions: BlackjackAction[]
): [number, number, Card[], BlackjackAction[]][] {
  // TODO: dynamically determine legal actions here.

  const hc = handToClassification(hand);

  // const nextLegalActions = legalActions();
  // let returnValue: [Card[], number, number][] = [];
  
  // Player has busted; their hand is worthless (-Infinity, return up the stack.
  if (hc.value > 21) return [[-Infinity, bet, hand, actions]];

  // Player has hit 21; they are done playing
  else if (hc.value === 21) return [[hc.value, bet, hand, actions]];

  // Player has doubled down; they are not allowed to see any more cards.
  else if (actions.length && actions[actions.length - 1] === BlackjackAction.DOUBLE) return [[hc.value, bet, hand, actions]]

  return [
    [hc.value, bet, hand, [...actions, BlackjackAction.STAND]], // stand
    ...playBlackjackRecursivePlayer([...hand, randomCard()], bet, [...actions, BlackjackAction.HIT]), // hit
    ...(hand.length === 2 ? playBlackjackRecursivePlayer([...hand, randomCard()], bet * 2, [...actions, BlackjackAction.DOUBLE]) : [])
  ]
}


export function playBlackjackRecursiveDealer(hand: Card[]): number {
  const hc = handToClassification(hand);
  return (
    // Dealer hand represents bust - we assign it a value of 0
    hc.value > 21 ? 0
    // Dealer stands on hard 17+ (better odds) or soft 18+
    : hc.value >= 18 || hc.value === 17 && (hc.type === HandType.HARD || !DECK_SETTINGS["HIT_SOFT_17"]) ? hc.value
    // Dealer hits on anything else
    : playBlackjackRecursiveDealer([...hand, randomCard()])
  );
}


export function playBlackjackRecursive() {

  const playerCards = [randomCard(), randomCard()];
  const dealerCard = randomCard();
  
  // TODO: Ignore blackjacks for now, fix later.
  if (handToClassification(playerCards).value === 21) return;

  const playerHandResults = playBlackjackRecursivePlayer(playerCards, BET_SIZE, []);
  const dealerHandResult = playBlackjackRecursiveDealer([dealerCard]);

  let actionCache: Set<String> = new Set<String>();

  for (let result of playerHandResults) {
    const [playerHandValue, playerBet, hand, actionSequence] = result;
    for (let i = 0; i < actionSequence.length; i++) {
      if (!actionCache.has(actionSequence.slice(0, i+1).join(""))) {
        const path = [
          handToClassification(hand.slice(0, i + 2)).symbol, 
          dealerCard.rank.pairSymbol, 
          actionSequence[i]
        ];
        const evDelta = (
          playerHandValue > dealerHandResult ? playerBet :
          playerHandValue === dealerHandResult ? 0 : 
          -playerBet
        );
        const handsWonAddend = playerHandValue > dealerHandResult ? 1 : 0;
        const handsLostAddend = playerHandValue < dealerHandResult ? 1 : 0;
        const handsPushedAddend = playerHandValue === dealerHandResult ? 1 : 0
        const result = _.get(results, path);
        _.set(results, path, result ? [result[0] + evDelta, result[1] + 1, result[2] + handsWonAddend, result[3] + handsLostAddend, result[4] + handsPushedAddend] : [evDelta, 1, handsWonAddend, handsLostAddend, handsPushedAddend]);
        actionCache.add(actionSequence.slice(0, i+1).join(""));
      }
    }
  }
}

export function playBlackjack() {
  _.times(10000, playBlackjackRecursive);  
}

export function clearResults() {
  results = {};
}