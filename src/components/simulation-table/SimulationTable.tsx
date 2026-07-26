import { FunctionComponent, useState } from "react";
import { PlayerHandClassification } from "../../types/HandClassification";
import './SimulationTable.css';
import { BET_SIZE, HandRanks } from "../../util/deck";
import { useSimulationResults } from "../../workers/simulationPool";
import { formatCount } from "../../util/format";
import { cardImageUrl, cardLabel } from "../../util/cardImage";
import { handToClassification } from "../../util/hand";
import { BlackjackAction } from "../../types/Action";
import { HandExample } from "../../types/HandExample";
import { Card } from "../../types/Card";
import _ from "lodash";
import { Button, ConfigProvider, Divider, Popover } from "antd";

import {
  FolderOpenFilled,
  InfoCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const dealerClassifications = _.uniq(HandRanks.map(hr => hr.pairSymbol));
const allPlayerClassifications = Object.values(PlayerHandClassification);

type HandCategory = "hard" | "soft" | "pairs";

function categoryOf(symbol: string): HandCategory {
    // Checked against real rank symbols (not just "are the two characters equal"), since hard
    // total "11" would otherwise be misclassified as a pair.
    if (symbol.length === 2 && symbol[0] === symbol[1] && dealerClassifications.includes(symbol[0])) return "pairs";
    if (symbol.startsWith("A")) return "soft";
    return "hard";
}


/**
 * Adjusts the brightness of a hex color.
 * @param {string} hex - The original hex color (e.g., #f87171).
 * @param {number} percentage - The brightness adjustment percentage (e.g., 37 for 37%).
 * @returns {string} - The new hex color with adjusted brightness.
 */
function adjustBrightness(hex: string, percentage: number) {
    // Ensure the hex color is in the correct format
    if (hex.charAt(0) === '#') {
        hex = hex.slice(1);
    }

    // Convert the hex color to RGB
    let r = parseInt(hex.slice(0, 2), 16);
    let g = parseInt(hex.slice(2, 4), 16);
    let b = parseInt(hex.slice(4, 6), 16);

    // Calculate the new brightness value. Scaled against a cap well below 100 (rather than 100
    // itself) since most real per-cell EV magnitudes fall well under that - scaling linearly
    // against 100 crammed the entire common range (e.g. -28%, -41%, -50%) into a narrow, nearly-
    // white band that all looked the same shade at a glance. Capping the "fully saturated" point
    // lower spreads that common range across the whole visible color gradient instead.
    const SATURATION_CAP_PERCENT = 50;
    // The most intense color reached at/beyond the cap - kept a bit short of the raw base color
    // (1.0) so the strongest cells read as a rich, toned-down shade rather than the full, harsh hue.
    const MAX_FACTOR = 0.8;
    let factor = Math.min(MAX_FACTOR, MAX_FACTOR * (percentage / SATURATION_CAP_PERCENT));

    // Adjust the RGB values, making 0% white (#ffffff)
    r = Math.min(255, Math.max(0, Math.floor(255 - (255 - r) * factor)));
    g = Math.min(255, Math.max(0, Math.floor(255 - (255 - g) * factor)));
    b = Math.min(255, Math.max(0, Math.floor(255 - (255 - b) * factor)));

    // Convert the new RGB values back to hex
    let newHex = '#' + 
        ('0' + r.toString(16)).slice(-2) + 
        ('0' + g.toString(16)).slice(-2) + 
        ('0' + b.toString(16)).slice(-2);

    // Ensure the result is in lowercase
    return newHex.toLowerCase();
}


const actionLabels: Record<string, string> = {
    S: "Stand",
    H: "Hit",
    D: "Double",
    P: "Split",
    R: "Surrender",
};

// Reuses the same reds/greens already driving the cell background and hand-breakdown bars
// elsewhere in this file, so the highlight reads as part of the same palette rather than
// introducing an unrelated set of hues.
const actionBorderColors: Record<string, string> = {
    S: "#b91c1c",
    H: "#4d7c0f",
    D: "#1d4ed8",
    P: "#7e22ce",
    R: "#78350f",
};

/**
 * Colors every card in a resolved hand by whichever decision it represents - derived purely from the
 * card count and the hand's own final action, with no extra bookkeeping needed: a fresh hand's first
 * decision (card 1) is `action` itself; every card after a Hit's first can only be another Hit, since
 * Double and Surrender never continue past their own card; and once the cards stop without a Double
 * or Surrender in play, that last card can only mean the hand stood. Index 0 (the very first card) is
 * never marked here - it's not itself a decision point, just half of the starting hand.
 */
function computeCardMarkers(cards: Card[], action: BlackjackAction): (BlackjackAction | undefined)[] {
    const n = cards.length;
    const markers: (BlackjackAction | undefined)[] = new Array(n).fill(undefined);
    if (action === BlackjackAction.DOUBLE || action === BlackjackAction.SURRENDER) {
        markers[n - 1] = action;
        return markers;
    }
    for (let k = 1; k < n; k++) {
        markers[k] = k < n - 1 ? BlackjackAction.HIT : (action === BlackjackAction.HIT ? BlackjackAction.STAND : action);
    }
    return markers;
}

interface ExampleHandDisplayProps {
    exampleHand: HandExample;
    cellActionCode: string;
}

/**
 * Renders one player hand at a time (with a 1-2-3 picker when a split produced more than one),
 * rather than every split hand's overlapping card stack crammed side by side - that reliably wrapped
 * onto its own ugly row once two stacks didn't fit the popover's half-width.
 */
const ExampleHandDisplay: FunctionComponent<ExampleHandDisplayProps> = ({ exampleHand, cellActionCode }) => {
    const [selectedHandIndex, setSelectedHandIndex] = useState(0);
    const hand = exampleHand.hands[Math.min(selectedHandIndex, exampleHand.hands.length - 1)];
    const isSplit = cellActionCode === BlackjackAction.SPLIT;
    const markers = computeCardMarkers(hand.cards, hand.action);
    // A split's own shared starting card (index 0) is a separate fact from whatever this hand went on
    // to do afterward - marked with the cell's own (purple) color instead of whatever computeCardMarkers
    // assigned there (nothing, since index 0 is never itself a decision point).
    const cardActionCodes: (string | undefined)[] = hand.cards.map((_, j) => (j === 0 && isSplit) ? cellActionCode : markers[j]);
    const legendCodes = _.uniq(cardActionCodes.filter((code): code is string => Boolean(code)));
    const dealerValue = handToClassification(exampleHand.dealerCards).value;

    return (
        <>
            <div className="flex items-center justify-between">
                <b>Example Hand</b>
                <div className="flex items-center gap-x-2">
                    {legendCodes.map(code => (
                        <span key={code} className="flex items-center gap-x-1">
                            <span className="w-3 h-2 rounded-sm" style={{ backgroundColor: actionBorderColors[code] }} />
                            <span className="text-[10px] text-gray-500">{actionLabels[code]}</span>
                        </span>
                    ))}
                </div>
            </div>
            <div className="flex items-start py-2">
                <div className="w-1/2 flex flex-col items-center justify-center">
                    <div className="inline-flex flex-col">
                        <div className="flex items-center">
                            {hand.cards.map((c, j) => {
                                const actionCode = cardActionCodes[j];
                                const borderColor = actionCode ? actionBorderColors[actionCode] : undefined;
                                // Casinos turn the extra card sideways when a player doubles down, marking the
                                // hand as doubled at a glance - mirrored here on that same drawn card.
                                const doubled = actionCode === BlackjackAction.DOUBLE;
                                return (
                                    <img
                                        key={j}
                                        src={cardImageUrl(c)}
                                        alt={cardLabel(c)}
                                        title={actionCode ? actionLabels[actionCode] : undefined}
                                        className={`w-16 rounded ${j > 0 ? "-ml-8" : ""} ${borderColor ? "border-2" : ""} ${doubled ? "rotate-90" : ""}`}
                                        style={borderColor ? { borderColor } : undefined}
                                    />
                                );
                            })}
                        </div>
                        <div className="text-gray-400 text-xs font-bold mt-1 text-center">
                            PLAYER — {handToClassification(hand.cards).value}
                        </div>
                        {exampleHand.hands.length > 1 && (
                            <div className="flex items-center justify-center gap-x-1 mt-1">
                                {exampleHand.hands.map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setSelectedHandIndex(idx)}
                                        className={`w-4 h-4 rounded-full text-[10px] leading-none font-bold ${idx === selectedHandIndex ? "text-white" : "bg-gray-100 text-gray-400"}`}
                                        style={idx === selectedHandIndex ? { backgroundColor: actionBorderColors[BlackjackAction.SPLIT] } : undefined}
                                    >
                                        {idx + 1}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="w-1/2 flex flex-col items-center justify-center">
                    <div className="inline-flex flex-col">
                        <div className="flex items-center">
                            {exampleHand.dealerCards.map((c, j) => (
                                <img
                                    key={j}
                                    src={cardImageUrl(c)}
                                    alt={cardLabel(c)}
                                    className={`w-16 rounded ${j > 0 ? "-ml-8" : ""}`}
                                />
                            ))}
                        </div>
                        <div className="text-gray-400 text-xs font-bold mt-1 text-center">
                            DEALER — {dealerValue}
                            {dealerValue > 21 && <span className="mx-1">🧨</span>}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

const SimulationTable: FunctionComponent = () => {

    const { results, exampleHands, settings } = useSimulationResults();
    const [category, setCategory] = useState<HandCategory>("hard");
    const playerClassifications = allPlayerClassifications.filter(p => categoryOf(p) === category);

    const legendEntries: [string, string, boolean][] = [
        ["S", "Stand", true],
        ["H", "Hit", true],
        ["D", "Double", true],
        ["P", "Split", category === "pairs"],
        ["R", "Surrender", settings.LATE_SURRENDER_ALLOWED],
    ];

    const computeCellValue = (p: string, d: string) => {
        const allResultActions = results?.[p]?.[d];
        if (!allResultActions) return "X";
        const allResults = Object.entries(allResultActions);
        return _.maxBy(allResults, v => computeExpectedValue(v[1]))?.[0];
    }

    const computeCellBackgroundColor = (p: string, d: string) => {
        const allResultActions = results?.[p]?.[d];
        if (!allResultActions) return "bg-gray-100";
        const allResults = Object.entries(allResultActions);
        // Selected the same way as computeCellValue (by EV ratio, not raw evSum) so the
        // background color always reflects the same action the cell's letter is showing.
        const bestResult = _.maxBy(allResults, v => computeExpectedValue(v[1]))?.[1];
        const bestExpectedValue = computeExpectedValue(bestResult);
        if (!bestResult || bestResult[0] === 0) return "bg-gray-100";
        else if (bestResult[0] > 0) return adjustBrightness("#4d7c0f", bestExpectedValue);
        else return adjustBrightness("#b91c1c", Math.abs(bestExpectedValue));
    }

    const computeExpectedValue = (r: number[] | undefined ) => {
        return (r?.[0] || 0) * 100 / ((r?.[1] || 1) * BET_SIZE) ;
    }

    const computePopoverContent = (p: string, d: string) => {
        const allResultActions = results?.[p]?.[d];
        if (!allResultActions) return "bg-gray-100";
        const allResults = Object.entries(allResultActions);
        const bestEntry = _.maxBy(allResults, v => computeExpectedValue(v[1]));
        const bestResult = bestEntry?.[1];
        const handsPlayed = bestResult?.[1] || 0;
        const bestExpectedvalue = computeExpectedValue(bestResult);
        const allResultsSorted = _.sortBy(allResults, v => -computeExpectedValue(v[1]));
        const exampleHand = bestEntry && exampleHands?.[p]?.[d]?.[bestEntry[0]];
        return (
            <div className="flex flex-col w-[330px]">
                <div className="flex gap-x-4 justify-between">
                    <b>Hands Played: </b>
                    {formatCount(handsPlayed)}
                </div>
                <div className="flex gap-x-4 justify-between">
                    <b>Expected Value: </b>
                    {`${bestExpectedvalue > 0 ? "+" : ""}${bestExpectedvalue.toFixed(1)}%`}
                </div>
                <Divider className="my-2" />
                <b>Hand Breakdown</b>
                {allResultsSorted.map(r => (
                    <div className="flex gap-x-4 justify-between">
                        <b className="text-gray-500 flex justify-between gap-x-2 w-[80px]">
                            <span>{r[0]}:</span>
                            <span>{`${(computeExpectedValue(r[1])) > 0 ? "+" : ""}${computeExpectedValue(r[1]).toFixed(1)}%`}</span>
                        </b>
                        <div className="flex flex-col justify-center grow">
                            <div className="w-full h-px bg-gray-300 relative">
                                <div className="absolute left-[50%] top-[-2px] h-1" style={{
                                    width: `${Math.min(Math.abs(computeExpectedValue(r[1]) / 2), 50)}%`,
                                    backgroundColor: `${computeExpectedValue(r[1]) > 0 ? "#4d7c0f" : "#b91c1c"}`,
                                    left: `${50 + Math.max(-50, Math.min((computeExpectedValue(r[1]) / 2), 0))}%`,
                                }}></div>
                            </div>
                        </div>
                    </div>
                ))}
                <Divider className="my-2" />
                {exampleHand ? (
                    <ExampleHandDisplay exampleHand={exampleHand} cellActionCode={bestEntry![0]} />
                ) : (
                    <>
                        <b>Example Hand</b>
                        <div className="text-gray-400 text-xs py-2">No winning example recorded yet</div>
                    </>
                )}
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center gap-y-6">
            <div className="w-full flex justify-between px-2">
                <div className="flex">
                    <InfoCircleOutlined />
                </div>
                <div className="flex gap-x-2">
                    <FolderOpenFilled />
                    <SettingOutlined />
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <td className="table-header-value"/>
                        {
                            dealerClassifications
                                .filter((_, i) => i < dealerClassifications.length)
                                .map((v) => (
                                    <td className="table-header-value text-sm" key={v}>
                                        { v }
                                    </td>
                                ))
                        }
                    </tr>
                </thead>
                <tbody>
                    {
                        playerClassifications
                            .map((p) => (
                                <tr key={p}>
                                    <td className="table-header-value text-sm">{p}</td>
                                    {
                                        dealerClassifications
                                            .filter((_, i) => i < dealerClassifications.length)
                                            .map((d) => (
                                                <Popover trigger="click" content={computePopoverContent(p, d)}>
                                                    <td key={d + p} style={{backgroundColor: computeCellBackgroundColor(p, d)}} className="text-sm cursor-pointer">
                                                        {computeCellValue(p, d)}
                                                    </td>
                                                </Popover>
                                            ))
                                    }
                                </tr>
                            ))
                        }
                </tbody>
                <tfoot></tfoot>
            </table>
            {/* An inline style only covers the resting state - AntD's own CSS drives hover/active
                off its theme tokens, which still point at blue. Overriding colorPrimary here lets
                AntD derive matching black hover/active shades itself, rather than fighting its
                generated CSS with more inline styles. */}
            <ConfigProvider theme={{ token: { colorPrimary: "#000000" } }}>
                <Button.Group>
                    {(["hard", "soft", "pairs"] as const).map((c) => (
                        <Button
                            key={c}
                            type={category === c ? "primary" : "default"}
                            onClick={() => setCategory(c)}
                        >
                            {c[0].toUpperCase() + c.slice(1)}
                        </Button>
                    ))}
                </Button.Group>
            </ConfigProvider>
            <div className="w-full flex justify-between rounded bg-gray-100 py-2 px-4 text-sm">
                {legendEntries.map(([code, label, active]) => (
                    <span key={code} className={active ? "text-black" : "text-gray-300"}>
                        <b>{code}</b> — {label}
                    </span>
                ))}
            </div>
        </div>
    );
}

export default SimulationTable;
