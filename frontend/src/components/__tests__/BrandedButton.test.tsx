import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrandedButton } from '../BrandedButton';
import { BrandingProvider } from '../../contexts/BrandingContext';
import { TenantAPI } from '../../services/tenant';

// Mock the TenantAPI
jest.mock('../../services/tenant', () => ({
  TenantAPI: {
    getSettings: jest.fn(),
  },
}));

const mockTenantAPI = TenantAPI as jest.Mocked<typeof TenantAPI>;

// Wrapper component with BrandingProvider
const BrandedButtonWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <BrandingProvider>{children}</BrandingProvider>;
};

describe('BrandedButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful tenant settings
    mockTenantAPI.getSettings.mockResolvedValue({
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
    });
  });

  it('should render with primary variant by default', () => {
    render(
      <BrandedButtonWrapper>
        <BrandedButton>Test Button</BrandedButton>
      </BrandedButtonWrapper>
    );

    const button = screen.getByRole('button', { name: 'Test Button' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center');
  });

  it('should render different button variants', () => {
    const { rerender } = render(
      <BrandedButtonWrapper>
        <BrandedButton variant="primary">Primary</BrandedButton>
      </BrandedButtonWrapper>
    );

    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();

    rerender(
      <BrandedButtonWrapper>
        <BrandedButton variant="secondary">Secondary</BrandedButton>
      </BrandedButtonWrapper>
    );

    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument();

    rerender(
      <BrandedButtonWrapper>
        <BrandedButton variant="outline">Outline</BrandedButton>
      </BrandedButtonWrapper>
    );

    expect(screen.getByRole('button', { name: 'Outline' })).toBeInTheDocument();

    rerender(
      <BrandedButtonWrapper>
        <BrandedButton variant="ghost">Ghost</BrandedButton>
      </BrandedButtonWrapper>
    );

    expect(screen.getByRole('button', { name: 'Ghost' })).toBeInTheDocument();
  });

  it('should render different button sizes', () => {
    const { rerender } = render(
      <BrandedButtonWrapper>
        <BrandedButton size="sm">Small</BrandedButton>
      </BrandedButtonWrapper>
    );

    let button = screen.getByRole('button', { name: 'Small' });
    expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm');

    rerender(
      <BrandedButtonWrapper>
        <BrandedButton size="md">Medium</BrandedButton>
      </BrandedButtonWrapper>
    );

    button = screen.getByRole('button', { name: 'Medium' });
    expect(button).toHaveClass('px-4', 'py-2', 'text-sm');

    rerender(
      <BrandedButtonWrapper>
        <BrandedButton size="lg">Large</BrandedButton>
      </BrandedButtonWrapper>
    );

    button = screen.getByRole('button', { name: 'Large' });
    expect(button).toHaveClass('px-6', 'py-3', 'text-base');
  });

  it('should handle loading state', () => {
    render(
      <BrandedButtonWrapper>
        <BrandedButton isLoading>Loading Button</BrandedButton>
      </BrandedButtonWrapper>
    );

    const button = screen.getByRole('button', { name: 'Loading Button' });
    expect(button).toBeDisabled();
    
    // Should show loading spinner
    const spinner = button.querySelector('svg');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
  });

  it('should handle disabled state', () => {
    render(
      <BrandedButtonWrapper>
        <BrandedButton disabled>Disabled Button</BrandedButton>
      </BrandedButtonWrapper>
    );

    const button = screen.getByRole('button', { name: 'Disabled Button' });
    expect(button).toBeDisabled();
  });

  it('should render with left and right icons', () => {
    const LeftIcon = () => <span data-testid="left-icon">←</span>;
    const RightIcon = () => <span data-testid="right-icon">→</span>;

    render(
      <BrandedButtonWrapper>
        <BrandedButton 
          leftIcon={<LeftIcon />} 
          rightIcon={<RightIcon />}
        >
          Icon Button
        </BrandedButton>
      </BrandedButtonWrapper>
    );

    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Icon Button' })).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = jest.fn();

    render(
      <BrandedButtonWrapper>
        <BrandedButton onClick={handleClick}>Clickable Button</BrandedButton>
      </BrandedButtonWrapper>
    );

    const button = screen.getByRole('button', { name: 'Clickable Button' });
    fireEvent.click(button);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', () => {
    const handleClick = jest.fn();

    render(
      <BrandedButtonWrapper>
        <BrandedButton onClick={handleClick} disabled>
          Disabled Button
        </BrandedButton>
      </BrandedButtonWrapper>
    );

    const button = screen.getByRole('button', { name: 'Disabled Button' });
    fireEvent.click(button);

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should handle mouse events for hover states', () => {
    const handleMouseEnter = jest.fn();
    const handleMouseLeave = jest.fn();

    render(
      <BrandedButtonWrapper>
        <BrandedButton 
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          Hover Button
        </BrandedButton>
      </BrandedButtonWrapper>
    );

    const button = screen.getByRole('button', { name: 'Hover Button' });
    
    fireEvent.mouseEnter(button);
    expect(handleMouseEnter).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(button);
    expect(handleMouseLeave).toHaveBeenCalledTimes(1);
  });

  it('should apply custom className and style props', () => {
    render(
      <BrandedButtonWrapper>
        <BrandedButton 
          className="custom-class"
          style={{ marginTop: '10px' }}
        >
          Custom Button
        </BrandedButton>
      </BrandedButtonWrapper>
    );

    const button = screen.getByRole('button', { name: 'Custom Button' });
    expect(button).toHaveClass('custom-class');
    expect(button).toHaveStyle({ marginTop: '10px' });
  });
});