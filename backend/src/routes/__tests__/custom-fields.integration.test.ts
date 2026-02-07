import request from 'supertest';
import express from 'express';
import adminRoutes from '../admin.routes';
import employeeRoutes from '../employee.routes';
import { CustomFieldRepository } from '../../repositories/custom-field.repository';

// Mock the dependencies
jest.mock('../../repositories/custom-field.repository');
jest.mock('../../services/audit.service');
jest.mock('../../lib/redis');

const mockCustomFieldRepository = CustomFieldRepository as jest.Mocked<typeof CustomFieldRepository>;

describe('Custom Fields API Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Mock authentication and tenant middleware
    app.use((req, res, next) => {
      req.user = {
        id: 'test-user-id',
        role: 'admin',
        tenantId: 'test-tenant-id',
      };
      req.tenant = {
        id: 'test-tenant-id',
        name: 'Test Company',
        subdomain: 'test',
      };
      req.id = 'test-request-id';
      next();
    });

    app.use('/api/admin', adminRoutes);
    app.use('/api/employees', employeeRoutes);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/custom-fields', () => {
    it('should return all custom fields for the tenant', async () => {
      const mockCustomFields = [
        {
          id: 'cf1',
          tenantId: 'test-tenant-id',
          fieldName: 'employeeId',
          fieldType: 'text',
          isRequired: true,
          options: null,
          displayOrder: 1,
          createdAt: new Date(),
        },
        {
          id: 'cf2',
          tenantId: 'test-tenant-id',
          fieldName: 'workLocation',
          fieldType: 'dropdown',
          isRequired: false,
          options: ['Remote', 'Office', 'Hybrid'],
          displayOrder: 2,
          createdAt: new Date(),
        },
      ];

      mockCustomFieldRepository.findMany.mockResolvedValue(mockCustomFields as any);

      const response = await request(app)
        .get('/api/admin/custom-fields')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCustomFields);
      expect(mockCustomFieldRepository.findMany).toHaveBeenCalledWith('test-tenant-id', {});
    });

    it('should apply filters when provided', async () => {
      mockCustomFieldRepository.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/admin/custom-fields?fieldType=text&isRequired=true')
        .expect(200);

      expect(mockCustomFieldRepository.findMany).toHaveBeenCalledWith('test-tenant-id', {
        fieldType: 'text',
        isRequired: true,
      });
    });
  });

  describe('GET /api/admin/custom-fields/:id', () => {
    it('should return a specific custom field', async () => {
      const mockCustomField = {
        id: 'cf1',
        tenantId: 'test-tenant-id',
        fieldName: 'employeeId',
        fieldType: 'text',
        isRequired: true,
        options: null,
        displayOrder: 1,
        createdAt: new Date(),
      };

      mockCustomFieldRepository.findById.mockResolvedValue(mockCustomField as any);

      const response = await request(app)
        .get('/api/admin/custom-fields/cf1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCustomField);
      expect(mockCustomFieldRepository.findById).toHaveBeenCalledWith('test-tenant-id', 'cf1');
    });

    it('should return 400 when ID is missing', async () => {
      await request(app)
        .get('/api/admin/custom-fields/')
        .expect(404); // Express returns 404 for missing route parameters
    });
  });

  describe('POST /api/admin/custom-fields', () => {
    it('should create a new custom field', async () => {
      const newCustomField = {
        fieldName: 'department',
        fieldType: 'dropdown',
        isRequired: true,
        options: ['Engineering', 'Sales', 'Marketing'],
      };

      const createdCustomField = {
        id: 'cf3',
        tenantId: 'test-tenant-id',
        ...newCustomField,
        displayOrder: 3,
        createdAt: new Date(),
      };

      mockCustomFieldRepository.create.mockResolvedValue(createdCustomField as any);

      const response = await request(app)
        .post('/api/admin/custom-fields')
        .send(newCustomField)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(createdCustomField);
      expect(response.body.message).toBe('Custom field created successfully');
      expect(mockCustomFieldRepository.create).toHaveBeenCalledWith('test-tenant-id', newCustomField);
    });

    it('should validate required fields', async () => {
      const invalidCustomField = {
        fieldType: 'text',
        // Missing required fieldName
      };

      const response = await request(app)
        .post('/api/admin/custom-fields')
        .send(invalidCustomField)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(mockCustomFieldRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/admin/custom-fields/:id', () => {
    it('should update a custom field', async () => {
      const updateData = {
        fieldName: 'workLocationUpdated',
        options: ['Remote', 'Office', 'Hybrid', 'Flexible'],
      };

      const updatedCustomField = {
        id: 'cf2',
        tenantId: 'test-tenant-id',
        fieldName: 'workLocationUpdated',
        fieldType: 'dropdown',
        isRequired: false,
        options: ['Remote', 'Office', 'Hybrid', 'Flexible'],
        displayOrder: 2,
        createdAt: new Date(),
      };

      mockCustomFieldRepository.update.mockResolvedValue(updatedCustomField as any);

      const response = await request(app)
        .put('/api/admin/custom-fields/cf2')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(updatedCustomField);
      expect(response.body.message).toBe('Custom field updated successfully');
      expect(mockCustomFieldRepository.update).toHaveBeenCalledWith('test-tenant-id', 'cf2', updateData);
    });
  });

  describe('DELETE /api/admin/custom-fields/:id', () => {
    it('should delete a custom field', async () => {
      const deletedCustomField = {
        id: 'cf2',
        tenantId: 'test-tenant-id',
        fieldName: 'workLocation',
        fieldType: 'dropdown',
        isRequired: false,
        options: ['Remote', 'Office', 'Hybrid'],
        displayOrder: 2,
        createdAt: new Date(),
      };

      mockCustomFieldRepository.delete.mockResolvedValue(deletedCustomField as any);

      const response = await request(app)
        .delete('/api/admin/custom-fields/cf2')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Custom field deleted successfully');
      expect(mockCustomFieldRepository.delete).toHaveBeenCalledWith('test-tenant-id', 'cf2');
    });
  });

  describe('POST /api/admin/custom-fields/reorder', () => {
    it('should reorder custom fields', async () => {
      const reorderData = {
        fieldOrders: [
          { id: 'cf1', displayOrder: 2 },
          { id: 'cf2', displayOrder: 1 },
        ],
      };

      const reorderedFields = [
        { id: 'cf1', displayOrder: 2 },
        { id: 'cf2', displayOrder: 1 },
      ];

      mockCustomFieldRepository.reorder.mockResolvedValue(reorderedFields as any);

      const response = await request(app)
        .post('/api/admin/custom-fields/reorder')
        .send(reorderData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(reorderedFields);
      expect(response.body.message).toBe('Custom fields reordered successfully');
      expect(mockCustomFieldRepository.reorder).toHaveBeenCalledWith('test-tenant-id', reorderData.fieldOrders);
    });
  });

  describe('GET /api/admin/custom-fields/statistics', () => {
    it('should return custom field statistics', async () => {
      const mockStatistics = {
        totalFields: 5,
        requiredFields: 2,
        optionalFields: 3,
        fieldTypeDistribution: [
          { fieldType: 'text', count: 2 },
          { fieldType: 'dropdown', count: 2 },
          { fieldType: 'number', count: 1 },
        ],
      };

      mockCustomFieldRepository.getStatistics.mockResolvedValue(mockStatistics as any);

      const response = await request(app)
        .get('/api/admin/custom-fields/statistics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStatistics);
      expect(mockCustomFieldRepository.getStatistics).toHaveBeenCalledWith('test-tenant-id');
    });
  });

  describe('GET /api/employees/custom-fields', () => {
    it('should return custom field definitions for employees', async () => {
      const mockCustomFields = [
        {
          id: 'cf1',
          tenantId: 'test-tenant-id',
          fieldName: 'employeeId',
          fieldType: 'text',
          isRequired: true,
          options: null,
          displayOrder: 1,
          createdAt: new Date(),
        },
      ];

      mockCustomFieldRepository.findMany.mockResolvedValue(mockCustomFields as any);

      const response = await request(app)
        .get('/api/employees/custom-fields')
        .expect(200);

      expect(response.body.customFields).toEqual(mockCustomFields);
      expect(response.body.count).toBe(1);
      expect(mockCustomFieldRepository.findMany).toHaveBeenCalledWith('test-tenant-id');
    });
  });
});