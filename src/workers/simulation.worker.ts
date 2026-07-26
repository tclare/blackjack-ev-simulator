import { playBlackjack, clearResults, results, DECK_SETTINGS, roundOutcome, exampleHands } from "../util/deck";
import { WorkerInboundMessage, WorkerOutboundMessage } from "./simulationMessages";

// Shadows the ambient `self: Window` (from the "dom" lib already in tsconfig.json) with the
// narrower "outside view" of a worker instead. We deliberately do NOT add "webworker" to
// tsconfig.json's `lib` array: lib.dom.d.ts and lib.webworker.d.ts both declare the global `self`
// with incompatible types, and CRA type-checks the whole project against one shared tsconfig, so
// loading both would break the entire app's build. `Worker` (from "dom") already exposes exactly
// what this file needs: postMessage/onmessage/onerror.
declare const self: Worker;

const BATCH_INTERVAL_MS = 100;

let intervalId: ReturnType<typeof setInterval> | undefined;

function postResults() {
  const message: WorkerOutboundMessage = { type: "results", results, roundOutcome, exampleHands };
  self.postMessage(message);
}

self.onmessage = (event: MessageEvent<WorkerInboundMessage>) => {
  const message = event.data;
  switch (message.type) {
    case "settings":
      Object.assign(DECK_SETTINGS, message.settings);
      clearResults();
      break;
    case "start":
      if (intervalId === undefined) {
        intervalId = setInterval(() => {
          playBlackjack();
          postResults();
        }, BATCH_INTERVAL_MS);
      }
      break;
    case "stop":
      clearInterval(intervalId);
      intervalId = undefined;
      break;
  }
};

const readyMessage: WorkerOutboundMessage = { type: "ready" };
self.postMessage(readyMessage);
