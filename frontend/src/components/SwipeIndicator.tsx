import React, { useState, useEffect, useCallback } from 'react';
import { useTouchGestures } from '../hooks/useTouchGestures';

interface SwipeIndicatorProps {
  direction?: 'horizontal' | 'vertical' | 'both';
  className?: string;
  autoHide?: boolean;
  hideDelay?: number;
  onSwipe?: (direction: 'left' | 'right' | 'up' | 'down') => void;
  showOnFirstVisit?: boolean;
  persistKey?: string;
}

export const SwipeIndicator: React.FC<SwipeIndicatorProps> = ({
  direction = 'horizontal',
  className = '',
  autoHide = true,
  hideDelay = 3000,
  onSwipe,
  showOnFirstVisit = true,
  persistKey = 'swipe-indicator-seen'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Check if user has seen this indicator before
  useEffect(() => {
    if (showOnFirstVisit) {
      const hasSeenBefore = localStorage.getItem(persistKey) === 'true';
      setIsVisible(!hasSeenBefore);
    } else {
      setIsVisible(true);
    }
  }, [showOnFirstVisit, persistKey]);

  // Auto-hide after delay
  useEffect(() => {
    if (autoHide && isVisible && !hasInteracted) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (showOnFirstVisit) {
          localStorage.setItem(persistKey, 'true');
        }
      }, hideDelay);

      return () => clearTimeout(timer);
    }
  }, [autoHide, hideDelay, isVisible, hasInteracted, showOnFirstVisit, persistKey]);

  // Handle swipe gestures
  const handleSwipe = useCallback((swipeDirection: 'left' | 'right' | 'up' | 'down') => {
    setHasInteracted(true);
    setIsVisible(false);
    
    if (showOnFirstVisit) {
      localStorage.setItem(persistKey, 'true');
    }
    
    if (onSwipe) {
      onSwipe(swipeDirection);
    }
  }, [onSwipe, showOnFirstVisit, persistKey]);

  const { elementRef } = useTouchGestures({
    onSwipeLeft: () => handleSwipe('left'),
    onSwipeRight: () => handleSwipe('right'),
    onSwipeUp: () => handleSwipe('up'),
    onSwipeDown: () => handleSwipe('down'),
    onTap: () => {
      setHasInteracted(true);
      setIsVisible(false);
      if (showOnFirstVisit) {
        localStorage.setItem(persistKey, 'true');
      }
    }
  });

  if (!isVisible) return null;

  const renderHorizontalIndicator = () => (
    <>
      <svg className="w-4 h-4 animate-bounce-x" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      <span className="text-responsive-xs font-medium">Swipe to navigate</span>
      <svg className="w-4 h-4 animate-bounce-x-reverse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </>
  );

  const renderVerticalIndicator = () => (
    <>
      <svg className="w-4 h-4 animate-bounce-y" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
      <span className="text-responsive-xs font-medium">Swipe up/down</span>
      <svg className="w-4 h-4 animate-bounce-y-reverse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </>
  );

  const renderBothIndicator = () => (
    <>
      <div className="flex items-center space-x-1">
        <svg className="w-3 h-3 animate-bounce-x" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <svg className="w-3 h-3 animate-bounce-x-reverse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <span className="text-responsive-xs font-medium">Swipe to navigate</span>
      <div className="flex flex-col space-y-1">
        <svg className="w-3 h-3 animate-bounce-y" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        <svg className="w-3 h-3 animate-bounce-y-reverse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </>
  );

  return (
    <div
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className={`
        fixed bottom-safe left-1/2 transform -translate-x-1/2 z-50
        bg-black bg-opacity-80 text-white px-4 py-3 rounded-full
        flex items-center justify-center space-x-3
        backdrop-blur-sm border border-white border-opacity-20
        shadow-lg lg:hidden touch-manipulation
        transition-all duration-300 ease-in-out
        ${hasInteracted ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}
        ${className}
      `}
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 1rem)'
      }}
    >
      {direction === 'horizontal' && renderHorizontalIndicator()}
      {direction === 'vertical' && renderVerticalIndicator()}
      {direction === 'both' && renderBothIndicator()}
      
      {/* Tap to dismiss hint */}
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2">
        <span className="text-xs text-white text-opacity-60">Tap to dismiss</span>
      </div>
    </div>
  );
};

export default SwipeIndicator;