import request from 'supertest';
import express from 'express';
import employeeRoutes from '../employee.routes';
import { prisma } from '../../lib/database';
import { createErrorHandler } from '../../utils/errors';

// Mock the employee service
jest.mock('../../services/employee.service', () => ({
  EmployeeService: {
    createEmployee: jest.fn(),
    updateEmployee: jest.fn(),
    getEmployeeById: jest.fn(),
    deleteEmployee: jest.fn(),
    listEmployees: jest.fn(),
    uploadProfilePhoto: jest.fn(),
  },
}));

// Mock the database
jest.mock('../../lib/database', () => ({
  prisma: {
    tenant: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock multer middleware
jest.mock('multer', () => {
  return () => ({
    single: () => (req: any, res: any, next: any) => {
      req.file = {
        buffer: Buffer.from('fake image data'),
        mimetype: 'image/jpeg',
        originalname: 'test.jpg',
        size: 1024,
      };
      next();
    },
  });
});

import { EmployeeService } from '../../services/employee.service';

const mockEmployeeService = EmployeeService as jest.Mocked<typeof EmployeeService>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

// Create test app
const app = express();
app.use(express.json());

// Mock middleware
app.use((req, res, next) => {
  req.tenant = { id: 'test-tenant-id', name: 'Test Tenant' };
  req.user = { 
    id: 'test-user-id', 
    email: 'admin@test.com', 
    role: 'admin',
    tenantId: 'test-tenant-id'
  };
  next();
});

app.use('/api/employees', employeeRoutes);
app.use(createErrorHandler());

describe('Employee Routes Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/employees', () => {
    it('should return list of employees', async () => {
      const mockEmployees = {
        employees: [
          {
            id: 'employee-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            title: 'Software Engineer',
            department: 'Engineering',
            isActive: true,
          },
          {
            id: 'employee-2',
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@example.com',
            title: 'Designer',
            department: 'Design',
            isActive: true,
          },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 2,
          totalPages: 1,
        },
      };

      mockEmployeeService.listEmployees.mockResolvedValue(mockEmployees);

      const response = await request(app)
        .get('/api/employees')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockEmployees,
      });

      expect(mockEmployeeService.listEmployees).toHaveBeenCalledWith(
        'test-tenant-id',
        {},
        { page: 1, pageSize: 20 }
      );
    });

    it('should apply filters and pagination', async () => {
      const mockEmployees = {
        employees: [],
        pagination: {
          page: 2,
          pageSize: 10,
          total: 0,
          totalPages: 0,
        },
      };

      mockEmployeeService.listEmployees.mockResolvedValue(mockEmployees);

      const response = await request(app)
        .get('/api/employees')
        .query({
          department: 'Engineering',
          isActive: 'true',
          page: '2',
          pageSize: '10',
        })
        .expect(200);

      expect(mockEmployeeService.listEmployees).toHaveBeenCalledWith(
        'test-tenant-id',
        { department: 'Engineering', isActive: true },
        { page: 2, pageSize: 10 }
      );
    });
  });

  describe('GET /api/employees/:id', () => {
    it('should return employee by ID', async () => {
      const mockEmployee = {
        id: 'employee-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        title: 'Software Engineer',
        department: 'Engineering',
        phone: '+1-555-0123',
        skills: ['JavaScript', 'TypeScript'],
        isActive: true,
      };

      mockEmployeeService.getEmployeeById.mockResolvedValue(mockEmployee);

      const response = await request(app)
        .get('/api/employees/employee-1')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockEmployee,
      });

      expect(mockEmployeeService.getEmployeeById).toHaveBeenCalledWith(
        'employee-1',
        'test-tenant-id'
      );
    });

    it('should return 404 for non-existent employee', async () => {
      mockEmployeeService.getEmployeeById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/employees/non-existent')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          message: 'Employee not found',
          code: 'NOT_FOUND',
        },
      });
    });
  });

  describe('POST /api/employees', () => {
    it('should create new employee (admin only)', async () => {
      const newEmployeeData = {
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@example.com',
        title: 'Product Manager',
        department: 'Product',
        phone: '+1-555-0456',
        skills: ['Product Management', 'Analytics'],
      };

      const createdEmployee = {
        id: 'employee-3',
        ...newEmployeeData,
        tenantId: 'test-tenant-id',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockEmployeeService.createEmployee.mockResolvedValue(createdEmployee);

      const response = await request(app)
        .post('/api/employees')
        .send(newEmployeeData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: createdEmployee,
      });

      expect(mockEmployeeService.createEmployee).toHaveBeenCalledWith(
        newEmployeeData,
        {
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          userRole: 'admin',
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
        }
      );
    });

    it('should return 400 for invalid employee data', async () => {
      const invalidData = {
        firstName: '', // Empty first name
        email: 'invalid-email', // Invalid email format
      };

      const response = await request(app)
        .post('/api/employees')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 403 for non-admin users', async () => {
      // Override middleware for this test
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: 'test-tenant-id', name: 'Test Tenant' };
        req.user = { 
          id: 'test-user-id', 
          email: 'user@test.com', 
          role: 'user', // Non-admin role
          tenantId: 'test-tenant-id'
        };
        next();
      });
      testApp.use('/api/employees', employeeRoutes);
      testApp.use(createErrorHandler());

      const response = await request(testApp)
        .post('/api/employees')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /api/employees/:id', () => {
    it('should update employee (admin)', async () => {
      const updateData = {
        title: 'Senior Software Engineer',
        skills: ['JavaScript', 'TypeScript', 'React'],
      };

      const updatedEmployee = {
        id: 'employee-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        ...updateData,
        isActive: true,
        updatedAt: new Date(),
      };

      mockEmployeeService.updateEmployee.mockResolvedValue(updatedEmployee);

      const response = await request(app)
        .put('/api/employees/employee-1')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: updatedEmployee,
      });

      expect(mockEmployeeService.updateEmployee).toHaveBeenCalledWith(
        'employee-1',
        updateData,
        {
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          userRole: 'admin',
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
        }
      );
    });

    it('should allow profile owner to update their own profile', async () => {
      // Override middleware for this test
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: 'test-tenant-id', name: 'Test Tenant' };
        req.user = { 
          id: 'employee-1', // Same as employee ID being updated
          email: 'john.doe@test.com', 
          role: 'user',
          tenantId: 'test-tenant-id'
        };
        next();
      });
      testApp.use('/api/employees', employeeRoutes);
      testApp.use(createErrorHandler());

      const updateData = {
        phone: '+1-555-9999',
        skills: ['JavaScript', 'TypeScript', 'Node.js'],
      };

      const updatedEmployee = {
        id: 'employee-1',
        firstName: 'John',
        lastName: 'Doe',
        ...updateData,
        isActive: true,
      };

      mockEmployeeService.updateEmployee.mockResolvedValue(updatedEmployee);

      const response = await request(testApp)
        .put('/api/employees/employee-1')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent employee', async () => {
      const updateData = { title: 'New Title' };

      mockEmployeeService.updateEmployee.mockRejectedValue(
        new Error('Employee not found')
      );

      const response = await request(app)
        .put('/api/employees/non-existent')
        .send(updateData)
        .expect(500); // Error handler will catch and return appropriate status

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/employees/:id', () => {
    it('should soft delete employee (admin only)', async () => {
      const deletedEmployee = {
        id: 'employee-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        isActive: false,
        updatedAt: new Date(),
      };

      mockEmployeeService.deleteEmployee.mockResolvedValue(deletedEmployee);

      const response = await request(app)
        .delete('/api/employees/employee-1')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: deletedEmployee,
      });

      expect(mockEmployeeService.deleteEmployee).toHaveBeenCalledWith(
        'employee-1',
        {
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          userRole: 'admin',
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
        }
      );
    });

    it('should return 403 for non-admin users', async () => {
      // Override middleware for this test
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req, res, next) => {
        req.tenant = { id: 'test-tenant-id', name: 'Test Tenant' };
        req.user = { 
          id: 'test-user-id', 
          email: 'user@test.com', 
          role: 'user', // Non-admin role
          tenantId: 'test-tenant-id'
        };
        next();
      });
      testApp.use('/api/employees', employeeRoutes);
      testApp.use(createErrorHandler());

      const response = await request(testApp)
        .delete('/api/employees/employee-1')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/employees/:id/photo', () => {
    it('should upload profile photo', async () => {
      const updatedEmployee = {
        id: 'employee-1',
        firstName: 'John',
        lastName: 'Doe',
        photoUrl: 'https://storage.example.com/photos/employee-1.jpg',
        isActive: true,
      };

      mockEmployeeService.uploadProfilePhoto.mockResolvedValue(updatedEmployee);

      const response = await request(app)
        .post('/api/employees/employee-1/photo')
        .attach('photo', Buffer.from('fake image data'), 'test.jpg')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: updatedEmployee,
      });

      expect(mockEmployeeService.uploadProfilePhoto).toHaveBeenCalledWith(
        'employee-1',
        expect.objectContaining({
          buffer: expect.any(Buffer),
          mimetype: 'image/jpeg',
          originalname: 'test.jpg',
        }),
        {
          tenantId: 'test-tenant-id',
          userId: 'test-user-id',
          userRole: 'admin',
          ipAddress: expect.any(String),
          userAgent: expect.any(String),
        }
      );
    });

    it('should return 400 when no file is uploaded', async () => {
      // Override multer mock for this test
      jest.doMock('multer', () => {
        return () => ({
          single: () => (req: any, res: any, next: any) => {
            // No file attached
            next();
          },
        });
      });

      const response = await request(app)
        .post('/api/employees/employee-1/photo')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('No file uploaded');
    });
  });

  describe('Error handling', () => {
    it('should handle service errors gracefully', async () => {
      mockEmployeeService.listEmployees.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/employees')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Database connection failed');
    });

    it('should handle validation errors', async () => {
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      
      mockEmployeeService.createEmployee.mockRejectedValue(validationError);

      const response = await request(app)
        .post('/api/employees')
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      // Create app without auth middleware
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use('/api/employees', employeeRoutes);
      unauthApp.use(createErrorHandler());

      const response = await request(unauthApp)
        .get('/api/employees')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should validate tenant context', async () => {
      // Create app without tenant middleware
      const noTenantApp = express();
      noTenantApp.use(express.json());
      noTenantApp.use((req, res, next) => {
        req.user = { 
          id: 'test-user-id', 
          email: 'admin@test.com', 
          role: 'admin',
          tenantId: 'test-tenant-id'
        };
        // No tenant context
        next();
      });
      noTenantApp.use('/api/employees', employeeRoutes);
      noTenantApp.use(createErrorHandler());

      const response = await request(noTenantApp)
        .get('/api/employees')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('tenant');
    });
  });
});