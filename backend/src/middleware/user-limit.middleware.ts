import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscription.service';
import { UserLimitExceededError } from '../utils/errors';

/**
 * Middleware to check user limits before creating employees
 */
export const checkEmployeeLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant not found' });
    }

    const limitCheck = await subscriptionService.canAddEmployee(tenantId);
    
    if (!limitCheck.canAdd) {
      return res.status(402).json({
        error: 'Employee limit exceeded',
        message: limitCheck.message,
        currentCount: limitCheck.currentCount,
        limit: limitCheck.limit,
        upgradeRequired: true,
        upgradeUrl: `/admin/billing/upgrade`,
      });
    }

    // Add usage info to request for potential warnings
    req.usageInfo = {
      currentCount: limitCheck.currentCount,
      limit: limitCheck.limit,
      usagePercentage: Math.round((limitCheck.currentCount / limitCheck.limit) * 100),
    };

    next();
  } catch (error) {
    console.error('Error checking employee limit:', error);
    res.status(500).json({ error: 'Failed to check employee limit' });
  }
};

/**
 * Middleware to check user limits before creating users
 */
export const checkUserLimit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant not found' });
    }

    const limitCheck = await subscriptionService.canAddUser(tenantId);
    
    if (!limitCheck.canAdd) {
      return res.status(402).json({
        error: 'User limit exceeded',
        message: limitCheck.message,
        currentCount: limitCheck.currentCount,
        limit: limitCheck.limit,
        upgradeRequired: true,
        upgradeUrl: `/admin/billing/upgrade`,
      });
    }

    // Add usage info to request for potential warnings
    req.usageInfo = {
      currentCount: limitCheck.currentCount,
      limit: limitCheck.limit,
      usagePercentage: Math.round((limitCheck.currentCount / limitCheck.limit) * 100),
    };

    next();
  } catch (error) {
    console.error('Error checking user limit:', error);
    res.status(500).json({ error: 'Failed to check user limit' });
  }
};

/**
 * Middleware to add usage warnings to responses
 */
export const addUsageWarnings = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  
  res.json = function(data: any) {
    if (req.usageInfo && req.usageInfo.usagePercentage >= 80) {
      data = {
        ...data,
        usageWarning: {
          message: `You are using ${req.usageInfo.usagePercentage}% of your user limit (${req.usageInfo.currentCount}/${req.usageInfo.limit}). Consider upgrading your subscription.`,
          usagePercentage: req.usageInfo.usagePercentage,
          upgradeUrl: `/admin/billing/upgrade`,
        },
      };
    }
    
    return originalJson.call(this, data);
  };
  
  next();
};

// Extend Request interface to include usage info
declare global {
  namespace Express {
    interface Request {
      usageInfo?: {
        currentCount: number;
        limit: number;
        usagePercentage: number;
      };
    }
  }
}