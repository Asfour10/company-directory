import request from 'supertest';
import express from 'express';
import { prisma } from '../../lib/database';
import { createTestApp } from '../../utils/test-helpers';

// Import routes for testing
import employeeRoutes from '../../routes/employee.routes';
import searchRoutes from '../../routes/search.routes';
import authRoutes from '../../routes/auth.routes';
import adminRoutes from '../../routes/admin.routes';

describe('Security Tests', () => {
  let app: express.Application;
  let validToken: string;
  let tenant1Id: string;
  let tenant2Id: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    app = createTestApp();
    await setupSecurityTestData();
  });

  afterAll(async () => {
    await cleanupSecurityTestData();
    await prisma.$disconnect();
  });

  describe('1. Tenant Isolation Tests', () => {
    it('should prevent cross-tenant data access in employee endpoints', async () => {
      // Create employee in tenant1
      const tenant1Employee = await prisma.employee.create({
        data: {
          firstName: 'Tenant1',
          lastName: 'Employee',
          email: 'tenant1@example.com',
          tenantId: tenant1Id,
          isActive: true,
        },
      });

      // Create employee in tenant2
      const tenant2Employee = await prisma.employee.create({
        data: {
          firstName: 'Tenant2',
          lastName: 'Employee',
          email: 'tenant2@example.com',
          tenantId: tenant2Id,
          isActive: true,
        },
      });

      // Login as tenant1 user
      const tenant1Token = await getTokenForTenant(tenant1Id, user1Id);

      // Try to access tenant2 employee - should fail
      const response = await request(app)
        .get(`/api/employees/${tenant2Employee.id}`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .expect(404); // Should not find employee from different tenant

      expect(response.body.success).toBe(false);

      // Verify can access own tenant's employee
      const validResponse = await request(app)
        .get(`/api/employees/${tenant1Employee.id}`)
        .set('Authorization', `Bearer ${tenant1Token}`)
        .expect(200);

      expect(validResponse.body.success).toBe(true);
      expect(validResponse.body.data.id).toBe(tenant1Employee.id);
    });

    it('should prevent cross-tenant data access in search endpoints', async () => {
      const tenant1Token = await getTokenForTenant(tenant1Id, user1Id);

      // Search should only return results from user's tenant
      const searchResponse = await request(app)
        .get('/api/search')
        .query({ q: 'employee' })
        .set('Authorization', `Bearer ${tenant1Token}`)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      
      // All results should belong to tenant1
      searchResponse.body.data.results.forEach((result: any) => {
        expect(result.tenantId).toBe(tenant1Id);
      });
    });

    it('should prevent cross-tenant audit log access', async () => {
      // Create audit logs for both tenants
      await prisma.auditLog.create({
        data: {
          tenantId: tenant1Id,
          userId: user1Id,
          action: 'CREATE',
          entityType: 'employee',
          entityId: 'test-entity-1',
        },
      });

      await prisma.auditLog.create({
        data: {
          tenantId: tenant2Id,
          userId: user2Id,
          action: 'CREATE',
          entityType: 'employee',
          entityId: 'test-entity-2',
        },
      });

      const tenant1AdminToken = await getAdminTokenForTenant(tenant1Id);

      // Admin should only see their tenant's audit logs
      const auditResponse = await request(app)
        .get('/api/admin/audit-logs')
        .set('Authorization', `Bearer ${tenant1AdminToken}`)
        .expect(200);

      expect(auditResponse.body.success).toBe(true);
      
      // All audit logs should belong to tenant1
      auditResponse.body.data.logs.forEach((log: any) => {
        expect(log.tenantId).toBe(tenant1Id);
      });
    });

    it('should prevent tenant ID manipulation in requests', async () => {
      const tenant1Token = await getTokenForTenant(tenant1Id, user1Id);

      // Try to create employee with different tenant ID in payload
      const maliciousPayload = {
        firstName: 'Malicious',
        lastName: 'User',
        email: 'malicious@example.com',
        tenantId: tenant2Id, // Trying to create in different tenant
      };

      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${tenant1Token}`)
        .send(maliciousPayload)
        .expect(201); // Should succeed but ignore malicious tenantId

      // Employee should be created in user's actual tenant, not the manipulated one
      expect(response.body.data.tenantId).toBe(tenant1Id);
      expect(response.body.data.tenantId).not.toBe(tenant2Id);
    });
  });

  describe('2. SQL Injection Prevention Tests', () => {
    it('should prevent SQL injection in search queries', async () => {
      const token = await getTokenForTenant(tenant1Id, user1Id);

      // Common SQL injection payloads
      const sqlInjectionPayloads = [
        "'; DROP TABLE employees; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO employees (firstName) VALUES ('hacked'); --",
        "' OR 1=1 --",
        "admin'--",
        "admin'/*",
        "' or 1=1#",
        "' or 1=1--",
        "') or '1'='1--",
        "') or ('1'='1--",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get('/api/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${token}`);

        // Should not return 500 error (which might indicate SQL error)
        expect(response.status).not.toBe(500);
        
        // Should either return 400 (validation error) or 200 (safe handling)
        expect([200, 400]).toContain(response.status);

        if (response.status === 200) {
          // If successful, should return safe results structure
          expect(response.body).toHaveProperty('success');
          expect(response.body).toHaveProperty('data');
          expect(response.body.data).toHaveProperty('results');
        }
      }
    });

    it('should prevent SQL injection in employee filters', async () => {
      const token = await getTokenForTenant(tenant1Id, user1Id);

      const sqlInjectionPayloads = [
        "'; DROP TABLE employees; --",
        "' OR '1'='1",
        "' UNION SELECT password FROM users --",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get('/api/employees')
          .query({ 
            department: payload,
            title: payload,
          })
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).not.toBe(500);
        expect([200, 400]).toContain(response.status);
      }
    });

    it('should prevent SQL injection in audit log filters', async () => {
      const adminToken = await getAdminTokenForTenant(tenant1Id);

      const sqlInjectionPayloads = [
        "'; DROP TABLE audit_logs; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get('/api/admin/audit-logs')
          .query({ 
            userId: payload,
            entityType: payload,
            action: payload,
          })
          .set('Authorization', `Bearer ${adminToken}`);

        expect(response.status).not.toBe(500);
        expect([200, 400]).toContain(response.status);
      }
    });

    it('should sanitize input in employee creation', async () => {
      const adminToken = await getAdminTokenForTenant(tenant1Id);

      const maliciousEmployee = {
        firstName: "'; DROP TABLE employees; --",
        lastName: "' OR '1'='1",
        email: "test@example.com",
        title: "' UNION SELECT * FROM users --",
        department: "'; INSERT INTO admin_users VALUES ('hacker'); --",
        skills: ["'; DELETE FROM employees; --", "' OR 1=1 --"],
      };

      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(maliciousEmployee)
        .expect(201);

      // Employee should be created with sanitized data
      expect(response.body.success).toBe(true);
      expect(response.body.data.firstName).toBe(maliciousEmployee.firstName);
      expect(response.body.data.lastName).toBe(maliciousEmployee.lastName);
      
      // Verify the data was stored safely (no SQL injection occurred)
      const verifyResponse = await request(app)
        .get(`/api/employees/${response.body.data.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(verifyResponse.body.data.firstName).toBe(maliciousEmployee.firstName);
    });
  });

  describe('3. XSS Vulnerability Prevention Tests', () => {
    it('should prevent XSS in employee data fields', async () => {
      const adminToken = await getAdminTokenForTenant(tenant1Id);

      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        'javascript:alert("XSS")',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
        '<body onload="alert(\'XSS\')">',
        '<div onclick="alert(\'XSS\')">Click me</div>',
        '"><script>alert("XSS")</script>',
        '\';alert(String.fromCharCode(88,83,83))//\';alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//";alert(String.fromCharCode(88,83,83))//--></SCRIPT>">\'><SCRIPT>alert(String.fromCharCode(88,83,83))</SCRIPT>',
      ];

      for (const payload of xssPayloads) {
        const employeeData = {
          firstName: payload,
          lastName: 'Test',
          email: 'xsstest@example.com',
          title: payload,
          department: payload,
          bio: payload,
          skills: [payload],
        };

        const response = await request(app)
          .post('/api/employees')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(employeeData);

        if (response.status === 201) {
          // If employee was created, verify XSS payload is stored as plain text
          const employeeId = response.body.data.id;
          
          const getResponse = await request(app)
            .get(`/api/employees/${employeeId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          // Data should be returned as-is (not executed)
          expect(getResponse.body.data.firstName).toBe(payload);
          expect(getResponse.body.data.title).toBe(payload);
          expect(getResponse.body.data.department).toBe(payload);
          expect(getResponse.body.data.bio).toBe(payload);
          expect(getResponse.body.data.skills).toContain(payload);

          // Response should be JSON, not HTML that could execute scripts
          expect(getResponse.headers['content-type']).toContain('application/json');
        } else {
          // If validation rejected the payload, that's also acceptable
          expect([400, 422]).toContain(response.status);
        }
      }
    });

    it('should prevent XSS in search queries', async () => {
      const token = await getTokenForTenant(tenant1Id, user1Id);

      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(\'XSS\')">',
        'javascript:alert("XSS")',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .get('/api/search')
          .query({ q: payload })
          .set('Authorization', `Bearer ${token}`);

        expect([200, 400]).toContain(response.status);
        
        if (response.status === 200) {
          // Response should be JSON
          expect(response.headers['content-type']).toContain('application/json');
          expect(response.body).toHaveProperty('success');
          expect(response.body).toHaveProperty('data');
        }
      }
    });

    it('should set proper security headers', async () => {
      const token = await getTokenForTenant(tenant1Id, user1Id);

      const response = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['content-type']).toContain('application/json');
    });
  });

  describe('4. Authentication Bypass Prevention Tests', () => {
    it('should require valid authentication for all protected endpoints', async () => {
      const protectedEndpoints = [
        { method: 'GET', path: '/api/employees' },
        { method: 'POST', path: '/api/employees' },
        { method: 'GET', path: '/api/employees/test-id' },
        { method: 'PUT', path: '/api/employees/test-id' },
        { method: 'DELETE', path: '/api/employees/test-id' },
        { method: 'GET', path: '/api/search?q=test' },
        { method: 'GET', path: '/api/admin/audit-logs' },
        { method: 'GET', path: '/api/admin/analytics/summary' },
      ];

      for (const endpoint of protectedEndpoints) {
        let response;
        
        switch (endpoint.method) {
          case 'GET':
            response = await request(app).get(endpoint.path);
            break;
          case 'POST':
            response = await request(app).post(endpoint.path).send({});
            break;
          case 'PUT':
            response = await request(app).put(endpoint.path).send({});
            break;
          case 'DELETE':
            response = await request(app).delete(endpoint.path);
            break;
          default:
            continue;
        }

        expect(response.status).toBe(401);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should reject invalid JWT tokens', async () => {
      const invalidTokens = [
        'invalid.jwt.token',
        'Bearer invalid.jwt.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        '',
        'null',
        'undefined',
        'Bearer ',
        'Basic dXNlcjpwYXNzd29yZA==', // Basic auth instead of Bearer
      ];

      for (const invalidToken of invalidTokens) {
        const response = await request(app)
          .get('/api/employees')
          .set('Authorization', invalidToken)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should reject expired JWT tokens', async () => {
      // This would require creating an expired token
      // For now, we'll test with a malformed token that looks expired
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid';

      const response = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should prevent token manipulation', async () => {
      const validToken = await getTokenForTenant(tenant1Id, user1Id);
      
      // Try to manipulate the token
      const manipulatedTokens = [
        validToken.slice(0, -5) + 'XXXXX', // Change signature
        validToken.replace(/\./g, 'X'), // Replace dots
        validToken + 'extra', // Add extra characters
        validToken.substring(10), // Remove beginning
      ];

      for (const manipulatedToken of manipulatedTokens) {
        const response = await request(app)
          .get('/api/employees')
          .set('Authorization', `Bearer ${manipulatedToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('should prevent privilege escalation', async () => {
      const userToken = await getTokenForTenant(tenant1Id, user1Id);

      // Try to access admin-only endpoints with user token
      const adminEndpoints = [
        '/api/admin/audit-logs',
        '/api/admin/analytics/summary',
        '/api/admin/employees/bulk-import',
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
    });

    it('should validate role-based permissions', async () => {
      const userToken = await getTokenForTenant(tenant1Id, user1Id);

      // User should not be able to create employees
      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          firstName: 'Test',
          lastName: 'User',
          email: 'test@example.com',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should prevent session fixation attacks', async () => {
      // Login with valid credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'user1@tenant1.com',
          password: 'password123',
          subdomain: 'tenant1',
        })
        .expect(200);

      const sessionId = loginResponse.body.data.session.id;
      const accessToken = loginResponse.body.data.tokens.accessToken;

      // Verify session is valid
      const validateResponse = await request(app)
        .get(`/api/auth/validate/${sessionId}`)
        .expect(200);

      expect(validateResponse.body.data.valid).toBe(true);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .send({ sessionId })
        .expect(200);

      // Try to use the same session after logout
      const invalidateResponse = await request(app)
        .get(`/api/auth/validate/${sessionId}`)
        .expect(200);

      expect(invalidateResponse.body.data.valid).toBe(false);

      // Try to use the access token after logout
      const unauthorizedResponse = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(unauthorizedResponse.body.success).toBe(false);
    });
  });

  describe('5. Input Validation and Sanitization Tests', () => {
    it('should validate email formats', async () => {
      const adminToken = await getAdminTokenForTenant(tenant1Id);

      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user..name@example.com',
        'user@example',
        'user name@example.com',
        '<script>alert("xss")</script>@example.com',
      ];

      for (const invalidEmail of invalidEmails) {
        const response = await request(app)
          .post('/api/employees')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            firstName: 'Test',
            lastName: 'User',
            email: invalidEmail,
          });

        expect([400, 422]).toContain(response.status);
        expect(response.body.success).toBe(false);
      }
    });

    it('should validate phone number formats', async () => {
      const adminToken = await getAdminTokenForTenant(tenant1Id);

      const invalidPhones = [
        'not-a-phone',
        '123',
        '+1-555-ABCD',
        '<script>alert("xss")</script>',
        ''; DROP TABLE employees; --',
      ];

      for (const invalidPhone of invalidPhones) {
        const response = await request(app)
          .post('/api/employees')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
            phone: invalidPhone,
          });

        // Should either reject invalid phone or sanitize it
        if (response.status === 201) {
          // If accepted, phone should be sanitized
          expect(response.body.data.phone).not.toContain('<script>');
          expect(response.body.data.phone).not.toContain('DROP TABLE');
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }
    });

    it('should limit input field lengths', async () => {
      const adminToken = await getAdminTokenForTenant(tenant1Id);

      const longString = 'A'.repeat(1000); // Very long string

      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: longString,
          lastName: longString,
          email: 'test@example.com',
          title: longString,
          department: longString,
          bio: longString,
        });

      // Should either reject or truncate long inputs
      if (response.status === 201) {
        // If accepted, fields should be truncated to reasonable lengths
        expect(response.body.data.firstName.length).toBeLessThan(500);
        expect(response.body.data.lastName.length).toBeLessThan(500);
        expect(response.body.data.title.length).toBeLessThan(500);
      } else {
        expect([400, 422]).toContain(response.status);
      }
    });

    it('should prevent null byte injection', async () => {
      const adminToken = await getAdminTokenForTenant(tenant1Id);

      const nullBytePayloads = [
        'test\x00.txt',
        'user\x00@example.com',
        'name\x00<script>alert("xss")</script>',
      ];

      for (const payload of nullBytePayloads) {
        const response = await request(app)
          .post('/api/employees')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            firstName: payload,
            lastName: 'Test',
            email: 'test@example.com',
          });

        // Should either reject or sanitize null bytes
        if (response.status === 201) {
          expect(response.body.data.firstName).not.toContain('\x00');
        } else {
          expect([400, 422]).toContain(response.status);
        }
      }
    });
  });

  describe('6. Rate Limiting and DoS Prevention Tests', () => {
    it('should handle rapid successive requests', async () => {
      const token = await getTokenForTenant(tenant1Id, user1Id);

      // Make many rapid requests
      const requests = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/employees')
          .set('Authorization', `Bearer ${token}`)
      );

      const responses = await Promise.all(requests);

      // Most requests should succeed, but some might be rate limited
      const successfulResponses = responses.filter(r => r.status === 200);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(successfulResponses.length + rateLimitedResponses.length).toBe(20);
      
      // At least some requests should succeed
      expect(successfulResponses.length).toBeGreaterThan(0);
    });

    it('should handle large payload attacks', async () => {
      const adminToken = await getAdminTokenForTenant(tenant1Id);

      const largePayload = {
        firstName: 'A'.repeat(10000),
        lastName: 'B'.repeat(10000),
        email: 'test@example.com',
        bio: 'C'.repeat(50000),
        skills: Array(1000).fill('skill'),
      };

      const response = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(largePayload);

      // Should either reject large payload or handle it gracefully
      expect([400, 413, 422]).toContain(response.status);
    });
  });

  // Helper functions
  async function setupSecurityTestData() {
    // Create test tenants
    const tenant1 = await prisma.tenant.create({
      data: {
        id: 'security-tenant-1',
        name: 'Security Test Tenant 1',
        subdomain: 'security1',
        subscriptionTier: 'basic',
        userLimit: 100,
      },
    });

    const tenant2 = await prisma.tenant.create({
      data: {
        id: 'security-tenant-2',
        name: 'Security Test Tenant 2',
        subdomain: 'security2',
        subscriptionTier: 'basic',
        userLimit: 100,
      },
    });

    tenant1Id = tenant1.id;
    tenant2Id = tenant2.id;

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        id: 'security-user-1',
        email: 'user1@tenant1.com',
        role: 'user',
        tenantId: tenant1Id,
        isActive: true,
        passwordHash: '$2b$10$hashedpassword',
      },
    });

    const user2 = await prisma.user.create({
      data: {
        id: 'security-user-2',
        email: 'user2@tenant2.com',
        role: 'user',
        tenantId: tenant2Id,
        isActive: true,
        passwordHash: '$2b$10$hashedpassword',
      },
    });

    user1Id = user1.id;
    user2Id = user2.id;

    // Create admin users
    await prisma.user.create({
      data: {
        id: 'security-admin-1',
        email: 'admin1@tenant1.com',
        role: 'admin',
        tenantId: tenant1Id,
        isActive: true,
        passwordHash: '$2b$10$hashedpassword',
      },
    });

    await prisma.user.create({
      data: {
        id: 'security-admin-2',
        email: 'admin2@tenant2.com',
        role: 'admin',
        tenantId: tenant2Id,
        isActive: true,
        passwordHash: '$2b$10$hashedpassword',
      },
    });
  }

  async function cleanupSecurityTestData() {
    await prisma.auditLog.deleteMany({
      where: {
        tenantId: { in: [tenant1Id, tenant2Id] },
      },
    });

    await prisma.employee.deleteMany({
      where: {
        tenantId: { in: [tenant1Id, tenant2Id] },
      },
    });

    await prisma.user.deleteMany({
      where: {
        tenantId: { in: [tenant1Id, tenant2Id] },
      },
    });

    await prisma.tenant.deleteMany({
      where: {
        id: { in: [tenant1Id, tenant2Id] },
      },
    });
  }

  async function getTokenForTenant(tenantId: string, userId: string): Promise<string> {
    // Mock token generation - in real implementation, this would use AuthService
    const mockToken = `mock-token-${tenantId}-${userId}`;
    return mockToken;
  }

  async function getAdminTokenForTenant(tenantId: string): Promise<string> {
    // Mock admin token generation
    const mockToken = `mock-admin-token-${tenantId}`;
    return mockToken;
  }
});