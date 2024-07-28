import './App.css';
import { SettingsPane } from './components/settings-pane/SettingsPane';
import SimulationTable from './components/simulation-table/SimulationTable';

function App() {

  return (
    <div className="h-screen">
      <div className="h-full flex items-center gap-6 justify-evenly wrap">
        <SimulationTable />
        <SettingsPane />
      </div>
    </div>
  );
}

export default App;
