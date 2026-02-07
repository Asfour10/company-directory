import axios, { AxiosResponse } from 'axios';
import { 
  SearchResult, 
  SearchFilters, 
  SearchOptions, 
  AutocompleteResult,
  OrgChartResponse,
  EmployeeOrgChartResponse,
  ManagementChainResponse,
  DirectReportsResponse,
  OrgStatsResponse,
  AnalyticsDashboardResponse,
  CustomFieldsResponse,
  CustomFieldResponse,
  CustomFieldStatisticsResponse,
  CreateCustomFieldRequest,
  UpdateCustomFieldRequest,
  AuditLogResponse,
  CustomFieldStatisticsResponse,
  AuditLogStatisticsResponse,
  AuditLogFilters
} from '../types/api';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.VITE_API_URL || 'http://localhost:3000/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export class SearchAPI {
  /**
   * Search for employees with debouncing support
   */
  static async search(
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<SearchResult> {
    const params = new URLSearchParams();
    
    if (query.trim()) {
      params.append('q', query.trim());
    }
    
    if (filters.department) {
      params.append('department', filters.department);
    }
    
    if (filters.title) {
      params.append('title', filters.title);
    }
    
    if (filters.skills && filters.skills.length > 0) {
      params.append('skills', filters.skills.join(','));
    }
    
    if (filters.includeInactive) {
      params.append('includeInactive', 'true');
    }
    
    if (options.page) {
      params.append('page', options.page.toString());
    }
    
    if (options.pageSize) {
      params.append('pageSize', options.pageSize.toString());
    }
    
    if (options.fuzzyThreshold) {
      params.append('fuzzyThreshold', options.fuzzyThreshold.toString());
    }

    const response: AxiosResponse<SearchResult> = await api.get(`/search?${params.toString()}`);
    return response.data;
  }

  /**
   * Get autocomplete suggestions
   */
  static async getAutocomplete(
    query: string,
    type: 'names' | 'titles' | 'departments' | 'skills' | 'all' = 'all',
    limit: number = 5
  ): Promise<AutocompleteResult> {
    const params = new URLSearchParams({
      q: query,
      type,
      limit: limit.toString(),
    });

    const response: AxiosResponse<AutocompleteResult> = await api.get(`/search/autocomplete?${params.toString()}`);
    return response.data;
  }

  /**
   * Track search analytics
   */
  static async trackSearch(query: string, resultCount: number, clickedResult?: string): Promise<void> {
    try {
      await api.post('/search/track', {
        query,
        resultCount,
        clickedResult,
      });
    } catch (error) {
      // Don't throw on analytics errors - just log them
      console.warn('Failed to track search analytics:', error);
    }
  }
}

export class OrgChartAPI {
  /**
   * Get complete organizational chart
   */
  static async getOrganizationalChart(): Promise<OrgChartResponse> {
    const response: AxiosResponse<OrgChartResponse> = await api.get('/org-chart');
    return response.data;
  }

  /**
   * Get organizational chart starting from a specific employee
   */
  static async getEmployeeOrgChart(employeeId: string): Promise<EmployeeOrgChartResponse> {
    const response: AxiosResponse<EmployeeOrgChartResponse> = await api.get(`/org-chart/employee/${employeeId}`);
    return response.data;
  }

  /**
   * Get management chain for an employee
   */
  static async getManagementChain(employeeId: string): Promise<ManagementChainResponse> {
    const response: AxiosResponse<ManagementChainResponse> = await api.get(`/org-chart/management-chain/${employeeId}`);
    return response.data;
  }

  /**
   * Get direct reports for an employee
   */
  static async getDirectReports(employeeId: string): Promise<DirectReportsResponse> {
    const response: AxiosResponse<DirectReportsResponse> = await api.get(`/org-chart/direct-reports/${employeeId}`);
    return response.data;
  }

  /**
   * Get organizational statistics
   */
  static async getOrganizationalStats(): Promise<OrgStatsResponse> {
    const response: AxiosResponse<OrgStatsResponse> = await api.get('/org-chart/stats');
    return response.data;
  }
}

export class AnalyticsAPI {
  /**
   * Get dashboard analytics data
   */
  static async getDashboardAnalytics(days: number = 90): Promise<AnalyticsDashboardResponse> {
    const params = new URLSearchParams({
      days: days.toString(),
    });

    const response: AxiosResponse<AnalyticsDashboardResponse> = await api.get(`/analytics/dashboard?${params.toString()}`);
    return response.data;
  }
}

