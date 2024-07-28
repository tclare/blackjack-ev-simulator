import { Divider, Switch } from "antd";
import { FC, useEffect, useState } from "react";
import { DECK_SETTINGS, clearResults, results } from "../../util/deck";
import _ from "lodash";


function sumNthElements(n: number): number {
  // Step 1: Extract all arrays from the nested structure
  const allArrays: number[][] = _.flatMap(results, (d) => 
      _.flatMap(d, (a) => 
          _.values(a)
      )
  );

  // Step 2: Map each array to its 1st element (index 1)
  const firstElements = allArrays.map(arr => arr[n]);

  // Step 3: Sum up these elements
  const sum = _.sum(firstElements);

  return sum;
}

// Function to calculate the overall weighted expected value
function calculateOverallExpectedValue(): string {
  // Step 1: Identify the best EV in each category
  const bestEVs: number[][] = _.flatMap(results, (d) =>
      _.flatMap(d, (a) => {
          const bestEntry = _.maxBy(_.entries(a), ([, value]) => value[0] / value[1]);
          return bestEntry ? [bestEntry[1]] : [];
      })
  );

  // Step 2: Aggregate total money and total times played from best EVs
  let totalMoney = 0;
  let totalTimesPlayed = 0;

  bestEVs.forEach(arr => {
      totalMoney += arr[0];
      totalTimesPlayed += arr[1];
  });

  // Step 3: Calculate the weighted expected value
  const weightedExpectedValue = totalMoney / totalTimesPlayed;

  return `${weightedExpectedValue > 0 ? "+" : ""}${weightedExpectedValue.toFixed(1)}%`;
}

export const SettingsPane: FC = () => {
  const [hitSoft17, setHitSoft17] = useState(true);

  useEffect(() => {
    DECK_SETTINGS["HIT_SOFT_17"] = hitSoft17;
    clearResults();
  }, [hitSoft17]);


  const [totalResults, setTotalResults] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [totalLosses, setTotalLosses] = useState(0);
  const [totalPushes, setTotalPushes] = useState(0);
  const [overallEV, setOverallEV] = useState("0%");

  useEffect(() => {
    let interval = setInterval(() => {
      setTotalResults(sumNthElements(1));
      setTotalWins(sumNthElements(2));
      setTotalLosses(sumNthElements(3));
      setTotalPushes(sumNthElements(4));
      setOverallEV(calculateOverallExpectedValue())
    }, 100);
    return () => clearInterval(interval);
  }, []);



  return (
    <div className="h-full w-[500px] h-[750px] bg-orange-50 rounded-lg p-4 flex gap-y-4 flex-col">
      <div className="text-2xl font-bold text-center">Basic Strategy Learner</div>
      <Divider className="my-0" />
      <div className="font-bold">CASINO RULE SETTINGS</div>
      <div className="flex flex-col gap-y-0.5">
        <div className="flex w-full justify-between">
          <span className="font-semibold text-gray-600">Dealer must hit on soft 17</span>
          <Switch checked={hitSoft17} onChange={checked => setHitSoft17(checked)} />
        </div>
        <span className="text-xs font-light">This is typical in most North American casinos.</span>
      </div>
      <Divider className="my-0" />
      <div className="font-bold">RESULTS</div>
      <div className="flex w-full justify-between">
        <span className="font-semibold text-gray-600">Total hands played</span>
        <span>{totalResults.toLocaleString("en-US")}</span>
      </div>
      <div className="flex w-full justify-between">
        <span className="font-semibold text-gray-600">Wins &#183; Losses &#183; Pushes</span>
        <span>{totalWins.toLocaleString("en-US")} &#183; {totalLosses.toLocaleString("en-US")} &#183; {totalPushes.toLocaleString("en-US")}</span>
      </div>
      <div className="flex w-full justify-between">
        <span className="font-semibold text-gray-600">Overall expected value</span>
        <span>{overallEV}</span>
      </div>
    </div>
  )
}