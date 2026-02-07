import api from './api';
import { User } from '../contexts/AuthContext';

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

export interface TokenValidationResponse {
  user: User;
  valid: boolean;
}

export class AuthService {
  /**
   * Login with email and password
   */
  static async login(email: string, password: string): Promise<LoginResponse> {
    const response = await api.post('/auth/login', { email, password });
    return {
      user: response.data.user,
      token: response.data.accessToken,
      refreshToken: response.data.refreshToken || response.data.accessToken // Use accessToken as fallback
    };
  }

  /**
   * Get SSO login URL for provider
   */
  static async getSSOUrl(provider: string): Promise<string> {
    const response = await api.get(`/auth/sso/${provider}/url`);
    return response.data.url;
  }

  /**
   * Handle SSO callback
   */
  static async handleSSOCallback(provider: string, code: string, state?: string): Promise<LoginResponse> {
    const response = await api.post(`/auth/sso/${provider}/callback`, { code, state });
    return response.data;
  }

  /**
   * Validate current token
   */
  static async validateToken(): Promise<User> {
    const response = await api.get('/auth/validate');
    return response.data.user;
  }

  /**
   * Refresh authentication token
   */
  static async refreshToken(): Promise<{ token: string }> {
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await api.post('/auth/refresh', { refreshToken });
    return response.data;
  }

  /**
   * Logout user
   */
  static async logout(): Promise<void> {
    await api.post('/auth/logout');
  }

  /**
   * Get current user profile
   */
  static async getCurrentUser(): Promise<User> {
    const response = await api.get('/auth/me');
    return response.data;
  }
}