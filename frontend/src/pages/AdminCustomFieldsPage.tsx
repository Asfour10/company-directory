import React, { useState, useEffect } from 'react';
import { CustomFieldsAPI } from '../services/api';
import { CustomField, CreateCustomFieldRequest, UpdateCustomFieldRequest, CustomFieldStatistics } from '../types/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BrandedButton } from '../components/BrandedButton';

interface CustomFieldFormProps {
  field?: CustomField;
  onSave: (data: CreateCustomFieldRequest) => void;
  onCancel: () => void;
  loading?: boolean;
}

const CustomFieldForm: React.FC<CustomFieldFormProps> = ({ field, onSave, onCancel, loading = false }) => {
  const [formData, setFormData] = useState<CreateCustomFieldRequest>({
    fieldName: field?.fieldName || '',
    fieldType: field?.fieldType || 'text',
    isRequired: field?.isRequired || false,
    options: field?.options || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (key: keyof CreateCustomFieldRequest, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: '' }));
    }
  };

  const handleOptionsChange = (value: string) => {
    const options = value.split('\n').map(opt => opt.trim()).filter(opt => opt);
    handleChange('options', options);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.fieldName.trim()) {
      newErrors.fieldName = 'Field name is required';
    } else if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(formData.fieldName)) {
      newErrors.fieldName = 'Field name must start with a letter and contain only letters, numbers, and underscores';
    }

    if ((formData.fieldType === 'dropdown' || formData.fieldType === 'multiselect') && 
        (!formData.options || formData.options.length === 0)) {
      newErrors.options = 'Dropdown and multiselect fields must have at least one option';
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

  const fieldTypeOptions = [
    { value: 'text', label: 'Text' },
    { value: 'number', label: 'Number' },
    { value: 'date', label: 'Date' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'multiselect', label: 'Multi-select' },
  ];

  const showOptions = formData.fieldType === 'dropdown' || formData.fieldType === 'multiselect';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Name *
        </label>
        <input
          type="text"
          value={formData.fieldName}
          onChange={(e) => handleChange('fieldName', e.target.value)}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.fieldName ? 'border-red-500' : 'border-gray-300'
          }`}
          placeholder="e.g., employeeId, startDate, skills"
          disabled={loading}
        />
        {errors.fieldName && <p className="text-red-500 text-sm mt-1">{errors.fieldName}</p>}
        <p className="text-gray-500 text-sm mt-1">
          Must start with a letter and contain only letters, numbers, and underscores
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Field Type *
        </label>
        <select
          value={formData.fieldType}
          onChange={(e) => handleChange('fieldType', e.target.value as any)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        >
          {fieldTypeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={formData.isRequired}
            onChange={(e) => handleChange('isRequired', e.target.checked)}
            className="mr-2"
            disabled={loading}
          />
          <span className="text-sm font-medium text-gray-700">Required field</span>
        </label>
      </div>

      {showOptions && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Options * (one per line)
          </label>
          <textarea
            value={formData.options?.join('\n') || ''}
            onChange={(e) => handleOptionsChange(e.target.value)}
            rows={5}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.options ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="Option 1&#10;Option 2&#10;Option 3"
            disabled={loading}
          />
          {errors.options && <p className="text-red-500 text-sm mt-1">{errors.options}</p>}
        </div>
      )}

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
          {loading ? 'Saving...' : field ? 'Update Field' : 'Create Field'}
        </BrandedButton>
      </div>
    </form>
  );
};

interface StatisticsCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon?: React.ReactNode;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({ title, value, subtitle, icon }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <div className="flex items-center">
      {icon && <div className="flex-shrink-0 mr-3">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-gray-600">{title}</p>
        <p className="text-2xl font-semibold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  </div>
);

export const AdminCustomFieldsPage: React.FC = () => {
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [statistics, setStatistics] = useState<CustomFieldStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [draggedField, setDraggedField] = useState<CustomField | null>(null);

  const loadCustomFields = async () => {
    try {
      setLoading(true);
      setError(null);
      const [fieldsResponse, statsResponse] = await Promise.all([
        CustomFieldsAPI.getCustomFields(),
        CustomFieldsAPI.getCustomFieldStatistics(),
      ]);
      setCustomFields(fieldsResponse.data);
      setStatistics(statsResponse.data);
    } catch (err) {
      console.error('Failed to load custom fields:', err);
      setError('Failed to load custom fields. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomFields();
  }, []);

  const handleCreateField = async (data: CreateCustomFieldRequest) => {
    try {
      setFormLoading(true);
      await CustomFieldsAPI.createCustomField(data);
      setShowCreateForm(false);
      loadCustomFields();
    } catch (err) {
      console.error('Failed to create custom field:', err);
      alert('Failed to create custom field. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleUpdateField = async (data: CreateCustomFieldRequest) => {
    if (!editingField) return;

    try {
      setFormLoading(true);
      await CustomFieldsAPI.updateCustomField(editingField.id, data);
      setEditingField(null);
      loadCustomFields();
    } catch (err) {
      console.error('Failed to update custom field:', err);
      alert('Failed to update custom field. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteField = async (field: CustomField) => {
    if (!confirm(`Are you sure you want to delete the custom field "${field.fieldName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await CustomFieldsAPI.deleteCustomField(field.id);
      loadCustomFields();
    } catch (err) {
      console.error('Failed to delete custom field:', err);
      alert('Failed to delete custom field. Please try again.');
    }
  };

  const handleDragStart = (e: React.DragEvent, field: CustomField) => {
    setDraggedField(field);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetField: CustomField) => {
    e.preventDefault();
    
    if (!draggedField || draggedField.id === targetField.id) {
      setDraggedField(null);
      return;
    }

    // Create new order based on drag and drop
    const newFields = [...customFields];
    const draggedIndex = newFields.findIndex(f => f.id === draggedField.id);
    const targetIndex = newFields.findIndex(f => f.id === targetField.id);

    // Remove dragged field and insert at target position
    newFields.splice(draggedIndex, 1);
    newFields.splice(targetIndex, 0, draggedField);

    // Update display orders
    const fieldOrders = newFields.map((field, index) => ({
      id: field.id,
      displayOrder: index + 1,
    }));

    try {
      await CustomFieldsAPI.reorderCustomFields(fieldOrders);
      loadCustomFields();
    } catch (err) {
      console.error('Failed to reorder custom fields:', err);
      alert('Failed to reorder custom fields. Please try again.');
    } finally {
      setDraggedField(null);
    }
  };

  const getFieldTypeIcon = (fieldType: string) => {
    switch (fieldType) {
      case 'text':
        return (
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
          </svg>
        );
      case 'number':
        return (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        );
      case 'date':
        return (
          <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'dropdown':
        return (
          <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        );
      case 'multiselect':
        return (
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <BrandedButton onClick={loadCustomFields}>
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
          <h1 className="text-2xl font-bold text-gray-900">Custom Fields</h1>
          <p className="text-gray-600">Manage custom fields for employee profiles</p>
        </div>
        
        <BrandedButton
          variant="primary"
          onClick={() => setShowCreateForm(true)}
        >
          Add Custom Field
        </BrandedButton>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatisticsCard
            title="Total Fields"
            value={statistics.totalFields}
            icon={
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            }
          />
          
          <StatisticsCard
            title="Required Fields"
            value={statistics.requiredFields}
            icon={
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            }
          />
          
          <StatisticsCard
            title="Optional Fields"
            value={statistics.optionalFields}
            icon={
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            }
          />
        </div>
      )}

      {/* Create/Edit Form */}
      {(showCreateForm || editingField) && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingField ? 'Edit Custom Field' : 'Create New Custom Field'}
          </h2>
          <CustomFieldForm
            field={editingField || undefined}
            onSave={editingField ? handleUpdateField : handleCreateField}
            onCancel={() => {
              setShowCreateForm(false);
              setEditingField(null);
            }}
            loading={formLoading}
          />
        </div>
      )}

      {/* Custom Fields List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">
            Custom Fields ({customFields.length})
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Drag and drop to reorder fields
          </p>
        </div>
        
        {customFields.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">No custom fields created yet</div>
            <BrandedButton
              variant="primary"
              onClick={() => setShowCreateForm(true)}
            >
              Create Your First Custom Field
            </BrandedButton>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {customFields.map((field) => (
              <div
                key={field.id}
                draggable
                onDragStart={(e) => handleDragStart(e, field)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, field)}
                className={`px-6 py-4 hover:bg-gray-50 cursor-move ${
                  draggedField?.id === field.id ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      {getFieldTypeIcon(field.fieldType)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-medium text-gray-900">
                          {field.fieldName}
                        </h3>
                        {field.isRequired && (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Required
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="capitalize">{field.fieldType}</span>
                        {field.options && field.options.length > 0 && (
                          <span>{field.options.length} options</span>
                        )}
                        <span>Order: {field.displayOrder}</span>
                      </div>
                      {field.options && field.options.length > 0 && (
                        <div className="mt-1 text-xs text-gray-400">
                          Options: {field.options.slice(0, 3).join(', ')}
                          {field.options.length > 3 && ` +${field.options.length - 3} more`}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setEditingField(field)}
                      className="text-blue-600 hover:text-blue-900 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteField(field)}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      Delete
                    </button>
                    <div className="text-gray-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};