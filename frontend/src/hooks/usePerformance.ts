import { useCallback, useMemo, useRef, useState, useEffect } from 'react';

/**
 * Hook for performance optimizations including memoization and debouncing
 */
export const usePerformance = () => {
  // Memoized callback that persists across renders
  const useMemoizedCallback = useCallback(<T extends (...args: any[]) => any>(
    callback: T,
    deps: React.DependencyList
  ): T => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useCallback(callback, deps);
  }, []);

  // Memoized value that only recalculates when dependencies change
  const useMemoizedValue = useCallback(<T>(
    factory: () => T,
    deps: React.DependencyList
  ): T => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(factory, deps);
  }, []);

  // Debounced function that delays execution
  const useDebounced = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): T => {
    const timeoutRef = useRef<NodeJS.Timeout>();

    return useCallback((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        func(...args);
      }, delay);
    }, [func, delay]) as T;
  }, []);

  // Throttled function that limits execution frequency
  const useThrottled = useCallback(<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): T => {
    const inThrottle = useRef(false);

    return useCallback((...args: Parameters<T>) => {
      if (!inThrottle.current) {
        func(...args);
        inThrottle.current = true;
        setTimeout(() => {
          inThrottle.current = false;
        }, limit);
      }
    }, [func, limit]) as T;
  }, []);

  // Check if device is likely mobile based on screen size and touch capability
  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    return isTouchDevice && (isSmallScreen || isMobileUserAgent);
  }, []);

  // Get optimal chunk size for virtualization based on device performance
  const getOptimalChunkSize = useCallback(() => {
    if (typeof window === 'undefined') return 20;

    // Estimate device performance
    const isLowEndDevice = isMobileDevice && (
      // @ts-ignore - deviceMemory is experimental
      (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
      // @ts-ignore - hardwareConcurrency fallback
      (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2)
    );

    if (isLowEndDevice) return 10; // Smaller chunks for low-end devices
    if (isMobileDevice) return 15; // Medium chunks for mobile
    return 20; // Larger chunks for desktop
  }, [isMobileDevice]);

  // Preload critical resources
  const preloadResource = useCallback((url: string, type: 'image' | 'script' | 'style' = 'image') => {
    if (typeof document === 'undefined') return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    
    switch (type) {
      case 'image':
        link.as = 'image';
        break;
      case 'script':
        link.as = 'script';
        break;
      case 'style':
        link.as = 'style';
        break;
    }

    document.head.appendChild(link);
  }, []);

  return {
    useMemoizedCallback,
    useMemoizedValue,
    useDebounced,
    useThrottled,
    isMobileDevice,
    getOptimalChunkSize,
    preloadResource
  };
};

/**
 * Hook for intersection observer to implement lazy loading
 */
export const useIntersectionObserver = (
  options: IntersectionObserverInit = {}
) => {
  const elementRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver>();

  const observe = useCallback((callback: (entry: IntersectionObserverEntry) => void) => {
    if (elementRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach(callback);
        },
        {
          threshold: 0.1,
          rootMargin: '50px',
          ...options
        }
      );
      
      observerRef.current.observe(elementRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [options]);

  return { elementRef, observe };
};

/**
 * Hook for lazy loading images with intersection observer
 */
export const useLazyImage = (src: string, placeholder?: string) => {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (!imgRef.current || !src) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = new Image();
            img.onload = () => {
              setImageSrc(src);
              setIsLoaded(true);
              setIsError(false);
            };
            img.onerror = () => {
              setIsError(true);
              setIsLoaded(false);
            };
            img.src = src;
            observer.unobserve(entry.target);
          }
        });
      },
      { 
        threshold: 0.1,
        rootMargin: '50px' // Start loading 50px before the image comes into view
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [src]);

  return { imageSrc, isLoaded, isError, imgRef };
};

/**
 * Hook for measuring component performance
 */
export const usePerformanceMonitor = (componentName: string) => {
  const renderCount = useRef(0);
  const startTime = useRef(performance.now());

  useEffect(() => {
    renderCount.current += 1;
    const endTime = performance.now();
    const renderTime = endTime - startTime.current;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName} - Render #${renderCount.current} took ${renderTime.toFixed(2)}ms`);
    }
    
    startTime.current = performance.now();
  });

  return { renderCount: renderCount.current };
};

export default usePerformance;