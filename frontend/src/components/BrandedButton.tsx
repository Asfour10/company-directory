import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { useBrandedInlineStyles } from '../hooks/useBrandedStyles';

export interface BrandedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const BrandedButton = forwardRef<HTMLButtonElement, BrandedButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      style,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref
  ) => {
    const brandedStyles = useBrandedInlineStyles();
    const [isHovered, setIsHovered] = React.useState(false);

    // Size classes - made more touch-friendly
    const sizeClasses = {
      sm: 'px-3 py-2 text-sm min-h-[40px]', // Increased min height for better touch
      md: 'px-4 py-2.5 text-sm min-h-[44px]', // Standard touch target size
      lg: 'px-6 py-3 text-base min-h-[48px]', // Larger touch target
    };

    // Base classes - added touch-manipulation for better mobile performance
    const baseClasses = `
      inline-flex items-center justify-center font-medium rounded-md
      transition-all duration-200 ease-in-out
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
      touch-manipulation select-none
      ${sizeClasses[size]}
    `.trim();

    // Get variant styles
    const getVariantStyle = () => {
      const isDisabled = disabled || isLoading;
      
      switch (variant) {
        case 'primary':
          if (isDisabled) {
            return {
              backgroundColor: '#9CA3AF', // gray-400
              borderColor: '#9CA3AF',
              color: 'white',
            };
          }
          return isHovered ? brandedStyles.primaryButtonHover : brandedStyles.primaryButton;

        case 'secondary':
          if (isDisabled) {
            return {
              backgroundColor: '#F3F4F6', // gray-100
              borderColor: '#D1D5DB', // gray-300
              color: '#9CA3AF', // gray-400
            };
          }
          return isHovered ? brandedStyles.secondaryButtonHover : brandedStyles.secondaryButton;

        case 'outline':
          return {
            backgroundColor: 'transparent',
            borderColor: isDisabled ? '#D1D5DB' : (isHovered ? brandedStyles.primaryBorder.borderColor : brandedStyles.primaryBorder.borderColor),
            color: isDisabled ? '#9CA3AF' : (isHovered ? brandedStyles.primaryText.color : brandedStyles.primaryText.color),
            borderWidth: '1px',
            borderStyle: 'solid',
          };

        case 'ghost':
          return {
            backgroundColor: isHovered && !isDisabled ? `${brandedStyles.primaryBg.backgroundColor}10` : 'transparent',
            color: isDisabled ? '#9CA3AF' : brandedStyles.primaryText.color,
          };

        default:
          return brandedStyles.primaryButton;
      }
    };

    const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsHovered(true);
      onMouseEnter?.(e);
    };

    const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
      setIsHovered(false);
      onMouseLeave?.(e);
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${className}`}
        style={{
          ...getVariantStyle(),
          ...style,
        }}
        disabled={disabled || isLoading}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* Left Icon */}
        {leftIcon && !isLoading && (
          <span className="mr-2 flex-shrink-0">
            {leftIcon}
          </span>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <span className="mr-2 flex-shrink-0">
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </span>
        )}

        {/* Button Text */}
        <span>{children}</span>

        {/* Right Icon */}
        {rightIcon && !isLoading && (
          <span className="ml-2 flex-shrink-0">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

BrandedButton.displayName = 'BrandedButton';

export default BrandedButton;