export class CustomFieldsAPI {
  /**
   * Get all custom fields
   */
  static async getCustomFields(filters?: {
    fieldType?: string;
    isRequired?: boolean;
  }): Promise<CustomFieldsResponse> {
    const params = new URLSearchParams();
    
    if (filters?.fieldType) {
      params.append('fieldType', filters.fieldType);
    }
    if (filters?.isRequired !== undefined) {
      params.append('isRequired', filters.isRequired.toString());
    }

    const response: AxiosResponse<CustomFieldsResponse> = await api.get(`/admin/custom-fields?${params.toString()}`);
    return response.data;
  }

  /**
   * Get custom field by ID
   */
  static async getCustomField(id: string): Promise<CustomFieldResponse> {
    const response: AxiosResponse<CustomFieldResponse> = await api.get(`/admin/custom-fields/${id}`);
    return response.data;
  }

  /**
   * Create new custom field
   */
  static async createCustomField(data: CreateCustomFieldRequest): Promise<CustomFieldResponse> {
    const response: AxiosResponse<CustomFieldResponse> = await api.post('/admin/custom-fields', data);
    return response.data;
  }

  /**
   * Update custom field
   */
  static async updateCustomField(id: string, data: UpdateCustomFieldRequest): Promise<CustomFieldResponse> {
    const response: AxiosResponse<CustomFieldResponse> = await api.put(`/admin/custom-fields/${id}`, data);
    return response.data;
  }

  /**
   * Delete custom field
   */
  static async deleteCustomField(id: string): Promise<void> {
    await api.delete(`/admin/custom-fields/${id}`);
  }

  /**
   * Reorder custom fields
   */
  static async reorderCustomFields(fieldOrders: Array<{ id: string; displayOrder: number }>): Promise<CustomFieldsResponse> {
    const response: AxiosResponse<CustomFieldsResponse> = await api.post('/admin/custom-fields/reorder', {
      fieldOrders,
    });
    return response.data;
  }

  /**
   * Get custom field statistics
   */
  static async getCustomFieldStatistics(): Promise<CustomFieldStatisticsResponse> {
    const response: AxiosResponse<CustomFieldStatisticsResponse> = await api.get('/admin/custom-fields/statistics');
    return response.data;
  }
}

export class AuditLogAPI {
  /**
   * Get audit logs with filtering and pagination
   */
  static async getAuditLogs(
    filters: AuditLogFilters = {},
    page: number = 1,
    pageSize: number = 50
  ): Promise<AuditLogResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (filters.userId) params.append('userId', filters.userId);
    if (filters.entityType) params.append('entityType', filters.entityType);
    if (filters.entityId) params.append('entityId', filters.entityId);
    if (filters.action) params.append('action', filters.action);
    if (filters.fieldName) params.append('fieldName', filters.fieldName);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response: AxiosResponse<AuditLogResponse> = await api.get(`/admin/audit-logs?${params.toString()}`);
    return response.data;
  }

  /**
   * Export audit logs to CSV
   */
  static async exportAuditLogs(filters: AuditLogFilters = {}): Promise<Blob> {
    const params = new URLSearchParams();

    if (filters.userId) params.append('userId', filters.userId);
    if (filters.entityType) params.append('entityType', filters.entityType);
    if (filters.entityId) params.append('entityId', filters.entityId);
    if (filters.action) params.append('action', filters.action);
    if (filters.fieldName) params.append('fieldName', filters.fieldName);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);

    const response = await api.get(`/admin/audit-logs/export?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Get audit log statistics
   */
  static async getAuditLogStatistics(days: number = 30): Promise<AuditLogStatisticsResponse> {
    const params = new URLSearchParams({
      days: days.toString(),
    });

    const response: AxiosResponse<AuditLogStatisticsResponse> = await api.get(`/admin/audit-logs/statistics?${params.toString()}`);
    return response.data;
  }
}

export class HealthAPI {
  /**
   * Get system health status
   */
  static async getHealthStatus(): Promise<any> {
    const response = await api.get('/health');
    return response.data;
  }

  /**
   * Get readiness status
   */
  static async getReadinessStatus(): Promise<any> {
    const response = await api.get('/ready');
    return response.data;
  }

  /**
   * Get system information
   */
  static async getSystemInfo(): Promise<any> {
    const response = await api.get('/health/system');
    return response.data;
  }
}

export default api;