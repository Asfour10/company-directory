import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { Role } from './authorization.middleware';

const authService = new AuthService();

/**
 * Middleware to authenticate JWT tokens
 */
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Access token required',
          requestId: req.id,
        },
      });
      return;
    }

    // Validate JWT token
    const payload = authService.validateToken(token);

    // Validate session exists in database
    const sessionValid = await authService.validateSession(token);
    if (!sessionValid) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session expired or invalid',
          requestId: req.id,
        },
      });
      return;
    }

    // Get user information
    const user = await authService.getUserById(payload.userId);
    if (!user || !user.isActive) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found or inactive',
          requestId: req.id,
        },
      });
      return;
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message,
        requestId: req.id,
      },
    });
  }
}

/**
 * Middleware to check if user has required role
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          requestId: req.id,
        },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
          details: `Required roles: ${roles.join(', ')}`,
          requestId: req.id,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to check if user is admin or super admin
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireRole(Role.ADMIN, Role.SUPER_ADMIN)(req, res, next);
}

/**
 * Middleware to check if user is super admin
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  return requireRole(Role.SUPER_ADMIN)(req, res, next);
}

/**
 * Optional authentication - adds user to request if token is valid, but doesn't require it
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const payload = authService.validateToken(token);
      const sessionValid = await authService.validateSession(token);
      
      if (sessionValid) {
        const user = await authService.getUserById(payload.userId);
        if (user && user.isActive) {
          req.user = user;
        }
      }
    }
  } catch (error) {
    // Ignore errors in optional auth
  }
  
  next();
}