import api from './api';

export interface TenantSettings {
  id: string;
  name: string;
  subdomain: string;
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  subscriptionTier: string;
  userLimit: number;
  dataRetentionDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface TenantBranding {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface TenantStats {
  userCount: number;
  employeeCount: number;
  activeUsers: number;
  userLimit: number;
  subscriptionTier: string;
  utilizationPercentage: number;
}

export interface TenantUsage {
  searchEvents: number;
  profileViews: number;
  logins: number;
  period: string;
}

export class TenantAPI {
  /**
   * Get tenant settings and configuration
   */
  static async getSettings(): Promise<TenantSettings> {
    const response = await api.get('/tenant/settings');
    return response.data.data;
  }

  /**
   * Update tenant branding (colors only)
   * Requires Super Admin role
   */
  static async updateBranding(branding: {
    primaryColor?: string;
    accentColor?: string;
  }): Promise<TenantBranding> {
    const response = await api.put('/tenant/branding', branding);
    return response.data.data;
  }

  /**
   * Upload tenant logo
   * Requires Super Admin role
   */
  static async uploadLogo(logoFile: File): Promise<{ logoUrl: string }> {
    const formData = new FormData();
    formData.append('logo', logoFile);

    const response = await api.post('/tenant/logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.data;
  }

  /**
   * Delete tenant logo
   * Requires Super Admin role
   */
  static async deleteLogo(): Promise<void> {
    await api.delete('/tenant/logo');
  }

  /**
   * Update SSO configuration
   * Requires Super Admin role
   */
  static async updateSSOConfig(config: {
    provider?: string;
    config?: any;
  }): Promise<void> {
    await api.put('/tenant/sso-config', config);
  }

  /**
   * Get tenant usage statistics
   * Requires Admin role
   */
  static async getStats(): Promise<TenantStats> {
    const response = await api.get('/tenant/stats');
    return response.data.data;
  }

  /**
   * Get tenant usage analytics
   * Requires Admin role
   */
  static async getUsage(days: number = 30): Promise<TenantUsage> {
    const response = await api.get(`/tenant/usage?days=${days}`);
    return response.data.data;
  }

  /**
   * Generate subdomain suggestions
   * Public endpoint
   */
  static async getSubdomainSuggestions(companyName: string): Promise<{
    suggestions: string[];
    baseName: string;
  }> {
    const response = await api.get(`/tenant/subdomain-suggestions?name=${encodeURIComponent(companyName)}`);
    return response.data.data;
  }
}