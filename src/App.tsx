import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from './lib/i18n';
import { AuthProvider } from './features/auth/AuthContext';
import { AppLockProvider } from './features/auth/AppLockContext';
import { PinLockOverlay } from './features/auth/PinLockOverlay';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LoginForm } from './features/auth/LoginForm';
import { Header } from './components/common/Header';
import { BottomNav } from './components/common/BottomNav';
import { OfflineBanner } from './components/common/OfflineBanner';
import { DashboardView } from './features/dashboard/DashboardView';
import { CustomerList } from './features/customers/CustomerList';
import { MortgageListPage } from './features/mortgages/MortgageListPage';
import { NewMortgagePage } from './features/mortgages/NewMortgagePage';
import { MortgageDetailView } from './features/mortgages/MortgageDetailView';
import { DueListPage } from './features/due-list/DueListPage';
import { ReceiptsPage } from './features/receipts/ReceiptsPage';
import { ReportsPage } from './features/reports/ReportsPage';
import { SettingsPage } from './features/settings/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: 1,
    },
  },
});

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <OfflineBanner />
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <AppLockProvider>
            <PinLockOverlay />
            <BrowserRouter>
              <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<LoginForm />} />

              {/* Protected App Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <DashboardView />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/customers"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <CustomerList />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mortgages"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <MortgageListPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mortgages/new"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <NewMortgagePage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/mortgages/:id"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <MortgageDetailView />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/due-list"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <DueListPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/receipts"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ReceiptsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute requiredRole="owner">
                    <AppLayout>
                      <ReportsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <SettingsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          </AppLockProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
};

export default App;
