import { Router, Request, Response, NextFunction } from 'express';
import { SCIMService, SCIMServiceContext } from '../services/scim.service';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors';
import { SCIMUser, SCIMListResponse, SCIM_ERROR_TYPES } from '../types/scim.types';
import {
  scimFlexibleAuthMiddleware,
  scimContentTypeMiddleware,
  scimRateLimitMiddleware,
} from '../middleware/scim-auth.middleware';

const router = Router();

// Apply SCIM middleware to all routes
router.use(scimContentTypeMiddleware);
router.use(scimFlexibleAuthMiddleware);
router.use(scimRateLimitMiddleware);

/**
 * Helper to create SCIM service context from request
 */
function createSCIMContext(req: Request): SCIMServiceContext {
  return {
    tenantId: req.tenant!.id,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    scimClientId: req.user?.id || 'scim-client', // Will be set by SCIM auth middleware
  };
}

/**
 * Helper to handle SCIM errors
 */
function handleSCIMError(error: any, res: Response) {
  if (error instanceof ValidationError) {
    return res.status(400).json(
      SCIMService.createError(400, SCIM_ERROR_TYPES.INVALID_VALUE, error.message)
    );
  }

  if (error instanceof NotFoundError) {
    return res.status(404).json(
      SCIMService.createError(404, SCIM_ERROR_TYPES.NO_TARGET, error.message)
    );
  }

  if (error instanceof ConflictError) {
    return res.status(409).json(
      SCIMService.createError(409, SCIM_ERROR_TYPES.UNIQUENESS, error.message)
    );
  }

  // Generic server error
  console.error('SCIM Error:', error);
  return res.status(500).json(
    SCIMService.createError(500, undefined, 'Internal server error')
  );
}

/**
 * POST /scim/v2/Users - Create user
 */
router.post('/Users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scimUser: SCIMUser = req.body;
    const context = createSCIMContext(req);

    const createdUser = await SCIMService.createUser(scimUser, context);

    res.status(201).json(createdUser);
  } catch (error) {
    handleSCIMError(error, res);
  }
});

/**
 * GET /scim/v2/Users/:id - Get user by ID
 */
router.get('/Users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const context = createSCIMContext(req);

    const user = await SCIMService.getUserById(id, context);

    res.json(user);
  } catch (error) {
    handleSCIMError(error, res);
  }
});

/**
 * PUT /scim/v2/Users/:id - Update user
 */
router.put('/Users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const scimUser: SCIMUser = req.body;
    const context = createSCIMContext(req);

    const updatedUser = await SCIMService.updateUser(id, scimUser, context);

    res.json(updatedUser);
  } catch (error) {
    handleSCIMError(error, res);
  }
});

/**
 * DELETE /scim/v2/Users/:id - Deactivate user
 */
router.delete('/Users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const context = createSCIMContext(req);

    await SCIMService.deactivateUser(id, context);

    res.status(204).send();
  } catch (error) {
    handleSCIMError(error, res);
  }
});

/**
 * GET /scim/v2/Users - List users with pagination and filtering
 */
router.get('/Users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const context = createSCIMContext(req);
    
    // Parse SCIM query parameters
    const startIndex = parseInt(req.query.startIndex as string) || 1;
    const count = parseInt(req.query.count as string) || 100;
    const filter = req.query.filter as string;

    const result = await SCIMService.listUsers(context, {
      startIndex,
      count,
      filter,
    });

    res.json(result);
  } catch (error) {
    handleSCIMError(error, res);
  }
});

/**
 * PATCH /scim/v2/Users/:id - Partial update user (optional SCIM operation)
 */
router.patch('/Users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // For now, we'll implement PATCH as a full update
    // A complete PATCH implementation would handle the Operations array
    const { id } = req.params;
    const scimUser: SCIMUser = req.body;
    const context = createSCIMContext(req);

    const updatedUser = await SCIMService.updateUser(id, scimUser, context);

    res.json(updatedUser);
  } catch (error) {
    handleSCIMError(error, res);
  }
});

/**
 * GET /scim/v2/ServiceProviderConfig - SCIM service provider configuration
 */
