import React, { useState, useEffect } from 'react';
import { EmployeeAPI } from '../services/employee';

interface EmployeeListFiltersProps {
  filters: {
    department?: string;
    title?: string;
    isActive?: boolean;
  };
  onFiltersChange: (filters: {
    department?: string;
    title?: string;
    isActive?: boolean;
  }) => void;
}

export const EmployeeListFilters: React.FC<EmployeeListFiltersProps> = ({
  filters,
  onFiltersChange
}) => {
  const [departments, setDepartments] = useState<string[]>([]);
  const [titles, setTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [departmentsData, titlesData] = await Promise.all([
          EmployeeAPI.getDepartments(),
          EmployeeAPI.getTitles()
        ]);
        setDepartments(departmentsData);
        setTitles(titlesData);
      } catch (error) {
        console.error('Failed to load filter options:', error);
      } finally {
        setLoading(false);
      }
    };

    loadFilterOptions();
  }, []);

  const handleFilterChange = (key: string, value: string | boolean | undefined) => {
    const newFilters = { ...filters };
    if (value === '' || value === undefined) {
      delete newFilters[key as keyof typeof newFilters];
    } else {
      (newFilters as any)[key] = value;
    }
    onFiltersChange(newFilters);
  };

  const clearFilters = () => {
    onFiltersChange({ isActive: true });
  };

  const hasActiveFilters = filters.department || filters.title || filters.isActive === false;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-4">
      <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-3 sm:mb-4">
        <h3 className="text-sm font-medium text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-500 self-start sm:self-auto"
          >
            Clear all filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Department Filter */}
        <div>
          <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
            Department
          </label>
          <select
            id="department"
            value={filters.department || ''}
            onChange={(e) => handleFilterChange('department', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            disabled={loading}
          >
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        {/* Title Filter */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title
          </label>
          <select
            id="title"
            value={filters.title || ''}
            onChange={(e) => handleFilterChange('title', e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            disabled={loading}
          >
            <option value="">All Titles</option>
            {titles.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status"
            value={filters.isActive === undefined ? 'all' : filters.isActive.toString()}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'all') {
                handleFilterChange('isActive', undefined);
              } else {
                handleFilterChange('isActive', value === 'true');
              }
            }}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
            <option value="all">All Employees</option>
          </select>
        </div>

        {/* Search placeholder for future enhancement */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Quick Search
          </label>
          <input
            type="text"
            id="search"
            placeholder="Search by name..."
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            disabled
          />
          <p className="mt-1 text-xs text-gray-500">Use main search for full search functionality</p>
        </div>
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="mt-3 sm:mt-4 flex flex-wrap gap-2">
          {filters.department && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Department: {filters.department}
              <button
                onClick={() => handleFilterChange('department', undefined)}
                className="ml-1 text-blue-600 hover:text-blue-500 focus:outline-none"
                aria-label="Remove department filter"
              >
                ×
              </button>
            </span>
          )}
          {filters.title && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Title: {filters.title}
              <button
                onClick={() => handleFilterChange('title', undefined)}
                className="ml-1 text-blue-600 hover:text-blue-500 focus:outline-none"
                aria-label="Remove title filter"
              >
                ×
              </button>
            </span>
          )}
          {filters.isActive === false && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              Inactive Only
              <button
                onClick={() => handleFilterChange('isActive', true)}
                className="ml-1 text-red-600 hover:text-red-500 focus:outline-none"
                aria-label="Remove status filter"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};