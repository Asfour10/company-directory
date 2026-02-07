import React, { useState, useEffect } from 'react';
import { EmployeeAPI, EmployeeListResponse } from '../services/employee';
import { Employee } from '../types/api';
import { EmployeeCard } from '../components/EmployeeCard';
import { EmployeeListFilters } from '../components/EmployeeListFilters';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { BrandedButton } from '../components/BrandedButton';
import { usePerformance } from '../hooks/usePerformance';

interface EmployeeDirectoryPageProps {
  onEmployeeClick?: (employee: Employee) => void;
}

export const EmployeeDirectoryPage: React.FC<EmployeeDirectoryPageProps> = ({
  onEmployeeClick
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>('');
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<{
    department?: string;
    title?: string;
    isActive?: boolean;
  }>({ isActive: true });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'department' | 'title'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { useMemoizedCallback, useMemoizedValue } = usePerformance();
  const pageSize = 20;

  // Memoized load employees function
  const loadEmployees = useMemoizedCallback(async (
    pageNum: number = 1, 
    currentFilters = filters,
    currentSortBy = sortBy,
    currentSortOrder = sortOrder,
    append = false
  ) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
        setError('');
      } else {
        setLoadingMore(true);
      }

      const response: EmployeeListResponse = await EmployeeAPI.getEmployees(
        pageNum,
        pageSize,
        currentFilters,
        currentSortBy,
        currentSortOrder
      );

      if (append) {
        setEmployees(prev => [...prev, ...response.employees]);
      } else {
        setEmployees(response.employees);
      }

      setHasMore(response.hasMore);
      setPage(pageNum);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filters, sortBy, sortOrder]);

  // Memoized filter change handler
  const handleFilterChange = useMemoizedCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  // Memoized load more handler
  const handleLoadMore = useMemoizedCallback(() => {
    if (!loadingMore && hasMore) {
      loadEmployees(page + 1, filters, sortBy, sortOrder, true);
    }
  }, [loadingMore, hasMore, page, filters, sortBy, sortOrder, loadEmployees]);

  // Memoized sort change handler
  const handleSortChange = useMemoizedCallback((newSortBy: 'name' | 'department' | 'title', newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    setPage(1);
  }, []);

  // Memoized employee click handler
  const handleEmployeeClick = useMemoizedCallback((employee: Employee) => {
    // Navigation is now handled by the EmployeeCard Link component
    // This handler is kept for backward compatibility
    if (onEmployeeClick) {
      onEmployeeClick(employee);
    }
  }, [onEmployeeClick]);

  // Memoized grid classes
  const gridClasses = useMemoizedValue(() => {
    return viewMode === 'grid'
      ? 'grid-responsive-cards'
      : 'space-y-3 sm:space-y-4';
  }, [viewMode]);

  // Initial load
  useEffect(() => {
    loadEmployees(1, filters, sortBy, sortOrder, false);
  }, [filters, sortBy, sortOrder, loadEmployees]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="rounded-md bg-red-50 p-4 max-w-md mx-auto">
          <div className="text-sm text-red-700">{error}</div>
          <button
            onClick={() => loadEmployees(1, filters, sortBy, sortOrder, false)}
            className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-mobile-y">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-responsive-xl font-bold text-gray-900">Employee Directory</h1>
          <p className="mt-1 text-responsive-xs text-gray-500">
            {employees.length} employee{employees.length !== 1 ? 's' : ''} found
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
          {/* Sort controls */}
          <div className="flex items-center space-x-2">
            <span className="text-responsive-xs text-gray-500 hidden sm:inline">Sort by:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-') as ['name' | 'department' | 'title', 'asc' | 'desc'];
                handleSortChange(newSortBy, newSortOrder);
              }}
              className="text-responsive-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 touch-target-sm"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="department-asc">Department (A-Z)</option>
              <option value="department-desc">Department (Z-A)</option>
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
            </select>
          </div>
          
          {/* View mode toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-responsive-xs text-gray-500 hidden sm:inline">View:</span>
            <div className="flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2 sm:px-3 py-2 text-responsive-xs font-medium rounded-l-lg border touch-target-sm tap-highlight-none ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50 active:bg-gray-100'
                }`}
                title="Grid view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2 sm:px-3 py-2 text-responsive-xs font-medium rounded-r-lg border-t border-r border-b touch-target-sm tap-highlight-none ${
                  viewMode === 'list'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50 active:bg-gray-100'
                }`}
                title="List view"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <EmployeeListFilters
        filters={filters}
        onFiltersChange={handleFilterChange}
      />

      {/* Employee List */}
      {employees.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="mt-2 text-responsive-sm font-medium text-gray-900">No employees found</h3>
          <p className="mt-1 text-responsive-xs text-gray-500">
            Try adjusting your filters or search criteria.
          </p>
        </div>
      ) : (
        <>
          <div className={gridClasses}>
            {employees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                onClick={() => handleEmployeeClick(employee)}
                viewMode={viewMode}
                enableNavigation={true}
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-4 lg:pt-6">
              <BrandedButton
                onClick={handleLoadMore}
                disabled={loadingMore}
                variant="outline"
                className="w-full sm:w-auto touch-target"
              >
                {loadingMore ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </BrandedButton>
            </div>
          )}
        </>
      )}
    </div>
  );
};