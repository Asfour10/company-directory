import { Router, Request, Response, NextFunction } from 'express';
import { UserService, UserServiceContext, AssignRoleRequest } from '../services/user.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAssignRoles, requireSuperAdmin, Role } from '../middleware/authorization.middleware';
import { tenantMiddleware, requireTenant } from '../middleware/tenant.middleware';
import { AuthenticatedUser } from '../types';

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
 * GET /api/users - List all users in tenant (super admin only)
 */
router.get('/', requireSuperAdmin, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthenticatedUser;
  const context: UserServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const users = await UserService.getUsers(context);

  res.json({
    users,
    count: users.length,
  });
}));

/**
 * GET /api/users/:id - Get user by ID (super admin only)
 */
router.get('/:id', requireSuperAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'Invalid user ID format',
        requestId: req.headers['x-request-id'],
      },
    });
  }

  const user = req.user as AuthenticatedUser;
  const context: UserServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const targetUser = await UserService.getUserById(id, context);

  res.json({
    user: targetUser,
  });
}));

/**
 * POST /api/users/:id/assign-role - Assign role to user (super admin only)
 */
router.post('/:id/assign-role', requireAssignRoles, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  // Validate UUID format
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'Invalid user ID format',
        requestId: req.headers['x-request-id'],
      },
    });
  }

  // Validate role
  if (!role || !Object.values(Role).includes(role)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid role specified',
        details: `Role must be one of: ${Object.values(Role).join(', ')}`,
        requestId: req.headers['x-request-id'],
      },
    });
  }

  const user = req.user as AuthenticatedUser;
  const context: UserServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const request: AssignRoleRequest = {
    userId: id,
    role: role as Role,
  };

  const updatedUser = await UserService.assignRole(request, context);

  res.json({
    user: updatedUser,
    message: `Role successfully assigned to ${updatedUser.email}`,
  });
}));

/**
 * POST /api/users/:id/deactivate - Deactivate user (super admin only)
 */
router.post('/:id/deactivate', requireSuperAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'Invalid user ID format',
        requestId: req.headers['x-request-id'],
      },
    });
  }

  const user = req.user as AuthenticatedUser;
  const context: UserServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  // Prevent self-deactivation
  if (id === user.id) {
    return res.status(400).json({
      error: {
        code: 'INVALID_OPERATION',
        message: 'Cannot deactivate your own account',
        requestId: req.headers['x-request-id'],
      },
    });
  }

  const deactivatedUser = await UserService.deactivateUser(id, context);

  res.json({
    user: deactivatedUser,
    message: `User ${deactivatedUser.email} has been deactivated`,
  });
}));

/**
 * POST /api/users/:id/reactivate - Reactivate user (super admin only)
 */
router.post('/:id/reactivate', requireSuperAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  // Validate UUID format
  if (!id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_ID',
        message: 'Invalid user ID format',
        requestId: req.headers['x-request-id'],
      },
    });
  }

  const user = req.user as AuthenticatedUser;
  const context: UserServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const reactivatedUser = await UserService.reactivateUser(id, context);

  res.json({
    user: reactivatedUser,
    message: `User ${reactivatedUser.email} has been reactivated`,
  });
}));

/**
 * GET /api/users/statistics - Get role statistics (super admin only)
 */
router.get('/statistics', requireSuperAdmin, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as AuthenticatedUser;
  const context: UserServiceContext = {
    tenantId: req.tenant!.id,
    userId: user?.id,
    userRole: user?.role,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  };

  const statistics = await UserService.getRoleStatistics(context);

  res.json({
    statistics,
  });
}));

export default router;