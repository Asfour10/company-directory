import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactNode, createElement } from 'react';
import { AuthProvider, useAuth } from '../AuthContext';
import { AuthService } from '../../services/auth';

// Mock the AuthService
vi.mock('../../services/auth');
const mockAuthService = vi.mocked(AuthService);

// Mock localStorage with proper Vitest spies
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

// Create a proper mock that implements the Storage interface
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Test wrapper component
const createWrapper = () => {
  return ({ children }: { children: ReactNode }) => 
    createElement(AuthProvider, null, children);
};

describe('AuthContext Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Property 5: Secure Token Storage', () => {
    it('Feature: basic-employee-directory, Property 5: For any successful authentication, JWT tokens should be stored securely in browser localStorage', async () => {
      const testCases = [
        {
          email: 'user1@example.com',
          password: 'password123',
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test1',
          refreshToken: 'refresh_token_1',
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'user',
            tenantId: 'tenant-1',
          },
        },
        {
          email: 'admin@company.com',
          password: 'adminpass456',
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test2',
          refreshToken: 'refresh_token_2',
          user: {
            id: 'admin-1',
            email: 'admin@company.com',
            firstName: 'Jane',
            lastName: 'Admin',
            role: 'admin',
            tenantId: 'tenant-1',
          },
        },
      ];

      for (const { email, password, token, refreshToken, user } of testCases) {
        // Mock successful login response
        mockAuthService.login.mockResolvedValueOnce({
          user,
          token,
          refreshToken,
        });

        const wrapper = createWrapper();
        const { result } = renderHook(() => useAuth(), { wrapper });

        // Perform login
        await act(async () => {
          await result.current.login(email, password);
        });

        // Verify token is stored in localStorage (not sessionStorage or cookies)
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('authToken', token);
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', refreshToken);
        
        // Verify user is authenticated after successful login
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.user).toEqual(user);

        // Reset mocks for next iteration
        vi.clearAllMocks();
      }
    });

    it('Feature: basic-employee-directory, Property 5: For any logout operation, JWT tokens should be removed from localStorage', async () => {
      const testCases = [
        {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test1',
          refreshToken: 'refresh_token_1',
        },
        {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test2',
          refreshToken: 'refresh_token_2',
        },
      ];

      for (const { token, refreshToken } of testCases) {
        // Setup initial state with tokens in localStorage
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'authToken') return token;
          if (key === 'refreshToken') return refreshToken;
          return null;
        });

        // Mock successful logout
        mockAuthService.logout.mockResolvedValueOnce(undefined);

        const wrapper = createWrapper();
        const { result } = renderHook(() => useAuth(), { wrapper });

        // Perform logout
        await act(async () => {
          await result.current.logout();
        });

        // Verify tokens are removed from localStorage
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refreshToken');
        
        // Verify user is no longer authenticated
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.user).toBeNull();

        // Reset mocks for next iteration
        vi.clearAllMocks();
      }
    });

    it('Feature: basic-employee-directory, Property 5: For any token validation failure, tokens should be removed from localStorage', async () => {
      const testCases = [
        {
          invalidToken: 'invalid.token.1',
          refreshToken: 'refresh_token_1',
        },
        {
          invalidToken: 'malformed-token',
          refreshToken: 'refresh_token_2',
        },
      ];

      for (const { invalidToken, refreshToken } of testCases) {
        // Setup localStorage with invalid token
        mockLocalStorage.getItem.mockImplementation((key) => {
          if (key === 'authToken') return invalidToken;
          if (key === 'refreshToken') return refreshToken;
          return null;
        });

        // Mock token validation failure
        mockAuthService.validateToken.mockRejectedValueOnce(new Error('Invalid token'));

        const wrapper = createWrapper();
        renderHook(() => useAuth(), { wrapper });

        // Wait for initialization to complete
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 0));
        });

        // Verify tokens are removed from localStorage on validation failure
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refreshToken');

        // Reset mocks for next iteration
        vi.clearAllMocks();
      }
    });
  });
});