import { Router, Request, Response, NextFunction } from 'express';
import { EmployeeService, EmployeeServiceContext } from '../services/employee.service';
import { CustomFieldRepository } from '../repositories/custom-field.repository';
import { AnalyticsService } from '../services/analytics.service';
import { subscriptionService } from '../services/subscription.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { 
  requireCreateEmployee, 
  requireDeactivateEmployee, 
  requireEmployeeEditPermission 
} from '../middleware/authorization.middleware';
import { tenantMiddleware, requireTenant } from '../middleware/tenant.middleware';
import { checkEmployeeLimit, addUsageWarnings } from '../middleware/user-limit.middleware';
import { validateCreateEmployee, validateUpdateEmployee } from '../validators/employee.validator';
import { AuthenticatedUser } from '../types';
import multer from 'multer';

const router = Router();

// Simple async handler utility
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply middleware to all routes
router.use(tenantMiddleware);
router.use(requireTenant);
router.use(authenticateToken);

/**
 * GET /api/employees/usage - Get usage statistics and upgrade recommendations
 */
router.get('/usage', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthenticatedUser;
  
  // Only allow admins and super admins to view usage stats
  if (!['admin', 'super_admin'].includes(user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const recommendations = await subscriptionService.getUpgradeRecommendations(req.tenant!.id);
  res.json(recommendations);
}));

/**
 * GET /api/employees - List employees with pagination and filters
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  // Parse query parameters
  const filters = {
    search: req.query.search as string,
    department: req.query.department as string,
    title: req.query.title as string,
    managerId: req.query.managerId as string,
    isActive: req.query.isActive ? req.query.isActive === 'true' : true,
    skills: req.query.skills ? (req.query.skills as string).split(',') : undefined,
  };

  const pagination = {
    page: parseInt(req.query.page as string) || 1,
    pageSize: Math.min(parseInt(req.query.pageSize as string) || 20, 100),
    sortBy: req.query.sortBy as string || 'lastName',
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'asc',
  };

  const startTime = Date.now();
  const result = await EmployeeService.listEmployees(filters, pagination, context);
  const responseTime = Date.now() - startTime;

  res.json({
    employees: result.employees,
    pagination: result.pagination,
    meta: {
      responseTime: `${responseTime}ms`,
      count: result.employees.length,
    },
  });
}));

/**
 * GET /api/employees/:id - Get employee by ID
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'Invalid employee ID format',
        requestId: req.headers['x-request-id'],
      },
    });
  }

  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const { employee, customFields } = await EmployeeService.getEmployeeByIdWithCustomFields(id, context);

  // Track profile view analytics
  await AnalyticsService.trackProfileView(
    req.tenant!.id,
    user?.id,
    {
      profileId: id,
      action: 'view',
      source: req.query.source as string || 'direct',
    }
  );

  // Calculate profile completeness
  const requiredFields = ['firstName', 'lastName', 'email', 'title', 'department'];
  const optionalFields = ['phone', 'officeLocation', 'bio', 'skills', 'photoUrl'];
  
  const completedRequired = requiredFields.filter(field => 
    employee[field as keyof typeof employee] && 
    employee[field as keyof typeof employee] !== ''
  ).length;
  
  const completedOptional = optionalFields.filter(field => {
    const value = employee[field as keyof typeof employee];
    return value && (Array.isArray(value) ? value.length > 0 : value !== '');
  }).length;

  // Include custom fields in completeness calculation
  const requiredCustomFields = customFields.filter(cf => cf.isRequired);
  const completedRequiredCustomFields = requiredCustomFields.filter(cf => {
    const value = employee.customFields[cf.fieldName];
    return value !== null && value !== undefined && value !== '';
  }).length;

  const optionalCustomFields = customFields.filter(cf => !cf.isRequired);
  const completedOptionalCustomFields = optionalCustomFields.filter(cf => {
    const value = employee.customFields[cf.fieldName];
    return value !== null && value !== undefined && value !== '';
  }).length;

  const totalRequired = requiredFields.length + requiredCustomFields.length;
  const totalOptional = optionalFields.length + optionalCustomFields.length;
  const completedRequiredTotal = completedRequired + completedRequiredCustomFields;
  const completedOptionalTotal = completedOptional + completedOptionalCustomFields;
  
  const completeness = Math.round(
    ((completedRequiredTotal / Math.max(totalRequired, 1)) * 70) + 
    ((completedOptionalTotal / Math.max(totalOptional, 1)) * 30)
  );

  res.json({
    employee: {
      ...employee,
      profileCompleteness: completeness,
    },
    customFields,
  });
}));

/**
 * POST /api/employees - Create new employee (admin only)
 */
