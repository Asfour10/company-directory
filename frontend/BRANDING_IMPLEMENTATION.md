# Frontend Branding Implementation

This document describes the implementation of tenant branding functionality in the Company Directory frontend application.

## Overview

The branding system allows each tenant to customize the appearance of their Company Directory with:
- Custom logo
- Primary brand color
- Accent brand color
- Tenant name display

The implementation follows requirement 12.3: "WHEN a User logs into their Tenant, THE Directory System SHALL display the Tenant's logo and apply the configured brand colors"

## Architecture

### 1. BrandingContext (`src/contexts/BrandingContext.tsx`)

The central context provider that:
- Loads tenant branding settings on app initialization
- Manages branding state throughout the application
- Applies CSS custom properties for dynamic theming
- Provides error handling and loading states

**Key Features:**
- Automatic loading of tenant settings via `TenantAPI.getSettings()`
- CSS custom property injection for dynamic theming
- Color variant generation (50, 100, 200, etc.)
- Graceful fallback to default colors on error

### 2. TenantAPI Service (`src/services/tenant.ts`)

API service for tenant-related operations:
- `getSettings()` - Fetch tenant configuration
- `updateBranding()` - Update brand colors (Super Admin only)
- `uploadLogo()` - Upload tenant logo (Super Admin only)
- `deleteLogo()` - Remove tenant logo (Super Admin only)

### 3. Branded Components

#### Header Component (`src/components/Header.tsx`)
- Displays tenant logo or fallback initial
- Shows tenant name in title
- Responsive logo sizing with error handling

#### BrandedButton Component (`src/components/BrandedButton.tsx`)
- Button component that uses tenant brand colors
- Multiple variants: primary, secondary, outline, ghost
- Multiple sizes: sm, md, lg
- Loading and disabled states
- Icon support (left/right)

#### SearchInput Component (Updated)
- Uses branded focus colors
- Branded loading spinner
- Branded autocomplete selection

### 4. Styling System

#### CSS Custom Properties (`src/index.css`)
Dynamic CSS variables that are updated by the BrandingContext:
```css
:root {
  --color-primary: #3B82F6;
  --color-primary-rgb: 59, 130, 246;
  --color-primary-50: rgba(59, 130, 246, 0.05);
  /* ... more variants */
  
  --color-accent: #10B981;
  --color-accent-rgb: 16, 185, 129;
  /* ... more variants */
}
```

#### Tailwind Configuration (`tailwind.config.js`)
Extended with:
- Dynamic brand color classes using CSS custom properties
- Safelist for arbitrary color values
- Custom animations for branding transitions

#### Branded Styling Hooks (`src/hooks/useBrandedStyles.ts`)
- `useBrandedStyles()` - Returns Tailwind classes with brand colors
- `useBrandedInlineStyles()` - Returns inline styles for dynamic theming

## Usage Examples

### Using the BrandingContext

```tsx
import { useBranding } from '../contexts/BrandingContext';

const MyComponent = () => {
  const { theme, isLoading, error } = useBranding();
  
  if (isLoading) return <div>Loading branding...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return (
    <div>
      <h1>{theme.tenantName}</h1>
      {theme.logoUrl && <img src={theme.logoUrl} alt="Logo" />}
    </div>
  );
};
```

### Using Branded Components

```tsx
import { BrandedButton } from '../components/BrandedButton';

const MyPage = () => (
  <div>
    <BrandedButton variant="primary" size="lg">
      Primary Action
    </BrandedButton>
    <BrandedButton variant="secondary" leftIcon={<Icon />}>
      Secondary Action
    </BrandedButton>
  </div>
);
```

### Using Branded Styles

```tsx
import { useBrandedInlineStyles } from '../hooks/useBrandedStyles';

const MyComponent = () => {
  const brandedStyles = useBrandedInlineStyles();
  
  return (
    <div>
      <h2 style={brandedStyles.primaryText}>Branded Heading</h2>
      <div style={{
        backgroundColor: `${brandedStyles.primaryBg.backgroundColor}10`
      }}>
        Branded background with 10% opacity
      </div>
    </div>
  );
};
```

## Implementation Details

### Color System

The branding system generates color variants automatically:
- **50-900 scale**: Different opacity/darkness levels
- **RGB values**: For use with opacity
- **Hover states**: Automatically darkened versions

### Error Handling

- **API Errors**: Falls back to default blue/emerald theme
- **Image Errors**: Shows tenant initial as fallback
- **Loading States**: Skeleton placeholders during load

### Performance Considerations

- **CSS Custom Properties**: Efficient runtime theme switching
- **Memoization**: Hooks use `useMemo` to prevent unnecessary recalculations
- **Caching**: Tenant settings are cached by the backend

### Accessibility

- **Color Contrast**: Maintains proper contrast ratios
- **Focus States**: Branded focus rings with sufficient visibility
- **Alt Text**: Proper alt text for logos and images

## Testing

The implementation includes comprehensive tests:

### BrandingContext Tests (`__tests__/BrandingContext.test.tsx`)
- Loading tenant settings
- Applying CSS custom properties
- Error handling
- Default fallbacks

### BrandedButton Tests (`__tests__/BrandedButton.test.tsx`)
- All button variants and sizes
- Loading and disabled states
- Icon rendering
- Event handling
- Custom props

## Demo

The `BrandingDemo` component (`src/components/BrandingDemo.tsx`) provides a comprehensive demonstration of:
- Current branding settings display
- All button variants and sizes
- Branded text and elements
- Color swatches
- Interactive refresh functionality

## Integration with Backend

The frontend integrates with the backend tenant service:

### API Endpoints Used:
- `GET /api/tenant/settings` - Load tenant configuration
- `PUT /api/tenant/branding` - Update brand colors (Super Admin)
- `POST /api/tenant/logo` - Upload logo (Super Admin)
- `DELETE /api/tenant/logo` - Delete logo (Super Admin)

### Authentication:
- Uses JWT tokens from localStorage
- Automatically redirects to login on 401 errors
- Respects role-based permissions for admin functions

## Future Enhancements

Potential improvements for the branding system:
1. **Theme Presets**: Pre-defined color combinations
2. **Dark Mode**: Support for dark theme variants
3. **Font Customization**: Custom font family selection
4. **Advanced Logo Options**: Multiple logo variants (light/dark)
5. **CSS-in-JS**: Migration to styled-components for better TypeScript support
6. **Theme Editor**: Visual theme customization interface

## Troubleshooting

### Common Issues:

1. **Colors not applying**: Check if CSS custom properties are being set in browser dev tools
2. **Logo not displaying**: Verify CORS settings and image URL accessibility
3. **Loading indefinitely**: Check network tab for API errors
4. **Default colors showing**: Verify tenant API is returning branding data

### Debug Tools:

- Use the BrandingDemo component to inspect current theme state
- Check browser dev tools for CSS custom property values
- Monitor network requests to tenant API endpoints
- Use React DevTools to inspect BrandingContext state