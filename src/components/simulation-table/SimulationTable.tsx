import { FunctionComponent, useState } from "react";
import { PlayerHandClassification } from "../../types/HandClassification";
import './SimulationTable.css';
import { BET_SIZE, HandRanks } from "../../util/deck";
import { useSimulationResults } from "../../workers/simulationPool";
import { formatCount } from "../../util/format";
import _ from "lodash";
import { Button, Card, ConfigProvider, Divider, Popover } from "antd";

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


const SimulationTable: FunctionComponent = () => {

    const { results } = useSimulationResults();
    const [category, setCategory] = useState<HandCategory>("hard");
    const playerClassifications = allPlayerClassifications.filter(p => categoryOf(p) === category);

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
        const bestResult = _.maxBy(allResults, v => computeExpectedValue(v[1]))?.[1];
        const handsPlayed = bestResult?.[1] || 0;
        const bestExpectedvalue = computeExpectedValue(bestResult);
        const allResultsSorted = _.sortBy(allResults, v => -computeExpectedValue(v[1]));
        return (
            <div className="flex flex-col w-[300px]">
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
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center gap-y-6">
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
        </div>
    );
}

export default SimulationTable;
