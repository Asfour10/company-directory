import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { BrandingProvider } from './contexts/BrandingContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/MainLayout';
import { LoginPage } from './pages/LoginPage';
import { SSOCallbackPage } from './pages/SSOCallbackPage';

function App() {
  return (
    <BrandingProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sso/callback" element={<SSOCallbackPage />} />
            
            {/* Protected routes - all handled by MainLayout */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </AuthProvider>
    </BrandingProvider>
  );
}

export default App;