import { Grid } from 'antd';
import { useState } from 'react';
import {
  FolderOpenFilled,
  InfoCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import './App.css';
import { CasinoRuleSettingsSection, IntroductionSection, MobileAppTitle, ResultsSection, SettingsPane } from './components/settings-pane/SettingsPane';
import { SimpleModal } from './components/SimpleModal';
import SimulationTable from './components/simulation-table/SimulationTable';

type MobileModalKind = "introduction" | "settings" | "results";

function App() {
  // "lg" is antd's 992px breakpoint - below it we collapse into the icon-driven mobile layout.
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.lg;
  // Lazy initializer, not a plain default - only evaluated once on this component's first render,
  // so the Introduction modal opens automatically on page load, but only for the mobile layout.
  const [openMobileModal, setOpenMobileModal] = useState<MobileModalKind | undefined>(() => isMobile ? "introduction" : undefined);

  if (isMobile) {
    // Flexbox divides remaining space (viewport height minus the title's and content's own
    // heights) among the three flex-grow spacers below in a 1:1:2 ratio. Giving the bottom spacer
    // twice the weight of the other two makes it exactly equal to their combined size - which both
    // centers the content block as a whole (top gap == bottom gap) AND, since the two spacers making
    // up that top gap are equal to each other, puts the title at the exact midpoint of the space
    // between the viewport's top edge and the content block's top edge. All without measuring
    // anything - it falls out of the ratio alone.
    return (
      <div className="h-screen flex flex-col">
        <div className="flex-1" />
        <div className="flex flex-col items-center px-4">
          <MobileAppTitle />
          <div className="flex justify-center gap-x-4 mt-3">
            <InfoCircleOutlined onClick={() => setOpenMobileModal("introduction")} />
            <FolderOpenFilled onClick={() => setOpenMobileModal("results")} />
            <SettingOutlined onClick={() => setOpenMobileModal("settings")} />
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex justify-center px-4">
          <SimulationTable isMobile />
        </div>
        <div className="flex-[2]" />
        <SimpleModal title="Introduction" open={openMobileModal === "introduction"} onClose={() => setOpenMobileModal(undefined)}>
          <IntroductionSection showHeader={false} />
        </SimpleModal>
        <SimpleModal title="Casino Rule Settings" open={openMobileModal === "settings"} onClose={() => setOpenMobileModal(undefined)}>
          <CasinoRuleSettingsSection showHeader={false} />
        </SimpleModal>
        <SimpleModal title="Results" open={openMobileModal === "results"} onClose={() => setOpenMobileModal(undefined)}>
          <ResultsSection showHeader={false} />
        </SimpleModal>
      </div>
    );
  }

  return (
    <div className="h-screen">
      <div className="h-full flex items-center gap-6 justify-evenly wrap">
        <SimulationTable isMobile={false} />
        <SettingsPane />
      </div>
    </div>
  );
}

export default App;
