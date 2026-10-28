import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cases from './pages/Cases';
import Suspects from './pages/Suspects';
import Victims from './pages/Victims';
import Witnesses from './pages/Witnesses'; // <-- Add this
import EvidencePage from './pages/Evidence';
import Relationships from './pages/Relationships';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/suspects" element={<Suspects />} />
        <Route path="/victims" element={<Victims />} />
        <Route path="/witnesses" element={<Witnesses />} /> {/* <-- Add this */}
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="/relationships" element={<Relationships />} />
        <Route path="/settings" element={<div className="p-10 text-center font-bold text-slate-500">Settings coming soon</div>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}