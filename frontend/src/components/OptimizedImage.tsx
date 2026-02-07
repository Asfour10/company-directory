import React, { useState, useCallback, useMemo } from 'react';
import { useLazyImage, usePerformance } from '../hooks/usePerformance';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  loading?: 'lazy' | 'eager';
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
  quality?: 'low' | 'medium' | 'high';
  placeholder?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  fallback,
  loading = 'lazy',
  sizes,
  onLoad,
  onError,
  quality = 'medium',
  placeholder
}) => {
  const [hasError, setHasError] = useState(false);
  const { isMobileDevice } = usePerformance();

  // Use lazy loading hook for better performance
  const { imageSrc, isLoaded, isError, imgRef } = useLazyImage(
    src,
    placeholder || generatePlaceholder()
  );

  // Generate optimized image URLs based on device and quality settings
  const optimizedSrc = useMemo(() => {
    if (!src) return src;

    // For mobile devices, we might want to serve smaller images
    if (isMobileDevice && quality !== 'high') {
      // This would typically integrate with an image CDN like Cloudinary or ImageKit
      // For now, we'll just use the original src
      return src;
    }

    return src;
  }, [src, isMobileDevice, quality]);

  // Generate responsive sizes attribute
  const responsiveSizes = useMemo(() => {
    if (sizes) return sizes;
    
    // Default responsive sizes for common use cases
    if (className.includes('rounded-full')) {
      // Profile photos
      return '(max-width: 640px) 40px, (max-width: 768px) 48px, 64px';
    }
    
    // General images
    return '(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw';
  }, [sizes, className]);

  const handleLoad = useCallback(() => {
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setHasError(true);
    onError?.();
  }, [onError]);

  // Generate a simple placeholder
  function generatePlaceholder(): string {
    // Create a simple 1x1 transparent pixel as placeholder
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB2aWV3Qm94PSIwIDAgMSAxIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNGM0Y0RjYiLz48L3N2Zz4=';
  }

  // Show fallback if there's an error and fallback is provided
  if ((hasError || isError) && fallback) {
    return <>{fallback}</>;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Loading placeholder */}
      {!isLoaded && !isError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse rounded-inherit" />
      )}
      
      {/* Main image */}
      <img
        ref={imgRef}
        src={loading === 'eager' ? optimizedSrc : imageSrc}
        alt={alt}
        className={`${className} ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-300`}
        loading={loading}
        sizes={responsiveSizes}
        onLoad={handleLoad}
        onError={handleError}
        decoding="async"
        // Add performance hints
        fetchPriority={loading === 'eager' ? 'high' : 'low'}
        // Improve mobile performance
        style={{
          contentVisibility: 'auto',
          containIntrinsicSize: '1px 1px'
        }}
      />
      
      {/* Error state */}
      {(hasError || isError) && !fallback && (
        <div className={`${className} bg-gray-100 flex items-center justify-center`}>
          <svg 
            className="w-6 h-6 text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
        </div>
      )}
    </div>
  );
};

export default OptimizedImage;