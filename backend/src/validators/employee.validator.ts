import Joi from 'joi';

/**
 * Validation schemas for employee data
 */

// Base employee schema with common validations
const baseEmployeeSchema = {
  firstName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .pattern(/^[a-zA-Z\s\-'\.]+$/)
    .messages({
      'string.empty': 'First name is required',
      'string.min': 'First name must be at least 1 character',
      'string.max': 'First name must not exceed 100 characters',
      'string.pattern.base': 'First name can only contain letters, spaces, hyphens, apostrophes, and periods',
    }),

  lastName: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .pattern(/^[a-zA-Z\s\-'\.]+$/)
    .messages({
      'string.empty': 'Last name is required',
      'string.min': 'Last name must be at least 1 character',
      'string.max': 'Last name must not exceed 100 characters',
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, apostrophes, and periods',
    }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(255)
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Email must be a valid email address',
      'string.max': 'Email must not exceed 255 characters',
    }),

  title: Joi.string()
    .trim()
    .max(200)
    .allow('')
    .messages({
      'string.max': 'Title must not exceed 200 characters',
    }),

  department: Joi.string()
    .trim()
    .max(200)
    .allow('')
    .messages({
      'string.max': 'Department must not exceed 200 characters',
    }),

  phone: Joi.string()
    .trim()
    .pattern(/^\+?[\d\s\-\(\)\.]+$/)
    .max(50)
    .allow('')
    .messages({
      'string.pattern.base': 'Phone number format is invalid',
      'string.max': 'Phone number must not exceed 50 characters',
    }),

  extension: Joi.string()
    .trim()
    .pattern(/^[\d\-\#\*]+$/)
    .max(20)
    .allow('')
    .messages({
      'string.pattern.base': 'Extension can only contain numbers, hyphens, #, and *',
      'string.max': 'Extension must not exceed 20 characters',
    }),

  officeLocation: Joi.string()
    .trim()
    .max(200)
    .allow('')
    .messages({
      'string.max': 'Office location must not exceed 200 characters',
    }),

  managerId: Joi.string()
    .uuid()
    .allow(null)
    .messages({
      'string.guid': 'Manager ID must be a valid UUID',
    }),

  photoUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(500)
    .allow('')
    .messages({
      'string.uri': 'Photo URL must be a valid HTTP/HTTPS URL',
      'string.max': 'Photo URL must not exceed 500 characters',
    }),

  bio: Joi.string()
    .trim()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Bio must not exceed 1000 characters',
    }),

  skills: Joi.array()
    .items(
      Joi.string()
        .trim()
        .min(1)
        .max(50)
        .messages({
          'string.empty': 'Skill cannot be empty',
          'string.max': 'Each skill must not exceed 50 characters',
        })
    )
    .max(20)
    .unique()
    .messages({
      'array.max': 'Cannot have more than 20 skills',
      'array.unique': 'Skills must be unique',
    }),

  customFields: Joi.object()
    .pattern(
      Joi.string().max(50),
      Joi.alternatives().try(
        Joi.string().max(500),
        Joi.number(),
        Joi.boolean(),
        Joi.date(),
        Joi.array().items(Joi.string().max(100)).max(10)
      )
    )
    .messages({
      'object.pattern.match': 'Custom field values must be strings, numbers, booleans, dates, or arrays of strings',
    }),

  userId: Joi.string()
    .uuid()
    .allow(null)
    .messages({
      'string.guid': 'User ID must be a valid UUID',
    }),

  isActive: Joi.boolean()
    .messages({
      'boolean.base': 'isActive must be a boolean value',
    }),
};

/**
 * Schema for creating a new employee
 */
export const createEmployeeSchema = Joi.object({
  firstName: baseEmployeeSchema.firstName.required(),
  lastName: baseEmployeeSchema.lastName.required(),
  email: baseEmployeeSchema.email.required(),
  title: baseEmployeeSchema.title.optional(),
  department: baseEmployeeSchema.department.optional(),
  phone: baseEmployeeSchema.phone.optional(),
  extension: baseEmployeeSchema.extension.optional(),
  officeLocation: baseEmployeeSchema.officeLocation.optional(),
  managerId: baseEmployeeSchema.managerId.optional(),
  photoUrl: baseEmployeeSchema.photoUrl.optional(),
  bio: baseEmployeeSchema.bio.optional(),
  skills: baseEmployeeSchema.skills.optional().default([]),
  customFields: baseEmployeeSchema.customFields.optional().default({}),
  userId: baseEmployeeSchema.userId.optional(),
}).messages({
  'object.unknown': 'Unknown field: {#label}',
});

/**
 * Schema for updating an employee
 */
export const updateEmployeeSchema = Joi.object({
  firstName: baseEmployeeSchema.firstName.optional(),
  lastName: baseEmployeeSchema.lastName.optional(),
  email: baseEmployeeSchema.email.optional(),
  title: baseEmployeeSchema.title.optional(),
  department: baseEmployeeSchema.department.optional(),
  phone: baseEmployeeSchema.phone.optional(),
  extension: baseEmployeeSchema.extension.optional(),
  officeLocation: baseEmployeeSchema.officeLocation.optional(),
  managerId: baseEmployeeSchema.managerId.optional(),
  photoUrl: baseEmployeeSchema.photoUrl.optional(),
  bio: baseEmployeeSchema.bio.optional(),
  skills: baseEmployeeSchema.skills.optional(),
  customFields: baseEmployeeSchema.customFields.optional(),
  userId: baseEmployeeSchema.userId.optional(),
  isActive: baseEmployeeSchema.isActive.optional(),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update',
  'object.unknown': 'Unknown field: {#label}',
});

/**
 * Schema for employee search/filter parameters
 */
export const employeeFilterSchema = Joi.object({
  search: Joi.string()
    .trim()
    .max(100)
    .allow('')
    .messages({
      'string.max': 'Search term must not exceed 100 characters',
    }),

  department: Joi.string()
    .trim()
    .max(200)
    .allow('')
    .messages({
      'string.max': 'Department filter must not exceed 200 characters',
    }),

  title: Joi.string()
    .trim()
    .max(200)
    .allow('')
    .messages({
      'string.max': 'Title filter must not exceed 200 characters',
    }),

  managerId: Joi.string()
    .uuid()
    .allow('')
    .messages({
      'string.guid': 'Manager ID must be a valid UUID',
    }),

  isActive: Joi.boolean()
    .messages({
      'boolean.base': 'isActive must be a boolean value',
    }),

  skills: Joi.array()
    .items(Joi.string().trim().max(50))
    .max(10)
    .messages({
      'array.max': 'Cannot filter by more than 10 skills',
    }),
}).messages({
  'object.unknown': 'Unknown filter parameter: {#label}',
});

/**
 * Schema for pagination parameters
 */
export const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
      'number.max': 'Page must not exceed 1000',
    }),

  pageSize: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.base': 'Page size must be a number',
      'number.integer': 'Page size must be an integer',
      'number.min': 'Page size must be at least 1',
      'number.max': 'Page size must not exceed 100',
    }),

  sortBy: Joi.string()
    .valid('firstName', 'lastName', 'name', 'email', 'title', 'department', 'createdAt')
    .default('lastName')
    .messages({
      'any.only': 'Sort field must be one of: firstName, lastName, name, email, title, department, createdAt',
    }),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('asc')
    .messages({
      'any.only': 'Sort order must be either "asc" or "desc"',
    }),
}).messages({
  'object.unknown': 'Unknown pagination parameter: {#label}',
});

