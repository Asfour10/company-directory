/**
 * Feature: basic-employee-directory, Property 20: Database Connectivity
 * For any employee data operation, the system should successfully connect to and interact with the PostgreSQL database
 * Validates: Requirements 7.1
 * 
 * NOTE: This test suite requires a running PostgreSQL database.
 * It is skipped by default and should be run in integration/deployment environments.
 * To run these tests, ensure DATABASE_URL points to a running test database.
 */

import { prisma } from '../../lib/database';

describe.skip('Property 20: Database Connectivity', () => {
  beforeAll(async () => {
    // Ensure database connection is established
    await prisma.$connect();
  });

  afterAll(async () => {
    // Clean up database connection
    await prisma.$disconnect();
  });

  it('should successfully connect to PostgreSQL database', async () => {
    // Test basic database connectivity with a simple query
    const result = await prisma.$queryRaw<Array<{ value: number }>>`SELECT 1 as value`;
    
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should perform CRUD operations on employee data', async () => {
    const testTenantId = 'test-tenant-db-connectivity';
    const testUserId = 'test-user-db-connectivity';
    
    // Clean up any existing test data
    await prisma.employee.deleteMany({
      where: { tenantId: testTenantId }
    });
    await prisma.user.deleteMany({
      where: { tenantId: testTenantId }
    });
    await prisma.tenant.deleteMany({
      where: { id: testTenantId }
    });

    try {
      // Create tenant
      const tenant = await prisma.tenant.create({
        data: {
          id: testTenantId,
          name: 'Test Tenant DB Connectivity',
          subdomain: 'test-db-connectivity',
          subscriptionTier: 'free',
          userLimit: 10,
        }
      });
      expect(tenant).toBeDefined();
      expect(tenant.id).toBe(testTenantId);

      // Create user
      const user = await prisma.user.create({
        data: {
          id: testUserId,
          tenantId: testTenantId,
          email: 'test-db@example.com',
          role: 'user',
          isActive: true,
        }
      });
      expect(user).toBeDefined();
      expect(user.id).toBe(testUserId);

      // Create employee (CREATE operation)
      const employee = await prisma.employee.create({
        data: {
          tenantId: testTenantId,
          userId: testUserId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          title: 'Software Engineer',
          department: 'Engineering',
          isActive: true,
        }
      });
      
      expect(employee).toBeDefined();
      expect(employee.firstName).toBe('John');
      expect(employee.lastName).toBe('Doe');
      expect(employee.email).toBe('john.doe@example.com');

      // Read employee (READ operation)
      const fetchedEmployee = await prisma.employee.findUnique({
        where: { id: employee.id }
      });
      
      expect(fetchedEmployee).toBeDefined();
      expect(fetchedEmployee?.id).toBe(employee.id);
      expect(fetchedEmployee?.firstName).toBe('John');

      // Update employee (UPDATE operation)
      const updatedEmployee = await prisma.employee.update({
        where: { id: employee.id },
        data: { title: 'Senior Software Engineer' }
      });
      
      expect(updatedEmployee).toBeDefined();
      expect(updatedEmployee.title).toBe('Senior Software Engineer');

      // Delete employee (DELETE operation)
      await prisma.employee.delete({
        where: { id: employee.id }
      });
      
      const deletedEmployee = await prisma.employee.findUnique({
        where: { id: employee.id }
      });
      
      expect(deletedEmployee).toBeNull();

    } finally {
      // Clean up test data
      await prisma.employee.deleteMany({
        where: { tenantId: testTenantId }
      });
      await prisma.user.deleteMany({
        where: { tenantId: testTenantId }
      });
      await prisma.tenant.deleteMany({
        where: { id: testTenantId }
      });
    }
  });

  it('should handle multiple concurrent database operations', async () => {
    const testTenantId = 'test-tenant-concurrent';
    
    // Clean up any existing test data
    await prisma.employee.deleteMany({
      where: { tenantId: testTenantId }
    });
    await prisma.tenant.deleteMany({
      where: { id: testTenantId }
    });

    try {
      // Create tenant
      await prisma.tenant.create({
        data: {
          id: testTenantId,
          name: 'Test Tenant Concurrent',
          subdomain: 'test-concurrent',
          subscriptionTier: 'free',
          userLimit: 10,
        }
      });

      // Create multiple employees concurrently
      const employeePromises = Array.from({ length: 5 }, (_, index) => 
        prisma.employee.create({
          data: {
            tenantId: testTenantId,
            firstName: `Employee${index}`,
            lastName: `Test${index}`,
            email: `employee${index}@example.com`,
            title: 'Test Title',
            department: 'Test Department',
            isActive: true,
          }
        })
      );

      const employees = await Promise.all(employeePromises);
      
      expect(employees).toHaveLength(5);
      employees.forEach((employee, index) => {
        expect(employee.firstName).toBe(`Employee${index}`);
        expect(employee.tenantId).toBe(testTenantId);
      });

      // Verify all employees were created
      const allEmployees = await prisma.employee.findMany({
        where: { tenantId: testTenantId }
      });
      
      expect(allEmployees).toHaveLength(5);

    } finally {
      // Clean up test data
      await prisma.employee.deleteMany({
        where: { tenantId: testTenantId }
      });
      await prisma.tenant.deleteMany({
        where: { id: testTenantId }
      });
    }
  });

  it('should handle database errors gracefully', async () => {
    // Attempt to create employee without required tenant
    await expect(
      prisma.employee.create({
        data: {
          tenantId: 'non-existent-tenant',
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
          isActive: true,
        }
      })
    ).rejects.toThrow();

    // Attempt to fetch non-existent employee
    const nonExistentEmployee = await prisma.employee.findUnique({
      where: { id: 'non-existent-id' }
    });
    
    expect(nonExistentEmployee).toBeNull();
  });

  it('should maintain data integrity with transactions', async () => {
    const testTenantId = 'test-tenant-transaction';
    const testUserId = 'test-user-transaction';
    
    // Clean up any existing test data
    await prisma.employee.deleteMany({
      where: { tenantId: testTenantId }
    });
    await prisma.user.deleteMany({
      where: { tenantId: testTenantId }
    });
    await prisma.tenant.deleteMany({
      where: { id: testTenantId }
    });

    try {
      // Create tenant and user in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            id: testTenantId,
            name: 'Test Tenant Transaction',
            subdomain: 'test-transaction',
            subscriptionTier: 'free',
            userLimit: 10,
          }
        });

        const user = await tx.user.create({
          data: {
            id: testUserId,
            tenantId: testTenantId,
            email: 'test-transaction@example.com',
            role: 'user',
            isActive: true,
          }
        });

        const employee = await tx.employee.create({
          data: {
            tenantId: testTenantId,
            userId: testUserId,
            firstName: 'Transaction',
            lastName: 'Test',
            email: 'transaction@example.com',
            isActive: true,
          }
        });

        return { tenant, user, employee };
      });

      expect(result.tenant).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.employee).toBeDefined();
      expect(result.employee.userId).toBe(testUserId);

      // Verify all records were created
      const tenant = await prisma.tenant.findUnique({
        where: { id: testTenantId }
      });
      const user = await prisma.user.findUnique({
        where: { id: testUserId }
      });
      const employee = await prisma.employee.findUnique({
        where: { id: result.employee.id }
      });

      expect(tenant).toBeDefined();
      expect(user).toBeDefined();
      expect(employee).toBeDefined();

    } finally {
      // Clean up test data
      await prisma.employee.deleteMany({
        where: { tenantId: testTenantId }
      });
      await prisma.user.deleteMany({
        where: { tenantId: testTenantId }
      });
      await prisma.tenant.deleteMany({
        where: { id: testTenantId }
      });
    }
  });

  it('should handle complex queries with relations', async () => {
    const testTenantId = 'test-tenant-relations';
    const managerId = 'manager-id';
    
    // Clean up any existing test data
    await prisma.employee.deleteMany({
      where: { tenantId: testTenantId }
    });
    await prisma.tenant.deleteMany({
      where: { id: testTenantId }
    });

    try {
      // Create tenant
      await prisma.tenant.create({
        data: {
          id: testTenantId,
          name: 'Test Tenant Relations',
          subdomain: 'test-relations',
          subscriptionTier: 'free',
          userLimit: 10,
        }
      });

      // Create manager
      await prisma.employee.create({
        data: {
          id: managerId,
          tenantId: testTenantId,
          firstName: 'Manager',
          lastName: 'Test',
          email: 'manager@example.com',
          title: 'Engineering Manager',
          department: 'Engineering',
          isActive: true,
        }
      });

      // Create employee with manager relationship
      const employee = await prisma.employee.create({
        data: {
          tenantId: testTenantId,
          firstName: 'Employee',
          lastName: 'Test',
          email: 'employee@example.com',
          title: 'Software Engineer',
          department: 'Engineering',
          managerId: managerId,
          isActive: true,
        }
      });

      // Query employee with manager relation
      const employeeWithManager = await prisma.employee.findUnique({
        where: { id: employee.id },
        include: { manager: true }
      });

      expect(employeeWithManager).toBeDefined();
      expect(employeeWithManager?.manager).toBeDefined();
      expect(employeeWithManager?.manager?.id).toBe(managerId);
      expect(employeeWithManager?.manager?.firstName).toBe('Manager');

      // Query manager with direct reports
      const managerWithReports = await prisma.employee.findUnique({
        where: { id: managerId },
        include: { directReports: true }
      });

      expect(managerWithReports).toBeDefined();
      expect(managerWithReports?.directReports).toBeDefined();
      expect(managerWithReports?.directReports.length).toBeGreaterThan(0);
      expect(managerWithReports?.directReports[0].id).toBe(employee.id);

    } finally {
      // Clean up test data
      await prisma.employee.deleteMany({
        where: { tenantId: testTenantId }
      });
      await prisma.tenant.deleteMany({
        where: { id: testTenantId }
      });
    }
  });
});
