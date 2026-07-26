import { DeckSettings } from "../util/deck";

export type ResultsTree = { [player: string]: { [dealer: string]: { [action: string]: number[] } } };

/** [evSum, count, wins, losses, pushes], updated exactly once per round - see deck.ts's roundOutcome. */
export type RoundOutcome = [number, number, number, number, number];

export type WorkerInboundMessage =
  | { type: "settings"; settings: DeckSettings }
  | { type: "start" }
  | { type: "stop" };

export type WorkerOutboundMessage =
  | { type: "ready" }
  | { type: "results"; results: ResultsTree; roundOutcome: RoundOutcome };
