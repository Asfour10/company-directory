import { useMemo } from 'react';
import { useBranding } from '../contexts/BrandingContext';

export interface BrandedStyles {
  primaryColor: string;
  accentColor: string;
  primaryBg: string;
  primaryBgHover: string;
  primaryText: string;
  primaryBorder: string;
  accentBg: string;
  accentBgHover: string;
  accentText: string;
  accentBorder: string;
  buttonPrimary: string;
  buttonPrimaryHover: string;
  buttonSecondary: string;
  buttonSecondaryHover: string;
  linkColor: string;
  linkHoverColor: string;
}

/**
 * Hook that provides branded CSS classes and inline styles
 * Uses tenant branding colors or falls back to defaults
 */
export const useBrandedStyles = (): BrandedStyles => {
  const { theme } = useBranding();

  return useMemo(() => {
    const primaryColor = theme.primaryColor || '#3B82F6'; // blue-500
    const accentColor = theme.accentColor || '#10B981'; // emerald-500

    return {
      // Raw colors
      primaryColor,
      accentColor,

      // Background styles
      primaryBg: `bg-[${primaryColor}]`,
      primaryBgHover: `hover:bg-[${darkenColor(primaryColor, 0.1)}]`,
      primaryText: `text-[${primaryColor}]`,
      primaryBorder: `border-[${primaryColor}]`,

      accentBg: `bg-[${accentColor}]`,
      accentBgHover: `hover:bg-[${darkenColor(accentColor, 0.1)}]`,
      accentText: `text-[${accentColor}]`,
      accentBorder: `border-[${accentColor}]`,

      // Button styles
      buttonPrimary: `bg-[${primaryColor}] hover:bg-[${darkenColor(primaryColor, 0.1)}] text-white`,
      buttonPrimaryHover: `hover:bg-[${darkenColor(primaryColor, 0.1)}]`,
      buttonSecondary: `border-[${primaryColor}] text-[${primaryColor}] hover:bg-[${primaryColor}] hover:text-white`,
      buttonSecondaryHover: `hover:bg-[${primaryColor}] hover:text-white`,

      // Link styles
      linkColor: `text-[${primaryColor}]`,
      linkHoverColor: `hover:text-[${darkenColor(primaryColor, 0.1)}]`,
    };
  }, [theme.primaryColor, theme.accentColor]);
};

/**
 * Hook that provides inline styles for dynamic theming
 * Use this when Tailwind's arbitrary value syntax doesn't work
 */
export const useBrandedInlineStyles = () => {
  const { theme } = useBranding();

  return useMemo(() => {
    const primaryColor = theme.primaryColor || '#3B82F6';
    const accentColor = theme.accentColor || '#10B981';

    return {
      // Button styles
      primaryButton: {
        backgroundColor: primaryColor,
        borderColor: primaryColor,
        color: 'white',
      },
      primaryButtonHover: {
        backgroundColor: darkenColor(primaryColor, 0.1),
        borderColor: darkenColor(primaryColor, 0.1),
      },
      secondaryButton: {
        backgroundColor: 'transparent',
        borderColor: primaryColor,
        color: primaryColor,
      },
      secondaryButtonHover: {
        backgroundColor: primaryColor,
        color: 'white',
      },

      // Text styles
      primaryText: {
        color: primaryColor,
      },
      accentText: {
        color: accentColor,
      },

      // Background styles
      primaryBg: {
        backgroundColor: primaryColor,
      },
      accentBg: {
        backgroundColor: accentColor,
      },

      // Border styles
      primaryBorder: {
        borderColor: primaryColor,
      },
      accentBorder: {
        borderColor: accentColor,
      },

      // Focus styles
      primaryFocus: {
        outline: 'none',
        boxShadow: `0 0 0 3px ${primaryColor}25`, // 25 = 15% opacity
      },
    };
  }, [theme.primaryColor, theme.accentColor]);
};

// Utility function to darken a color
function darkenColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * amount * 100);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16)
    .slice(1);
}