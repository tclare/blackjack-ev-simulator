import { Card } from "./Card";
import { BlackjackAction } from "./Action";

/** One physical hand's final cards and the action taken to resolve it (e.g. "hit out to 20"). */
export interface PlayedHand {
  cards: Card[];
  action: BlackjackAction;
}

/**
 * A concrete example round captured for a single (playerSymbol, dealerSymbol, action) table cell:
 * the dealer's full final hand plus every player hand it was scored against. Normally `hands` has
 * one entry, but a Split cell's example has two (or more, if aces were re-split) - one per hand the
 * split produced, each with its own action.
 */
export interface HandExample {
  dealerCards: Card[];
  hands: PlayedHand[];
}

export type ExampleHandsTree = { [player: string]: { [dealer: string]: { [action: string]: HandExample } } };
