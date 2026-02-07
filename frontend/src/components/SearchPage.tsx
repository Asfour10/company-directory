import React, { useState } from 'react';
import { SearchInput } from './SearchInput';
import { SearchResults } from './SearchResults';
import { useSearch } from '../hooks/useSearch';
import { Employee, SearchFilters } from '../types/api';
import { BrandedButton } from './BrandedButton';
import { useBrandedInlineStyles } from '../hooks/useBrandedStyles';

interface SearchPageProps {
  onEmployeeClick?: (employee: Employee) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onEmployeeClick }) => {
  const [showFilters, setShowFilters] = useState(false);
  const brandedStyles = useBrandedInlineStyles();
  
  const {
    query,
    setQuery,
    results,
    isLoading,
    error,
    filters,
    setFilters,
    clearResults,
    hasSearched,
  } = useSearch({
    debounceDelay: 300, // 300ms debouncing as required
    autoSearch: true,
    initialOptions: {
      page: 1,
      pageSize: 20,
    },
  });

  const handleFilterChange = (newFilters: Partial<SearchFilters>) => {
    setFilters({ ...filters, ...newFilters });
  };

  const handleClearSearch = () => {
    setQuery('');
    clearResults();
  };

  const handleEmployeeClick = (employee: Employee) => {
    // Track the click for analytics
    if (results?.query) {
      // This will be handled by the SearchAPI.trackSearch call in useSearch
    }
    onEmployeeClick?.(employee);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Search Input */}
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search employees by name, department, title, or skills..."
              showAutocomplete={true}
              autocompleteType="all"
              className="w-full"
            />
          </div>
          
          {/* Filter Toggle */}
          <BrandedButton
            variant={showFilters ? 'primary' : 'outline'}
            onClick={() => setShowFilters(!showFilters)}
            leftIcon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            }
          >
            Filters
          </BrandedButton>

          {/* Clear Button */}
          {(query || hasSearched) && (
            <BrandedButton
              variant="ghost"
              onClick={handleClearSearch}
            >
              Clear
            </BrandedButton>
          )}
        </div>

        {/* Search Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  id="department"
                  value={filters.department || ''}
                  onChange={(e) => handleFilterChange({ department: e.target.value || undefined })}
                  placeholder="e.g., Engineering"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-offset-2 focus:outline-none transition-all duration-200"
                  style={{
                    ...brandedStyles.primaryFocus,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = brandedStyles.primaryBorder.borderColor;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#D1D5DB'; // gray-300
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={filters.title || ''}
                  onChange={(e) => handleFilterChange({ title: e.target.value || undefined })}
                  placeholder="e.g., Software Engineer"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-offset-2 focus:outline-none transition-all duration-200"
                  style={{
                    ...brandedStyles.primaryFocus,
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = brandedStyles.primaryBorder.borderColor;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = '#D1D5DB'; // gray-300
                  }}
                />
              </div>
              
              <div>
                <label htmlFor="includeInactive" className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="includeInactive"
                    checked={filters.includeInactive || false}
                    onChange={(e) => handleFilterChange({ includeInactive: e.target.checked })}
                    className="rounded border-gray-300 focus:ring-2 focus:ring-offset-2"
                    style={{
                      accentColor: brandedStyles.primaryBg.backgroundColor,
                    }}
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Include inactive employees
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Search Results */}
      <SearchResults
        results={results}
        isLoading={isLoading}
        error={error}
        onEmployeeClick={handleEmployeeClick}
        className="mb-8"
      />

      {/* Search Tips */}
      {!hasSearched && !isLoading && (
        <div 
          className="border rounded-lg p-6"
          style={{
            backgroundColor: `${brandedStyles.primaryBg.backgroundColor}05`, // 5% opacity
            borderColor: `${brandedStyles.primaryBg.backgroundColor}20`, // 20% opacity
          }}
        >
          <h3 
            className="text-lg font-medium mb-3"
            style={brandedStyles.primaryText}
          >
            Search Tips
          </h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start space-x-2">
              <span style={brandedStyles.primaryText}>•</span>
              <span>Search by name, department, title, or skills</span>
            </li>
            <li className="flex items-start space-x-2">
              <span style={brandedStyles.primaryText}>•</span>
              <span>Results appear as you type with 300ms debouncing</span>
            </li>
            <li className="flex items-start space-x-2">
              <span style={brandedStyles.primaryText}>•</span>
              <span>Use filters to narrow down your search</span>
            </li>
            <li className="flex items-start space-x-2">
              <span style={brandedStyles.primaryText}>•</span>
              <span>Autocomplete suggestions help you find what you're looking for</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};