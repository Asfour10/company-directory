import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OrgChart } from '../OrgChart';
import { OrgChartAPI } from '../../services/api';
import { OrgChartNode, OrgChartResponse } from '../../types/api';

// Mock the API
vi.mock('../../services/api', () => ({
  OrgChartAPI: {
    getOrganizationalChart: vi.fn(),
  },
}));

const mockOrgChartAPI = vi.mocked(OrgChartAPI);

describe('OrgChart Component', () => {
  const mockOrgChartData: OrgChartNode[] = [
    {
      id: '1',
      firstName: 'John',
      lastName: 'Doe',
      title: 'CEO',
      department: 'Executive',
      email: 'john.doe@company.com',
      photoUrl: 'https://example.com/john.jpg',
      level: 0,
      children: [
        {
          id: '2',
          firstName: 'Jane',
          lastName: 'Smith',
          title: 'CTO',
          department: 'Technology',
          email: 'jane.smith@company.com',
          level: 1,
          managerId: '1',
          children: [
            {
              id: '3',
              firstName: 'Bob',
              lastName: 'Johnson',
              title: 'Senior Developer',
              department: 'Technology',
              email: 'bob.johnson@company.com',
              level: 2,
              managerId: '2',
              children: [],
            },
          ],
        },
        {
          id: '4',
          firstName: 'Alice',
          lastName: 'Brown',
          title: 'CFO',
          department: 'Finance',
          email: 'alice.brown@company.com',
          level: 1,
          managerId: '1',
          children: [],
        },
      ],
    },
  ];

  const mockResponse: OrgChartResponse = {
    success: true,
    data: {
      orgChart: mockOrgChartData,
      metadata: {
        totalNodes: 4,
        rootNodes: 1,
        maxDepth: 2,
        generatedAt: '2024-01-01T00:00:00Z',
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockOrgChartAPI.getOrganizationalChart.mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading and Error States', () => {
    it('displays loading state initially', async () => {
      mockOrgChartAPI.getOrganizationalChart.mockImplementation(
        () => new Promise<OrgChartResponse>(() => {}) // Never resolves
      );

      render(<OrgChart />);

      expect(screen.getByText('Loading organizational chart...')).toBeInTheDocument();
      expect(screen.getByRole('status', { hidden: true })).toBeInTheDocument(); // Loading spinner
    });

    it('displays error state when API call fails', async () => {
      const errorMessage = 'Failed to load organizational chart';
      mockOrgChartAPI.getOrganizationalChart.mockRejectedValue(new Error(errorMessage));

      render(<OrgChart />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Chart')).toBeInTheDocument();
        expect(screen.getByText(errorMessage)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
      });
    });

    it('displays empty state when no org chart data is available', async () => {
      mockOrgChartAPI.getOrganizationalChart.mockResolvedValue({
        ...mockResponse,
        data: { ...mockResponse.data, orgChart: [] },
      });

      render(<OrgChart />);

      await waitFor(() => {
        expect(screen.getByText('No Organizational Data')).toBeInTheDocument();
        expect(screen.getByText('No employees found to display in the organizational chart.')).toBeInTheDocument();
      });
    });

    it('retries loading when Try Again button is clicked', async () => {
      mockOrgChartAPI.getOrganizationalChart
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockResponse);

      render(<OrgChart />);

      await waitFor(() => {
        expect(screen.getByText('Error Loading Chart')).toBeInTheDocument();
      });

      const tryAgainButton = screen.getByRole('button', { name: 'Try Again' });
      fireEvent.click(tryAgainButton);

      await waitFor(() => {
        expect(screen.getByText('Organizational Chart')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      expect(mockOrgChartAPI.getOrganizationalChart).toHaveBeenCalledTimes(2);
    });
  });

  describe('Org Chart Display', () => {
    it('renders organizational chart with employee data', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        expect(screen.getByText('Organizational Chart')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('CEO')).toBeInTheDocument();
        expect(screen.getByText('Executive')).toBeInTheDocument();
      });
    });

    it('displays employee profile photos when available', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        const profileImage = screen.getByAltText('John Doe');
        expect(profileImage).toBeInTheDocument();
        expect(profileImage).toHaveAttribute('src', 'https://example.com/john.jpg');
      });
    });

    it('shows reports count badge for employees with children', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        // John Doe has 2 direct reports
        const badge = screen.getByText('2');
        expect(badge).toBeInTheDocument();
      });
    });

    it('auto-expands first level nodes by default', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });
    });
  });

  describe('Expand/Collapse Functionality', () => {
    it('expands and collapses nodes when expand button is clicked', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
      });

      // Find Jane Smith's expand button and click it to expand her reports
      const janeExpandButton = screen.getAllByLabelText(/Expand.*Jane Smith/)[0];
      fireEvent.click(janeExpandButton);

      await waitFor(() => {
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });

      // Click again to collapse
      const janeCollapseButton = screen.getByLabelText(/Collapse.*Jane Smith/);
      fireEvent.click(janeCollapseButton);

      await waitFor(() => {
        expect(screen.queryByText('Bob Johnson')).not.toBeInTheDocument();
      });
    });

    it('collapses all nodes when Collapse All button is clicked', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
      });

      const collapseAllButton = screen.getByRole('button', { name: 'Collapse All' });
      fireEvent.click(collapseAllButton);

      await waitFor(() => {
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
        expect(screen.queryByText('Alice Brown')).not.toBeInTheDocument();
      });
    });

    it('expands all nodes when Expand All button is clicked', async () => {
      render(<OrgChart />);

      // First collapse all
      await waitFor(() => {
        const collapseAllButton = screen.getByRole('button', { name: 'Collapse All' });
        fireEvent.click(collapseAllButton);
      });

      await waitFor(() => {
        expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
      });

      // Then expand all
      const expandAllButton = screen.getByRole('button', { name: 'Expand All' });
      fireEvent.click(expandAllButton);

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeInTheDocument();
        expect(screen.getByText('Alice Brown')).toBeInTheDocument();
        expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
      });
    });
  });

  describe('Employee Click Handling', () => {
    it('calls onEmployeeClick callback when employee is clicked', async () => {
      const mockOnEmployeeClick = vi.fn();
      render(<OrgChart onEmployeeClick={mockOnEmployeeClick} />);

      await waitFor(() => {
        const johnDoeCard = screen.getByText('John Doe').closest('[role="button"]');
        expect(johnDoeCard).toBeInTheDocument();
        fireEvent.click(johnDoeCard!);
      });

      expect(mockOnEmployeeClick).toHaveBeenCalledWith(mockOrgChartData[0]);
    });

    it('highlights selected employee', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        const johnDoeCard = screen.getByText('John Doe').closest('[role="button"]');
        fireEvent.click(johnDoeCard!);
      });

      await waitFor(() => {
        const johnDoeCard = screen.getByText('John Doe').closest('[role="button"]');
        expect(johnDoeCard).toHaveClass('border-blue-500', 'bg-blue-50');
      });
    });

    it('handles keyboard navigation with Enter key', async () => {
      const mockOnEmployeeClick = vi.fn();
      render(<OrgChart onEmployeeClick={mockOnEmployeeClick} />);

      await waitFor(() => {
        const johnDoeCard = screen.getByText('John Doe').closest('[role="button"]');
        expect(johnDoeCard).toBeInTheDocument();
        fireEvent.keyDown(johnDoeCard!, { key: 'Enter' });
      });

      expect(mockOnEmployeeClick).toHaveBeenCalledWith(mockOrgChartData[0]);
    });

    it('handles keyboard navigation with Space key', async () => {
      const mockOnEmployeeClick = vi.fn();
      render(<OrgChart onEmployeeClick={mockOnEmployeeClick} />);

      await waitFor(() => {
        const johnDoeCard = screen.getByText('John Doe').closest('[role="button"]');
        expect(johnDoeCard).toBeInTheDocument();
        fireEvent.keyDown(johnDoeCard!, { key: ' ' });
      });

      expect(mockOnEmployeeClick).toHaveBeenCalledWith(mockOrgChartData[0]);
    });
  });

  describe('Touch Gesture Support', () => {
    it('handles touch events for mobile interaction', async () => {
      const mockOnEmployeeClick = vi.fn();
      render(<OrgChart onEmployeeClick={mockOnEmployeeClick} />);

      await waitFor(() => {
        const johnDoeCard = screen.getByText('John Doe').closest('[role="button"]');
        expect(johnDoeCard).toBeInTheDocument();
        fireEvent.touchStart(johnDoeCard!);
      });

      expect(mockOnEmployeeClick).toHaveBeenCalledWith(mockOrgChartData[0]);
    });

    it('applies touch-friendly CSS classes', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        const johnDoeCard = screen.getByText('John Doe').closest('[role="button"]');
        expect(johnDoeCard).toHaveClass('touch-manipulation', 'select-none');
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('refreshes org chart data when Refresh button is clicked', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole('button', { name: 'Refresh' });
      fireEvent.click(refreshButton);

      expect(mockOrgChartAPI.getOrganizationalChart).toHaveBeenCalledTimes(2);
    });
  });

  describe('Responsive Design', () => {
    it('applies custom className prop', () => {
      const customClass = 'custom-org-chart';
      render(<OrgChart className={customClass} />);

      const container = document.querySelector(`.${customClass}`);
      expect(container).toBeInTheDocument();
    });

    it('renders with responsive layout classes', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        const container = document.querySelector('.org-chart-container');
        expect(container).toBeInTheDocument();
        
        const scrollableArea = document.querySelector('.overflow-x-auto');
        expect(scrollableArea).toBeInTheDocument();
      });
    });
  });

  describe('Visual Hierarchy', () => {
    it('displays connection lines between levels', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        // Look for vertical connection lines
        const connectionLines = document.querySelectorAll('.w-px.h-6.bg-gray-300');
        expect(connectionLines.length).toBeGreaterThan(0);
        
        // Look for horizontal connection lines
        const horizontalLines = document.querySelectorAll('.w-full.h-px.bg-gray-300');
        expect(horizontalLines.length).toBeGreaterThan(0);
      });
    });

    it('distinguishes root nodes with special styling', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        const johnDoeCard = screen.getByText('John Doe').closest('[role="button"]');
        expect(johnDoeCard).toHaveClass('border-purple-300', 'bg-purple-50');
      });
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels for employee cards', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        const johnDoeCard = screen.getByLabelText('View profile for John Doe, CEO');
        expect(johnDoeCard).toBeInTheDocument();
      });
    });

    it('provides proper ARIA labels for expand/collapse buttons', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        const expandButton = screen.getByLabelText(/Expand John Doe's reports/);
        expect(expandButton).toBeInTheDocument();
      });
    });

    it('supports keyboard navigation with proper focus management', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        const johnDoeCard = screen.getByText('John Doe').closest('[role="button"]');
        expect(johnDoeCard).toHaveAttribute('tabIndex', '0');
      });
    });

    it('provides focus indicators for interactive elements', async () => {
      render(<OrgChart />);

      await waitFor(() => {
        const expandButton = screen.getAllByRole('button').find(btn => 
          btn.getAttribute('aria-label')?.includes('Expand')
        );
        expect(expandButton).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-blue-300');
      });
    });
  });
});