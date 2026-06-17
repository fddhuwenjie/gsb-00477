import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from 'react';
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import EquipmentPage from "@/pages/Equipment";
import EquipmentDetail from "@/pages/EquipmentDetail";
import ReservationPage from "@/pages/Reservation";
import UsagePage from "@/pages/Usage";
import TrainingPage from "@/pages/Training";
import StatisticsPage from "@/pages/Statistics";
import MaintenancePage from "@/pages/Maintenance";
import BorrowPage from "@/pages/Borrow";
import ProjectPage from "@/pages/Project";
import ReportPage from "@/pages/Report";
import { useAuthStore } from "@/store/auth.js";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, token, checkAuth } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!user && token) {
        await checkAuth();
      }
      setLoading(false);
    };
    init();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="equipment/:id" element={<EquipmentDetail />} />
          <Route path="reservation" element={<ReservationPage />} />
          <Route path="usage" element={<UsagePage />} />
          <Route path="training" element={<TrainingPage />} />
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="borrow" element={<BorrowPage />} />
          <Route path="project" element={<ProjectPage />} />
          <Route path="report" element={<ReportPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
