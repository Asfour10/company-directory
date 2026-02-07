import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import * as dotenv from 'dotenv';
import { AuthService } from './services/auth.service';
import { EmployeeService } from './services/employee.service';
import { prisma } from './lib/database';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const authService = new AuthService();

// Basic middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'company-directory-backend'
  });
});

// Basic API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Company Directory API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api',
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      validate: '/api/auth/validate',
      me: '/api/auth/me',
      employees: '/api/employees',
      employeeById: '/api/employees/:id',
      departments: '/api/employees/departments',
      titles: '/api/employees/titles'
    }
  });
});

// Authentication endpoints
/**
 * POST /api/auth/login - Basic login endpoint
 * For simplified demo, accepts any email/password combination
 * In production, this would validate against a user database
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Email and password are required',
        },
      });
    }

    // For simplified demo, create a mock user
    // In production, this would validate credentials against database
    const mockUser = {
      id: 'demo-user-' + Date.now(),
      tenantId: 'demo-tenant',
      email: email,
      role: email.includes('admin') ? 'admin' : 'user',
      isActive: true,
    };

    // Generate JWT token
    const token = authService.generateToken(
      mockUser.id,
      mockUser.tenantId,
      mockUser.email,
      mockUser.role
    );

    // Create session
    await authService.createSession(mockUser.id, token);

    res.json({
      accessToken: token,
      user: mockUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Login failed',
      },
    });
  }
});

/**
 * POST /api/auth/logout - Logout endpoint
 */
app.post('/api/auth/logout', async (req, res) => {
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
    console.error('Logout error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Logout failed',
      },
    });
  }
});

/**
 * GET /api/auth/validate - Token validation endpoint
 */
app.get('/api/auth/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No token provided',
        },
      });
    }

    // Validate token
    const decoded = authService.validateToken(token);
    
    // Check session validity
    const isValidSession = await authService.validateSession(token);
    
    if (!isValidSession) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid session',
        },
      });
    }

    res.json({
      valid: true,
      user: {
        id: decoded.userId,
        tenantId: decoded.tenantId,
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      },
    });
  }
});

/**
 * GET /api/auth/me - Get current user information
 */
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No token provided',
        },
      });
    }

    // Validate token
    const decoded = authService.validateToken(token);
    
    // Check session validity
    const isValidSession = await authService.validateSession(token);
    
    if (!isValidSession) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid session',
        },
      });
    }

    res.json({
      user: {
        id: decoded.userId,
        tenantId: decoded.tenantId,
        email: decoded.email,
        role: decoded.role,
        isActive: true,
      },
    });
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      },
    });
  }
});

// Middleware to validate authentication for protected routes
const authenticateToken = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No token provided',
        },
      });
    }

    // Validate token
    const decoded = authService.validateToken(token);
    
    // Check session validity
    const isValidSession = await authService.validateSession(token);
    
    if (!isValidSession) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid session',
        },
      });
    }

    // Add user info to request
    req.user = {
      id: decoded.userId,
      tenantId: decoded.tenantId,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid token',
      },
    });
  }
};

// Employee endpoints
/**
 * GET /api/employees - List employees with pagination and filtering
 */
app.get('/api/employees', authenticateToken, async (req: any, res) => {
  try {
    const { page = 1, pageSize = 20, search, department, title } = req.query;
    
    const context = {
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };

    const filters = {
      search: search || undefined,
      department: department || undefined,
      title: title || undefined,
      isActive: true,
    };

    const pagination = {
      page: parseInt(page as string, 10),
      pageSize: parseInt(pageSize as string, 10),
      sortBy: 'lastName',
      sortOrder: 'asc' as const,
    };

    const result = await EmployeeService.listEmployees(filters, pagination, context);

    res.json(result);
  } catch (error) {
    console.error('Employee listing error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch employees',
      },
    });
  }
});

/**
 * GET /api/employees/:id - Get employee by ID
 */
app.get('/api/employees/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const context = {
      tenantId: req.user.tenantId,
      userId: req.user.id,
      userRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    };

    const employee = await EmployeeService.getEmployeeById(id, context);

    res.json(employee);
  } catch (error) {
    console.error('Employee fetch error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Employee not found',
        },
      });
    } else {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch employee',
        },
      });
    }
  }
});

/**
 * GET /api/employees/departments - Get list of departments
 */
app.get('/api/employees/departments', authenticateToken, async (req: any, res) => {
  try {
    // For simplified demo, return mock departments
    // In production, this would query the database for unique departments
    const departments = [
      'Engineering',
      'Product',
      'Design',
      'Marketing',
      'Sales',
      'Human Resources',
      'Finance',
      'Operations',
      'Customer Success',
      'Legal'
    ];

    res.json({
      departments: departments.sort()
    });
  } catch (error) {
    console.error('Departments fetch error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch departments',
      },
    });
  }
});

/**
 * GET /api/employees/titles - Get list of job titles
 */
app.get('/api/employees/titles', authenticateToken, async (req: any, res) => {
  try {
    // For simplified demo, return mock titles
    // In production, this would query the database for unique titles
    const titles = [
      'Software Engineer',
      'Senior Software Engineer',
      'Staff Software Engineer',
      'Principal Software Engineer',
      'Engineering Manager',
      'Senior Engineering Manager',
      'Director of Engineering',
      'VP of Engineering',
      'Product Manager',
      'Senior Product Manager',
      'Principal Product Manager',
      'Director of Product',
      'VP of Product',
      'UX Designer',
      'Senior UX Designer',
      'Principal UX Designer',
      'Design Manager',
      'Marketing Manager',
      'Senior Marketing Manager',
      'Marketing Director',
      'Sales Representative',
      'Senior Sales Representative',
      'Sales Manager',
      'Sales Director',
      'HR Generalist',
      'Senior HR Generalist',
      'HR Manager',
      'HR Director',
      'Financial Analyst',
      'Senior Financial Analyst',
      'Finance Manager',
      'Finance Director',
      'Operations Manager',
      'Operations Director',
      'Customer Success Manager',
      'Senior Customer Success Manager',
      'Legal Counsel',
      'Senior Legal Counsel'
    ];

    res.json({
      titles: titles.sort()
    });
  } catch (error) {
    console.error('Titles fetch error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch titles',
      },
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Company Directory Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 API info: http://localhost:${PORT}/api`);
  console.log(`🔐 Authentication endpoints:`);
  console.log(`   POST /api/auth/login`);
  console.log(`   POST /api/auth/logout`);
  console.log(`   GET /api/auth/validate`);
  console.log(`   GET /api/auth/me`);
  console.log(`👥 Employee endpoints:`);
  console.log(`   GET /api/employees`);
  console.log(`   GET /api/employees/:id`);
});