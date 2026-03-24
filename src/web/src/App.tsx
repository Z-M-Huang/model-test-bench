import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { SetupList } from './pages/SetupList.js';
import { ScenarioList } from './pages/ScenarioList.js';
import { RunPage } from './pages/RunPage.js';
import { RunHistory } from './pages/RunHistory.js';
import { ReportView } from './pages/ReportView.js';

export function App(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<SetupList />} />
          <Route path="/setups" element={<SetupList />} />
          <Route path="/scenarios" element={<ScenarioList />} />
          <Route path="/run" element={<RunPage />} />
          <Route path="/history" element={<RunHistory />} />
          <Route path="/report/:id" element={<ReportView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
