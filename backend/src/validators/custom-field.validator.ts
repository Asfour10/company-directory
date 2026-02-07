import Joi from 'joi';

/**
 * Validation schemas for custom field data
 */

// Valid field types
const FIELD_TYPES = ['text', 'number', 'date', 'dropdown', 'multiselect'] as const;

// Base custom field schema with common validations
const baseCustomFieldSchema = {
  fieldName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .pattern(/^[a-zA-Z][a-zA-Z0-9_]*$/)
    .messages({
      'string.empty': 'Field name is required',
      'string.min': 'Field name must be at least 1 character',
      'string.max': 'Field name must not exceed 100 characters',
      'string.pattern.base': 'Field name must start with a letter and contain only letters, numbers, and underscores',
    }),

  fieldType: Joi.string()
    .valid(...FIELD_TYPES)
    .messages({
      'any.only': `Field type must be one of: ${FIELD_TYPES.join(', ')}`,
      'string.empty': 'Field type is required',
    }),

  isRequired: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'isRequired must be a boolean value',
    }),

  options: Joi.array()
    .items(
      Joi.string()
        .trim()
        .min(1)
        .max(100)
        .messages({
          'string.empty': 'Option cannot be empty',
          'string.max': 'Each option must not exceed 100 characters',
        })
    )
    .min(1)
    .max(50)
    .unique()
    .allow(null)
    .messages({
      'array.min': 'At least one option is required for dropdown and multiselect fields',
      'array.max': 'Cannot have more than 50 options',
      'array.unique': 'Options must be unique',
    }),

  displayOrder: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .messages({
      'number.base': 'Display order must be a number',
      'number.integer': 'Display order must be an integer',
      'number.min': 'Display order must be at least 1',
      'number.max': 'Display order must not exceed 1000',
    }),
};

/**
 * Schema for creating a new custom field
 */
export const createCustomFieldSchema = Joi.object({
  fieldName: baseCustomFieldSchema.fieldName.required(),
  fieldType: baseCustomFieldSchema.fieldType.required(),
  isRequired: baseCustomFieldSchema.isRequired.optional(),
  options: baseCustomFieldSchema.options.optional(),
  displayOrder: baseCustomFieldSchema.displayOrder.optional(),
})
.custom((value, helpers) => {
  // Validate that dropdown/multiselect fields have options
  if ((value.fieldType === 'dropdown' || value.fieldType === 'multiselect')) {
    if (!value.options || value.options.length === 0) {
      return helpers.error('custom.optionsRequired');
    }
  }
  
  // Validate that non-dropdown fields don't have options
  if (value.fieldType !== 'dropdown' && value.fieldType !== 'multiselect') {
    if (value.options && value.options.length > 0) {
      return helpers.error('custom.optionsNotAllowed');
    }
  }
  
  return value;
})
.messages({
  'object.unknown': 'Unknown field: {#label}',
  'custom.optionsRequired': 'Dropdown and multiselect fields must have at least one option',
  'custom.optionsNotAllowed': 'Only dropdown and multiselect fields can have options',
});

/**
 * Schema for updating a custom field
 */
export const updateCustomFieldSchema = Joi.object({
  fieldName: baseCustomFieldSchema.fieldName.optional(),
  fieldType: baseCustomFieldSchema.fieldType.optional(),
  isRequired: baseCustomFieldSchema.isRequired.optional(),
  options: baseCustomFieldSchema.options.optional(),
  displayOrder: baseCustomFieldSchema.displayOrder.optional(),
})
.min(1)
.custom((value, helpers) => {
  // If fieldType is being updated, validate options accordingly
  if (value.fieldType) {
    if ((value.fieldType === 'dropdown' || value.fieldType === 'multiselect')) {
      if (value.options !== undefined && (!value.options || value.options.length === 0)) {
        return helpers.error('custom.optionsRequired');
      }
    } else {
      if (value.options && value.options.length > 0) {
        return helpers.error('custom.optionsNotAllowed');
      }
    }
  }
  
  return value;
})
.messages({
  'object.min': 'At least one field must be provided for update',
  'object.unknown': 'Unknown field: {#label}',
  'custom.optionsRequired': 'Dropdown and multiselect fields must have at least one option',
  'custom.optionsNotAllowed': 'Only dropdown and multiselect fields can have options',
});

