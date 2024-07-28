import { FunctionComponent, useEffect, useState } from "react";
import { PlayerHandClassification } from "../../types/HandClassification";
import './SimulationTable.css';
import { BET_SIZE, HandRanks, playBlackjack, results } from "../../util/deck";
import _ from "lodash";
import { Divider, Popover } from "antd";

const dealerClassifications = _.uniq(HandRanks.map(hr => hr.pairSymbol));
const playerClassifications = Object.values(PlayerHandClassification);


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

    // Calculate the new brightness value
    let factor = percentage / 100;

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

    const [i, setI] = useState(0);

    useEffect(() => {
        let interval = setInterval(() => {
          playBlackjack();
          setI(i + 1);
        }, 100);
        return () => clearInterval(interval);
    }, [i]);

    const computeCellValue = (p: string, d: string) => {
        const allResultActions = results?.[p]?.[d];
        if (!allResultActions) return "X";
        const allResults = Object.entries(allResultActions);
        return _.maxBy(allResults, v => computeExpectedValue(v[1]))?.[0];
    }

    const computeCellBackgroundColor = (p: string, d: string) => {
        // console.log(p, d);
        const allResultActions = results?.[p]?.[d];
        if (!allResultActions) return "bg-gray-100";
        const allResults = Object.entries(allResultActions);
        const bestResult = _.maxBy(allResults, v => v[1][0])?.[1];
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
                    {handsPlayed.toLocaleString("en-US")}
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
                        .filter((_, i) => i < playerClassifications.length)
                        .map((p) => (
                            <tr key={p}>
                                <td className="table-header-value text-sm">{p}</td>
                                {
                                    dealerClassifications
                                        .filter((_, i) => i < dealerClassifications.length)
                                        .map((d) => (
                                            <Popover trigger="click" content={computePopoverContent(p, d)}>                                                
                                                <td key={d + p} style={{backgroundColor: computeCellBackgroundColor(p, d)}} className="text-sm">
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
    );
}

export default SimulationTable;
