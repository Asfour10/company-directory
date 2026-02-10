import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
// import passport from 'passport'; // Disabled for basic deployment
import { AuthService } from '../services/auth.service';
// import { SSOService } from '../services/sso.service'; // Disabled for basic deployment
import { authenticateToken } from '../middleware/auth.middleware';
import { prisma } from '../lib/database';
import { AppError } from '../utils/errors';

const router = Router();
const authService = new AuthService();
// const ssoService = new SSOService(); // Disabled for basic deployment

/**
 * POST /api/auth/login - Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      throw new AppError('Email and password are required', 400, 'BAD_REQUEST');
    }

    // Find user by email
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      include: { tenant: true },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'UNAUTHORIZED');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is inactive', 403, 'FORBIDDEN');
    }

    // Verify password
    if (!user.passwordHash) {
      throw new AppError('Password authentication not configured for this user', 401, 'UNAUTHORIZED');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401, 'UNAUTHORIZED');
    }

    // Generate tokens
    const accessToken = authService.generateToken(user.id, user.tenantId, user.email, user.role);
    const refreshToken = authService.generateRefreshToken(user.id);

    // Create session
    await authService.createSession(user.id, accessToken);

    // Update last login
    await authService.updateLastLogin(user.id);

    // Return user data and tokens
    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    // Log the full error for debugging
    console.error('Login error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error: error
    });
    
    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          requestId: req.id,
        },
      });
    }
    
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Login failed',
        requestId: req.id,
      },
    });
  }
});

/**
 * GET /api/auth/me - Get current user information
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    res.json({
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get user information',
        requestId: req.id,
      },
    });
  }
});

/**
 * POST /api/auth/token/refresh - Refresh access token
 */
router.post('/token/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Refresh token required',
          requestId: req.id,
        },
      });
    }

    const result = await authService.refreshToken(refreshToken);

    res.json({
      accessToken: result.accessToken,
      user: result.user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token refresh failed';
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message,
        requestId: req.id,
      },
    });
  }
});

/**
 * POST /api/auth/logout - Logout and invalidate session
 */
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      await authService.invalidateSession(token);
    }

    res.json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed',
        requestId: req.id,
      },
    });
  }
});

// SSO routes disabled for basic deployment
/*
/**
 * GET /api/auth/sso/providers - Get available SSO providers
 *\/
router.get('/sso/providers', (req: Request, res: Response) => {
  const providers = ssoService.getAvailableProviders();
  res.json({ providers });
});

/**
 * GET /api/auth/sso/:provider/login - Initiate SSO login
 *\/
router.get('/sso/:provider/login', async (req: Request, res: Response, next) => {
  try {
    const { provider } = req.params;
    const { tenant: tenantSubdomain } = req.query;

    if (!tenantSubdomain) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Tenant parameter required',
          requestId: req.id,
        },
      });
    }

    // Get tenant information
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain: tenantSubdomain as string },
    });

    if (!tenant) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Tenant not found',
          requestId: req.id,
        },
      });
    }

    // Validate SSO provider is configured for this tenant
    const isValidProvider = await ssoService.validateSSOProvider(tenant.id, provider);
    if (!isValidProvider) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'SSO provider not configured for this tenant',
          requestId: req.id,
        },
      });
    }

    // Add tenant to request for passport strategy
    req.tenant = tenant;

    // Initiate SSO flow
    passport.authenticate(provider)(req, res, next);
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'SSO login initiation failed',
        requestId: req.id,
      },
    });
  }
});

/**
 * POST /api/auth/sso/:provider/callback - Handle SSO callback
 *\/
router.post('/sso/:provider/callback', (req: Request, res: Response, next) => {
  const { provider } = req.params;

  passport.authenticate(provider, async (err: any, user: any) => {
    try {
      if (err) {
        return res.status(400).json({
          error: {
            code: 'SSO_ERROR',
            message: err.message || 'SSO authentication failed',
            requestId: req.id,
          },
        });
      }

      if (!user) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'SSO authentication failed',
            requestId: req.id,
          },
        });
      }

      // Generate tokens
      const tokens = await ssoService.handleSSOCallback(user);

      // In production, you might want to redirect to frontend with tokens
      // For API-only response:
      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user,
      });
    } catch (error) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'SSO callback processing failed',
          requestId: req.id,
        },
      });
    }
  })(req, res, next);
});

/**
 * GET /api/auth/sso/:provider/callback - Handle SSO callback (GET method for some providers)
 *\/
router.get('/sso/:provider/callback', (req: Request, res: Response, next) => {
  const { provider } = req.params;

  passport.authenticate(provider, async (err: any, user: any) => {
    try {
      if (err || !user) {
        // Redirect to frontend with error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        return res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(err?.message || 'Authentication failed')}`);
      }

      // Generate tokens
      const tokens = await ssoService.handleSSOCallback(user);

      // Redirect to frontend with tokens (in production, use secure cookies or other secure method)
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent('Authentication processing failed')}`);
    }
  })(req, res, next);
});
*/

export default router;