/**
 * Schema for custom field filter parameters
 */
export const customFieldFilterSchema = Joi.object({
  fieldType: Joi.string()
    .valid(...FIELD_TYPES)
    .allow('')
    .messages({
      'any.only': `Field type must be one of: ${FIELD_TYPES.join(', ')}`,
    }),

  isRequired: Joi.boolean()
    .messages({
      'boolean.base': 'isRequired must be a boolean value',
    }),
}).messages({
  'object.unknown': 'Unknown filter parameter: {#label}',
});

/**
 * Schema for reordering custom fields
 */
export const reorderCustomFieldsSchema = Joi.object({
  fieldOrders: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().uuid().required().messages({
          'string.guid': 'Field ID must be a valid UUID',
        }),
        displayOrder: Joi.number().integer().min(1).max(1000).required().messages({
          'number.base': 'Display order must be a number',
          'number.integer': 'Display order must be an integer',
          'number.min': 'Display order must be at least 1',
          'number.max': 'Display order must not exceed 1000',
        }),
      })
    )
    .min(1)
    .max(100)
    .messages({
      'array.min': 'At least one field order must be provided',
      'array.max': 'Cannot reorder more than 100 fields at once',
    }),
}).messages({
  'object.unknown': 'Unknown field: {#label}',
});

/**
 * Schema for validating custom field values
 */
export const customFieldValueSchema = Joi.object()
  .pattern(
    Joi.string().max(100),
    Joi.alternatives().try(
      Joi.string().max(1000).allow(''),
      Joi.number(),
      Joi.date(),
      Joi.array().items(Joi.string().max(100)).max(20)
    )
  )
  .messages({
    'object.pattern.match': 'Custom field values must be strings, numbers, dates, or arrays of strings',
  });

/**
 * Validation functions
 */

/**
 * Validate custom field creation data
 */
