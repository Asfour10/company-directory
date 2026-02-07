import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { ReactNode, createElement } from 'react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { AuthService } from '../../services/auth';

// Mock the AuthService
vi.mock('../../services/auth');
const mockAuthService = vi.mocked(AuthService);

// Mock the BrandingContext to prevent network calls
vi.mock('../../contexts/BrandingContext', () => ({
  BrandingProvider: ({ children }: { children: ReactNode }) => createElement('div', null, children),
  useBranding: () => ({
    theme: {
      primaryColor: '#3B82F6',
      accentColor: '#10B981',
      tenantName: 'Test Company',
    },
    isLoading: false,
    error: null,
    refreshBranding: vi.fn(),
    updateTheme: vi.fn(),
  }),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Test wrapper component with all required providers
const createWrapper = (initialEntries: string[] = ['/']) => {
  return ({ children }: { children: ReactNode }) => 
    createElement(AuthProvider, null,
      createElement(MemoryRouter, { initialEntries }, children)
    );
};

// Test component that uses auth context
const TestComponent: React.FC = () => {
  const { isAuthenticated, user, isLoading } = useAuth();
  
  if (isLoading) {
    return <div data-testid="loading">Loading...</div>;
  }
  
  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'not-authenticated'}</div>
      <div data-testid="user-info">{user ? `${user.firstName} ${user.lastName}` : 'no-user'}</div>
      <div data-testid="user-role">{user?.role || 'no-role'}</div>
    </div>
  );
};

// Mock user data
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  role: 'user' as const,
  tenantId: 'tenant-1',
};

