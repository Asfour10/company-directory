import { prisma } from '../lib/database';
import { Prisma } from '@prisma/client';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors';

export interface CreateCustomFieldData {
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'dropdown' | 'multiselect';
  isRequired?: boolean;
  options?: string[] | null;
  displayOrder?: number;
}

export interface UpdateCustomFieldData {
  fieldName?: string;
  fieldType?: 'text' | 'number' | 'date' | 'dropdown' | 'multiselect';
  isRequired?: boolean;
  options?: string[] | null;
  displayOrder?: number;
}

export interface CustomFieldFilters {
  fieldType?: string;
  isRequired?: boolean;
}

/**
 * Repository for custom field data operations
 * All operations are automatically scoped to the current tenant
 */
export class CustomFieldRepository {
  /**
   * Create a new custom field
   */
  static async create(tenantId: string, data: CreateCustomFieldData) {
    try {
      // Check for field name uniqueness within tenant
      const existingField = await prisma.customField.findUnique({
        where: {
          tenantId_fieldName: {
            tenantId,
            fieldName: data.fieldName,
          },
        },
      });

      if (existingField) {
        throw new ConflictError(`Custom field with name '${data.fieldName}' already exists`);
      }

      // Validate options for dropdown/multiselect fields
      if ((data.fieldType === 'dropdown' || data.fieldType === 'multiselect') && (!data.options || data.options.length === 0)) {
        throw new ValidationError('Dropdown and multiselect fields must have at least one option', 'options', data.options);
      }

      // Validate that non-dropdown fields don't have options
      if (data.fieldType !== 'dropdown' && data.fieldType !== 'multiselect' && data.options && data.options.length > 0) {
        throw new ValidationError(`Field type '${data.fieldType}' cannot have options`, 'options', data.options);
      }

      // Get next display order if not provided
      let displayOrder = data.displayOrder;
      if (displayOrder === undefined) {
        const maxOrder = await prisma.customField.aggregate({
          where: { tenantId },
          _max: { displayOrder: true },
        });
        displayOrder = (maxOrder._max.displayOrder || 0) + 1;
      }

      // Create the custom field
      const customField = await prisma.customField.create({
        data: {
          tenantId,
          fieldName: data.fieldName,
          fieldType: data.fieldType,
          isRequired: data.isRequired || false,
          options: data.options || undefined,
          displayOrder,
        },
      });

      return customField;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Failed to create custom field: ${(error as Error).message}`);
    }
  }

  /**
   * Get custom field by ID
   */
  static async findById(tenantId: string, fieldId: string) {
    const customField = await prisma.customField.findFirst({
      where: {
        id: fieldId,
        tenantId,
      },
    });

    if (!customField) {
      throw new NotFoundError('Custom field', fieldId);
    }

    return customField;
  }

  /**
   * Get custom field by name
   */
  static async findByName(tenantId: string, fieldName: string) {
    const customField = await prisma.customField.findUnique({
      where: {
        tenantId_fieldName: {
          tenantId,
          fieldName,
        },
      },
    });

    return customField;
  }

  /**
   * List custom fields with filtering
   */
  static async findMany(tenantId: string, filters: CustomFieldFilters = {}) {
    const { fieldType, isRequired } = filters;

    // Build where clause
    const where: Prisma.CustomFieldWhereInput = {
      tenantId,
    };

    if (fieldType) {
      where.fieldType = fieldType;
    }

    if (isRequired !== undefined) {
      where.isRequired = isRequired;
    }

    const customFields = await prisma.customField.findMany({
      where,
      orderBy: [
        { displayOrder: 'asc' },
        { fieldName: 'asc' },
      ],
    });

    return customFields;
  }

  /**
   * Update custom field
   */
  static async update(tenantId: string, fieldId: string, data: UpdateCustomFieldData) {
    try {
      // Check if custom field exists
      const existingField = await this.findById(tenantId, fieldId);

      // Check field name uniqueness if name is being updated
      if (data.fieldName && data.fieldName !== existingField.fieldName) {
        const nameExists = await prisma.customField.findUnique({
          where: {
            tenantId_fieldName: {
              tenantId,
              fieldName: data.fieldName,
            },
          },
        });

        if (nameExists) {
          throw new ConflictError(`Custom field with name '${data.fieldName}' already exists`);
        }
      }

      // Validate options for dropdown/multiselect fields
      const fieldType = data.fieldType || existingField.fieldType;
      if ((fieldType === 'dropdown' || fieldType === 'multiselect')) {
        const options = data.options !== undefined ? data.options : existingField.options as string[] | null;
        if (!options || options.length === 0) {
          throw new ValidationError('Dropdown and multiselect fields must have at least one option', 'options', options);
        }
      }

      // Validate that non-dropdown fields don't have options
      if (fieldType !== 'dropdown' && fieldType !== 'multiselect' && data.options && data.options.length > 0) {
        throw new ValidationError(`Field type '${fieldType}' cannot have options`, 'options', data.options);
      }

      // Update the custom field
      const updatedField = await prisma.customField.update({
        where: {
          id: fieldId,
        },
        data: {
          fieldName: data.fieldName,
          fieldType: data.fieldType,
          isRequired: data.isRequired,
          options: data.options || undefined,
          displayOrder: data.displayOrder,
        },
      });

      return updatedField;
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError || error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to update custom field: ${(error as Error).message}`);
    }
  }

  /**
   * Delete custom field
   */
  static async delete(tenantId: string, fieldId: string) {
    try {
      // Check if custom field exists
      await this.findById(tenantId, fieldId);

      // Delete the custom field
      const deletedField = await prisma.customField.delete({
        where: {
          id: fieldId,
        },
      });

      return deletedField;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to delete custom field: ${(error as Error).message}`);
    }
  }

  /**
   * Reorder custom fields
   */
  static async reorder(tenantId: string, fieldOrders: Array<{ id: string; displayOrder: number }>) {
    try {
      const results = [];
      
      for (const { id, displayOrder } of fieldOrders) {
        // Verify field exists and belongs to tenant
        await this.findById(tenantId, id);
        
        const updated = await prisma.customField.update({
          where: { id },
          data: { displayOrder },
        });
        
        results.push(updated);
      }

      return results;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new Error(`Failed to reorder custom fields: ${(error as Error).message}`);
    }
  }

  /**
   * Get custom field statistics
   */
  static async getStatistics(tenantId: string) {
    const [
      totalFields,
      requiredFields,
      fieldTypeStats,
    ] = await Promise.all([
      prisma.customField.count({
        where: { tenantId },
      }),
      prisma.customField.count({
        where: { tenantId, isRequired: true },
      }),
      prisma.customField.groupBy({
        by: ['fieldType'],
        where: { tenantId },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    return {
      totalFields,
      requiredFields,
      optionalFields: totalFields - requiredFields,
      fieldTypeDistribution: fieldTypeStats.map(stat => ({
        fieldType: stat.fieldType,
        count: stat._count.id,
      })),
    };
  }

  /**
   * Validate custom field value
   */
  static validateFieldValue(field: any, value: any): { isValid: boolean; error?: string } {
    // Handle null/undefined values
    if (value === null || value === undefined || value === '') {
      if (field.isRequired) {
        return { isValid: false, error: `${field.fieldName} is required` };
      }
      return { isValid: true };
    }

    switch (field.fieldType) {
      case 'text':
        if (typeof value !== 'string') {
          return { isValid: false, error: `${field.fieldName} must be a string` };
        }
        break;

      case 'number':
        if (typeof value !== 'number' && !Number.isFinite(Number(value))) {
          return { isValid: false, error: `${field.fieldName} must be a valid number` };
        }
        break;

      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { isValid: false, error: `${field.fieldName} must be a valid date` };
        }
        break;

      case 'dropdown':
        const options = field.options as string[];
        if (!options || !options.includes(value)) {
          return { isValid: false, error: `${field.fieldName} must be one of: ${options?.join(', ')}` };
        }
        break;

      case 'multiselect':
        if (!Array.isArray(value)) {
          return { isValid: false, error: `${field.fieldName} must be an array` };
        }
        const multiselectOptions = field.options as string[];
        const invalidValues = value.filter(v => !multiselectOptions?.includes(v));
        if (invalidValues.length > 0) {
          return { isValid: false, error: `${field.fieldName} contains invalid values: ${invalidValues.join(', ')}` };
        }
        break;

      default:
        return { isValid: false, error: `Unknown field type: ${field.fieldType}` };
    }

    return { isValid: true };
  }

  /**
   * Validate multiple custom field values
   */
  static async validateCustomFieldValues(tenantId: string, customFieldValues: Record<string, any>) {
    const customFields = await this.findMany(tenantId);
    const errors: string[] = [];

    // Check required fields
    for (const field of customFields) {
      const value = customFieldValues[field.fieldName];
      const validation = this.validateFieldValue(field, value);
      
      if (!validation.isValid) {
        errors.push(validation.error!);
      }
    }

    // Check for unknown fields
    const validFieldNames = new Set(customFields.map(f => f.fieldName));
    for (const fieldName of Object.keys(customFieldValues)) {
      if (!validFieldNames.has(fieldName)) {
        errors.push(`Unknown custom field: ${fieldName}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}