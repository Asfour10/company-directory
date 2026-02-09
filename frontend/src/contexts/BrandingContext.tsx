import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { TenantAPI } from '../services/tenant';

export interface BrandingTheme {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  tenantName?: string;
  subdomain?: string;
}

interface BrandingContextType {
  theme: BrandingTheme;
  isLoading: boolean;
  error: string | null;
  refreshBranding: () => Promise<void>;
  updateTheme: (updates: Partial<BrandingTheme>) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

interface BrandingProviderProps {
  children: ReactNode;
}

export const BrandingProvider: React.FC<BrandingProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<BrandingTheme>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBranding = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const settings = await TenantAPI.getSettings();
      
      const newTheme: BrandingTheme = {
        logoUrl: settings.logoUrl,
        primaryColor: settings.primaryColor,
        accentColor: settings.accentColor,
        tenantName: settings.name,
        subdomain: settings.subdomain,
      };
      
      setTheme(newTheme);
      
      // Apply CSS custom properties for dynamic theming
      applyThemeToDOM(newTheme);
      
    } catch (err) {
      console.error('Failed to load tenant branding:', err);
      setError('Failed to load branding settings');
      
      // Apply default theme on error
      const defaultTheme: BrandingTheme = {
        primaryColor: '#3B82F6', // blue-500
        accentColor: '#10B981', // emerald-500
        tenantName: 'Company Directory',
      };
      setTheme(defaultTheme);
      applyThemeToDOM(defaultTheme);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshBranding = async () => {
    await loadBranding();
  };

  const updateTheme = (updates: Partial<BrandingTheme>) => {
    const newTheme = { ...theme, ...updates };
    setTheme(newTheme);
    applyThemeToDOM(newTheme);
  };

  // Apply theme colors to DOM as CSS custom properties
  const applyThemeToDOM = (brandingTheme: BrandingTheme) => {
    const root = document.documentElement;
    
    if (brandingTheme.primaryColor) {
      root.style.setProperty('--color-primary', brandingTheme.primaryColor);
      
      // Generate lighter and darker variants
      const primaryRgb = hexToRgb(brandingTheme.primaryColor);
      if (primaryRgb) {
        root.style.setProperty('--color-primary-rgb', `${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}`);
        root.style.setProperty('--color-primary-50', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.05)`);
        root.style.setProperty('--color-primary-100', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.1)`);
        root.style.setProperty('--color-primary-200', `rgba(${primaryRgb.r}, ${primaryRgb.g}, ${primaryRgb.b}, 0.2)`);
        root.style.setProperty('--color-primary-500', brandingTheme.primaryColor);
        root.style.setProperty('--color-primary-600', darkenColor(brandingTheme.primaryColor, 0.1));
        root.style.setProperty('--color-primary-700', darkenColor(brandingTheme.primaryColor, 0.2));
        root.style.setProperty('--color-primary-800', darkenColor(brandingTheme.primaryColor, 0.3));
        root.style.setProperty('--color-primary-900', darkenColor(brandingTheme.primaryColor, 0.4));
      }
    }
    
    if (brandingTheme.accentColor) {
      root.style.setProperty('--color-accent', brandingTheme.accentColor);
      
      // Generate lighter and darker variants
      const accentRgb = hexToRgb(brandingTheme.accentColor);
      if (accentRgb) {
        root.style.setProperty('--color-accent-rgb', `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
        root.style.setProperty('--color-accent-50', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.05)`);
        root.style.setProperty('--color-accent-100', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.1)`);
        root.style.setProperty('--color-accent-200', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.2)`);
        root.style.setProperty('--color-accent-500', brandingTheme.accentColor);
        root.style.setProperty('--color-accent-600', darkenColor(brandingTheme.accentColor, 0.1));
        root.style.setProperty('--color-accent-700', darkenColor(brandingTheme.accentColor, 0.2));
      }
    }
  };

  // Load branding on mount
  useEffect(() => {
    loadBranding();
  }, []);

  const value: BrandingContextType = {
    theme,
    isLoading,
    error,
    refreshBranding,
    updateTheme,
  };

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = (): BrandingContextType => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};

// Utility functions for color manipulation
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const darken = (value: number) => Math.max(0, Math.floor(value * (1 - amount)));
  
  const r = darken(rgb.r).toString(16).padStart(2, '0');
  const g = darken(rgb.g).toString(16).padStart(2, '0');
  const b = darken(rgb.b).toString(16).padStart(2, '0');
  
  return `#${r}${g}${b}`;
}