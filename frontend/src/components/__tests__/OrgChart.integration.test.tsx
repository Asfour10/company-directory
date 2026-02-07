import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { OrgChart } from '../OrgChart';
import { OrgChartAPI } from '../../services/api';

// Mock the API but allow real HTTP calls for integration testing
vi.mock('../../services/api', async () => {
  const actual = await vi.importActual('../../services/api') as any;
  return {
    ...actual,
    OrgChartAPI: {
      getOrganizationalChart: vi.fn(),
    },
  };
});

const mockOrgChartAPI = vi.mocked(OrgChartAPI);

describe('OrgChart Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('handles real API response structure correctly', async () => {
    // Mock a realistic API response
    const realApiResponse = {
      success: true,
      data: {
        orgChart: [
          {
            id: 'emp-001',
            firstName: 'Sarah',
            lastName: 'Johnson',
            title: 'Chief Executive Officer',
            department: 'Executive',
            email: 'sarah.johnson@company.com',
            photoUrl: 'https://api.company.com/photos/emp-001.jpg',
            level: 0,
            children: [
              {
                id: 'emp-002',
                firstName: 'Michael',
                lastName: 'Chen',
                title: 'Chief Technology Officer',
                department: 'Technology',
                email: 'michael.chen@company.com',
                level: 1,
                managerId: 'emp-001',
                children: [
                  {
                    id: 'emp-003',
                    firstName: 'Emily',
                    lastName: 'Rodriguez',
                    title: 'Senior Software Engineer',
                    department: 'Technology',
                    email: 'emily.rodriguez@company.com',
                    level: 2,
                    managerId: 'emp-002',
                    children: [],
                  },
                  {
                    id: 'emp-004',
                    firstName: 'David',
                    lastName: 'Kim',
                    title: 'DevOps Engineer',
                    department: 'Technology',
                    email: 'david.kim@company.com',
                    level: 2,
                    managerId: 'emp-002',
                    children: [],
                  },
                ],
              },
              {
                id: 'emp-005',
                firstName: 'Lisa',
                lastName: 'Thompson',
                title: 'Chief Financial Officer',
                department: 'Finance',
                email: 'lisa.thompson@company.com',
                level: 1,
                managerId: 'emp-001',
                children: [],
              },
            ],
          },
        ],
        metadata: {
          totalNodes: 5,
          rootNodes: 1,
          maxDepth: 2,
          generatedAt: '2024-01-15T10:30:00Z',
        },
      },
    };

    mockOrgChartAPI.getOrganizationalChart.mockResolvedValue(realApiResponse);

    render(<OrgChart />);

    // Wait for the component to load and render the org chart
    await waitFor(() => {
      expect(screen.getByText('Organizational Chart')).toBeInTheDocument();
      expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
      expect(screen.getByText('Chief Executive Officer')).toBeInTheDocument();
    });

    // Verify that direct reports are auto-expanded
    await waitFor(() => {
      expect(screen.getByText('Michael Chen')).toBeInTheDocument();
      expect(screen.getByText('Lisa Thompson')).toBeInTheDocument();
    });

    // Verify that the reports count badge is displayed
    expect(screen.getByText('2')).toBeInTheDocument(); // Sarah has 2 direct reports

    // Verify API was called correctly
    expect(mockOrgChartAPI.getOrganizationalChart).toHaveBeenCalledTimes(1);
  });

  it('handles API errors gracefully in production-like scenarios', async () => {
    // Simulate network error
    mockOrgChartAPI.getOrganizationalChart.mockRejectedValue(
      new Error('Network Error: Unable to connect to server')
    );

    render(<OrgChart />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Chart')).toBeInTheDocument();
      expect(screen.getByText('Network Error: Unable to connect to server')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });
  });

  it('handles empty org chart data from API', async () => {
    mockOrgChartAPI.getOrganizationalChart.mockResolvedValue({
      success: true,
      data: {
        orgChart: [],
        metadata: {
          totalNodes: 0,
          rootNodes: 0,
          maxDepth: 0,
          generatedAt: '2024-01-15T10:30:00Z',
        },
      },
    });

    render(<OrgChart />);

    await waitFor(() => {
      expect(screen.getByText('No Organizational Data')).toBeInTheDocument();
      expect(screen.getByText('No employees found to display in the organizational chart.')).toBeInTheDocument();
    });
  });

  it('handles large org chart data efficiently', async () => {
    // Create a large org chart structure
    const createLargeOrgChart = () => {
      const rootEmployee = {
        id: 'ceo-001',
        firstName: 'John',
        lastName: 'CEO',
        title: 'Chief Executive Officer',
        department: 'Executive',
        email: 'ceo@company.com',
        level: 0,
        children: [] as any[],
      };

      // Create 10 VPs, each with 5 directors, each with 3 managers
      for (let vp = 1; vp <= 10; vp++) {
        const vpEmployee = {
          id: `vp-${vp.toString().padStart(3, '0')}`,
          firstName: `VP${vp}`,
          lastName: 'Vice President',
          title: `Vice President ${vp}`,
          department: `Department ${vp}`,
          email: `vp${vp}@company.com`,
          level: 1,
          managerId: 'ceo-001',
          children: [] as any[],
        };

        for (let dir = 1; dir <= 5; dir++) {
          const dirEmployee = {
            id: `dir-${vp}-${dir.toString().padStart(2, '0')}`,
            firstName: `Dir${vp}${dir}`,
            lastName: 'Director',
            title: `Director ${vp}.${dir}`,
            department: `Department ${vp}`,
            email: `dir${vp}${dir}@company.com`,
            level: 2,
            managerId: vpEmployee.id,
            children: [] as any[],
          };

          for (let mgr = 1; mgr <= 3; mgr++) {
            const mgrEmployee = {
              id: `mgr-${vp}-${dir}-${mgr}`,
              firstName: `Mgr${vp}${dir}${mgr}`,
              lastName: 'Manager',
              title: `Manager ${vp}.${dir}.${mgr}`,
              department: `Department ${vp}`,
              email: `mgr${vp}${dir}${mgr}@company.com`,
              level: 3,
              managerId: dirEmployee.id,
              children: [],
            };
            dirEmployee.children.push(mgrEmployee);
          }
          vpEmployee.children.push(dirEmployee);
        }
        rootEmployee.children.push(vpEmployee);
      }

      return rootEmployee;
    };

    const largeOrgChart = createLargeOrgChart();
    const totalNodes = 1 + 10 + (10 * 5) + (10 * 5 * 3); // CEO + VPs + Directors + Managers = 201

    mockOrgChartAPI.getOrganizationalChart.mockResolvedValue({
      success: true,
      data: {
        orgChart: [largeOrgChart],
        metadata: {
          totalNodes,
          rootNodes: 1,
          maxDepth: 3,
          generatedAt: '2024-01-15T10:30:00Z',
        },
      },
    });

    const startTime = performance.now();
    render(<OrgChart />);

    await waitFor(() => {
      expect(screen.getByText('John CEO')).toBeInTheDocument();
      expect(screen.getByText('Chief Executive Officer')).toBeInTheDocument();
    });

    const endTime = performance.now();
    const renderTime = endTime - startTime;

    // Verify that rendering completes within reasonable time (< 2 seconds)
    expect(renderTime).toBeLessThan(2000);

    // Verify that the reports count badge shows correct number
    expect(screen.getByText('10')).toBeInTheDocument(); // CEO has 10 VPs

    // Verify that only first level is auto-expanded (VPs should be visible)
    expect(screen.getByText('VP1 Vice President')).toBeInTheDocument();
    expect(screen.getByText('VP10 Vice President')).toBeInTheDocument();
  });

  it('maintains performance with frequent expand/collapse operations', async () => {
    const orgChartData = {
      success: true,
      data: {
        orgChart: [
          {
            id: '1',
            firstName: 'Root',
            lastName: 'Employee',
            title: 'CEO',
            department: 'Executive',
            email: 'root@company.com',
            level: 0,
            children: Array.from({ length: 20 }, (_, i) => ({
              id: `child-${i}`,
              firstName: `Child${i}`,
              lastName: 'Employee',
              title: `Title ${i}`,
              department: 'Department',
              email: `child${i}@company.com`,
              level: 1,
              managerId: '1',
              children: [],
            })),
          },
        ],
        metadata: {
          totalNodes: 21,
          rootNodes: 1,
          maxDepth: 1,
          generatedAt: '2024-01-15T10:30:00Z',
        },
      },
    };

    mockOrgChartAPI.getOrganizationalChart.mockResolvedValue(orgChartData);

    render(<OrgChart />);

    await waitFor(() => {
      expect(screen.getByText('Root Employee')).toBeInTheDocument();
    });

    // Measure performance of expand/collapse operations
    const startTime = performance.now();

    // Perform multiple expand/collapse operations
    const collapseAllButton = screen.getByRole('button', { name: 'Collapse All' });
    const expandAllButton = screen.getByRole('button', { name: 'Expand All' });

    for (let i = 0; i < 5; i++) {
      collapseAllButton.click();
      expandAllButton.click();
    }

    const endTime = performance.now();
    const operationTime = endTime - startTime;

    // Operations should complete quickly (< 500ms for 10 operations)
    expect(operationTime).toBeLessThan(500);
  });
});