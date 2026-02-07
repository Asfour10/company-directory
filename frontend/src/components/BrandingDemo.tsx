import React from 'react';
import { useBranding } from '../contexts/BrandingContext';
import { BrandedButton } from './BrandedButton';
import { useBrandedInlineStyles } from '../hooks/useBrandedStyles';

/**
 * Demo component to showcase branding functionality
 * This component demonstrates how tenant branding is applied throughout the application
 */
export const BrandingDemo: React.FC = () => {
  const { theme, isLoading, error, refreshBranding } = useBranding();
  const brandedStyles = useBrandedInlineStyles();

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-medium mb-2">Branding Error</h3>
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <BrandedButton onClick={refreshBranding} size="sm">
          Retry
        </BrandedButton>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Branding Information */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Current Branding Settings
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Tenant Information</h3>
            <div className="space-y-1 text-sm">
              <p><span className="font-medium">Name:</span> {theme.tenantName || 'Not set'}</p>
              <p><span className="font-medium">Subdomain:</span> {theme.subdomain || 'Not set'}</p>
            </div>
          </div>
          
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Brand Colors</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: theme.primaryColor || '#3B82F6' }}
                />
                <span className="text-sm">Primary: {theme.primaryColor || '#3B82F6 (default)'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: theme.accentColor || '#10B981' }}
                />
                <span className="text-sm">Accent: {theme.accentColor || '#10B981 (default)'}</span>
              </div>
            </div>
          </div>
        </div>

        {theme.logoUrl && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Logo</h3>
            <img 
              src={theme.logoUrl} 
              alt="Tenant Logo" 
              className="h-12 w-auto object-contain border rounded"
            />
          </div>
        )}
      </div>

      {/* Button Variants Demo */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Branded Button Variants
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Primary</h3>
            <BrandedButton variant="primary" size="sm">Small</BrandedButton>
            <BrandedButton variant="primary" size="md">Medium</BrandedButton>
            <BrandedButton variant="primary" size="lg">Large</BrandedButton>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Secondary</h3>
            <BrandedButton variant="secondary" size="sm">Small</BrandedButton>
            <BrandedButton variant="secondary" size="md">Medium</BrandedButton>
            <BrandedButton variant="secondary" size="lg">Large</BrandedButton>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Outline</h3>
            <BrandedButton variant="outline" size="sm">Small</BrandedButton>
            <BrandedButton variant="outline" size="md">Medium</BrandedButton>
            <BrandedButton variant="outline" size="lg">Large</BrandedButton>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Ghost</h3>
            <BrandedButton variant="ghost" size="sm">Small</BrandedButton>
            <BrandedButton variant="ghost" size="md">Medium</BrandedButton>
            <BrandedButton variant="ghost" size="lg">Large</BrandedButton>
          </div>
        </div>

        <div className="mt-4 space-x-2">
          <BrandedButton 
            variant="primary" 
            isLoading={true}
            disabled
          >
            Loading...
          </BrandedButton>
          <BrandedButton 
            variant="secondary" 
            disabled
          >
            Disabled
          </BrandedButton>
        </div>
      </div>

      {/* Text and Elements Demo */}
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Branded Text and Elements
        </h2>
        
        <div className="space-y-4">
          <div>
            <h3 
              className="text-lg font-medium mb-2"
              style={brandedStyles.primaryText}
            >
              Primary Color Text
            </h3>
            <p className="text-gray-600">
              This heading uses the tenant's primary brand color.
            </p>
          </div>
          
          <div>
            <h3 
              className="text-lg font-medium mb-2"
              style={brandedStyles.accentText}
            >
              Accent Color Text
            </h3>
            <p className="text-gray-600">
              This heading uses the tenant's accent brand color.
            </p>
          </div>
          
          <div>
            <a 
              href="#" 
              className="text-sm underline hover:no-underline transition-all duration-200"
              style={brandedStyles.primaryText}
            >
              Branded Link Example
            </a>
          </div>
          
          <div 
            className="p-4 rounded-lg border"
            style={{
              backgroundColor: `${brandedStyles.primaryBg.backgroundColor}05`,
              borderColor: `${brandedStyles.primaryBg.backgroundColor}20`,
            }}
          >
            <p className="text-sm text-gray-700">
              This is a branded background container using the primary color with low opacity.
            </p>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <BrandedButton 
          variant="outline" 
          onClick={refreshBranding}
          leftIcon={
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        >
          Refresh Branding
        </BrandedButton>
      </div>
    </div>
  );
};

export default BrandingDemo;