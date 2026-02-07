import React, { useState, useRef, useEffect } from 'react';
import { SearchAPI } from '../services/api';
import { useDebounce } from '../hooks/useDebounce';
import { useBrandedInlineStyles } from '../hooks/useBrandedStyles';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showAutocomplete?: boolean;
  autocompleteType?: 'names' | 'titles' | 'departments' | 'skills' | 'all';
  disabled?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}

interface AutocompleteSuggestion {
  text: string;
  type: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  placeholder = 'Search employees...',
  className = '',
  showAutocomplete = true,
  autocompleteType = 'all',
  disabled = false,
  onFocus,
  onBlur,
}) => {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const brandedStyles = useBrandedInlineStyles();
  
  // Debounce the autocomplete query
  const debouncedValue = useDebounce(value, 200); // Shorter delay for autocomplete

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (!showAutocomplete || !debouncedValue.trim() || debouncedValue.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoadingSuggestions(true);
      try {
        const result = await SearchAPI.getAutocomplete(debouncedValue, autocompleteType, 5);
        const formattedSuggestions = result.suggestions.map(text => ({
          text,
          type: autocompleteType,
        }));
        setSuggestions(formattedSuggestions);
        setShowSuggestions(formattedSuggestions.length > 0);
        setSelectedIndex(-1);
      } catch (error) {
        console.warn('Failed to fetch autocomplete suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [debouncedValue, showAutocomplete, autocompleteType]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          const selectedSuggestion = suggestions[selectedIndex];
          onChange(selectedSuggestion.text);
          setShowSuggestions(false);
          setSelectedIndex(-1);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
    onChange(suggestion.text);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
    onFocus?.();
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    }, 150);
    onBlur?.();
  };

  // Get input styles with branding
  const getInputStyles = () => {
    const baseStyle = {
      transition: 'all 0.2s ease-in-out',
    };

    if (disabled) {
      return {
        ...baseStyle,
        backgroundColor: '#F3F4F6', // gray-100
        cursor: 'not-allowed',
      };
    }

    if (isFocused) {
      return {
        ...baseStyle,
        ...brandedStyles.primaryFocus,
        borderColor: brandedStyles.primaryBorder.borderColor,
      };
    }

    return baseStyle;
  };

  // Get suggestion item styles
  const getSuggestionStyles = (index: number, isSelected: boolean) => {
    if (isSelected) {
      return {
        backgroundColor: `${brandedStyles.primaryBg.backgroundColor}10`, // 10% opacity
        color: brandedStyles.primaryText.color,
      };
    }
    return {};
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg
            focus:ring-2 focus:ring-offset-2 focus:outline-none
            disabled:bg-gray-100 disabled:cursor-not-allowed
            ${showSuggestions ? 'rounded-b-none' : ''}
          `}
          style={getInputStyles()}
        />
        
        {/* Search icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          {isLoadingSuggestions ? (
            <div 
              className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-2 rounded-full"
              style={{ borderTopColor: brandedStyles.primaryBg.backgroundColor }}
            />
          ) : (
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>
      </div>

      {/* Autocomplete suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full bg-white border border-gray-300 border-t-0 rounded-b-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.text}-${index}`}
              type="button"
              className={`
                w-full px-4 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none
                text-gray-900 transition-colors duration-150
                ${index === suggestions.length - 1 ? 'rounded-b-lg' : ''}
              `}
              style={getSuggestionStyles(index, index === selectedIndex)}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="flex items-center">
                <span className="flex-1">{suggestion.text}</span>
                <span className="text-xs text-gray-500 ml-2 capitalize">
                  {suggestion.type}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};