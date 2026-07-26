import { Divider, Switch } from "antd";
import { FC, useEffect, useState } from "react";
import { updateSettings, useSimulationResults } from "../../workers/simulationPool";
import { formatCount } from "../../util/format";

export const SettingsPane: FC = () => {
  const [hitSoft17, setHitSoft17] = useState(true);
  const [lateSurrenderAllowed, setLateSurrenderAllowed] = useState(false);
  const [doubleAfterSplitAllowed, setDoubleAfterSplitAllowed] = useState(true);
  const [resplitAcesAllowed, setResplitAcesAllowed] = useState(false);

  useEffect(() => {
    updateSettings({
      HIT_SOFT_17: hitSoft17,
      LATE_SURRENDER_ALLOWED: lateSurrenderAllowed,
      DOUBLE_AFTER_SPLIT_ALLOWED: doubleAfterSplitAllowed,
      RESPLIT_ACES_ALLOWED: resplitAcesAllowed,
    });
  }, [hitSoft17, lateSurrenderAllowed, doubleAfterSplitAllowed, resplitAcesAllowed]);

  const { handsPlayed, wins: totalWins, losses: totalLosses, pushes: totalPushes, overallEV } = useSimulationResults();

  return (
    <div className="h-full w-[500px] h-[750px] bg-orange-50 rounded-lg p-4 flex gap-y-4 flex-col">
      <div className="text-2xl font-bold text-center">Basic Strategy Learner</div>
      <Divider className="my-0" />
      <div className="flex flex-col gap-y-0.5">
        <div className="font-bold">INTRODUCTION</div>
        <p className="text-sm text-gray-600">
          Blackjack players often utilize various basic strategy cards without fully grasping the intuition behind
          its recommendations. This tool is an interactive basic strategy chart, populated via a Monte Carlo
          simulation running up to millions of blackjack hands per second. Click on a cell to understand how other
          decisions are not as good as the basic strategy recommendation, and for an example hand where the optimal
          decision gets rewarded.
        </p>
      </div>
      <Divider className="my-0" />
      <div className="font-bold">CASINO RULE SETTINGS</div>
      <div className="flex flex-col gap-y-0.5">
        <div className="flex w-full justify-between">
          <span className="font-semibold text-gray-600">Dealer must hit on soft 17</span>
          <Switch checked={hitSoft17} onChange={checked => setHitSoft17(checked)} />
        </div>
        <span className="text-xs font-light">This is typical in most North American casinos.</span>
      </div>
      <div className="flex flex-col gap-y-0.5">
        <div className="flex w-full justify-between">
          <span className="font-semibold text-gray-600">Late surrender allowed</span>
          <Switch checked={lateSurrenderAllowed} onChange={checked => setLateSurrenderAllowed(checked)} />
        </div>
        <span className="text-xs font-light">Player receives half their bet back to forfeit their starting hand.</span>
      </div>
      <div className="flex flex-col gap-y-0.5">
        <div className="flex w-full justify-between">
          <span className="font-semibold text-gray-600">Double after split allowed</span>
          <Switch checked={doubleAfterSplitAllowed} onChange={checked => setDoubleAfterSplitAllowed(checked)} />
        </div>
        <span className="text-xs font-light">This is typical in most North American casinos.</span>
      </div>
      <div className="flex flex-col gap-y-0.5">
        <div className="flex w-full justify-between">
          <span className="font-semibold text-gray-600">Re-split aces allowed</span>
          <Switch checked={resplitAcesAllowed} onChange={checked => setResplitAcesAllowed(checked)} />
        </div>
        <span className="text-xs font-light">Exception to normal "only one card after ace split" rule.</span>
      </div>
      <Divider className="my-0" />
      <div className="font-bold">RESULTS</div>
      <div className="flex w-full justify-between">
        <span className="font-semibold text-gray-600">Total hands played</span>
        <span>{formatCount(handsPlayed)}</span>
      </div>
      <div className="flex w-full justify-between">
        <span className="font-semibold text-gray-600">Wins<span className="mx-2">&#183;</span>Losses<span className="mx-2">&#183;</span>Pushes</span>
        <span>{formatCount(totalWins)}<span className="mx-2">&#183;</span>{formatCount(totalLosses)}<span className="mx-2">&#183;</span>{formatCount(totalPushes)}</span>
      </div>
      <div className="flex w-full justify-between">
        <span className="font-semibold text-gray-600">Overall expected value</span>
        <span>{overallEV}</span>
      </div>
    </div>
  )
}