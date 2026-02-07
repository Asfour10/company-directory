import React from 'react';
import { Employee, SearchResult } from '../types/api';

interface SearchResultsProps {
  results: SearchResult | null;
  isLoading: boolean;
  error: string | null;
  onEmployeeClick?: (employee: Employee) => void;
  className?: string;
}

interface EmployeeCardProps {
  employee: Employee;
  onClick?: (employee: Employee) => void;
}

const EmployeeCard: React.FC<EmployeeCardProps> = ({ employee, onClick }) => {
  const handleClick = () => {
    onClick?.(employee);
  };

  return (
    <div
      className={`
        bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200
        ${onClick ? 'cursor-pointer hover:border-blue-300' : ''}
      `}
      onClick={handleClick}
    >
      <div className="flex items-start space-x-4">
        {/* Profile Photo */}
        <div className="flex-shrink-0">
          {employee.profilePhotoUrl ? (
            <img
              src={employee.profilePhotoUrl}
              alt={`${employee.firstName} ${employee.lastName}`}
              className="w-12 h-12 rounded-full object-cover"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
              <span className="text-gray-600 font-medium text-lg">
                {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Employee Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {employee.firstName} {employee.lastName}
            </h3>
            {!employee.isActive && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Inactive
              </span>
            )}
          </div>
          
          {employee.title && (
            <p className="text-sm text-gray-600 truncate">{employee.title}</p>
          )}
          
          {employee.department && (
            <p className="text-sm text-gray-500 truncate">{employee.department}</p>
          )}
          
          <div className="mt-2 space-y-1">
            <p className="text-sm text-gray-700 truncate">
              <span className="font-medium">Email:</span> {employee.email}
            </p>
            
            {employee.phone && (
              <p className="text-sm text-gray-700 truncate">
                <span className="font-medium">Phone:</span> {employee.phone}
              </p>
            )}
            
            {employee.officeLocation && (
              <p className="text-sm text-gray-700 truncate">
                <span className="font-medium">Location:</span> {employee.officeLocation}
              </p>
            )}
          </div>

          {employee.skills && employee.skills.length > 0 && (
            <div className="mt-3">
              <div className="flex flex-wrap gap-1">
                {employee.skills.slice(0, 3).map((skill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {skill}
                  </span>
                ))}
                {employee.skills.length > 3 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    +{employee.skills.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const LoadingCard: React.FC = () => (
  <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
    <div className="flex items-start space-x-4">
      <div className="w-12 h-12 rounded-full bg-gray-300"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-300 rounded w-1/3"></div>
        <div className="h-3 bg-gray-300 rounded w-1/4"></div>
        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        <div className="h-3 bg-gray-300 rounded w-2/3"></div>
      </div>
    </div>
  </div>
);

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  isLoading,
  error,
  onEmployeeClick,
  className = '',
}) => {
  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-red-600 mb-2">
          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Search Error</h3>
        <p className="text-gray-600">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        {Array.from({ length: 3 }).map((_, index) => (
          <LoadingCard key={index} />
        ))}
      </div>
    );
  }

  if (!results) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-gray-400 mb-2">
          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Start Searching</h3>
        <p className="text-gray-600">Enter a name, department, or skill to find employees</p>
      </div>
    );
  }

  if (results.results.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-gray-400 mb-2">
          <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-1.009-5.824-2.562M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No Results Found</h3>
        <p className="text-gray-600">
          {results.message || `No employees found for "${results.query}"`}
        </p>
        {results.suggestions && results.suggestions.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-500 mb-2">Did you mean:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {results.suggestions.map((suggestion, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                >
                  {suggestion}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Results Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Search Results
          </h2>
          <span className="text-sm text-gray-500">
            {results.total} {results.total === 1 ? 'result' : 'results'} found
            {results.query && ` for "${results.query}"`}
          </span>
        </div>
        
        {results.meta.responseTime && (
          <span className="text-xs text-gray-400">
            {results.meta.responseTime}
            {results.meta.cached && ' (cached)'}
          </span>
        )}
      </div>

      {/* Results List */}
      <div className="space-y-4">
        {results.results.map((employee) => (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            onClick={onEmployeeClick}
          />
        ))}
      </div>

      {/* Pagination Info */}
      {results.hasMore && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Showing {results.results.length} of {results.total} results
          </p>
        </div>
      )}
    </div>
  );
};