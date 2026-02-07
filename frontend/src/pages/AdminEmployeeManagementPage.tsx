import React, { useState, useEffect, useRef } from 'react';
import { EmployeeAPI, EmployeeListResponse, CreateEmployeeRequest, BulkImportValidationResponse, BulkImportResponse } from '../services/employee.ts';
import { Employee } from '../types/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BrandedButton } from '../components/BrandedButton';

interface EmployeeFormProps {
  employee?: Employee;
  onSave: (employee: CreateEmployeeRequest) => void;
  onCancel: () => void;
  loading?: boolean;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ employee, onSave, onCancel, loading = false }) => {
  const [formData, setFormData] = useState<CreateEmployeeRequest>({
    firstName: employee?.firstName || '',
    lastName: employee?.lastName || '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    title: employee?.title || '',
    department: employee?.department || '',
    officeLocation: employee?.officeLocation || '',
    skills: employee?.skills || [],
    bio: employee?.bio || '',
    managerId: employee?.managerId || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof CreateEmployeeRequest, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSkillsChange = (value: string) => {
    const skills = value.split(',').map(skill => skill.trim()).filter(skill => skill);
    handleChange('skills', skills);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => handleChange('firstName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.firstName ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => handleChange('lastName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.lastName ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email *
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange('email', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.email ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department
          </label>
          <input
            type="text"
            value={formData.department}
            onChange={(e) => handleChange('department', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Office Location
          </label>
          <input
            type="text"
            value={formData.officeLocation}
            onChange={(e) => handleChange('officeLocation', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Skills (comma-separated)
          </label>
          <input
            type="text"
            value={formData.skills?.join(', ') || ''}
            onChange={(e) => handleSkillsChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="JavaScript, React, Node.js"
            disabled={loading}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Bio
        </label>
        <textarea
          value={formData.bio}
          onChange={(e) => handleChange('bio', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <BrandedButton
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </BrandedButton>
        <BrandedButton
          type="submit"
          variant="primary"
          disabled={loading}
        >
          {loading ? 'Saving...' : employee ? 'Update Employee' : 'Create Employee'}
        </BrandedButton>
      </div>
    </form>
  );
};

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [validation, setValidation] = useState<BulkImportValidationResponse | null>(null);
  const [importResult, setImportResult] = useState<BulkImportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'upload' | 'validate' | 'import' | 'complete'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setValidation(null);
      setImportResult(null);
      setStep('upload');
    } else {
      alert('Please select a valid CSV file');
    }
  };

  const handleValidate = async () => {
    if (!file) return;

    try {
      setLoading(true);
      const result = await EmployeeAPI.validateBulkImport(file);
      setValidation(result);
      setStep('validate');
    } catch (error) {
      console.error('Validation failed:', error);
      alert('Failed to validate CSV file. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setLoading(true);
      const result = await EmployeeAPI.bulkImport(file);
      setImportResult(result);
      setStep('complete');
      if (result.success) {
        onImportComplete();
      }
    } catch (error) {
      console.error('Import failed:', error);
      alert('Failed to import employees. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const blob = await EmployeeAPI.downloadBulkImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employee-import-template.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download template:', error);
      alert('Failed to download template. Please try again.');
    }
  };

  const resetModal = () => {
    setFile(null);
    setValidation(null);
    setImportResult(null);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Bulk Import Employees</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'upload' && (
          <div className="space-y-4">
            <div>
              <p className="text-gray-600 mb-4">
                Upload a CSV file to import multiple employees at once.
              </p>
              <BrandedButton
                variant="ghost"
                onClick={handleDownloadTemplate}
                className="mb-4"
              >
                Download CSV Template
              </BrandedButton>
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {file && (
              <div className="bg-gray-50 p-3 rounded">
                <p className="text-sm text-gray-600">
                  Selected file: <span className="font-medium">{file.name}</span>
                </p>
                <p className="text-sm text-gray-500">
                  Size: {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <BrandedButton variant="ghost" onClick={handleClose}>
                Cancel
              </BrandedButton>
              <BrandedButton
                variant="primary"
                onClick={handleValidate}
                disabled={!file || loading}
              >
                {loading ? 'Validating...' : 'Validate File'}
              </BrandedButton>
            </div>
          </div>
        )}

        {step === 'validate' && validation && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-medium mb-2">Validation Results</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Total Rows: {validation.summary.totalRows}</div>
                <div>Valid Rows: {validation.summary.validRows}</div>
                <div>Error Rows: {validation.summary.errorRows}</div>
                <div>Warning Rows: {validation.summary.warningRows}</div>
              </div>
            </div>

            {validation.errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded">
                <h4 className="font-medium text-red-800 mb-2">Errors</h4>
                <div className="max-h-32 overflow-y-auto">
                  {validation.errors.slice(0, 10).map((error, index) => (
                    <p key={index} className="text-sm text-red-700">
                      Row {error.row}: {error.field} - {error.message}
                    </p>
                  ))}
                  {validation.errors.length > 10 && (
                    <p className="text-sm text-red-600 mt-2">
                      ... and {validation.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            )}

            {validation.warnings.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded">
                <h4 className="font-medium text-yellow-800 mb-2">Warnings</h4>
                <div className="max-h-32 overflow-y-auto">
                  {validation.warnings.slice(0, 5).map((warning, index) => (
                    <p key={index} className="text-sm text-yellow-700">
                      Row {warning.row}: {warning.field} - {warning.message}
                    </p>
                  ))}
                  {validation.warnings.length > 5 && (
                    <p className="text-sm text-yellow-600 mt-2">
                      ... and {validation.warnings.length - 5} more warnings
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <BrandedButton variant="ghost" onClick={() => setStep('upload')}>
                Back
              </BrandedButton>
              <BrandedButton
                variant="primary"
                onClick={handleImport}
                disabled={!validation.valid || loading}
              >
                {loading ? 'Importing...' : 'Import Employees'}
              </BrandedButton>
            </div>
          </div>
        )}

        {step === 'complete' && importResult && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded">
              <h3 className="font-medium mb-2">Import Results</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Total Rows: {importResult.summary.totalRows}</div>
                <div>Created: {importResult.summary.created}</div>
                <div>Updated: {importResult.summary.updated}</div>
                <div>Errors: {importResult.summary.errors}</div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="bg-red-50 p-4 rounded">
                <h4 className="font-medium text-red-800 mb-2">Import Errors</h4>
                <div className="max-h-32 overflow-y-auto">
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <p key={index} className="text-sm text-red-700">
                      Row {error.row}: {error.field} - {error.message}
                    </p>
                  ))}
                  {importResult.errors.length > 10 && (
                    <p className="text-sm text-red-600 mt-2">
                      ... and {importResult.errors.length - 10} more errors
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <BrandedButton variant="primary" onClick={handleClose}>
                Close
              </BrandedButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const AdminEmployeeManagementPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const pageSize = 20;

  const loadEmployees = async (page: number = 1, append: boolean = false) => {
    try {
      if (!append) {
        setLoading(true);
        setError(null);
      }

      const response: EmployeeListResponse = await EmployeeAPI.getEmployees(page, pageSize);
      
      if (append) {
        setEmployees(prev => [...prev, ...response.employees]);
      } else {
        setEmployees(response.employees);
      }
      
      setTotalEmployees(response.total);
      setHasMore(response.hasMore);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load employees:', err);
      setError('Failed to load employees. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const handleCreateEmployee = async (employeeData: CreateEmployeeRequest) => {
    try {
      setFormLoading(true);
      await EmployeeAPI.createEmployee(employeeData);
      setShowCreateForm(false);
      loadEmployees(); // Reload the list
    } catch (err) {
      console.error('Failed to create employee:', err);
      alert('Failed to create employee. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateEmployee = async (employeeData: CreateEmployeeRequest) => {
    if (!editingEmployee) return;

    try {
      setFormLoading(true);
      await EmployeeAPI.updateEmployee({
        id: editingEmployee.id,
        ...employeeData,
      });
      setEditingEmployee(null);
      loadEmployees(); // Reload the list
    } catch (err) {
      console.error('Failed to update employee:', err);
      alert('Failed to update employee. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (!confirm(`Are you sure you want to deactivate ${employee.firstName} ${employee.lastName}?`)) {
      return;
    }

    try {
      await EmployeeAPI.deleteEmployee(employee.id);
      loadEmployees(); // Reload the list
    } catch (err) {
      console.error('Failed to delete employee:', err);
      alert('Failed to deactivate employee. Please try again.');
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadEmployees(currentPage + 1, true);
    }
  };

  const handleBulkImportComplete = () => {
    loadEmployees(); // Reload the list after import
  };

  if (loading && employees.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && employees.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <BrandedButton onClick={() => loadEmployees()}>
          Try Again
        </BrandedButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
          <p className="text-gray-600">Manage employee profiles and data</p>
        </div>
        
        <div className="flex space-x-3">
          <BrandedButton
            variant="ghost"
            onClick={() => setShowBulkImport(true)}
          >
            Bulk Import
          </BrandedButton>
          <BrandedButton
            variant="primary"
            onClick={() => setShowCreateForm(true)}
          >
            Add Employee
          </BrandedButton>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(showCreateForm || editingEmployee) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingEmployee ? 'Edit Employee' : 'Create New Employee'}
          </h2>
          <EmployeeForm
            employee={editingEmployee || undefined}
            onSave={editingEmployee ? handleUpdateEmployee : handleCreateEmployee}
            onCancel={() => {
              setShowCreateForm(false);
              setEditingEmployee(null);
            }}
            loading={formLoading}
          />
        </div>
      )}

      {/* Employee List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Employees ({totalEmployees})
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {employee.profilePhotoUrl && (
                        <img
                          className="h-8 w-8 rounded-full mr-3"
                          src={employee.profilePhotoUrl}
                          alt=""
                        />
                      )}
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {employee.firstName} {employee.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.title || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {employee.department || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      employee.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {employee.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingEmployee(employee)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Edit
                      </button>
                      {employee.isActive && (
                        <button
                          onClick={() => handleDeleteEmployee(employee)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="px-6 py-4 border-t border-gray-200 text-center">
            <BrandedButton
              variant="ghost"
              onClick={handleLoadMore}
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Load More'}
            </BrandedButton>
          </div>
        )}
      </div>

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImportComplete={handleBulkImportComplete}
      />
    </div>
  );
};