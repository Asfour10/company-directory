import React, { useState, useEffect, useCallback } from 'react';
import { OrgChartAPI } from '../services/api';
import { OrgChartNode } from '../types/api';

interface OrgChartProps {
  onEmployeeClick?: (employee: OrgChartNode) => void;
  className?: string;
}

interface OrgChartState {
  orgChart: OrgChartNode[];
  loading: boolean;
  error: string | null;
  expandedNodes: Set<string>;
  selectedEmployee: string | null;
}

export const OrgChart: React.FC<OrgChartProps> = ({ onEmployeeClick, className = '' }) => {
  const [state, setState] = useState<OrgChartState>({
    orgChart: [],
    loading: true,
    error: null,
    expandedNodes: new Set(),
    selectedEmployee: null,
  });

  // Load organizational chart data
  const loadOrgChart = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      const response = await OrgChartAPI.getOrganizationalChart();
      
      // Auto-expand first level by default
      const firstLevelNodes = new Set<string>();
      response.data.orgChart.forEach(node => {
        firstLevelNodes.add(node.id);
        // Also expand nodes with children at level 0
        if (node.children.length > 0) {
          node.children.forEach(child => firstLevelNodes.add(child.id));
        }
      });

      setState(prev => ({
        ...prev,
        orgChart: response.data.orgChart,
        loading: false,
        expandedNodes: firstLevelNodes,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load organizational chart',
      }));
    }
  }, []);

  useEffect(() => {
    loadOrgChart();
  }, [loadOrgChart]);

  // Toggle node expansion
  const toggleNode = useCallback((nodeId: string) => {
    setState(prev => {
      const newExpanded = new Set(prev.expandedNodes);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return { ...prev, expandedNodes: newExpanded };
    });
  }, []);

  // Handle employee click
  const handleEmployeeClick = useCallback((employee: OrgChartNode, event: React.MouseEvent) => {
    event.stopPropagation();
    setState(prev => ({ ...prev, selectedEmployee: employee.id }));
    onEmployeeClick?.(employee);
  }, [onEmployeeClick]);

  // Handle touch events for mobile
  const handleTouchStart = useCallback((employee: OrgChartNode, event: React.TouchEvent) => {
    event.preventDefault();
    // Add haptic feedback if available
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    handleEmployeeClick(employee, event as any);
  }, [handleEmployeeClick]);

  // Handle swipe gestures for navigation
  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    // Allow natural scrolling but prevent unwanted interactions
    event.stopPropagation();
  }, []);

  // Handle long press for additional context
  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    event.preventDefault();
  }, []);

  // Render employee node
  const renderEmployeeNode = useCallback((node: OrgChartNode, isRoot = false) => {
    const isExpanded = state.expandedNodes.has(node.id);
    const hasChildren = node.children.length > 0;
    const isSelected = state.selectedEmployee === node.id;

    return (
      <div key={node.id} className="flex flex-col items-center">
        {/* Employee Card */}
        <div
          className={`
            relative bg-white rounded-lg shadow-md border-2 p-4 m-2 cursor-pointer
            transition-all duration-200 hover:shadow-lg hover:scale-105
            ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}
            ${isRoot ? 'border-purple-300 bg-purple-50' : ''}
            min-w-[180px] max-w-[220px] sm:min-w-[200px] sm:max-w-[250px]
            touch-manipulation select-none
          `}
          onClick={(e) => handleEmployeeClick(node, e)}
          onTouchStart={(e) => handleTouchStart(node, e)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleEmployeeClick(node, e as any);
            }
          }}
          aria-label={`View profile for ${node.firstName} ${node.lastName}, ${node.title || 'Employee'}`}
        >
          {/* Profile Photo */}
          {node.photoUrl && (
            <div className="flex justify-center mb-2">
              <img
                src={node.photoUrl}
                alt={`${node.firstName} ${node.lastName}`}
                className="w-12 h-12 rounded-full object-cover border-2 border-gray-300"
              />
            </div>
          )}

          {/* Employee Info */}
          <div className="text-center">
            <h3 className="font-semibold text-gray-900 text-xs sm:text-sm">
              {node.firstName} {node.lastName}
            </h3>
            {node.title && (
              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{node.title}</p>
            )}
            {node.department && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">{node.department}</p>
            )}
          </div>

          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              className={`
                absolute -bottom-3 left-1/2 transform -translate-x-1/2
                w-6 h-6 rounded-full bg-blue-500 text-white text-xs
                flex items-center justify-center hover:bg-blue-600
                transition-colors duration-200 touch-manipulation
                focus:outline-none focus:ring-2 focus:ring-blue-300
              `}
              onClick={(e) => {
                e.stopPropagation();
                toggleNode(node.id);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                if ('vibrate' in navigator) {
                  navigator.vibrate(30);
                }
              }}
              aria-label={isExpanded ? `Collapse ${node.firstName} ${node.lastName}'s reports` : `Expand ${node.firstName} ${node.lastName}'s reports`}
            >
              {isExpanded ? '−' : '+'}
            </button>
          )}

          {/* Reports Count Badge */}
          {hasChildren && (
            <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {node.children.length}
            </div>
          )}
        </div>

        {/* Connection Line */}
        {hasChildren && isExpanded && (
          <div className="w-px h-6 bg-gray-300"></div>
        )}

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="flex flex-col items-center">
            {/* Horizontal Line */}
            <div className="w-full h-px bg-gray-300 mb-4"></div>
            
            {/* Children Container */}
            <div className="flex flex-wrap justify-center gap-4">
              {node.children.map((child) => (
                <div key={child.id} className="flex flex-col items-center">
                  {/* Vertical Line to Child */}
                  <div className="w-px h-4 bg-gray-300"></div>
                  {renderEmployeeNode(child)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }, [state.expandedNodes, state.selectedEmployee, handleEmployeeClick, handleTouchStart, toggleNode]);

  // Loading state
  if (state.loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading organizational chart...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Chart</h3>
          <p className="text-gray-600 mb-4">{state.error}</p>
          <button
            onClick={loadOrgChart}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (state.orgChart.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 ${className}`}>
        <div className="text-center">
          <div className="text-gray-400 text-4xl mb-4">👥</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Organizational Data</h3>
          <p className="text-gray-600">No employees found to display in the organizational chart.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`org-chart-container ${className}`}>
      {/* Header */}
      <div className="mb-6 text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Organizational Chart</h2>
        <p className="text-sm sm:text-base text-gray-600">
          <span className="hidden sm:inline">Click on employees to view details • Touch and hold on mobile</span>
          <span className="sm:hidden">Tap employees to view details</span>
        </p>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto overflow-y-auto max-h-screen touch-pan-x touch-pan-y">
        <div className="min-w-max p-4">
          <div className="flex flex-wrap justify-center gap-8">
            {state.orgChart.map((rootNode) => renderEmployeeNode(rootNode, true))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex flex-wrap justify-center gap-2 sm:gap-4">
        <button
          onClick={() => setState(prev => ({ ...prev, expandedNodes: new Set() }))}
          className="px-3 py-2 sm:px-4 bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors text-sm touch-manipulation"
        >
          Collapse All
        </button>
        <button
          onClick={() => {
            const allNodes = new Set<string>();
            const collectNodes = (nodes: OrgChartNode[]) => {
              nodes.forEach(node => {
                allNodes.add(node.id);
                collectNodes(node.children);
              });
            };
            collectNodes(state.orgChart);
            setState(prev => ({ ...prev, expandedNodes: allNodes }));
          }}
          className="px-3 py-2 sm:px-4 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm touch-manipulation"
        >
          Expand All
        </button>
        <button
          onClick={loadOrgChart}
          className="px-3 py-2 sm:px-4 bg-green-500 text-white rounded hover:bg-green-600 transition-colors text-sm touch-manipulation"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};