router.post('/', requireCreateEmployee, checkEmployeeLimit, addUsageWarnings, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  // Validate request body
  try {
    const validatedData = validateCreateEmployee(req.body);
    const employee = await EmployeeService.createEmployee(validatedData, context);

    // Track profile creation analytics
    await AnalyticsService.trackProfileCreate(
      req.tenant!.id,
      user?.id,
      {
        profileId: employee.id,
        action: 'create',
      }
    );

    res.status(201).json({
      employee,
      message: 'Employee created successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid employee data',
          details: error.message.replace('Validation failed: ', ''),
          requestId: req.headers['x-request-id'],
        },
      });
    }
    throw error;
  }
}));

/**
 * PUT /api/employees/:id - Update employee
 */
router.put('/:id', requireEmployeeEditPermission(), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  // Validate request body
  try {
    const validatedData = validateUpdateEmployee(req.body);
    
    // Track which fields are being changed for analytics
    const fieldsChanged = Object.keys(validatedData);
    
    const employee = await EmployeeService.updateEmployee(id, validatedData, context);

    // Track profile update analytics
    await AnalyticsService.trackProfileUpdate(
      req.tenant!.id,
      user?.id,
      {
        profileId: id,
        action: 'update',
        fieldsChanged,
      }
    );

    res.json({
      employee,
      message: 'Employee updated successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Validation failed:')) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid employee data',
          details: error.message.replace('Validation failed: ', ''),
          requestId: req.headers['x-request-id'],
        },
      });
    }
    throw error;
  }
}));

/**
 * DELETE /api/employees/:id - Deactivate employee (admin only)
 */
router.delete('/:id', requireDeactivateEmployee, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  await EmployeeService.deactivateEmployee(id, context);

  // Track profile deletion analytics
  await AnalyticsService.trackProfileDelete(
    req.tenant!.id,
    user?.id,
    {
      profileId: id,
      action: 'delete',
    }
  );

  res.json({
    message: 'Employee deactivated successfully',
  });
}));

/**
 * POST /api/employees/:id/photo - Upload profile photo
 */
router.post('/:id/photo', requireEmployeeEditPermission(), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  // Configure multer for this route
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 2 * 1024 * 1024, // 2MB
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
  });
  
  upload.single('photo')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        error: {
          code: 'FILE_UPLOAD_ERROR',
          message: err.message,
          requestId: req.headers['x-request-id'],
        },
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'No photo file provided',
          requestId: req.headers['x-request-id'],
        },
      });
    }

    try {
      const result = await EmployeeService.uploadProfilePhoto(id, req.file, context);

      res.json({
        employee: result.employee,
        upload: result.upload,
        message: 'Profile photo uploaded successfully',
      });
    } catch (error) {
      throw error;
    }
  });
}));

/**
 * DELETE /api/employees/:id/photo - Remove profile photo
 */
router.delete('/:id/photo', requireEmployeeEditPermission(), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  await EmployeeService.deleteProfilePhoto(id, context);

  res.json({
    message: 'Profile photo removed successfully',
  });
}));

/**
 * GET /api/employees/:id/direct-reports - Get direct reports
 */
router.get('/:id/direct-reports', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const directReports = await EmployeeService.getDirectReports(id, context);

  res.json({
    directReports,
    managerId: id,
    count: directReports.length,
  });
}));

/**
 * GET /api/employees/:id/hierarchy - Get organizational hierarchy for employee
 */
router.get('/:id/hierarchy', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const hierarchy = await EmployeeService.getEmployeeHierarchy(id, context);

  res.json({
    hierarchy,
    employeeId: id,
  });
}));

/**
 * GET /api/employees/custom-fields - Get custom field definitions for employees
 */
router.get('/custom-fields', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const customFields = await CustomFieldRepository.findMany(context.tenantId);

  res.json({
    customFields,
    count: customFields.length,
  });
}));

/**
 * GET /api/employees/statistics - Get employee statistics
 */
router.get('/statistics', asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthenticatedUser;
  const context: EmployeeServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const statistics = await EmployeeService.getEmployeeStatistics(context);

  res.json({
    statistics,
  });
}));

export default router;