router.get('/ServiceProviderConfig', (req: Request, res: Response) => {
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://docs.company-directory.com/scim',
    patch: {
      supported: true,
    },
    bulk: {
      supported: false,
      maxOperations: 0,
      maxPayloadSize: 0,
    },
    filter: {
      supported: true,
      maxResults: 1000,
    },
    changePassword: {
      supported: false,
    },
    sort: {
      supported: false,
    },
    etag: {
      supported: false,
    },
    authenticationSchemes: [
      {
        type: 'httpbasic',
        name: 'HTTP Basic',
        description: 'Authentication scheme using HTTP Basic',
        specUri: 'http://www.rfc-editor.org/info/rfc2617',
        documentationUri: 'https://docs.company-directory.com/scim/auth',
      },
      {
        type: 'oauthbearertoken',
        name: 'OAuth Bearer Token',
        description: 'Authentication scheme using OAuth Bearer Token',
        specUri: 'http://www.rfc-editor.org/info/rfc6750',
        documentationUri: 'https://docs.company-directory.com/scim/auth',
      },
    ],
  });
});

/**
 * GET /scim/v2/Schemas - SCIM schemas
 */
router.get('/Schemas', (req: Request, res: Response) => {
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 2,
    startIndex: 1,
    itemsPerPage: 2,
    Resources: [
      {
        id: 'urn:ietf:params:scim:schemas:core:2.0:User',
        name: 'User',
        description: 'User Account',
        attributes: [
          {
            name: 'userName',
            type: 'string',
            multiValued: false,
            description: 'Unique identifier for the User',
            required: true,
            caseExact: false,
            mutability: 'readWrite',
            returned: 'default',
            uniqueness: 'server',
          },
          {
            name: 'name',
            type: 'complex',
            multiValued: false,
            description: 'The components of the user\'s real name',
            required: false,
            subAttributes: [
              {
                name: 'givenName',
                type: 'string',
                multiValued: false,
                description: 'The given name of the User',
                required: false,
                caseExact: false,
                mutability: 'readWrite',
                returned: 'default',
                uniqueness: 'none',
              },
              {
                name: 'familyName',
                type: 'string',
                multiValued: false,
                description: 'The family name of the User',
                required: false,
                caseExact: false,
                mutability: 'readWrite',
                returned: 'default',
                uniqueness: 'none',
              },
            ],
          },
          {
            name: 'emails',
            type: 'complex',
            multiValued: true,
            description: 'Email addresses for the user',
            required: false,
            subAttributes: [
              {
                name: 'value',
                type: 'string',
                multiValued: false,
                description: 'Email addresses for the user',
                required: false,
                caseExact: false,
                mutability: 'readWrite',
                returned: 'default',
                uniqueness: 'none',
              },
              {
                name: 'primary',
                type: 'boolean',
                multiValued: false,
                description: 'A Boolean value indicating the primary email address',
                required: false,
                mutability: 'readWrite',
                returned: 'default',
              },
            ],
          },
        ],
        meta: {
          resourceType: 'Schema',
          location: '/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User',
        },
      },
      {
        id: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
        name: 'EnterpriseUser',
        description: 'Enterprise User',
        attributes: [
          {
            name: 'department',
            type: 'string',
            multiValued: false,
            description: 'Identifies the name of a department',
            required: false,
            caseExact: false,
            mutability: 'readWrite',
            returned: 'default',
            uniqueness: 'none',
          },
          {
            name: 'manager',
            type: 'complex',
            multiValued: false,
            description: 'The User\'s manager',
            required: false,
            subAttributes: [
              {
                name: 'value',
                type: 'string',
                multiValued: false,
                description: 'The id of the SCIM resource representing the User\'s manager',
                required: false,
                caseExact: false,
                mutability: 'readWrite',
                returned: 'default',
                uniqueness: 'none',
              },
            ],
          },
        ],
        meta: {
          resourceType: 'Schema',
          location: '/scim/v2/Schemas/urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
        },
      },
    ],
  });
});

/**
 * GET /scim/v2/ResourceTypes - SCIM resource types
 */
router.get('/ResourceTypes', (req: Request, res: Response) => {
  res.json({
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: 1,
    startIndex: 1,
    itemsPerPage: 1,
    Resources: [
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        description: 'User Account',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:User',
        schemaExtensions: [
          {
            schema: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
            required: false,
          },
        ],
        meta: {
          location: '/scim/v2/ResourceTypes/User',
          resourceType: 'ResourceType',
        },
      },
    ],
  });
});

export default router;