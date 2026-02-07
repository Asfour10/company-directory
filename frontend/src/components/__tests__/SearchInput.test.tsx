import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchInput } from '../SearchInput';
import { SearchAPI } from '../../services/api';

// Mock the SearchAPI
jest.mock('../../services/api');
const mockSearchAPI = SearchAPI as jest.Mocked<typeof SearchAPI>;

// Mock the useDebounce hook
jest.mock('../../hooks/useDebounce', () => ({
  useDebounce: jest.fn((value) => value), // Return value immediately for testing
}));

describe('SearchInput', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render with placeholder text', () => {
    render(
      <SearchInput
        value=""
        onChange={mockOnChange}
        placeholder="Search employees..."
      />
    );

    expect(screen.getByPlaceholderText('Search employees...')).toBeInTheDocument();
  });

  it('should call onChange when input value changes', () => {
    render(
      <SearchInput
        value=""
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'John' } });

    expect(mockOnChange).toHaveBeenCalledWith('John');
  });

  it('should display current value', () => {
    render(
      <SearchInput
        value="John Doe"
        onChange={mockOnChange}
      />
    );

    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('John Doe');
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <SearchInput
        value=""
        onChange={mockOnChange}
        disabled={true}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });

  it('should show loading spinner when fetching autocomplete', async () => {
    // Mock API to return a promise that doesn't resolve immediately
    mockSearchAPI.getAutocomplete.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(
      <SearchInput
        value="Jo"
        onChange={mockOnChange}
        showAutocomplete={true}
      />
    );

    // Focus the input to trigger autocomplete
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    // Should show loading spinner
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });
  });

  it('should fetch and display autocomplete suggestions', async () => {
    mockSearchAPI.getAutocomplete.mockResolvedValue({
      suggestions: ['John Doe', 'Jane Smith'],
      query: 'Jo',
      type: 'all',
      count: 2,
    });

    render(
      <SearchInput
        value="Jo"
        onChange={mockOnChange}
        showAutocomplete={true}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('should handle keyboard navigation in autocomplete', async () => {
    mockSearchAPI.getAutocomplete.mockResolvedValue({
      suggestions: ['John Doe', 'Jane Smith'],
      query: 'Jo',
      type: 'all',
      count: 2,
    });

    render(
      <SearchInput
        value="Jo"
        onChange={mockOnChange}
        showAutocomplete={true}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Press arrow down to select first suggestion
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    
    // Press enter to select
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockOnChange).toHaveBeenCalledWith('John Doe');
  });

  it('should handle escape key to close suggestions', async () => {
    mockSearchAPI.getAutocomplete.mockResolvedValue({
      suggestions: ['John Doe', 'Jane Smith'],
      query: 'Jo',
      type: 'all',
      count: 2,
    });

    render(
      <SearchInput
        value="Jo"
        onChange={mockOnChange}
        showAutocomplete={true}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Press escape to close suggestions
    fireEvent.keyDown(input, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    });
  });

  it('should not show autocomplete for short queries', () => {
    render(
      <SearchInput
        value="J"
        onChange={mockOnChange}
        showAutocomplete={true}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    // Should not call API for short queries
    expect(mockSearchAPI.getAutocomplete).not.toHaveBeenCalled();
  });
});