describe('Session Persistence Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 18: Session Persistence', () => {
    it('Feature: basic-employee-directory, Property 18: For any authenticated user navigating between pages, their authentication state should be maintained throughout the session', async () => {
      // Test cases for different navigation scenarios
      const navigationTestCases = [
        {
          description: 'Navigate from directory to search',
          routes: ['/directory', '/search'],
          token: 'valid-token-1',
          refreshToken: 'refresh-token-1',
        },
        {
          description: 'Navigate from search to profile',
          routes: ['/search', '/employees/123'],
          token: 'valid-token-2',
          refreshToken: 'refresh-token-2',
        },
        {
          description: 'Navigate through multiple admin pages',
          routes: ['/admin', '/admin/employees', '/admin/settings'],
          token: 'valid-admin-token',
          refreshToken: 'refresh-admin-token',
        },
        {
          description: 'Navigate back and forth between pages',
          routes: ['/directory', '/search', '/directory', '/employees/456'],
          token: 'valid-token-3',
          refreshToken: 'refresh-token-3',
        },
      ];

      for (const { description, routes, token, refreshToken } of navigationTestCases) {
        // Setup localStorage with valid tokens
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'authToken') return token;
          if (key === 'refreshToken') return refreshToken;
          return null;
        });

        // Mock successful token validation
        mockAuthService.validateToken.mockResolvedValue(mockUser);

        // Test navigation through each route
        for (let i = 0; i < routes.length; i++) {
          const currentRoute = routes[i];
          const wrapper = createWrapper([currentRoute]);
          
          const { unmount } = render(createElement(TestComponent), { wrapper });

          // Wait for authentication to initialize
          await waitFor(() => {
            expect(screen.getByTestId('auth-status')).not.toHaveTextContent('Loading');
          });

          // Verify authentication state is maintained
          expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
          expect(screen.getByTestId('user-info')).toHaveTextContent('John Doe');
          expect(screen.getByTestId('user-role')).toHaveTextContent('user');

          // Verify token validation was called
          expect(mockAuthService.validateToken).toHaveBeenCalled();

          unmount();
        }

        // Reset mocks for next test case
        vi.clearAllMocks();
      }
    });

    it('Feature: basic-employee-directory, Property 18: For any page refresh, authentication state should be restored from localStorage', async () => {
      const refreshTestCases = [
        {
          description: 'Refresh on directory page',
          route: '/directory',
          token: 'persistent-token-1',
          refreshToken: 'persistent-refresh-1',
          user: { ...mockUser, firstName: 'Alice', lastName: 'Smith' },
        },
        {
          description: 'Refresh on admin page',
          route: '/admin',
          token: 'persistent-admin-token',
          refreshToken: 'persistent-admin-refresh',
          user: { ...mockUser, firstName: 'Bob', lastName: 'Admin', role: 'admin' as const },
        },
        {
          description: 'Refresh on profile page',
          route: '/employees/789',
          token: 'persistent-token-2',
          refreshToken: 'persistent-refresh-2',
          user: { ...mockUser, firstName: 'Charlie', lastName: 'Manager', role: 'manager' as const },
        },
      ];

      for (const { description, route, token, refreshToken, user } of refreshTestCases) {
        // Setup localStorage with persistent tokens
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'authToken') return token;
          if (key === 'refreshToken') return refreshToken;
          return null;
        });

        // Mock successful token validation with user data
        mockAuthService.validateToken.mockResolvedValue(user);

        // Simulate page refresh by creating new component instance
        const wrapper = createWrapper([route]);
        const { unmount } = render(createElement(TestComponent), { wrapper });

        // Wait for authentication to initialize from localStorage
        await waitFor(() => {
          expect(screen.getByTestId('auth-status')).not.toHaveTextContent('Loading');
        });

        // Verify authentication state is restored
        expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        expect(screen.getByTestId('user-info')).toHaveTextContent(`${user.firstName} ${user.lastName}`);
        expect(screen.getByTestId('user-role')).toHaveTextContent(user.role);

        // Verify token was read from localStorage and validated
        expect(mockLocalStorage.getItem).toHaveBeenCalledWith('authToken');
        expect(mockAuthService.validateToken).toHaveBeenCalled();

        unmount();
        vi.clearAllMocks();
      }
    });

    it('Feature: basic-employee-directory, Property 18: For any invalid or expired token, authentication state should be cleared and user redirected to login', async () => {
      const invalidTokenTestCases = [
        {
          description: 'Expired token',
          token: 'expired-token',
          refreshToken: 'expired-refresh',
          error: new Error('Token expired'),
        },
        {
          description: 'Malformed token',
          token: 'malformed.token',
          refreshToken: 'valid-refresh',
          error: new Error('Invalid token format'),
        },
        {
          description: 'Revoked token',
          token: 'revoked-token',
          refreshToken: 'revoked-refresh',
          error: new Error('Token revoked'),
        },
      ];

      for (const { description, token, refreshToken, error } of invalidTokenTestCases) {
        // Setup localStorage with invalid tokens
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'authToken') return token;
          if (key === 'refreshToken') return refreshToken;
          return null;
        });

        // Mock token validation failure
        mockAuthService.validateToken.mockRejectedValue(error);

        const wrapper = createWrapper(['/directory']);
        const { unmount } = render(createElement(TestComponent), { wrapper });

        // Wait for authentication to fail
        await waitFor(() => {
          expect(screen.getByTestId('auth-status')).not.toHaveTextContent('Loading');
        });

        // Verify authentication state is cleared
        expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
        expect(screen.getByTestId('user-info')).toHaveTextContent('no-user');
        expect(screen.getByTestId('user-role')).toHaveTextContent('no-role');

        // Verify tokens are removed from localStorage
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refreshToken');

        unmount();
        vi.clearAllMocks();
      }
    });

    it('Feature: basic-employee-directory, Property 18: For any concurrent navigation, authentication state should remain consistent', async () => {
      const concurrentTestCases = [
        {
          description: 'Multiple rapid navigation changes',
          routes: ['/directory', '/search', '/admin', '/directory'],
          token: 'concurrent-token-1',
          refreshToken: 'concurrent-refresh-1',
        },
        {
          description: 'Navigation during token refresh',
          routes: ['/employees/123', '/employees/456', '/search'],
          token: 'concurrent-token-2',
          refreshToken: 'concurrent-refresh-2',
        },
      ];

      for (const { description, routes, token, refreshToken } of concurrentTestCases) {
        // Setup localStorage with valid tokens
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'authToken') return token;
          if (key === 'refreshToken') return refreshToken;
          return null;
        });

        // Mock successful token validation
        mockAuthService.validateToken.mockResolvedValue(mockUser);

        // Create multiple component instances to simulate concurrent navigation
        const components = routes.map(route => {
          const wrapper = createWrapper([route]);
          return render(createElement(TestComponent), { wrapper });
        });

        // Wait for all components to initialize
        await Promise.all(components.map(async ({ container }) => {
          await waitFor(() => {
            const authStatus = container.querySelector('[data-testid="auth-status"]');
            expect(authStatus?.textContent).not.toBe('Loading');
          });
        }));

        // Verify all components show consistent authentication state
        components.forEach(({ container }) => {
          const authStatus = container.querySelector('[data-testid="auth-status"]');
          const userInfo = container.querySelector('[data-testid="user-info"]');
          const userRole = container.querySelector('[data-testid="user-role"]');

          expect(authStatus?.textContent).toBe('authenticated');
          expect(userInfo?.textContent).toBe('John Doe');
          expect(userRole?.textContent).toBe('user');
        });

        // Cleanup
        components.forEach(({ unmount }) => unmount());
        vi.clearAllMocks();
      }
    });

    it('Feature: basic-employee-directory, Property 18: For any session timeout, authentication state should be cleared across all components', async () => {
      const sessionTimeoutTestCases = [
        {
          description: 'Session timeout during navigation',
          initialRoute: '/directory',
          token: 'timeout-token-1',
          refreshToken: 'timeout-refresh-1',
        },
        {
          description: 'Session timeout on admin page',
          initialRoute: '/admin',
          token: 'timeout-admin-token',
          refreshToken: 'timeout-admin-refresh',
        },
      ];

      for (const { description, initialRoute, token, refreshToken } of sessionTimeoutTestCases) {
        // Setup localStorage with valid tokens initially
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'authToken') return token;
          if (key === 'refreshToken') return refreshToken;
          return null;
        });

        // Mock initial successful validation
        mockAuthService.validateToken.mockResolvedValueOnce(mockUser);

        const wrapper = createWrapper([initialRoute]);
        const { unmount } = render(createElement(TestComponent), { wrapper });

        // Wait for initial authentication
        await waitFor(() => {
          expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
        });

        // Simulate session timeout by making token validation fail and clearing localStorage
        mockAuthService.validateToken.mockRejectedValue(new Error('Session timeout'));
        mockLocalStorage.getItem.mockReturnValue(null);

        // Unmount the first component completely
        unmount();
        
        // Wait a bit to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 50));

        // Remount to simulate navigation that would trigger re-validation
        const newWrapper = createWrapper(['/search']);
        const { unmount: unmount2 } = render(createElement(TestComponent), { wrapper: newWrapper });

        // Wait for authentication to be cleared
        await waitFor(() => {
          expect(screen.getByTestId('auth-status')).toHaveTextContent('not-authenticated');
        });

        // Verify user info is cleared
        expect(screen.getByTestId('user-info')).toHaveTextContent('no-user');
        expect(screen.getByTestId('user-role')).toHaveTextContent('no-role');

        unmount2();
        vi.clearAllMocks();
      }
    });
  });
});