export function validateCreateCustomField(data: any) {
  const { error, value } = createCustomFieldSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Validate custom field update data
 */
export function validateUpdateCustomField(data: any) {
  const { error, value } = updateCustomFieldSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Validate custom field filter parameters
 */
export function validateCustomFieldFilters(data: any) {
  const { error, value } = customFieldFilterSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Filter validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Validate field reordering data
 */
export function validateReorderCustomFields(data: any) {
  const { error, value } = reorderCustomFieldsSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Reorder validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Validate custom field values
 */
export function validateCustomFieldValues(data: any) {
  const { error, value } = customFieldValueSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Custom field values validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Custom validation functions
 */

/**
 * Validate field name uniqueness and format
 */
export function validateFieldName(fieldName: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!fieldName || fieldName.trim().length === 0) {
    errors.push('Field name is required');
    return { valid: false, errors };
  }
  
  const trimmed = fieldName.trim();
  
  if (trimmed.length > 100) {
    errors.push('Field name must not exceed 100 characters');
  }
  
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(trimmed)) {
    errors.push('Field name must start with a letter and contain only letters, numbers, and underscores');
  }
  
  // Check for reserved field names
  const reservedNames = [
    'id', 'tenantId', 'userId', 'firstName', 'lastName', 'email', 'title', 
    'department', 'phone', 'extension', 'officeLocation', 'managerId', 
    'photoUrl', 'bio', 'skills', 'isActive', 'createdAt', 'updatedAt',
    'customFields', 'searchVector'
  ];
  
  if (reservedNames.includes(trimmed)) {
    errors.push(`Field name "${trimmed}" is reserved and cannot be used`);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate field options for dropdown/multiselect
 */
export function validateFieldOptions(fieldType: string, options: string[] | null): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (fieldType === 'dropdown' || fieldType === 'multiselect') {
    if (!options || options.length === 0) {
      errors.push('Dropdown and multiselect fields must have at least one option');
      return { valid: false, errors };
    }
    
    if (options.length > 50) {
      errors.push('Cannot have more than 50 options');
    }
    
    const uniqueOptions = new Set();
    options.forEach((option, index) => {
      if (typeof option !== 'string') {
        errors.push(`Option at index ${index} must be a string`);
        return;
      }
      
      const trimmed = option.trim();
      if (trimmed.length === 0) {
        errors.push(`Option at index ${index} cannot be empty`);
        return;
      }
      
      if (trimmed.length > 100) {
        errors.push(`Option at index ${index} must not exceed 100 characters`);
        return;
      }
      
      if (uniqueOptions.has(trimmed.toLowerCase())) {
        errors.push(`Duplicate option: ${trimmed}`);
        return;
      }
      
      uniqueOptions.add(trimmed.toLowerCase());
    });
  } else {
    if (options && options.length > 0) {
      errors.push(`Field type '${fieldType}' cannot have options`);
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate a single custom field value against its definition
 */
export function validateSingleFieldValue(
  fieldDefinition: any,
  value: any
): { valid: boolean; error?: string } {
  const { fieldName, fieldType, isRequired, options } = fieldDefinition;
  
  // Handle null/undefined/empty values
  if (value === null || value === undefined || value === '') {
    if (isRequired) {
      return { valid: false, error: `${fieldName} is required` };
    }
    return { valid: true };
  }
  
  switch (fieldType) {
    case 'text':
      if (typeof value !== 'string') {
        return { valid: false, error: `${fieldName} must be a string` };
      }
      if (value.length > 1000) {
        return { valid: false, error: `${fieldName} must not exceed 1000 characters` };
      }
      break;
      
    case 'number':
      const numValue = Number(value);
      if (!Number.isFinite(numValue)) {
        return { valid: false, error: `${fieldName} must be a valid number` };
      }
      break;
      
    case 'date':
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return { valid: false, error: `${fieldName} must be a valid date` };
      }
      break;
      
    case 'dropdown':
      if (typeof value !== 'string') {
        return { valid: false, error: `${fieldName} must be a string` };
      }
      if (!options || !options.includes(value)) {
        return { 
          valid: false, 
          error: `${fieldName} must be one of: ${options?.join(', ') || 'no options available'}` 
        };
      }
      break;
      
    case 'multiselect':
      if (!Array.isArray(value)) {
        return { valid: false, error: `${fieldName} must be an array` };
      }
      if (value.length > 20) {
        return { valid: false, error: `${fieldName} cannot have more than 20 selections` };
      }
      const invalidValues = value.filter(v => typeof v !== 'string' || !options?.includes(v));
      if (invalidValues.length > 0) {
        return { 
          valid: false, 
          error: `${fieldName} contains invalid values: ${invalidValues.join(', ')}` 
        };
      }
      break;
      
    default:
      return { valid: false, error: `Unknown field type: ${fieldType}` };
  }
  
  return { valid: true };
}

/**
 * Validate multiple custom field values against their definitions
 */
export function validateMultipleFieldValues(
  fieldDefinitions: any[],
  customFieldValues: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Create a map of field definitions by name for quick lookup
  const fieldMap = new Map(fieldDefinitions.map(field => [field.fieldName, field]));
  
  // Check required fields
  for (const field of fieldDefinitions) {
    if (field.isRequired) {
      const value = customFieldValues[field.fieldName];
      if (value === null || value === undefined || value === '') {
        errors.push(`${field.fieldName} is required`);
      }
    }
  }
  
  // Validate provided values
  for (const [fieldName, value] of Object.entries(customFieldValues)) {
    const fieldDefinition = fieldMap.get(fieldName);
    
    if (!fieldDefinition) {
      errors.push(`Unknown custom field: ${fieldName}`);
      continue;
    }
    
    const validation = validateSingleFieldValue(fieldDefinition, value);
    if (!validation.valid) {
      errors.push(validation.error!);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate display order values
 */
export function validateDisplayOrders(orders: Array<{ id: string; displayOrder: number }>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const orderValues = new Set<number>();
  
  for (const { id, displayOrder } of orders) {
    if (!id || typeof id !== 'string') {
      errors.push('Each field order must have a valid ID');
      continue;
    }
    
    if (typeof displayOrder !== 'number' || !Number.isInteger(displayOrder)) {
      errors.push(`Display order for field ${id} must be an integer`);
      continue;
    }
    
    if (displayOrder < 1 || displayOrder > 1000) {
      errors.push(`Display order for field ${id} must be between 1 and 1000`);
      continue;
    }
    
    if (orderValues.has(displayOrder)) {
      errors.push(`Duplicate display order: ${displayOrder}`);
      continue;
    }
    
    orderValues.add(displayOrder);
  }
  
  return { valid: errors.length === 0, errors };
}