/**
 * Schema for bulk employee operations
 */
export const bulkEmployeeSchema = Joi.object({
  employees: Joi.array()
    .items(
      Joi.object({
        id: Joi.string().uuid().required(),
        data: updateEmployeeSchema.required(),
      })
    )
    .min(1)
    .max(100)
    .messages({
      'array.min': 'At least one employee must be provided',
      'array.max': 'Cannot update more than 100 employees at once',
    }),
}).messages({
  'object.unknown': 'Unknown field: {#label}',
});

/**
 * Schema for employee import data
 */
export const importEmployeeSchema = Joi.object({
  firstName: baseEmployeeSchema.firstName.required(),
  lastName: baseEmployeeSchema.lastName.required(),
  email: baseEmployeeSchema.email.required(),
  title: baseEmployeeSchema.title.optional(),
  department: baseEmployeeSchema.department.optional(),
  phone: baseEmployeeSchema.phone.optional(),
  extension: baseEmployeeSchema.extension.optional(),
  officeLocation: baseEmployeeSchema.officeLocation.optional(),
  managerEmail: Joi.string()
    .email({ tlds: { allow: false } })
    .max(255)
    .allow('')
    .messages({
      'string.email': 'Manager email must be a valid email address',
      'string.max': 'Manager email must not exceed 255 characters',
    }),
  bio: baseEmployeeSchema.bio.optional(),
  skills: Joi.string()
    .max(500)
    .allow('')
    .messages({
      'string.max': 'Skills string must not exceed 500 characters',
    }),
}).messages({
  'object.unknown': 'Unknown field in import data: {#label}',
});

/**
 * Validation functions
 */

