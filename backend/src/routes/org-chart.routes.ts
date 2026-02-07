import { Router } from 'express';
import { OrgChartService } from '../services/org-chart.service';
import { authenticateToken } from '../middleware/auth.middleware';
import { tenantMiddleware, requireTenant } from '../middleware/tenant.middleware';
import { errorHandler } from '../middleware/error.middleware';
import { ValidationError } from '../utils/errors';

const router = Router();

// Apply middleware to all routes
router.use(authenticateToken);
router.use(tenantMiddleware);
router.use(requireTenant);

/**
 * GET /api/org-chart
 * Get complete organizational chart for the tenant
 */
router.get('/', async (req, res, next) => {
  try {
    const context = {
      tenantId: req.tenant.id,
      userId: req.user?.id,
      userRole: req.user?.role,
    };

    const orgChart = await OrgChartService.getOrganizationalChart(context);

    res.json({
      success: true,
      data: {
        orgChart,
        metadata: {
          totalNodes: countTotalNodes(orgChart),
          rootNodes: orgChart.length,
          maxDepth: calculateMaxDepth(orgChart),
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/org-chart/employee/:employeeId
 * Get organizational chart starting from a specific employee
 */
router.get('/employee/:employeeId', async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      throw new ValidationError('Employee ID is required', 'employeeId');
    }

    const context = {
      tenantId: req.tenant.id,
      userId: req.user?.id,
      userRole: req.user?.role,
    };

    const employeeNode = await OrgChartService.getOrganizationalChartFromEmployee(
      employeeId,
      context
    );

    res.json({
      success: true,
      data: {
        employee: employeeNode,
        metadata: {
          totalChildren: countTotalNodes([employeeNode]) - 1, // Subtract the root node
          level: employeeNode.level,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/org-chart/management-chain/:employeeId
 * Get management chain for a specific employee
 */
router.get('/management-chain/:employeeId', async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      throw new ValidationError('Employee ID is required', 'employeeId');
    }

    const context = {
      tenantId: req.tenant.id,
      userId: req.user?.id,
      userRole: req.user?.role,
    };

    const managementChain = await OrgChartService.getManagementChain(employeeId, context);

    res.json({
      success: true,
      data: {
        managementChain,
        metadata: {
          chainLength: managementChain.length,
          employeeId,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/org-chart/direct-reports/:employeeId
 * Get direct reports for a specific employee
 */
router.get('/direct-reports/:employeeId', async (req, res, next) => {
  try {
    const { employeeId } = req.params;

    if (!employeeId) {
      throw new ValidationError('Employee ID is required', 'employeeId');
    }

    const context = {
      tenantId: req.tenant.id,
      userId: req.user?.id,
      userRole: req.user?.role,
    };

    const directReports = await OrgChartService.getDirectReports(employeeId, context);

    res.json({
      success: true,
      data: {
        directReports,
        metadata: {
          reportsCount: directReports.length,
          managerId: employeeId,
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/org-chart/stats
 * Get organizational statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const context = {
      tenantId: req.tenant.id,
      userId: req.user?.id,
      userRole: req.user?.role,
    };

    const stats = await OrgChartService.getOrganizationalStats(context);

    res.json({
      success: true,
      data: {
        stats,
        metadata: {
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/org-chart/validate
 * Validate organizational structure integrity
 */
router.get('/validate', async (req, res, next) => {
  try {
    const context = {
      tenantId: req.tenant.id,
      userId: req.user?.id,
      userRole: req.user?.role,
    };

    const validation = await OrgChartService.validateOrganizationalStructure(context);

    res.json({
      success: true,
      data: validation,
    });
  } catch (error) {
    next(error);
  }
});

// Helper functions
function countTotalNodes(nodes: any[]): number {
  let count = nodes.length;
  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      count += countTotalNodes(node.children);
    }
  });
  return count;
}

function calculateMaxDepth(nodes: any[]): number {
  if (nodes.length === 0) return 0;

  let maxDepth = 0;
  nodes.forEach(node => {
    const childDepth = node.children ? calculateMaxDepth(node.children) : 0;
    maxDepth = Math.max(maxDepth, 1 + childDepth);
  });

  return maxDepth;
}

// Apply error handling middleware
router.use(errorHandler);

export default router;