import { useRef, useCallback, useEffect } from 'react';

interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: (event?: TouchEvent) => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onPinchStart?: (scale: number) => void;
  onPinchMove?: (scale: number) => void;
  onPinchEnd?: (scale: number) => void;
  swipeThreshold?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
  pinchThreshold?: number;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

interface PinchData {
  initialDistance: number;
  currentScale: number;
}

export const useTouchGestures = (options: TouchGestureOptions = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    onLongPress,
    onPinchStart,
    onPinchMove,
    onPinchEnd,
    swipeThreshold = 50,
    longPressDelay = 500,
    doubleTapDelay = 300
  } = options;

  const touchStartRef = useRef<TouchPoint | null>(null);
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout>();
  const pinchDataRef = useRef<PinchData | null>(null);
  const elementRef = useRef<HTMLElement>(null);

  // Calculate distance between two touch points
  const getDistance = useCallback((touches: TouchList) => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();
    
    if (e.touches.length === 1) {
      // Single touch
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: now
      };

      // Start long press timer
      if (onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          onLongPress();
        }, longPressDelay);
      }
    } else if (e.touches.length === 2) {
      // Multi-touch (pinch)
      const distance = getDistance(e.touches);
      pinchDataRef.current = {
        initialDistance: distance,
        currentScale: 1
      };
      
      if (onPinchStart) {
        onPinchStart(1);
      }
      
      // Cancel long press on multi-touch
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = undefined;
      }
    }
  }, [onLongPress, onPinchStart, longPressDelay, getDistance]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    // Cancel long press on move
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }

    if (e.touches.length === 2 && pinchDataRef.current) {
      // Handle pinch gesture
      const currentDistance = getDistance(e.touches);
      const scale = currentDistance / pinchDataRef.current.initialDistance;
      
      if (Math.abs(scale - pinchDataRef.current.currentScale) > 0.1) {
        pinchDataRef.current.currentScale = scale;
        if (onPinchMove) {
          onPinchMove(scale);
        }
      }
    }
  }, [onPinchMove, getDistance]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    // Cancel long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }

    if (e.touches.length === 0 && pinchDataRef.current) {
      // End pinch gesture
      if (onPinchEnd) {
        onPinchEnd(pinchDataRef.current.currentScale);
      }
      pinchDataRef.current = null;
      return;
    }

    if (!touchStartRef.current || e.touches.length > 0) return;

    const touch = e.changedTouches[0];
    const touchEnd = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };

    const deltaX = touchEnd.x - touchStartRef.current.x;
    const deltaY = touchEnd.y - touchStartRef.current.y;
    const deltaTime = touchEnd.time - touchStartRef.current.time;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Check for tap (short duration, small distance)
    if (deltaTime < 300 && distance < 10) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;
      
      if (timeSinceLastTap < doubleTapDelay && onDoubleTap) {
        // Double tap
        onDoubleTap();
        lastTapRef.current = 0; // Reset to prevent triple tap
      } else {
        // Single tap
        if (onTap) {
          onTap(e);
        }
        lastTapRef.current = now;
      }
      return;
    }

    // Check for swipe gestures
    if (distance > swipeThreshold) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      if (absX > absY) {
        // Horizontal swipe
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    }

    touchStartRef.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onTap, onDoubleTap, onPinchEnd, swipeThreshold, doubleTapDelay]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Add touch event listeners with passive: false for preventDefault support
    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
      
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { elementRef };
};

/**
 * Hook for handling pinch-to-zoom gestures with enhanced features
 */
export const usePinchZoom = (options: {
  onZoom?: (scale: number) => void;
  onZoomStart?: () => void;
  onZoomEnd?: () => void;
  minScale?: number;
  maxScale?: number;
  step?: number;
} = {}) => {
  const { 
    onZoom, 
    onZoomStart, 
    onZoomEnd, 
    minScale = 0.5, 
    maxScale = 3,
    step = 0.1
  } = options;
  
  const elementRef = useRef<HTMLElement>(null);
  const initialDistanceRef = useRef<number>(0);
  const currentScaleRef = useRef<number>(1);
  const isZoomingRef = useRef<boolean>(false);

  const getDistance = useCallback((touches: TouchList) => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      initialDistanceRef.current = getDistance(e.touches);
      isZoomingRef.current = true;
      if (onZoomStart) {
        onZoomStart();
      }
    }
  }, [getDistance, onZoomStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && initialDistanceRef.current > 0 && isZoomingRef.current) {
      e.preventDefault();
      
      const currentDistance = getDistance(e.touches);
      const rawScale = currentDistance / initialDistanceRef.current;
      
      // Apply step-based scaling for smoother experience
      const steppedScale = Math.round(rawScale / step) * step;
      const clampedScale = Math.max(minScale, Math.min(maxScale, steppedScale));
      
      if (Math.abs(clampedScale - currentScaleRef.current) >= step) {
        currentScaleRef.current = clampedScale;
        if (onZoom) {
          onZoom(clampedScale);
        }
      }
    }
  }, [getDistance, onZoom, minScale, maxScale, step]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length < 2 && isZoomingRef.current) {
      isZoomingRef.current = false;
      initialDistanceRef.current = 0;
      if (onZoomEnd) {
        onZoomEnd();
      }
    }
  }, [onZoomEnd]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { 
    elementRef, 
    currentScale: currentScaleRef.current,
    isZooming: isZoomingRef.current
  };
};

/**
 * Hook for handling swipe navigation with momentum and boundaries
 */
export const useSwipeNavigation = (options: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  velocityThreshold?: number;
  preventScroll?: boolean;
} = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    threshold = 50,
    velocityThreshold = 0.3,
    preventScroll = false
  } = options;

  const elementRef = useRef<HTMLElement>(null);
  const startXRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const isSwipingRef = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    startTimeRef.current = Date.now();
    isSwipingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (preventScroll && isSwipingRef.current) {
      e.preventDefault();
    }

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - startXRef.current);
    
    if (deltaX > 10) {
      isSwipingRef.current = true;
    }
  }, [preventScroll]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!isSwipingRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaTime = Date.now() - startTimeRef.current;
    const velocity = Math.abs(deltaX) / deltaTime;

    if (Math.abs(deltaX) > threshold || velocity > velocityThreshold) {
      if (deltaX > 0 && onSwipeRight) {
        onSwipeRight();
      } else if (deltaX < 0 && onSwipeLeft) {
        onSwipeLeft();
      }
    }

    isSwipingRef.current = false;
  }, [onSwipeLeft, onSwipeRight, threshold, velocityThreshold]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return { elementRef, isSwiping: isSwipingRef.current };
};

export default useTouchGestures;