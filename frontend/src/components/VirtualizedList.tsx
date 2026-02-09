import React, { useState, useEffect, useRef } from 'react';
import { useIntersectionObserver, usePerformance } from '../hooks/usePerformance';

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  containerHeight?: number;
  overscan?: number;
  className?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  estimateItemHeight?: (item: T, index: number) => number;
}

export function VirtualizedList<T>({
  items,
  renderItem,
  itemHeight = 100,
  containerHeight = 600,
  overscan = 5,
  className = '',
  onLoadMore,
  hasMore = false,
  loading = false,
  estimateItemHeight
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { elementRef: loadMoreRef, observe } = useIntersectionObserver();
  const { isMobileDevice, useMemoizedCallback, useMemoizedValue } = usePerformance();

  // Adjust overscan and chunk size for mobile devices
  const optimizedOverscan = useMemoizedValue(() => {
    return isMobileDevice ? Math.max(2, overscan - 2) : overscan;
  }, [isMobileDevice, overscan]);

  // Calculate item heights if dynamic sizing is enabled
  const itemHeights = useMemoizedValue(() => {
    if (!estimateItemHeight) return null;
    
    return items.map((item, index) => estimateItemHeight(item, index));
  }, [items, estimateItemHeight]);

  // Calculate positions for dynamic heights
  const itemPositions = useMemoizedValue(() => {
    if (!itemHeights) return null;

    const positions = [0];
    for (let i = 0; i < itemHeights.length; i++) {
      positions.push(positions[i] + itemHeights[i]);
    }
    return positions;
  }, [itemHeights]);

  // Calculate visible range with optimizations for mobile
  const visibleRange = useMemoizedValue(() => {
    let startIndex: number;
    let endIndex: number;

    if (itemPositions) {
      // Dynamic height calculation
      startIndex = Math.max(0, 
        itemPositions.findIndex(pos => pos >= scrollTop) - optimizedOverscan
      );
      endIndex = Math.min(
        items.length - 1,
        itemPositions.findIndex(pos => pos >= scrollTop + containerHeight) + optimizedOverscan
      );
    } else {
      // Fixed height calculation
      startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - optimizedOverscan);
      endIndex = Math.min(
        items.length - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + optimizedOverscan
      );
    }

    return { startIndex, endIndex };
  }, [scrollTop, containerHeight, itemHeight, optimizedOverscan, itemPositions, items.length]);

  const visibleItems = useMemoizedValue(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
  }, [items, visibleRange]);

  const totalHeight = useMemoizedValue(() => {
    if (itemPositions) {
      return itemPositions[itemPositions.length - 1];
    }
    return items.length * itemHeight;
  }, [items.length, itemHeight, itemPositions]);

  const offsetY = useMemoizedValue(() => {
    if (itemPositions) {
      return itemPositions[visibleRange.startIndex] || 0;
    }
    return visibleRange.startIndex * itemHeight;
  }, [visibleRange.startIndex, itemHeight, itemPositions]);

  // Throttled scroll handler for better mobile performance
  const handleScroll = useMemoizedCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    
    // Use requestAnimationFrame for smoother scrolling on mobile
    requestAnimationFrame(() => {
      setScrollTop(newScrollTop);
    });
  }, []);

  // Optimized load more with intersection observer
  useEffect(() => {
    if (onLoadMore && hasMore && !loading) {
      const cleanup = observe((entry) => {
        if (entry.isIntersecting) {
          // Debounce load more calls
          setTimeout(() => {
            onLoadMore();
          }, 100);
        }
      });
      return cleanup;
    }
  }, [observe, onLoadMore, hasMore, loading]);

  // Render visible items with performance optimizations
  const renderedItems = useMemoizedValue(() => {
    return visibleItems.map((item, index) => {
      const actualIndex = visibleRange.startIndex + index;
      return (
        <div
          key={actualIndex}
          style={{
            height: itemHeights ? itemHeights[actualIndex] : itemHeight,
            // Use transform3d for hardware acceleration on mobile
            transform: itemPositions 
              ? `translate3d(0, ${itemPositions[actualIndex] - offsetY}px, 0)`
              : `translate3d(0, ${index * itemHeight}px, 0)`,
            position: itemPositions ? 'absolute' : 'relative',
            width: '100%'
          }}
        >
          {renderItem(item, actualIndex)}
        </div>
      );
    });
  }, [visibleItems, visibleRange.startIndex, itemHeight, itemHeights, itemPositions, offsetY, renderItem]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto scroll-smooth-mobile ${className}`}
      style={{ 
        height: containerHeight,
        // Optimize scrolling performance on mobile
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain'
      }}
      onScroll={handleScroll}
    >
      <div 
        style={{ 
          height: totalHeight, 
          position: 'relative',
          // Use will-change for better mobile performance
          willChange: 'transform'
        }}
      >
        <div
          style={{
            transform: `translate3d(0, ${offsetY}px, 0)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            willChange: 'transform'
          }}
        >
          {renderedItems}
        </div>
        
        {/* Load more trigger */}
        {hasMore && (
          <div
            ref={loadMoreRef as React.RefObject<HTMLDivElement>}
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 1,
            }}
          />
        )}
        
        {/* Loading indicator */}
        {loading && (
          <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
            <div className="inline-flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-responsive-xs text-gray-500">Loading more...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VirtualizedList;