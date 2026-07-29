import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import WorkspaceLayout from './components/layout/WorkspaceLayout';
import { WORKSPACES } from './app/workspaces';
import { useAuthStore } from './store/useAuthStore';

import SignInPage from './pages/auth/SignInPage';

import HomePage from './pages/home/HomePage';
import FavoritesPage from './pages/home/FavoritesPage';
import RecentPage from './pages/home/RecentPage';
import SettingsPage from './pages/home/SettingsPage';
import NotFoundPage from './pages/home/NotFoundPage';

import MfcOverviewPage from './pages/mfc/MfcOverviewPage';
import MfcToolsPage from './pages/mfc/MfcToolsPage';
import DashboardPage from './pages/mfc/DashboardPage';
import SupplierSummaryPage from './pages/mfc/SupplierSummaryPage';
import SupplierProductsPage from './pages/mfc/SupplierProductsPage';
import ProductsPage from './pages/mfc/ProductsPage';
import ProductForecastPage from './pages/mfc/ProductForecastPage';
import RecommendationsPage from './pages/mfc/RecommendationsPage';
import RecommendPricesPage from './pages/mfc/RecommendPricesPage';
import UltrafreshAvailabilityLayout from './pages/mfc/UltrafreshAvailabilityLayout';

import GroceriesHomePage from './pages/groceries/GroceriesHomePage';
import GroceriesToolsPage from './pages/groceries/GroceriesToolsPage';
import RetailHomePage from './pages/retail/RetailHomePage';
import RetailToolsPage from './pages/retail/RetailToolsPage';

export default function App() {
  const user = useAuthStore((s) => s.user);
  const sessionChecked = useAuthStore((s) => s.sessionChecked);
  const markSessionChecked = useAuthStore((s) => s.markSessionChecked);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!user || sessionChecked) return;
    setChecking(true);
    if (window.electronAuth?.checkGoogleSession) {
      window.electronAuth.checkGoogleSession()
        .then((result) => { if (result.valid) markSessionChecked(); else clearAuth(); })
        .catch(() => clearAuth())
        .finally(() => setChecking(false));
    } else {
      markSessionChecked();
      setChecking(false);
    }
  }, []);

  const isAuthenticated = Boolean(user && sessionChecked);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center flex-col">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-xl bg-[#FFC244] flex items-center justify-center text-[#5c4200] font-bold text-2xl shadow-lg mb-2">G</div>
          <span className="material-symbols-outlined animate-spin text-[28px] text-[#FFC244]">progress_activity</span>
          <p className="text-[13px] text-secondary">Verifying session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <SignInPage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="favorites" element={<FavoritesPage />} />
        <Route path="recent" element={<RecentPage />} />
        <Route path="settings" element={<SettingsPage />} />

        <Route path="mfc" element={<WorkspaceLayout workspace={WORKSPACES.mfc} />}>
          <Route index element={<MfcOverviewPage />} />
          <Route path="tools" element={<MfcToolsPage />} />
          <Route path="suppliers" element={<UltrafreshAvailabilityLayout />}>
            <Route index element={<Navigate to="/mfc/suppliers/dashboard" replace />} />
            <Route path="summary" element={<SupplierSummaryPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="forecast" element={<ProductForecastPage />} />
            <Route path=":supplierName" element={<SupplierProductsPage />} />
            <Route path="recommendations" element={<RecommendationsPage />} />
            <Route path="prices" element={<RecommendPricesPage />} />
          </Route>
        </Route>

        <Route path="groceries" element={<WorkspaceLayout workspace={WORKSPACES.groceries} />}>
          <Route index element={<GroceriesHomePage />} />
          <Route path="tools" element={<GroceriesToolsPage />} />
        </Route>

        <Route path="retail" element={<WorkspaceLayout workspace={WORKSPACES.retail} />}>
          <Route index element={<RetailHomePage />} />
          <Route path="tools" element={<RetailToolsPage />} />
        </Route>

        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
