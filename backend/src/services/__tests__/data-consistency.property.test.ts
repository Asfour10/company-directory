/**
 * Feature: basic-employee-directory, Property 8: Data Consistency After Updates
 * For any employee profile update, the changes should be immediately reflected in all views (directory listing, profile page, search results)
 * Validates: Requirements 2.4, 7.4
 */

import { EmployeeService, EmployeeServiceContext } from '../employee.service';
import { EmployeeRepository } from '../../repositories/employee.repository';

// Mock dependencies
jest.mock('../../repositories/employee.repository');
jest.mock('../audit.service');
jest.mock('../../validators/employee.validator');

const mockEmployeeRepository = EmployeeRepository as jest.Mocked<typeof EmployeeRepository>;

describe('Property 8: Data Consistency After Updates', () => {
  const testContext: EmployeeServiceContext = {
    tenantId: 'tenant-consistency',
    userId: 'user-consistency',
    userRole: 'admin',
    ipAddress: '192.168.1.1',
    userAgent: 'Test Agent',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock validation functions
    const { validateEmployeeFilters, validatePagination, validateUpdateEmployee } = require('../../validators/employee.validator');
    validateEmployeeFilters.mockImplementation((filters: any) => filters);
    validatePagination.mockImplementation((pagination: any) => pagination);
    validateUpdateEmployee.mockImplementation((data: any) => data);
  });

  /**
   * Test that employee updates are immediately reflected in directory listings
   */
  it('should reflect employee updates in directory listing immediately', async () => {
    const employeeId = 'emp-consistency-1';
    
    // Initial employee data
    const initialEmployee = {
      id: employeeId,
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
      officeLocation: 'Building A',
      managerId: null,
      photoUrl: null,
      bio: 'Initial bio',
      skills: ['JavaScript', 'TypeScript'],
      isActive: true,
      customFields: {},
      searchVector: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      manager: null,
      user: null,
      directReports: []
    };

    // Mock initial directory listing
    mockEmployeeRepository.findMany.mockResolvedValueOnce({
      employees: [initialEmployee],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1
      }
    });

    // Get initial directory listing
    const initialListing = await EmployeeService.listEmployees({}, {}, testContext);
    expect(initialListing.employees[0].title).toBe('Software Engineer');
    expect(initialListing.employees[0].department).toBe('Engineering');
    expect(initialListing.employees[0].officeLocation).toBe('Building A');

    // Update employee
    const updatedEmployee = {
      ...initialEmployee,
      title: 'Senior Software Engineer',
      department: 'Platform Engineering',
      officeLocation: 'Building B',
      bio: 'Updated bio',
      skills: ['JavaScript', 'TypeScript', 'React'],
      updatedAt: new Date(),
    };

    mockEmployeeRepository.findById.mockResolvedValue(initialEmployee);
    mockEmployeeRepository.update.mockResolvedValue(updatedEmployee);

    // Perform update
    await EmployeeService.updateEmployee(
      employeeId,
      {
        title: 'Senior Software Engineer',
        department: 'Platform Engineering',
        officeLocation: 'Building B',
        bio: 'Updated bio',
        skills: ['JavaScript', 'TypeScript', 'React'],
      },
      testContext
    );

    // Mock updated directory listing
    mockEmployeeRepository.findMany.mockResolvedValueOnce({
      employees: [updatedEmployee],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1
      }
    });

    // Get updated directory listing
    const updatedListing = await EmployeeService.listEmployees({}, {}, testContext);
    
    // Verify updates are reflected in directory listing
    expect(updatedListing.employees[0].title).toBe('Senior Software Engineer');
    expect(updatedListing.employees[0].department).toBe('Platform Engineering');
    expect(updatedListing.employees[0].officeLocation).toBe('Building B');
    expect(updatedListing.employees[0].bio).toBe('Updated bio');
    expect(updatedListing.employees[0].skills).toContain('React');
  });

  /**
   * Test that employee updates are immediately reflected in profile views
   */
  it('should reflect employee updates in profile view immediately', async () => {
    const employeeId = 'emp-consistency-2';
    
    const initialEmployee = {
      id: employeeId,
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
      officeLocation: 'Remote',
      managerId: null,
      photoUrl: null,
      bio: 'Product manager with 5 years experience',
      skills: ['Product Strategy', 'Agile'],
      isActive: true,
      customFields: {},
      searchVector: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      manager: null,
      user: null,
      directReports: []
    };

    // Mock initial profile fetch
    mockEmployeeRepository.findById.mockResolvedValueOnce(initialEmployee);

    // Get initial profile
    const initialProfile = await EmployeeService.getEmployeeById(employeeId, testContext);
    expect(initialProfile.title).toBe('Product Manager');
    expect(initialProfile.bio).toBe('Product manager with 5 years experience');

    // Update employee
    const updatedEmployee = {
      ...initialEmployee,
      title: 'Senior Product Manager',
      bio: 'Senior product manager with 7 years experience',
      skills: ['Product Strategy', 'Agile', 'Data Analysis'],
      updatedAt: new Date(),
    };

    mockEmployeeRepository.findById.mockResolvedValueOnce(initialEmployee);
    mockEmployeeRepository.update.mockResolvedValue(updatedEmployee);

    // Perform update
    await EmployeeService.updateEmployee(
      employeeId,
      {
        title: 'Senior Product Manager',
        bio: 'Senior product manager with 7 years experience',
        skills: ['Product Strategy', 'Agile', 'Data Analysis'],
      },
      testContext
    );

    // Mock updated profile fetch
    mockEmployeeRepository.findById.mockResolvedValueOnce(updatedEmployee);

    // Get updated profile
    const updatedProfile = await EmployeeService.getEmployeeById(employeeId, testContext);
    
    // Verify updates are reflected in profile view
    expect(updatedProfile.title).toBe('Senior Product Manager');
    expect(updatedProfile.bio).toBe('Senior product manager with 7 years experience');
    expect(updatedProfile.skills).toContain('Data Analysis');
  });

  /**
   * Test that multiple field updates are all reflected consistently
   */
  it('should reflect all field updates consistently across views', async () => {
    const employeeId = 'emp-consistency-3';
    
    const initialEmployee = {
      id: employeeId,
      tenantId: testContext.tenantId,
      userId: null,
      firstName: 'Bob',
      lastName: 'Johnson',
      title: 'Designer',
      department: 'Design',
      email: 'bob.johnson@example.com',
      phone: { value: '+1-555-0125', iv: 'test-iv' },
      personalEmail: null,
      extension: '1234',
      officeLocation: 'Building C',
      managerId: null,
      photoUrl: null,
      bio: 'UI/UX Designer',
      skills: ['Figma', 'Sketch'],
      isActive: true,
      customFields: {},
      searchVector: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      manager: null,
      user: null,
      directReports: []
    };

    // Update multiple fields at once
    const updatedEmployee = {
      ...initialEmployee,
      title: 'Lead Designer',
      department: 'Product Design',
      extension: '5678',
      officeLocation: 'Building D',
      bio: 'Lead UI/UX Designer',
      skills: ['Figma', 'Sketch', 'Adobe XD', 'Prototyping'],
      updatedAt: new Date(),
    };

    mockEmployeeRepository.findById.mockResolvedValueOnce(initialEmployee);
    mockEmployeeRepository.update.mockResolvedValue(updatedEmployee);

    // Perform update with multiple fields
    await EmployeeService.updateEmployee(
      employeeId,
      {
        title: 'Lead Designer',
        department: 'Product Design',
        extension: '5678',
        officeLocation: 'Building D',
        bio: 'Lead UI/UX Designer',
        skills: ['Figma', 'Sketch', 'Adobe XD', 'Prototyping'],
      },
      testContext
    );

    // Verify in directory listing
    mockEmployeeRepository.findMany.mockResolvedValueOnce({
      employees: [updatedEmployee],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1
      }
    });

    const directoryListing = await EmployeeService.listEmployees({}, {}, testContext);
    expect(directoryListing.employees[0].title).toBe('Lead Designer');
    expect(directoryListing.employees[0].department).toBe('Product Design');
    expect(directoryListing.employees[0].officeLocation).toBe('Building D');

    // Verify in profile view
    mockEmployeeRepository.findById.mockResolvedValueOnce(updatedEmployee);
    const profileView = await EmployeeService.getEmployeeById(employeeId, testContext);
    expect(profileView.title).toBe('Lead Designer');
    expect(profileView.department).toBe('Product Design');
    expect(profileView.extension).toBe('5678');
    expect(profileView.officeLocation).toBe('Building D');
    expect(profileView.bio).toBe('Lead UI/UX Designer');
    expect(profileView.skills).toEqual(['Figma', 'Sketch', 'Adobe XD', 'Prototyping']);
  });

  /**
   * Test that updates to one employee don't affect other employees
   */
  it('should maintain data consistency for other employees when one is updated', async () => {
    const employee1Id = 'emp-consistency-4';
    const employee2Id = 'emp-consistency-5';
    
    const employee1 = {
      id: employee1Id,
      tenantId: testContext.tenantId,
      userId: null,
      firstName: 'Alice',
      lastName: 'Williams',
      title: 'Engineer',
      department: 'Engineering',
      email: 'alice@example.com',
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
      user: null,
      directReports: []
    };

    const employee2 = {
      id: employee2Id,
      tenantId: testContext.tenantId,
      userId: null,
      firstName: 'Charlie',
      lastName: 'Brown',
      title: 'Manager',
      department: 'Management',
      email: 'charlie@example.com',
      phone: { value: '+1-555-0127', iv: 'test-iv' },
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
      user: null,
      directReports: []
    };

    // Initial directory listing with both employees
    mockEmployeeRepository.findMany.mockResolvedValueOnce({
      employees: [employee1, employee2],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1
      }
    });

    const initialListing = await EmployeeService.listEmployees({}, {}, testContext);
    expect(initialListing.employees).toHaveLength(2);
    expect(initialListing.employees[0].title).toBe('Engineer');
    expect(initialListing.employees[1].title).toBe('Manager');

    // Update only employee1
    const updatedEmployee1 = {
      ...employee1,
      title: 'Senior Engineer',
      updatedAt: new Date(),
    };

    mockEmployeeRepository.findById.mockResolvedValueOnce(employee1);
    mockEmployeeRepository.update.mockResolvedValue(updatedEmployee1);

    await EmployeeService.updateEmployee(
      employee1Id,
      { title: 'Senior Engineer' },
      testContext
    );

    // Verify updated directory listing
    mockEmployeeRepository.findMany.mockResolvedValueOnce({
      employees: [updatedEmployee1, employee2],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 2,
        totalPages: 1
      }
    });

    const updatedListing = await EmployeeService.listEmployees({}, {}, testContext);
    
    // Employee1 should be updated
    expect(updatedListing.employees[0].title).toBe('Senior Engineer');
    
    // Employee2 should remain unchanged
    expect(updatedListing.employees[1].title).toBe('Manager');
    expect(updatedListing.employees[1].firstName).toBe('Charlie');
    expect(updatedListing.employees[1].department).toBe('Management');
  });

  /**
   * Test that rapid successive updates maintain consistency
   */
  it('should maintain consistency with rapid successive updates', async () => {
    const employeeId = 'emp-consistency-6';
    
    const baseEmployee = {
      id: employeeId,
      tenantId: testContext.tenantId,
      userId: null,
      firstName: 'David',
      lastName: 'Miller',
      title: 'Developer',
      department: 'Engineering',
      email: 'david@example.com',
      phone: { value: '+1-555-0128', iv: 'test-iv' },
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
      user: null,
      directReports: []
    };

    // Perform multiple rapid updates
    const updates = [
      { title: 'Junior Developer' },
      { title: 'Developer' },
      { title: 'Senior Developer' },
      { title: 'Lead Developer' },
    ];

    let currentEmployee = baseEmployee;

    for (const update of updates) {
      mockEmployeeRepository.findById.mockResolvedValueOnce(currentEmployee);
      
      currentEmployee = {
        ...currentEmployee,
        ...update,
        updatedAt: new Date(),
      };
      
      mockEmployeeRepository.update.mockResolvedValueOnce(currentEmployee);

      await EmployeeService.updateEmployee(employeeId, update, testContext);
    }

    // Verify final state in directory
    mockEmployeeRepository.findMany.mockResolvedValueOnce({
      employees: [currentEmployee],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1
      }
    });

    const finalListing = await EmployeeService.listEmployees({}, {}, testContext);
    expect(finalListing.employees[0].title).toBe('Lead Developer');

    // Verify final state in profile
    mockEmployeeRepository.findById.mockResolvedValueOnce(currentEmployee);
    const finalProfile = await EmployeeService.getEmployeeById(employeeId, testContext);
    expect(finalProfile.title).toBe('Lead Developer');
  });

  /**
   * Test that deactivating an employee is reflected consistently
   */
  it('should reflect employee deactivation consistently across views', async () => {
    const employeeId = 'emp-consistency-7';
    
    const activeEmployee = {
      id: employeeId,
      tenantId: testContext.tenantId,
      userId: null,
      firstName: 'Eve',
      lastName: 'Davis',
      title: 'Analyst',
      department: 'Analytics',
      email: 'eve@example.com',
      phone: { value: '+1-555-0129', iv: 'test-iv' },
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
      user: null,
      directReports: []
    };

    // Initial state - employee is active
    mockEmployeeRepository.findMany.mockResolvedValueOnce({
      employees: [activeEmployee],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1
      }
    });

    const initialListing = await EmployeeService.listEmployees({}, {}, testContext);
    expect(initialListing.employees[0].isActive).toBe(true);

    // Deactivate employee
    const deactivatedEmployee = {
      ...activeEmployee,
      isActive: false,
      updatedAt: new Date(),
    };

    mockEmployeeRepository.findById.mockResolvedValueOnce(activeEmployee);
    mockEmployeeRepository.update.mockResolvedValue(deactivatedEmployee);

    await EmployeeService.updateEmployee(
      employeeId,
      { isActive: false },
      testContext
    );

    // Verify deactivation in directory (should not appear in active listing)
    mockEmployeeRepository.findMany.mockResolvedValueOnce({
      employees: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0
      }
    });

    const updatedListing = await EmployeeService.listEmployees({}, {}, testContext);
    expect(updatedListing.employees).toHaveLength(0);

    // Verify deactivation in profile view
    mockEmployeeRepository.findById.mockResolvedValueOnce(deactivatedEmployee);
    const profile = await EmployeeService.getEmployeeById(employeeId, testContext);
    expect(profile.isActive).toBe(false);
  });
});
