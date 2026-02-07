import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import PlannerPage from './pages/PlannerPage';
import GeneratorPage from './pages/GeneratorPage';
import HealerPage from './pages/HealerPage';

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/planner" replace />} />
          <Route path="/planner" element={<PlannerPage />} />
          <Route path="/generator" element={<GeneratorPage />} />
          <Route path="/healer" element={<HealerPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;

