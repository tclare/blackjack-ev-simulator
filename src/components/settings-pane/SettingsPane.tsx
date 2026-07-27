import { Divider, Switch } from "antd";
import { FC, useEffect, useState } from "react";
import { updateSettings, useSimulationResults } from "../../workers/simulationPool";
import { formatCount } from "../../util/format";

export const AppTitle: FC = () => (
  <div className="text-2xl font-bold text-center">Basic Strategy Learner</div>
);

// Mobile has no sidebar to hold a subtitle, so the desktop's single "Basic Strategy Learner" line
// becomes a title/subtitle pair up top instead.
export const MobileAppTitle: FC = () => (
  <div className="flex flex-col items-center">
    <div className="text-2xl font-bold text-center">Basic Strategy Card</div>
    <div className="text-sm font-bold text-gray-500 text-center uppercase">An Interactive Simulation</div>
  </div>
);

interface SectionProps {
  // The desktop sidebar shows this bold uppercase line as its own section title; the mobile modals
  // instead surface the same title through antd's real Modal title bar (so its close "X" sits
  // naturally alongside it), which would otherwise leave this line duplicated inside the modal body.
  showHeader?: boolean;
}

export const IntroductionSection: FC<SectionProps> = ({ showHeader = true }) => (
  <div className="flex flex-col gap-y-4">
    {showHeader && <div className="font-bold">INTRODUCTION</div>}
    <p className="text-sm text-gray-600">
      Blackjack players often utilize various basic strategy cards without fully grasping the intuition behind
      its recommendations. This tool is an interactive basic strategy chart, populated via a Monte Carlo
      simulation running up to millions of blackjack hands per second. Click on a cell to understand how other
      decisions are not as good as the basic strategy recommendation, and for an example hand where the optimal
      decision gets rewarded.
    </p>
  </div>
);

// Owns the casino-rule state itself (rather than accepting it as props) so this section works as a
// drop-in for both the desktop sidebar and the mobile settings modal without either caller needing
// to manage the state.
export const CasinoRuleSettingsSection: FC<SectionProps> = ({ showHeader = true }) => {
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

  return (
    <div className="flex flex-col">
      {showHeader && <div className="font-bold mb-4">CASINO RULE SETTINGS</div>}
      {/* The label and its description live together in one column (min-w-0 so that column can
          actually shrink below its content's natural width instead of forcing an overflow), with the
          switch centered against that whole column via items-center. */}
      <div className="flex flex-col gap-y-2">
        <div className="flex w-full justify-between items-center gap-x-4 py-2">
          <div className="flex flex-col gap-y-0.5 min-w-0">
            <span className="font-semibold text-gray-600">Dealer must hit on soft 17</span>
            <span className="text-xs font-light">Otherwise, dealer stands on all 17s.</span>
          </div>
          <Switch checked={hitSoft17} onChange={checked => setHitSoft17(checked)} className="shrink-0" />
        </div>
        <div className="flex w-full justify-between items-center gap-x-4 py-2">
          <div className="flex flex-col gap-y-0.5 min-w-0">
            <span className="font-semibold text-gray-600">Late surrender allowed</span>
            <span className="text-xs font-light">Player receives half their bet back.</span>
          </div>
          <Switch checked={lateSurrenderAllowed} onChange={checked => setLateSurrenderAllowed(checked)} className="shrink-0" />
        </div>
        <div className="flex w-full justify-between items-center gap-x-4 py-2">
          <div className="flex flex-col gap-y-0.5 min-w-0">
            <span className="font-semibold text-gray-600">Double after split allowed</span>
            <span className="text-xs font-light">Only hits allowed otherwise.</span>
          </div>
          <Switch checked={doubleAfterSplitAllowed} onChange={checked => setDoubleAfterSplitAllowed(checked)} className="shrink-0" />
        </div>
        <div className="flex w-full justify-between items-center gap-x-4 py-2">
          <div className="flex flex-col gap-y-0.5 min-w-0">
            <span className="font-semibold text-gray-600">Re-split aces allowed</span>
            <span className="text-xs font-light">Exception to "one card after ace split" norm.</span>
          </div>
          <Switch checked={resplitAcesAllowed} onChange={checked => setResplitAcesAllowed(checked)} className="shrink-0" />
        </div>
      </div>
    </div>
  );
};

export const ResultsSection: FC<SectionProps> = ({ showHeader = true }) => {
  const { handsPlayed, wins: totalWins, losses: totalLosses, pushes: totalPushes, overallEV } = useSimulationResults();

  return (
    <div className="flex flex-col">
      {showHeader && <div className="font-bold mb-4">RESULTS</div>}
      <div className="flex flex-col gap-y-2">
        <div className="flex w-full justify-between">
          <span className="font-semibold text-gray-600">Total hands played</span>
          <span>{formatCount(handsPlayed)}</span>
        </div>
        <div className="flex w-full justify-between">
          <span className="font-semibold text-gray-600">Wins<span className="mx-1">&#183;</span>Losses<span className="mx-1">&#183;</span>Pushes</span>
          <span>{formatCount(totalWins)}<span className="mx-1">&#183;</span>{formatCount(totalLosses)}<span className="mx-1">&#183;</span>{formatCount(totalPushes)}</span>
        </div>
        <div className="flex w-full justify-between">
          <span className="font-semibold text-gray-600">Overall expected value</span>
          <span>{overallEV}</span>
        </div>
      </div>
    </div>
  );
};

export const SettingsPane: FC = () => (
  <div className="h-full w-[500px] h-[750px] bg-orange-50 rounded-lg p-4 flex gap-y-4 flex-col">
    <AppTitle />
    <Divider className="my-0" />
    <IntroductionSection />
    <Divider className="my-0" />
    <CasinoRuleSettingsSection />
    <Divider className="my-0" />
    <ResultsSection />
  </div>
);
