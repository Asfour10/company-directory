import { EmployeeService, EmployeeServiceContext } from '../employee.service';
import { EmployeeRepository } from '../../repositories/employee.repository';

// Mock dependencies
jest.mock('../../repositories/employee.repository');
jest.mock('../audit.service');
jest.mock('../../validators/employee.validator');
jest.mock('../../lib/redis');

const mockEmployeeRepository = EmployeeRepository as jest.Mocked<typeof EmployeeRepository>;

describe('EmployeeService Property Tests', () => {
  const testContext: EmployeeServiceContext = {
    tenantId: 'tenant-123',
    userId: 'user-456',
    userRole: 'user',
    ipAddress: '192.168.1.1',
    userAgent: 'Test Agent',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock validation functions
    const { validateEmployeeFilters, validatePagination } = require('../../validators/employee.validator');
    validateEmployeeFilters.mockImplementation((filters: any) => filters);
    validatePagination.mockImplementation((pagination: any) => pagination);
  });

  /**
   * Feature: basic-employee-directory, Property 6: Complete Directory Listing
   * For any set of active employees in the system, the directory should display all employees with their name, title, department, and contact information visible
   * Validates: Requirements 2.1, 2.2
   */
  describe('Property 6: Complete Directory Listing', () => {
    it('should return all active employees with complete information', async () => {
      const testCases = [
        // Empty directory
        {
          employees: [],
          expectedCount: 0,
          description: 'empty directory'
        },
        // Single employee
        {
          employees: [
            {
              id: 'emp-1',
              tenantId: testContext.tenantId,
              userId: null,
              firstName: 'John',
              lastName: 'Doe',
              title: 'Software Engineer',
              department: 'Engineering',
              email: 'john.doe@example.com',
              phone: { value: '+1-555-0123', iv: 'test-iv' },
              personalEmail: null,
              extension: null,
              officeLocation: null,
              managerId: null,
              photoUrl: null,
              bio: null,
              skills: [],
              isActive: true,
              customFields: {},
              searchVector: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              manager: null,
              user: null
            }
          ],
          expectedCount: 1,
          description: 'single employee'
        },
        // Multiple employees with different departments
        {
          employees: [
            {
              id: 'emp-1',
              tenantId: testContext.tenantId,
              userId: null,
              firstName: 'John',
              lastName: 'Doe',
              title: 'Software Engineer',
              department: 'Engineering',
              email: 'john.doe@example.com',
              phone: { value: '+1-555-0123', iv: 'test-iv' },
              personalEmail: null,
              extension: null,
              officeLocation: null,
              managerId: null,
              photoUrl: null,
              bio: null,
              skills: [],
              isActive: true,
              customFields: {},
              searchVector: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              manager: null,
              user: null
            },
            {
              id: 'emp-2',
              tenantId: testContext.tenantId,
              userId: null,
              firstName: 'Jane',
              lastName: 'Smith',
              title: 'Product Manager',
              department: 'Product',
              email: 'jane.smith@example.com',
              phone: { value: '+1-555-0124', iv: 'test-iv' },
              personalEmail: null,
              extension: null,
              officeLocation: null,
              managerId: null,
              photoUrl: null,
              bio: null,
              skills: [],
              isActive: true,
              customFields: {},
              searchVector: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              manager: null,
              user: null
            },
            {
              id: 'emp-3',
              tenantId: testContext.tenantId,
              userId: null,
              firstName: 'Bob',
              lastName: 'Johnson',
              title: 'Designer',
              department: 'Design',
              email: 'bob.johnson@example.com',
              phone: { value: '+1-555-0125', iv: 'test-iv' },
              personalEmail: null,
              extension: null,
              officeLocation: null,
              managerId: null,
              photoUrl: null,
              bio: null,
              skills: [],
              isActive: true,
              customFields: {},
              searchVector: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              manager: null,
              user: null
            }
          ],
          expectedCount: 3,
          description: 'multiple employees from different departments'
        },
        // Employees with manager relationships
        {
          employees: [
            {
              id: 'emp-1',
              tenantId: testContext.tenantId,
              userId: null,
              firstName: 'Alice',
              lastName: 'Manager',
              title: 'Engineering Manager',
              department: 'Engineering',
              email: 'alice.manager@example.com',
              phone: { value: '+1-555-0126', iv: 'test-iv' },
              personalEmail: null,
              extension: null,
              officeLocation: null,
              managerId: null,
              photoUrl: null,
              bio: null,
              skills: [],
              isActive: true,
              customFields: {},
              searchVector: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              manager: null,
              user: null
            },
            {
              id: 'emp-2',
              tenantId: testContext.tenantId,
              userId: null,
              firstName: 'Charlie',
              lastName: 'Developer',
              title: 'Senior Developer',
              department: 'Engineering',
              email: 'charlie.dev@example.com',
              phone: { value: '+1-555-0127', iv: 'test-iv' },
              personalEmail: null,
              extension: null,
              officeLocation: null,
              managerId: 'emp-1',
              photoUrl: null,
              bio: null,
              skills: [],
              isActive: true,
              customFields: {},
              searchVector: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              manager: {
                id: 'emp-1',
                firstName: 'Alice',
                lastName: 'Manager',
                title: 'Engineering Manager'
              },
              user: null
            }
          ],
          expectedCount: 2,
          description: 'employees with manager relationships'
        }
      ];

      for (const testCase of testCases) {
        // Mock repository response
        mockEmployeeRepository.findMany.mockResolvedValue({
          employees: testCase.employees,
          pagination: {
            page: 1,
            pageSize: 20,
            total: testCase.expectedCount,
            totalPages: Math.ceil(testCase.expectedCount / 20)
          }
        });

        const result = await EmployeeService.listEmployees({}, {}, testContext);

        // Verify all employees are returned
        expect(result.employees).toHaveLength(testCase.expectedCount);
        
        // Verify each employee has required information
        result.employees.forEach((employee, index) => {
          const expectedEmployee = testCase.employees[index];
          
          // Required fields for directory listing (Requirements 2.1, 2.2)
          expect(employee.firstName).toBeDefined();
          expect(employee.lastName).toBeDefined();
          expect(employee.email).toBeDefined();
          expect(employee.title).toBeDefined();
          expect(employee.department).toBeDefined();
          
          // Verify actual values match expected
          expect(employee.firstName).toBe(expectedEmployee.firstName);
          expect(employee.lastName).toBe(expectedEmployee.lastName);
          expect(employee.email).toBe(expectedEmployee.email);
          expect(employee.title).toBe(expectedEmployee.title);
          expect(employee.department).toBe(expectedEmployee.department);
          
          // Contact information should be available
          if (expectedEmployee.phone) {
            expect(employee.phone).toBeDefined();
          }
          
          // Manager information should be included if present
          if (expectedEmployee.manager) {
            expect(employee.manager).toBeDefined();
            expect(employee.manager?.firstName).toBe(expectedEmployee.manager.firstName);
            expect(employee.manager?.lastName).toBe(expectedEmployee.manager.lastName);
          }
        });

        // Verify pagination information is provided
        expect(result.pagination).toBeDefined();
        expect(result.pagination.total).toBe(testCase.expectedCount);
        expect(result.pagination.page).toBe(1);
        expect(result.pagination.pageSize).toBe(20);
        expect(result.pagination.totalPages).toBe(Math.ceil(testCase.expectedCount / 20));
      }
    });

    it('should handle various filter combinations while maintaining complete information', async () => {
      const allEmployees = [
        {
          id: 'emp-1',
          tenantId: testContext.tenantId,
          userId: null,
          firstName: 'John',
          lastName: 'Doe',
          title: 'Software Engineer',
          department: 'Engineering',
          email: 'john.doe@example.com',
          phone: { value: '+1-555-0123', iv: 'test-iv' },
          personalEmail: null,
          extension: null,
          officeLocation: null,
          managerId: null,
          photoUrl: null,
          bio: null,
          skills: [],
          isActive: true,
          customFields: {},
          searchVector: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          manager: null,
          user: null
        },
        {
          id: 'emp-2',
          tenantId: testContext.tenantId,
          userId: null,
          firstName: 'Jane',
          lastName: 'Smith',
          title: 'Product Manager',
          department: 'Product',
          email: 'jane.smith@example.com',
          phone: { value: '+1-555-0124', iv: 'test-iv' },
          personalEmail: null,
          extension: null,
          officeLocation: null,
          managerId: null,
          photoUrl: null,
          bio: null,
          skills: [],
          isActive: true,
          customFields: {},
          searchVector: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          manager: null,
          user: null
        }
      ];

      const filterTestCases = [
        {
          filters: { department: 'Engineering' },
          expectedEmployees: [allEmployees[0]],
          description: 'department filter'
        },
        {
          filters: { title: 'Product Manager' },
          expectedEmployees: [allEmployees[1]],
          description: 'title filter'
        },
        {
          filters: { search: 'John' },
          expectedEmployees: [allEmployees[0]],
          description: 'search filter'
        },
        {
          filters: {},
          expectedEmployees: allEmployees,
          description: 'no filters (all employees)'
        }
      ];

      for (const testCase of filterTestCases) {
        mockEmployeeRepository.findMany.mockResolvedValue({
          employees: testCase.expectedEmployees,
          pagination: {
            page: 1,
            pageSize: 20,
            total: testCase.expectedEmployees.length,
            totalPages: Math.ceil(testCase.expectedEmployees.length / 20)
          }
        });

        const result = await EmployeeService.listEmployees(testCase.filters, {}, testContext);

        // Verify filtered results still contain complete information
        expect(result.employees).toHaveLength(testCase.expectedEmployees.length);
        
        result.employees.forEach((employee, index) => {
          const expectedEmployee = testCase.expectedEmployees[index];
          
          // All required fields must be present regardless of filters
          expect(employee.firstName).toBe(expectedEmployee.firstName);
          expect(employee.lastName).toBe(expectedEmployee.lastName);
          expect(employee.email).toBe(expectedEmployee.email);
          expect(employee.title).toBe(expectedEmployee.title);
          expect(employee.department).toBe(expectedEmployee.department);
          expect(employee.phone).toBeDefined();
        });
      }
    });
  });

  /**
   * Feature: basic-employee-directory, Property 7: Directory Pagination
   * For any directory with more than the page size limit of employees, pagination controls should be provided and functional
   * Validates: Requirements 2.3
   */
  describe('Property 7: Directory Pagination', () => {
    it('should provide pagination controls for large employee lists', async () => {
      const testCases = [
        // Small list - no pagination needed
        {
          totalEmployees: 5,
          pageSize: 20,
          expectedPages: 1,
          description: 'small list under page size'
        },
        // Exactly one page
        {
          totalEmployees: 20,
          pageSize: 20,
          expectedPages: 1,
          description: 'exactly one page'
        },
        // Multiple pages
        {
          totalEmployees: 45,
          pageSize: 20,
          expectedPages: 3,
          description: 'multiple pages needed'
        },
        // Large list
        {
          totalEmployees: 100,
          pageSize: 10,
          expectedPages: 10,
          description: 'large list with small page size'
        }
      ];

      for (const testCase of testCases) {
        // Generate mock employees for the test case
        const mockEmployees = Array.from({ length: Math.min(testCase.pageSize, testCase.totalEmployees) }, (_, index) => ({
          id: `emp-${index + 1}`,
          tenantId: testContext.tenantId,
          userId: null,
          firstName: `Employee${index + 1}`,
          lastName: `LastName${index + 1}`,
          title: 'Test Title',
          department: 'Test Department',
          email: `employee${index + 1}@example.com`,
          phone: { value: `+1-555-${String(index + 1).padStart(4, '0')}`, iv: 'test-iv' },
          personalEmail: null,
          extension: null,
          officeLocation: null,
          managerId: null,
          photoUrl: null,
          bio: null,
          skills: [],
          isActive: true,
          customFields: {},
          searchVector: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          manager: null,
          user: null
        }));

        // Mock repository response with pagination
        mockEmployeeRepository.findMany.mockResolvedValue({
          employees: mockEmployees,
          pagination: {
            page: 1,
            pageSize: testCase.pageSize,
            total: testCase.totalEmployees,
            totalPages: testCase.expectedPages
          }
        });

        const result = await EmployeeService.listEmployees({}, { pageSize: testCase.pageSize }, testContext);

        // Verify pagination information is correct
        expect(result.pagination).toBeDefined();
        expect(result.pagination.total).toBe(testCase.totalEmployees);
        expect(result.pagination.pageSize).toBe(testCase.pageSize);
        expect(result.pagination.totalPages).toBe(testCase.expectedPages);
        expect(result.pagination.page).toBe(1);

        // Verify employees returned don't exceed page size
        expect(result.employees.length).toBeLessThanOrEqual(testCase.pageSize);
        
        // For cases where we have more employees than page size, verify pagination is needed
        if (testCase.totalEmployees > testCase.pageSize) {
          expect(result.pagination.totalPages).toBeGreaterThan(1);
        } else {
          expect(result.pagination.totalPages).toBe(1);
        }
      }
    });

    it('should handle different page requests correctly', async () => {
      const totalEmployees = 50;
      const pageSize = 10;
      const totalPages = Math.ceil(totalEmployees / pageSize);

      const pageTestCases = [
        { page: 1, expectedStart: 0, expectedEnd: 9 },
        { page: 2, expectedStart: 10, expectedEnd: 19 },
        { page: 3, expectedStart: 20, expectedEnd: 29 },
        { page: 5, expectedStart: 40, expectedEnd: 49 } // Last page
      ];

      for (const testCase of pageTestCases) {
        // Generate mock employees for the specific page
        const mockEmployees = Array.from({ length: pageSize }, (_, index) => ({
          id: `emp-${testCase.expectedStart + index + 1}`,
          tenantId: testContext.tenantId,
          userId: null,
          firstName: `Employee${testCase.expectedStart + index + 1}`,
          lastName: `LastName${testCase.expectedStart + index + 1}`,
          title: 'Test Title',
          department: 'Test Department',
          email: `employee${testCase.expectedStart + index + 1}@example.com`,
          phone: { value: `+1-555-${String(testCase.expectedStart + index + 1).padStart(4, '0')}`, iv: 'test-iv' },
          personalEmail: null,
          extension: null,
          officeLocation: null,
          managerId: null,
          photoUrl: null,
          bio: null,
          skills: [],
          isActive: true,
          customFields: {},
          searchVector: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          manager: null,
          user: null
        }));

        mockEmployeeRepository.findMany.mockResolvedValue({
          employees: mockEmployees,
          pagination: {
            page: testCase.page,
            pageSize: pageSize,
            total: totalEmployees,
            totalPages: totalPages
          }
        });

        const result = await EmployeeService.listEmployees({}, { page: testCase.page, pageSize: pageSize }, testContext);

        // Verify pagination metadata
        expect(result.pagination.page).toBe(testCase.page);
        expect(result.pagination.pageSize).toBe(pageSize);
        expect(result.pagination.total).toBe(totalEmployees);
        expect(result.pagination.totalPages).toBe(totalPages);

        // Verify correct number of employees returned
        expect(result.employees).toHaveLength(pageSize);

        // Verify employee IDs match expected range
        result.employees.forEach((employee, index) => {
          const expectedId = `emp-${testCase.expectedStart + index + 1}`;
          expect(employee.id).toBe(expectedId);
        });
      }
    });

    it('should handle edge cases in pagination', async () => {
      const edgeCases = [
        // Empty result set
        {
          totalEmployees: 0,
          pageSize: 20,
          page: 1,
          expectedPages: 0,
          expectedEmployees: 0,
          description: 'empty result set'
        },
        // Single employee
        {
          totalEmployees: 1,
          pageSize: 20,
          page: 1,
          expectedPages: 1,
          expectedEmployees: 1,
          description: 'single employee'
        },
        // Last page with fewer employees
        {
          totalEmployees: 25,
          pageSize: 10,
          page: 3,
          expectedPages: 3,
          expectedEmployees: 5, // Last page has only 5 employees
          description: 'partial last page'
        }
      ];

      for (const testCase of edgeCases) {
        const mockEmployees = Array.from({ length: testCase.expectedEmployees }, (_, index) => ({
          id: `emp-${index + 1}`,
          tenantId: testContext.tenantId,
          userId: null,
          firstName: `Employee${index + 1}`,
          lastName: `LastName${index + 1}`,
          title: 'Test Title',
          department: 'Test Department',
          email: `employee${index + 1}@example.com`,
          phone: { value: `+1-555-${String(index + 1).padStart(4, '0')}`, iv: 'test-iv' },
          personalEmail: null,
          extension: null,
          officeLocation: null,
          managerId: null,
          photoUrl: null,
          bio: null,
          skills: [],
          isActive: true,
          customFields: {},
          searchVector: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          manager: null,
          user: null
        }));

        mockEmployeeRepository.findMany.mockResolvedValue({
          employees: mockEmployees,
          pagination: {
            page: testCase.page,
            pageSize: testCase.pageSize,
            total: testCase.totalEmployees,
            totalPages: testCase.expectedPages
          }
        });

        const result = await EmployeeService.listEmployees({}, { page: testCase.page, pageSize: testCase.pageSize }, testContext);

        // Verify pagination handles edge cases correctly
        expect(result.pagination.total).toBe(testCase.totalEmployees);
        expect(result.pagination.totalPages).toBe(testCase.expectedPages);
        expect(result.employees).toHaveLength(testCase.expectedEmployees);
      }
    });
  });
});