import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrandingProvider, useBranding } from '../../contexts/BrandingContext';
import { TenantAPI } from '../../services/tenant';

// Mock the TenantAPI
jest.mock('../../services/tenant', () => ({
  TenantAPI: {
    getSettings: jest.fn(),
  },
}));

const mockTenantAPI = TenantAPI as jest.Mocked<typeof TenantAPI>;

// Test component that uses the branding context
const TestComponent: React.FC = () => {
  const { theme, isLoading, error } = useBranding();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <div data-testid="tenant-name">{theme.tenantName || 'No name'}</div>
      <div data-testid="primary-color">{theme.primaryColor || 'No primary color'}</div>
      <div data-testid="accent-color">{theme.accentColor || 'No accent color'}</div>
      <div data-testid="logo-url">{theme.logoUrl || 'No logo'}</div>
    </div>
  );
};

describe('BrandingContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any existing CSS custom properties
    document.documentElement.style.removeProperty('--color-primary');
    document.documentElement.style.removeProperty('--color-accent');
  });

  it('should load tenant branding settings on mount', async () => {
    const mockSettings = {
      id: 'tenant-1',
      name: 'Test Company',
      subdomain: 'testco',
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#FF0000',
      accentColor: '#00FF00',
      subscriptionTier: 'premium',
      userLimit: 100,
      dataRetentionDays: 365,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    mockTenantAPI.getSettings.mockResolvedValueOnce(mockSettings);

    render(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>
    );

    // Should show loading initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for the settings to load
    await waitFor(() => {
      expect(screen.getByTestId('tenant-name')).toHaveTextContent('Test Company');
    });

    expect(screen.getByTestId('primary-color')).toHaveTextContent('#FF0000');
    expect(screen.getByTestId('accent-color')).toHaveTextContent('#00FF00');
    expect(screen.getByTestId('logo-url')).toHaveTextContent('https://example.com/logo.png');

    // Verify API was called
    expect(mockTenantAPI.getSettings).toHaveBeenCalledTimes(1);
  });

  it('should apply CSS custom properties for theme colors', async () => {
    const mockSettings = {
      id: 'tenant-1',
      name: 'Test Company',
      subdomain: 'testco',
      primaryColor: '#FF0000',
      accentColor: '#00FF00',
      subscriptionTier: 'premium',
      userLimit: 100,
      dataRetentionDays: 365,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    mockTenantAPI.getSettings.mockResolvedValueOnce(mockSettings);

    render(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('tenant-name')).toHaveTextContent('Test Company');
    });

    // Check that CSS custom properties were set
    const rootStyle = getComputedStyle(document.documentElement);
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#FF0000');
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#00FF00');
  });

  it('should handle API errors gracefully', async () => {
    mockTenantAPI.getSettings.mockRejectedValueOnce(new Error('API Error'));

    render(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Error: Failed to load branding settings')).toBeInTheDocument();
    });

    // Should still apply default theme
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#3B82F6');
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#10B981');
  });

  it('should use default colors when tenant colors are not provided', async () => {
    const mockSettings = {
      id: 'tenant-1',
      name: 'Test Company',
      subdomain: 'testco',
      subscriptionTier: 'basic',
      userLimit: 50,
      dataRetentionDays: 365,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    mockTenantAPI.getSettings.mockResolvedValueOnce(mockSettings);

    render(
      <BrandingProvider>
        <TestComponent />
      </BrandingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('tenant-name')).toHaveTextContent('Test Company');
    });

    // Should use default colors
    expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe('#3B82F6');
    expect(document.documentElement.style.getPropertyValue('--color-accent')).toBe('#10B981');
  });
});