import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider } from "@/hooks/use-auth";
import LoginPage from "@/pages/LoginPage/LoginPage";
import DailyHazardsPage from "@/pages/DailyHazardsPage/DailyHazardsPage";
import HazardSummaryPage from "@/pages/HazardSummaryPage/HazardSummaryPage";
import MemoPage from "@/pages/MemoPage/MemoPage";
import SafetyFilesPage from "@/pages/SafetyFilesPage/SafetyFilesPage";
import AccountSettingsPage from "@/pages/AccountSettingsPage/AccountSettingsPage";
import SpecialWorkPage from "@/pages/SpecialWorkPage/SpecialWorkPage";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* 登录页：公开访问 */}
        <Route path="/login" element={<LoginPage />} />

        {/* 受保护的业务页面 */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DailyHazardsPage />} />
          <Route path="summary" element={<HazardSummaryPage />} />
          <Route path="special-work" element={<SpecialWorkPage />} />
          <Route path="memo" element={<MemoPage />} />
          <Route path="files" element={<ProtectedRoute requireAdmin><SafetyFilesPage /></ProtectedRoute>} />
          <Route path="settings" element={<AccountSettingsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
