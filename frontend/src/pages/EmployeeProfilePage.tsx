import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { EmployeeAPI } from '../services/employee';
import { Employee } from '../types/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BrandedButton } from '../components/BrandedButton';
import { useAuth } from '../contexts/AuthContext';

export const EmployeeProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const loadEmployee = async () => {
      if (!id) {
        setError('Employee ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const employeeData = await EmployeeAPI.getEmployee(id);
        setEmployee(employeeData);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to load employee profile');
      } finally {
        setLoading(false);
      }
    };

    loadEmployee();
  }, [id]);

  const canEdit = user && employee && (
    user.id === employee.id || // Own profile
    user.role === 'admin' || 
    user.role === 'super_admin' ||
    (user.role === 'manager' && employee.managerId === user.id) // Manager of this employee
  );

  const handleEdit = () => {
    navigate(`/employees/${id}/edit`);
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="text-center py-12">
        <div className="rounded-md bg-red-50 p-4 max-w-md mx-auto">
          <div className="text-sm text-red-700">{error || 'Employee not found'}</div>
          <button
            onClick={handleBack}
            className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const initials = `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleBack}
          className="flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        
        {canEdit && (
          <BrandedButton onClick={handleEdit} variant="primary">
            Edit Profile
          </BrandedButton>
        )}
      </div>

      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-6">
          {/* Profile Photo */}
          <div className="flex-shrink-0 mb-4 sm:mb-0">
            {employee.profilePhotoUrl ? (
              <img
                className="h-24 w-24 rounded-full object-cover"
                src={employee.profilePhotoUrl}
                alt={`${employee.firstName} ${employee.lastName}`}
              />
            ) : (
              <div className="h-24 w-24 rounded-full bg-gray-300 flex items-center justify-center">
                <span className="text-2xl font-medium text-gray-700">{initials}</span>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {employee.firstName} {employee.lastName}
              </h1>
              <div className={`w-3 h-3 rounded-full ${employee.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
            </div>
            
            {employee.title && (
              <p className="text-lg text-gray-600 mb-1">{employee.title}</p>
            )}
            
            {employee.department && (
              <p className="text-sm text-gray-500 mb-2">{employee.department}</p>
            )}

            {employee.manager && (
              <p className="text-sm text-gray-500">
                Reports to {employee.manager.firstName} {employee.manager.lastName}
                {employee.manager.title && ` (${employee.manager.title})`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Email</label>
            <p className="mt-1 text-sm text-gray-900">
              <a href={`mailto:${employee.email}`} className="text-blue-600 hover:text-blue-500">
                {employee.email}
              </a>
            </p>
          </div>
          
          {employee.phone && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Phone</label>
              <p className="mt-1 text-sm text-gray-900">
                <a href={`tel:${employee.phone}`} className="text-blue-600 hover:text-blue-500">
                  {employee.phone}
                </a>
              </p>
            </div>
          )}
          
          {employee.officeLocation && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Office Location</label>
              <p className="mt-1 text-sm text-gray-900">{employee.officeLocation}</p>
            </div>
          )}
        </div>
      </div>

      {/* Skills */}
      {employee.skills && employee.skills.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Skills</h2>
          <div className="flex flex-wrap gap-2">
            {employee.skills.map((skill, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bio */}
      {employee.bio && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">About</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{employee.bio}</p>
        </div>
      )}

      {/* Additional Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block font-medium text-gray-500">Employee ID</label>
            <p className="mt-1 text-gray-900">{employee.id}</p>
          </div>
          
          <div>
            <label className="block font-medium text-gray-500">Status</label>
            <p className="mt-1">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                employee.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {employee.isActive ? 'Active' : 'Inactive'}
              </span>
            </p>
          </div>
          
          <div>
            <label className="block font-medium text-gray-500">Created</label>
            <p className="mt-1 text-gray-900">
              {new Date(employee.createdAt).toLocaleDateString()}
            </p>
          </div>
          
          <div>
            <label className="block font-medium text-gray-500">Last Updated</label>
            <p className="mt-1 text-gray-900">
              {new Date(employee.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};