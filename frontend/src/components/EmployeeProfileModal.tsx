import React, { useState, useEffect } from 'react';
import { EmployeeAPI } from '../services/employee';
import { OrgChartAPI } from '../services/api';
import { Employee, OrgChartNode } from '../types/api';
import { LoadingSpinner } from './LoadingSpinner';
import { BrandedButton } from './BrandedButton';
import { OptimizedImage } from './OptimizedImage';
import { useAuth } from '../contexts/AuthContext';

interface EmployeeProfileModalProps {
  employeeId: string;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (employee: Employee) => void;
}

export const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({
  employeeId,
  isOpen,
  onClose,
  onEdit
}) => {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [directReports, setDirectReports] = useState<OrgChartNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingReports, setLoadingReports] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen && employeeId) {
      loadEmployee();
    }
  }, [isOpen, employeeId]);

  const loadEmployee = async () => {
    try {
      setLoading(true);
      setError('');
      const employeeData = await EmployeeAPI.getEmployee(employeeId);
      setEmployee(employeeData);
      
      // Load direct reports if this employee is a manager
      loadDirectReports(employeeId);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  };

  const loadDirectReports = async (managerId: string) => {
    try {
      setLoadingReports(true);
      const response = await OrgChartAPI.getDirectReports(managerId);
      setDirectReports(response.data.directReports);
    } catch (err) {
      // Don't show error for direct reports - just log it
      console.warn('Failed to load direct reports:', err);
      setDirectReports([]);
    } finally {
      setLoadingReports(false);
    }
  };

  const canEdit = user && employee && (
    user.id === employee.id || // Own profile
    user.role === 'admin' || 
    user.role === 'super_admin' ||
    (user.role === 'manager' && employee.managerId === user.id) // Manager of this employee
  );

  const handleEdit = () => {
    if (employee && onEdit) {
      onEdit(employee);
    }
  };

  if (!isOpen) return null;

  const initials = employee ? `${employee.firstName.charAt(0)}${employee.lastName.charAt(0)}` : '';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Employee Profile
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none focus:text-gray-500"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <div className="text-sm text-red-700">{error}</div>
                <button
                  onClick={loadEmployee}
                  className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                >
                  Try again
                </button>
              </div>
            ) : employee ? (
              <div className="space-y-6">
                {/* Profile Header */}
                <div className="flex items-center space-x-4">
                  {/* Profile Photo */}
                  <div className="flex-shrink-0">
                    {employee.profilePhotoUrl ? (
                      <OptimizedImage
                        src={employee.profilePhotoUrl}
                        alt={`${employee.firstName} ${employee.lastName}`}
                        className="h-16 w-16 rounded-full object-cover"
                        fallback={
                          <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-lg font-medium text-gray-700">{initials}</span>
                          </div>
                        }
                        sizes="64px"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-lg font-medium text-gray-700">{initials}</span>
                      </div>
                    )}
                  </div>

                  {/* Basic Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h2 className="text-xl font-bold text-gray-900">
                        {employee.firstName} {employee.lastName}
                      </h2>
                      <div className={`w-2 h-2 rounded-full ${employee.isActive ? 'bg-green-400' : 'bg-gray-400'}`} />
                    </div>
                    
                    {employee.title && (
                      <p className="text-sm text-gray-600 mb-1">{employee.title}</p>
                    )}
                    
                    {employee.department && (
                      <p className="text-sm text-gray-500">{employee.department}</p>
                    )}
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Contact Information</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Email: </span>
                      <a href={`mailto:${employee.email}`} className="text-blue-600 hover:text-blue-500">
                        {employee.email}
                      </a>
                    </div>
                    
                    {employee.phone && (
                      <div>
                        <span className="text-gray-500">Phone: </span>
                        <a href={`tel:${employee.phone}`} className="text-blue-600 hover:text-blue-500">
                          {employee.phone}
                        </a>
                      </div>
                    )}
                    
                    {employee.officeLocation && (
                      <div>
                        <span className="text-gray-500">Office: </span>
                        <span className="text-gray-900">{employee.officeLocation}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manager */}
                {employee.manager && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Reports To</h3>
                    <p className="text-sm text-gray-700">
                      {employee.manager.firstName} {employee.manager.lastName}
                      {employee.manager.title && ` (${employee.manager.title})`}
                    </p>
                  </div>
                )}

                {/* Skills */}
                {employee.skills && employee.skills.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Skills</h3>
                    <div className="flex flex-wrap gap-1">
                      {employee.skills.map((skill, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bio */}
                {employee.bio && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">About</h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{employee.bio}</p>
                  </div>
                )}

                {/* Custom Fields */}
                {employee.customFields && Object.keys(employee.customFields).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Additional Information</h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(employee.customFields).map(([fieldName, value]) => (
                        <div key={fieldName}>
                          <span className="text-gray-500 capitalize">{fieldName.replace(/([A-Z])/g, ' $1').trim()}: </span>
                          <span className="text-gray-900">
                            {Array.isArray(value) ? value.join(', ') : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct Reports */}
                {directReports.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">
                      Direct Reports ({directReports.length})
                    </h3>
                    {loadingReports ? (
                      <div className="flex justify-center py-2">
                        <LoadingSpinner size="sm" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {directReports.slice(0, 5).map((report) => (
                          <div key={report.id} className="flex items-center space-x-2 text-sm">
                            {report.photoUrl ? (
                              <OptimizedImage
                                src={report.photoUrl}
                                alt={`${report.firstName} ${report.lastName}`}
                                className="h-6 w-6 rounded-full object-cover"
                                fallback={
                                  <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
                                    <span className="text-xs font-medium text-gray-700">
                                      {report.firstName.charAt(0)}{report.lastName.charAt(0)}
                                    </span>
                                  </div>
                                }
                                sizes="24px"
                              />
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
                                <span className="text-xs font-medium text-gray-700">
                                  {report.firstName.charAt(0)}{report.lastName.charAt(0)}
                                </span>
                              </div>
                            )}
                            <span className="text-gray-900">
                              {report.firstName} {report.lastName}
                            </span>
                            {report.title && (
                              <span className="text-gray-500">({report.title})</span>
                            )}
                          </div>
                        ))}
                        {directReports.length > 5 && (
                          <p className="text-xs text-gray-500 mt-2">
                            And {directReports.length - 5} more...
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Close
            </button>
            
            {canEdit && employee && (
              <BrandedButton onClick={handleEdit} variant="primary">
                Edit Profile
              </BrandedButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};