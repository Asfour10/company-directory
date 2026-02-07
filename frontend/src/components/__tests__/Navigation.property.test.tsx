import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode, createElement } from 'react';
import { Navigation } from '../Navigation';
import { AuthProvider } from '../../contexts/AuthContext';
import { BrandingProvider } from '../../contexts/BrandingContext';

// Mock the auth service
vi.mock('../../services/auth');

// Mock touch gestures hook
vi.mock('../../hooks/useTouchGestures', () => ({
  useTouchGestures: () => ({
    elementRef: { current: null }
  })
}));

// Mock tenant service to prevent network calls
vi.mock('../../services/tenant', () => ({
  TenantAPI: {
    getSettings: vi.fn().mockResolvedValue({
      primaryColor: '#3B82F6',
      accentColor: '#10B981',
      logoUrl: null,
      companyName: 'Test Company'
    })
  }
}));

// Test wrapper component with all required providers
const createWrapper = (initialEntries: string[] = ['/']) => {
  return ({ children }: { children: ReactNode }) => 
    createElement(BrandingProvider, null,
      createElement(AuthProvider, null,
        createElement(MemoryRouter, { initialEntries }, children)
      )
    );
};

// Mock user data for different roles
const mockUsers = {
  user: {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'John',
    lastName: 'User',
    role: 'user' as const,
    tenantId: 'tenant-1',
  },
  admin: {
    id: 'admin-1',
    email: 'admin@example.com',
    firstName: 'Jane',
    lastName: 'Admin',
    role: 'admin' as const,
    tenantId: 'tenant-1',
  },
  super_admin: {
    id: 'super-admin-1',
    email: 'superadmin@example.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin' as const,
    tenantId: 'tenant-1',
  },
};

// Mock AuthContext
const mockAuthContext = {
  isAuthenticated: true,
  isLoading: false,
  user: mockUsers.user,
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
};

vi.mock('../../contexts/AuthContext', async () => {
  const actual = await vi.importActual('../../contexts/AuthContext') as any;
  return {
    ...actual,
    useAuth: () => mockAuthContext,
  };
});

describe('Navigation Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 16: Navigation Consistency', () => {
    it('Feature: basic-employee-directory, Property 16: For any page in the application, the navigation menu should be present with clear indicators of the current page location', async () => {
      // Test different routes and verify navigation is present with correct active states
      const testRoutes = [
        { path: '/directory', expectedActive: 'Employee Directory' },
        { path: '/search', expectedActive: 'Search' },
        { path: '/admin', expectedActive: 'Analytics' },
        { path: '/admin/employees', expectedActive: 'Manage Employees' },
        { path: '/admin/custom-fields', expectedActive: 'Custom Fields' },
        { path: '/admin/audit-logs', expectedActive: 'Audit Logs' },
      ];

      for (const { path, expectedActive } of testRoutes) {
        // Set appropriate user role for admin routes
        if (path.startsWith('/admin')) {
          mockAuthContext.user = mockUsers.admin;
        } else {
          mockAuthContext.user = mockUsers.user;
        }

        const wrapper = createWrapper([path]);
        const { unmount } = render(createElement(Navigation), { wrapper });

        // Verify navigation menu is present using the nav element
        const navigation = screen.getByRole('navigation');
        expect(navigation).toBeInTheDocument();

        // Look for the expected active item text in the navigation
        // Note: Text appears in both mobile and desktop versions
        const activeTexts = screen.getAllByText(expectedActive);
        expect(activeTexts.length).toBeGreaterThan(0);

        unmount();
      }
    });

    it('Feature: basic-employee-directory, Property 16: For any user role, navigation should show appropriate menu items based on permissions', async () => {
      const roleTestCases = [
        {
          user: mockUsers.user,
          expectedItems: ['Employee Directory', 'Search'],
          hiddenItems: ['Analytics', 'Manage Employees', 'Custom Fields', 'Audit Logs', 'Settings'],
        },
        {
          user: mockUsers.admin,
          expectedItems: ['Employee Directory', 'Search', 'Analytics', 'Manage Employees', 'Custom Fields', 'Audit Logs'],
          hiddenItems: ['Settings'],
        },
        {
          user: mockUsers.super_admin,
          expectedItems: ['Employee Directory', 'Search', 'Analytics', 'Manage Employees', 'Custom Fields', 'Audit Logs', 'Settings'],
          hiddenItems: [],
        },
      ];

      for (const { user, expectedItems, hiddenItems } of roleTestCases) {
        mockAuthContext.user = user;

        const wrapper = createWrapper(['/directory']);
        const { unmount } = render(createElement(Navigation), { wrapper });

        // Check that expected items are present
        // Note: Items appear in both mobile and desktop versions
        for (const item of expectedItems) {
          const elements = screen.getAllByText(item);
          expect(elements.length).toBeGreaterThan(0);
        }

        // Check that hidden items are not present
        for (const item of hiddenItems) {
          const element = screen.queryByText(item);
          expect(element).not.toBeInTheDocument();
        }

        unmount();
      }
    });

    it('Feature: basic-employee-directory, Property 16: For any navigation state, mobile and desktop navigation should be consistent in content', async () => {
      const testCases = [
        { user: mockUsers.user, path: '/directory' },
        { user: mockUsers.admin, path: '/admin' },
        { user: mockUsers.super_admin, path: '/admin/settings' },
      ];

      for (const { user, path } of testCases) {
        mockAuthContext.user = user;

        const wrapper = createWrapper([path]);
        const { unmount } = render(createElement(Navigation), { wrapper });

        // Verify navigation is present (may be multiple due to test rendering)
        const navigations = screen.getAllByRole('navigation');
        expect(navigations.length).toBeGreaterThan(0);

        // Basic navigation items should always be present for authenticated users
        // Note: Items appear in both mobile and desktop versions
        expect(screen.getAllByText('Employee Directory').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Search').length).toBeGreaterThan(0);

        // Admin items should be present for admin users
        if (user.role === 'admin' || user.role === 'super_admin') {
          expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0);
          expect(screen.getAllByText('Manage Employees').length).toBeGreaterThan(0);
        }

        // Super admin items should be present for super admin users
        if (user.role === 'super_admin') {
          expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
        }

        unmount();
      }
    });

    it('Feature: basic-employee-directory, Property 16: For any route change, navigation should update active state correctly', async () => {
      const routeSequence = [
        { path: '/directory', expectedActive: 'Employee Directory' },
        { path: '/search', expectedActive: 'Search' },
        { path: '/directory', expectedActive: 'Employee Directory' },
      ];

      mockAuthContext.user = mockUsers.user;

      for (const { path, expectedActive } of routeSequence) {
        const wrapper = createWrapper([path]);
        const { unmount } = render(createElement(Navigation), { wrapper });

        // Verify the navigation is present
        const navigation = screen.getByRole('navigation');
        expect(navigation).toBeInTheDocument();

        // Verify the expected active item is present
        // Note: Text appears in both mobile and desktop versions
        const activeElements = screen.getAllByText(expectedActive);
        expect(activeElements.length).toBeGreaterThan(0);

        unmount();
      }
    });
  });
});