import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import { ToastProvider } from './components/Toast';
import { GlobalErrorBoundary } from './components/GlobalErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { EditorPage } from './pages/EditorPage';
import { SettingsHub } from './pages/SettingsHub';
import { OAuthConsentPage } from './pages/OAuthConsentPage';

function AppRoutes() {
  const { setupNeeded, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // If setup is needed, redirect to setup page
  if (setupNeeded) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  // If logged in and must change password, redirect to change password page
  if (user?.mustChangePassword) {
    return (
      <Routes>
        <Route path="/change-password" element={<ChangePasswordPage isRequired={true} />} />
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />
      <Route path="/oauth/consent" element={<OAuthConsentPage />} />
      {/* Settings routes with nested section parameter */}
      <Route
        path="/settings/:section?"
        element={
          <ProtectedRoute>
            <SettingsHub />
          </ProtectedRoute>
        }
      />
      {/* Legacy routes redirect to settings hub with appropriate section */}
      <Route path="/profile" element={<Navigate to="/settings/profile" replace />} />
      <Route path="/admin" element={<Navigate to="/settings/admin" replace />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <EditorPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <GlobalErrorBoundary>
        <AuthProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AppRoutes />
            </ConfirmProvider>
          </ToastProvider>
        </AuthProvider>
      </GlobalErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
