import api from './api';
import { Employee } from '../types/api';

export interface EmployeeListResponse {
  employees: Employee[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CreateEmployeeRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  department?: string;
  officeLocation?: string;
  skills?: string[];
  bio?: string;
  managerId?: string;
  customFields?: Record<string, any>;
}

export interface BulkImportValidationResponse {
  valid: boolean;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    value?: string;
  }>;
  warnings: Array<{
    row: number;
    field: string;
    message: string;
    value?: string;
  }>;
  summary: {
    totalRows: number;
    validRows: number;
    errorRows: number;
    warningRows: number;
  };
  preview: Array<{
    row: number;
    data: Record<string, string>;
  }>;
}

export interface BulkImportResponse {
  success: boolean;
  summary: {
    totalRows: number;
    created: number;
    updated: number;
    errors: number;
  };
  errors: Array<{
    row: number;
    field: string;
    message: string;
    value?: string;
  }>;
  createdEmployees: Employee[];
  updatedEmployees: Employee[];
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {
  id: string;
}

export class EmployeeAPI {
  /**
   * Get list of employees with pagination
   */
  static async getEmployees(
    page: number = 1,
    pageSize: number = 20,
    filters?: {
      department?: string;
      title?: string;
      isActive?: boolean;
    },
    sortBy: 'name' | 'department' | 'title' = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ): Promise<EmployeeListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
      sortBy,
      sortOrder,
    });

    if (filters?.department) {
      params.append('department', filters.department);
    }
    if (filters?.title) {
      params.append('title', filters.title);
    }
    if (filters?.isActive !== undefined) {
      params.append('isActive', filters.isActive.toString());
    }

    const response = await api.get(`/employees?${params.toString()}`);
    return response.data;
  }

  /**
   * Get employee by ID
   */
  static async getEmployee(id: string): Promise<Employee> {
    const response = await api.get(`/employees/${id}`);
    return response.data;
  }

  /**
   * Create new employee (admin only)
   */
  static async createEmployee(employee: CreateEmployeeRequest): Promise<Employee> {
    const response = await api.post('/employees', employee);
    return response.data;
  }

  /**
   * Update employee
   */
  static async updateEmployee(employee: UpdateEmployeeRequest): Promise<Employee> {
    const { id, ...updateData } = employee;
    const response = await api.put(`/employees/${id}`, updateData);
    return response.data;
  }

  /**
   * Delete/deactivate employee (admin only)
   */
  static async deleteEmployee(id: string): Promise<void> {
    await api.delete(`/employees/${id}`);
  }

  /**
   * Upload profile photo
   */
  static async uploadProfilePhoto(id: string, file: File): Promise<{ photoUrl: string }> {
    const formData = new FormData();
    formData.append('photo', file);

    const response = await api.post(`/employees/${id}/photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * Get departments list
   */
  static async getDepartments(): Promise<string[]> {
    const response = await api.get('/employees/departments');
    return response.data.departments;
  }

  /**
   * Get titles list
   */
  static async getTitles(): Promise<string[]> {
    const response = await api.get('/employees/titles');
    return response.data.titles;
  }

  /**
   * Validate CSV file for bulk import
   */
  static async validateBulkImport(file: File): Promise<BulkImportValidationResponse> {
    const formData = new FormData();
    formData.append('csvFile', file);

    const response = await api.post('/admin/employees/bulk-import/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * Import employees from CSV file
   */
  static async bulkImport(file: File): Promise<BulkImportResponse> {
    const formData = new FormData();
    formData.append('csvFile', file);

    const response = await api.post('/admin/employees/bulk-import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  /**
   * Download CSV template for bulk import
   */
  static async downloadBulkImportTemplate(): Promise<Blob> {
    const response = await api.get('/admin/employees/bulk-import/template', {
      responseType: 'blob',
    });
    return response.data;
  }
}