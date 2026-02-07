// API response types for the Company Directory

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  officeLocation?: string;
  skills?: string[];
  bio?: string;
  profilePhotoUrl?: string;
  managerId?: string;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
    title?: string;
  };
  customFields?: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  results: Employee[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  query: string;
  executionTime: number;
  suggestions?: string[];
  message?: string;
  filters: {
    department?: string | null;
    title?: string | null;
    skills?: string[] | null;
    includeInactive: boolean;
  };
  meta: {
    responseTime: string;
    cached: boolean;
    resultCount: number;
    searchTypes: string[];
  };
}

export interface SearchFilters {
  department?: string;
  title?: string;
  skills?: string[];
  includeInactive?: boolean;
}

export interface SearchOptions {
  page?: number;
  pageSize?: number;
  fuzzyThreshold?: number;
}

export interface AutocompleteResult {
  suggestions: string[];
  query: string;
  type: string;
  count: number;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

// Organizational Chart Types
export interface OrgChartNode {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  department?: string;
  email: string;
  photoUrl?: string;
  managerId?: string;
  children: OrgChartNode[];
  level: number;
}

export interface OrgChartResponse {
  success: boolean;
  data: {
    orgChart: OrgChartNode[];
    metadata: {
      totalNodes: number;
      rootNodes: number;
      maxDepth: number;
      generatedAt: string;
    };
  };
}

export interface EmployeeOrgChartResponse {
  success: boolean;
  data: {
    employee: OrgChartNode;
    metadata: {
      totalChildren: number;
      level: number;
      generatedAt: string;
    };
  };
}

export interface ManagementChainResponse {
  success: boolean;
  data: {
    managementChain: OrgChartNode[];
    metadata: {
      chainLength: number;
      employeeId: string;
      generatedAt: string;
    };
  };
}

export interface DirectReportsResponse {
  success: boolean;
  data: {
    directReports: OrgChartNode[];
    metadata: {
      reportsCount: number;
      managerId: string;
      generatedAt: string;
    };
  };
}

export interface OrgStatsResponse {
  success: boolean;
  data: {
    stats: {
      totalEmployees: number;
      managersCount: number;
      topLevelEmployees: number;
      maxHierarchyDepth: number;
      averageSpanOfControl: number;
      departmentDistribution: Array<{
        department: string;
        count: number;
      }>;
    };
    metadata: {
      generatedAt: string;
    };
  };
}

// Analytics Types
export interface AnalyticsDashboardData {
  period: string;
  userMetrics: {
    totalUsers: number;
    activeUsers: number;
    activeUsersPeriod: string;
  };
  profileMetrics: {
    completenessPercentage: number;
    totalProfiles: number;
    completeProfiles: number;
  };
  topSearchQueries: Array<{
    query: string;
    count: number;
  }>;
  mostViewedProfiles: Array<{
    profileId: string;
    viewCount: number;
    employee: {
      firstName: string;
      lastName: string;
      title: string;
      department: string;
    };
  }>;
  departmentDistribution: Array<{
    department: string;
    count: number;
  }>;
  roleDistribution: Array<{
    title: string;
    count: number;
  }>;
}

export interface CustomField {
  id: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'dropdown' | 'multiselect';
  isRequired: boolean;
  options: string[] | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomFieldRequest {
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'dropdown' | 'multiselect';
  isRequired?: boolean;
  options?: string[];
}

export interface UpdateCustomFieldRequest extends Partial<CreateCustomFieldRequest> {
  displayOrder?: number;
}

export interface CustomFieldStatistics {
  totalFields: number;
  requiredFields: number;
  optionalFields: number;
  fieldTypeDistribution: Array<{
    fieldType: string;
    count: number;
  }>;
}

export interface CustomFieldsResponse {
  success: boolean;
  data: CustomField[];
}

export interface CustomFieldResponse {
  success: boolean;
  data: CustomField;
}

export interface CustomFieldStatisticsResponse {
  success: boolean;
  data: CustomFieldStatistics;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entityType: string;
  entityId: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    id: string;
    email: string;
  };
}

export interface AuditLogFilters {
  userId?: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  fieldName?: string;
  startDate?: string;
  endDate?: string;
}

export interface AuditLogResponse {
  success: boolean;
  data: {
    logs: AuditLogEntry[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface AuditLogStatistics {
  action: string;
  entityType: string;
  count: number;
}

export interface AuditLogStatisticsResponse {
  success: boolean;
  data: AuditLogStatistics[];
}

export interface AnalyticsDashboardResponse {
  success: boolean;
  data: AnalyticsDashboardData;
}