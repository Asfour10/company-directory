import React, { useState, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Navigation } from './Navigation';
import { Breadcrumbs } from './Breadcrumbs';
import { EmployeeProfileModal } from './EmployeeProfileModal';
import { Employee } from '../types/api';
import { BrandedButton } from './BrandedButton';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

// Lazy load page components for better performance
const SearchPage = React.lazy(() => import('./SearchPage').then(module => ({ default: module.SearchPage })));
const BrandingDemo = React.lazy(() => import('./BrandingDemo').then(module => ({ default: module.BrandingDemo })));
const EmployeeDirectoryPage = React.lazy(() => import('../pages/EmployeeDirectoryPage').then(module => ({ default: module.EmployeeDirectoryPage })));
const EmployeeProfilePage = React.lazy(() => import('../pages/EmployeeProfilePage').then(module => ({ default: module.EmployeeProfilePage })));
const EmployeeEditPage = React.lazy(() => import('../pages/EmployeeEditPage').then(module => ({ default: module.EmployeeEditPage })));
const AdminDashboardPage = React.lazy(() => import('../pages/AdminDashboardPage').then(module => ({ default: module.AdminDashboardPage })));
const AdminEmployeeManagementPage = React.lazy(() => import('../pages/AdminEmployeeManagementPage').then(module => ({ default: module.AdminEmployeeManagementPage })));
const AdminCustomFieldsPage = React.lazy(() => import('../pages/AdminCustomFieldsPage').then(module => ({ default: module.AdminCustomFieldsPage })));
const AdminAuditLogPage = React.lazy(() => import('../pages/AdminAuditLogPage').then(module => ({ default: module.AdminAuditLogPage })));
const AdminTenantSettingsPage = React.lazy(() => import('../pages/AdminTenantSettingsPage').then(module => ({ default: module.AdminTenantSettingsPage })));

// Loading fallback component
const PageLoadingFallback: React.FC = () => (
  <div className="flex justify-center items-center py-12">
    <LoadingSpinner size="lg" />
  </div>
);

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Navigation error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-12">
          <div className="rounded-full h-12 w-12 bg-red-100 mx-auto flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-responsive-xl font-bold text-gray-900 mb-4">Something went wrong</h2>
          <p className="text-responsive-sm text-gray-600 mb-6">
            We encountered an error while loading this page. Please try refreshing or go back to the directory.
          </p>
          <div className="space-x-4">
            <BrandedButton 
              onClick={() => window.location.reload()}
              className="touch-target"
            >
              Refresh Page
            </BrandedButton>
            <BrandedButton 
              variant="ghost"
              onClick={() => window.location.href = '/directory'}
              className="touch-target"
            >
              Go to Directory
            </BrandedButton>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export const MainLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const handleEmployeeClick = (employee: Employee) => {
    setSelectedEmployeeId(employee.id);
    setShowProfileModal(true);
  };

  const handleCloseModal = () => {
    setShowProfileModal(false);
    setSelectedEmployeeId(null);
  };

  const handleEditEmployee = (employee: Employee) => {
    // For now, just close the modal and show an alert
    // In a full implementation, this would navigate to edit page
    setShowProfileModal(false);
    alert(`Edit functionality for ${employee.firstName} ${employee.lastName} coming soon!`);
  };

  const isAdmin = user && (user.role === 'admin' || user.role === 'super_admin');
  const isSuperAdmin = user && user.role === 'super_admin';

  // Determine page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/' || path === '/directory') return 'Employee Directory';
    if (path === '/search') return 'Search';
    if (path === '/admin') return 'Analytics Dashboard';
    if (path === '/admin/employees') return 'Employee Management';
    if (path === '/admin/custom-fields') return 'Custom Fields';
    if (path === '/admin/audit-logs') return 'Audit Logs';
    if (path === '/admin/settings') return 'Tenant Settings';
    if (path === '/branding') return 'Branding Demo';
    if (path.startsWith('/employees/') && path.endsWith('/edit')) return 'Edit Employee';
    if (path.startsWith('/employees/')) return 'Employee Profile';
    return 'Company Directory';
  };

  return (
    <div className="min-h-screen bg-gray-50 safe-top safe-bottom">
      <Header title={getPageTitle()} />
      <Navigation />
      
      {/* Breadcrumbs */}
      <div className="container-mobile py-2">
        <Breadcrumbs />
      </div>

      <main className="container-mobile space-mobile-y pb-safe">
        <ErrorBoundary>
          <Suspense fallback={<PageLoadingFallback />}>
            <Routes>
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/directory" replace />} />
              
              {/* Public routes */}
              <Route 
                path="/directory" 
                element={<EmployeeDirectoryPage onEmployeeClick={handleEmployeeClick} />} 
              />
              <Route 
                path="/search" 
                element={<SearchPage onEmployeeClick={handleEmployeeClick} />} 
              />
              <Route 
                path="/branding" 
                element={<BrandingDemo />} 
              />
              
              {/* Employee profile routes */}
              <Route 
                path="/employees/:id" 
                element={<EmployeeProfilePage />} 
              />
              <Route 
                path="/employees/:id/edit" 
                element={<EmployeeEditPage />} 
              />
              
              {/* Admin routes - protected by role */}
              {isAdmin && (
                <>
                  <Route 
                    path="/admin" 
                    element={<AdminDashboardPage />} 
                  />
                  <Route 
                    path="/admin/employees" 
                    element={<AdminEmployeeManagementPage />} 
                  />
                  <Route 
                    path="/admin/custom-fields" 
                    element={<AdminCustomFieldsPage />} 
                  />
                  <Route 
                    path="/admin/audit-logs" 
                    element={<AdminAuditLogPage />} 
                  />
                  {isSuperAdmin && (
                    <Route 
                      path="/admin/settings" 
                      element={<AdminTenantSettingsPage />} 
                    />
                  )}
                </>
              )}
              
              {/* 404 fallback */}
              <Route path="*" element={
                <div className="text-center py-12">
                  <div className="rounded-full h-12 w-12 bg-gray-100 mx-auto flex items-center justify-center mb-4">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-responsive-xl font-bold text-gray-900 mb-4">Page Not Found</h2>
                  <p className="text-responsive-sm text-gray-600 mb-6">The page you're looking for doesn't exist or you don't have permission to access it.</p>
                  <div className="space-x-4">
                    <BrandedButton 
                      onClick={() => window.location.href = '/directory'}
                      className="touch-target"
                    >
                      Go to Directory
                    </BrandedButton>
                    <BrandedButton 
                      variant="ghost"
                      onClick={() => window.history.back()}
                      className="touch-target"
                    >
                      Go Back
                    </BrandedButton>
                  </div>
                </div>
              } />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Employee Profile Modal */}
      {selectedEmployeeId && (
        <EmployeeProfileModal
          employeeId={selectedEmployeeId}
          isOpen={showProfileModal}
          onClose={handleCloseModal}
          onEdit={handleEditEmployee}
        />
      )}
    </div>
  );
};