import { useState, useEffect, useCallback, useRef } from 'react';
import { SearchResult, SearchFilters, SearchOptions } from '../types/api';
import { SearchAPI } from '../services/api';
import { useDebounce } from './useDebounce';

interface UseSearchOptions {
  debounceDelay?: number;
  initialFilters?: SearchFilters;
  initialOptions?: SearchOptions;
  autoSearch?: boolean;
}

interface UseSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  results: SearchResult | null;
  isLoading: boolean;
  error: string | null;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  options: SearchOptions;
  setOptions: (options: SearchOptions) => void;
  search: (overrideQuery?: string) => Promise<void>;
  clearResults: () => void;
  hasSearched: boolean;
}

/**
 * Custom hook for search functionality with debouncing and incremental results
 */
export function useSearch({
  debounceDelay = 300,
  initialFilters = {},
  initialOptions = { page: 1, pageSize: 20 },
  autoSearch = true,
}: UseSearchOptions = {}): UseSearchReturn {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [options, setOptions] = useState<SearchOptions>(initialOptions);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Debounce the search query
  const debouncedQuery = useDebounce(query, debounceDelay);
  
  // Keep track of the current request to cancel outdated ones
  const currentRequestRef = useRef<AbortController | null>(null);

  const search = useCallback(async (overrideQuery?: string) => {
    const searchQuery = overrideQuery !== undefined ? overrideQuery : debouncedQuery;
    
    // Cancel any ongoing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
    }

    // Create new abort controller for this request
    const abortController = new AbortController();
    currentRequestRef.current = abortController;

    setIsLoading(true);
    setError(null);

    try {
      const searchResult = await SearchAPI.search(searchQuery, filters, options);
      
      // Only update results if this request wasn't cancelled
      if (!abortController.signal.aborted) {
        setResults(searchResult);
        setHasSearched(true);
        
        // Track search analytics if there was a query
        if (searchQuery.trim()) {
          SearchAPI.trackSearch(searchQuery, searchResult.total);
        }
      }
    } catch (err: any) {
      // Only handle error if request wasn't cancelled
      if (!abortController.signal.aborted) {
        const errorMessage = err.response?.data?.error?.message || 'Search failed. Please try again.';
        setError(errorMessage);
        console.error('Search error:', err);
      }
    } finally {
      // Only update loading state if request wasn't cancelled
      if (!abortController.signal.aborted) {
        setIsLoading(false);
        currentRequestRef.current = null;
      }
    }
  }, [debouncedQuery, filters, options]);

  const clearResults = useCallback(() => {
    setResults(null);
    setError(null);
    setHasSearched(false);
    
    // Cancel any ongoing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }
  }, []);

  // Auto-search when debounced query changes (if enabled)
  useEffect(() => {
    if (autoSearch && debouncedQuery !== query) {
      // Only search if we have a query or if we've searched before (to handle empty queries)
      if (debouncedQuery.trim() || hasSearched) {
        search();
      }
    }
  }, [debouncedQuery, autoSearch, search, query, hasSearched]);

  // Re-search when filters or options change (if we have results)
  useEffect(() => {
    if (hasSearched && (debouncedQuery.trim() || results)) {
      search();
    }
  }, [filters, options, hasSearched, debouncedQuery, results, search]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }
    };
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    filters,
    setFilters,
    options,
    setOptions,
    search,
    clearResults,
    hasSearched,
  };
}