import _ from "lodash";
import { useSyncExternalStore } from "react";
import { BET_SIZE, DECK_SETTINGS, DeckSettings } from "../util/deck";
import { ResultsTree, RoundOutcome, WorkerInboundMessage, WorkerOutboundMessage } from "./simulationMessages";
import { ExampleHandsTree, HandExample } from "../types/HandExample";

const WORKER_COUNT = Math.max(1, Math.min(navigator.hardwareConcurrency || 4, 8));

/**
 * Sums the [evSum, count, wins, losses, pushes] tuples element-wise wherever the trees overlap.
 * Plain lodash `_.merge` would overwrite arrays by index instead of adding them, which is why this
 * needs an explicit customizer.
 */
function mergeResultsTrees(trees: ResultsTree[]): ResultsTree {
  return _.mergeWith({}, ...trees, (a: unknown, b: unknown) => {
    if (Array.isArray(a) || Array.isArray(b)) {
      // Array.isArray (not just a null/undefined check) guards against a stray non-array value
      // ever reaching .map here, regardless of cause.
      const av = Array.isArray(a) ? a : [0, 0, 0, 0, 0];
      const bv = Array.isArray(b) ? b : [0, 0, 0, 0, 0];
      return av.map((v, i) => v + bv[i]);
    }
    return undefined;
  });
}

/** Total card count across an example's dealer hand plus every player hand it recorded. */
function totalCardCount(example: HandExample): number {
  return example.dealerCards.length + example.hands.reduce((n, h) => n + h.cards.length, 0);
}

/**
 * Unlike `mergeResultsTrees`'s stats (which sum across workers), a `HandExample` leaf is a single
 * concrete example round - it can't be summed, so wherever two workers both reported an example for
 * the same cell, this keeps whichever one has fewer total cards, exactly matching the "simplest
 * example wins" rule each worker already applies internally (deck.ts's `recordExampleHand`).
 */
function mergeExampleHandsTrees(trees: ExampleHandsTree[]): ExampleHandsTree {
  return _.mergeWith({}, ...trees, (a: unknown, b: unknown) => {
    if (a && typeof a === "object" && "dealerCards" in a && b && typeof b === "object" && "dealerCards" in b) {
      return totalCardCount(a as HandExample) <= totalCardCount(b as HandExample) ? a : b;
    }
    return undefined;
  });
}

export interface SimulationSnapshot {
  results: ResultsTree;
  exampleHands: ExampleHandsTree;
  handsPlayed: number;
  wins: number;
  losses: number;
  pushes: number;
  overallEV: string;
  settings: DeckSettings;
}

const EMPTY_ROUND_OUTCOME: RoundOutcome = [0, 0, 0, 0, 0];

// Each worker is an independent replica running its own stratified-dealing cycle and its own
// self-teaching bootstrap. Every tick it reports its FULL cumulative results, not a delta, so the
// pool must keep only the latest snapshot per worker (replace, never accumulate into a running
// total) and recompute the merged view from scratch - accumulating incoming messages over time
// would re-add each worker's own growth on every tick.
const latestResultsPerWorker: ResultsTree[] = _.times(WORKER_COUNT, () => ({}));
const latestExampleHandsPerWorker: ExampleHandsTree[] = _.times(WORKER_COUNT, () => ({}));
const latestRoundOutcomePerWorker: RoundOutcome[] = _.times(WORKER_COUNT, () => EMPTY_ROUND_OUTCOME);

let currentSettings: DeckSettings = { ...DECK_SETTINGS };

let snapshot: SimulationSnapshot = {
  results: {}, exampleHands: {}, handsPlayed: 0, wins: 0, losses: 0, pushes: 0, overallEV: "0%", settings: currentSettings,
};
const listeners = new Set<() => void>();

function recomputeSnapshot() {
  const [evSum, handsPlayed, wins, losses, pushes] = latestRoundOutcomePerWorker.reduce(
    (a, b) => a.map((v, i) => v + b[i]) as RoundOutcome,
    EMPTY_ROUND_OUTCOME,
  );
  snapshot = {
    results: mergeResultsTrees(latestResultsPerWorker),
    exampleHands: mergeExampleHandsTrees(latestExampleHandsPerWorker),
    handsPlayed,
    wins,
    losses,
    pushes,
    overallEV: handsPlayed > 0
      ? `${evSum > 0 ? "+" : ""}${((evSum * 100) / (handsPlayed * BET_SIZE)).toFixed(1)}%`
      : "0%",
    settings: currentSettings,
  };
  listeners.forEach(listener => listener());
}

// Workers report independently and asynchronously - with several of them each on their own
// ~100ms cadence, a naive "recompute on every message" would re-render far more often, and far
// less predictably, than the single ~100ms cadence this UI previously had. That flood of
// unpredictably-timed re-renders is what was disrupting AntD's Popover click handling (needing a
// second click to open, not closing on a new cell click, stats appearing frozen until a re-render
// happened to coincide with a click). Throttling notifications to a fixed cadence restores a
// predictable render rate regardless of how many workers are reporting or how often.
const NOTIFY_INTERVAL_MS = 200;
let notifyTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleNotify() {
  if (notifyTimer !== undefined) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = undefined;
    recomputeSnapshot();
  }, NOTIFY_INTERVAL_MS);
}

function postToWorker(worker: Worker, message: WorkerInboundMessage) {
  worker.postMessage(message);
}

// A module-scope singleton, created once when this module is first imported - not tied to a
// useEffect, since <App/> renders under React.StrictMode, which double-invokes mount effects in
// dev and would otherwise spawn double the intended workers.
const workers: Worker[] = _.times(WORKER_COUNT, (i) => {
  const worker = new Worker(new URL("./simulation.worker.ts", import.meta.url));
  worker.onerror = (event: ErrorEvent) => console.error(`Simulation worker ${i} error:`, event);
  worker.onmessage = (event: MessageEvent<WorkerOutboundMessage>) => {
    const message = event.data;
    if (message.type === "results") {
      latestResultsPerWorker[i] = message.results;
      latestExampleHandsPerWorker[i] = message.exampleHands;
      latestRoundOutcomePerWorker[i] = message.roundOutcome;
      scheduleNotify();
    }
  };
  postToWorker(worker, { type: "start" });
  return worker;
});

export function updateSettings(settings: DeckSettings) {
  currentSettings = settings;
  workers.forEach(worker => postToWorker(worker, { type: "settings", settings }));
  // Eagerly zero the local snapshot too, so the UI doesn't show a stale blended table for the
  // tick or two it takes each worker to actually clear and report back. Cancel any pending
  // throttled notify first so it can't immediately follow up with a stale pre-clear recompute.
  clearTimeout(notifyTimer);
  notifyTimer = undefined;
  for (let i = 0; i < WORKER_COUNT; i++) {
    latestResultsPerWorker[i] = {};
    latestExampleHandsPerWorker[i] = {};
    latestRoundOutcomePerWorker[i] = EMPTY_ROUND_OUTCOME;
  }
  recomputeSnapshot();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): SimulationSnapshot {
  return snapshot;
}

export function useSimulationResults(): SimulationSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}