/**
 * Validate employee creation data
 */
export function validateCreateEmployee(data: any) {
  const { error, value } = createEmployeeSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Validate employee update data
 */
export function validateUpdateEmployee(data: any) {
  const { error, value } = updateEmployeeSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Validate employee filter parameters
 */
export function validateEmployeeFilters(data: any) {
  const { error, value } = employeeFilterSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Filter validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(data: any) {
  const { error, value } = paginationSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Pagination validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Validate bulk employee operation data
 */
export function validateBulkEmployees(data: any) {
  const { error, value } = bulkEmployeeSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Bulk operation validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Validate employee import data
 */
export function validateImportEmployee(data: any) {
  const { error, value } = importEmployeeSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    throw new Error(`Import validation failed: ${error.details.map(d => d.message).join(', ')}`);
  }

  return value;
}

/**
 * Custom validation functions
 */

/**
 * Validate phone number format (more flexible than regex)
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone || phone.trim().length === 0) return true; // Optional field
  
  // Remove all non-digit characters except + at the start
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Check if it's a valid format
  if (cleaned.startsWith('+')) {
    // International format: +1234567890 (7-15 digits after +)
    return /^\+\d{7,15}$/.test(cleaned);
  } else {
    // Domestic format: 1234567890 (7-15 digits)
    return /^\d{7,15}$/.test(cleaned);
  }
}

/**
 * Validate email domain (if needed for corporate restrictions)
 */
export function validateEmailDomain(email: string, allowedDomains?: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  
  const domain = email.split('@')[1]?.toLowerCase();
  return allowedDomains.some(allowed => domain === allowed.toLowerCase());
}

/**
 * Validate skills format and content
 */
export function validateSkills(skills: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Array.isArray(skills)) {
    return { valid: false, errors: ['Skills must be an array'] };
  }
  
  if (skills.length > 20) {
    errors.push('Cannot have more than 20 skills');
  }
  
  const uniqueSkills = new Set();
  skills.forEach((skill, index) => {
    if (typeof skill !== 'string') {
      errors.push(`Skill at index ${index} must be a string`);
      return;
    }
    
    const trimmed = skill.trim();
    if (trimmed.length === 0) {
      errors.push(`Skill at index ${index} cannot be empty`);
      return;
    }
    
    if (trimmed.length > 50) {
      errors.push(`Skill at index ${index} must not exceed 50 characters`);
      return;
    }
    
    if (uniqueSkills.has(trimmed.toLowerCase())) {
      errors.push(`Duplicate skill: ${trimmed}`);
      return;
    }
    
    uniqueSkills.add(trimmed.toLowerCase());
  });
  
  return { valid: errors.length === 0, errors };
}

/**
 * Validate custom fields structure and types
 */
export function validateCustomFields(customFields: Record<string, any>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (typeof customFields !== 'object' || customFields === null) {
    return { valid: false, errors: ['Custom fields must be an object'] };
  }
  
  const fieldCount = Object.keys(customFields).length;
  if (fieldCount > 50) {
    errors.push('Cannot have more than 50 custom fields');
  }
  
  Object.entries(customFields).forEach(([key, value]) => {
    // Validate field name
    if (key.length > 50) {
      errors.push(`Custom field name "${key}" exceeds 50 characters`);
    }
    
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
      errors.push(`Custom field name "${key}" must start with a letter and contain only letters, numbers, and underscores`);
    }
    
    // Validate field value
    const valueType = typeof value;
    if (value === null || value === undefined) {
      // Allow null/undefined values
      return;
    }
    
    if (valueType === 'string') {
      if (value.length > 500) {
        errors.push(`Custom field "${key}" string value exceeds 500 characters`);
      }
    } else if (valueType === 'number') {
      if (!Number.isFinite(value)) {
        errors.push(`Custom field "${key}" must be a finite number`);
      }
    } else if (valueType === 'boolean') {
      // Boolean values are always valid
    } else if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        errors.push(`Custom field "${key}" must be a valid date`);
      }
    } else if (Array.isArray(value)) {
      if (value.length > 10) {
        errors.push(`Custom field "${key}" array cannot have more than 10 items`);
      }
      value.forEach((item, index) => {
        if (typeof item !== 'string') {
          errors.push(`Custom field "${key}" array item at index ${index} must be a string`);
        } else if (item.length > 100) {
          errors.push(`Custom field "${key}" array item at index ${index} exceeds 100 characters`);
        }
      });
    } else {
      errors.push(`Custom field "${key}" has unsupported type: ${valueType}`);
    }
  });
  
  return { valid: errors.length === 0, errors };
}