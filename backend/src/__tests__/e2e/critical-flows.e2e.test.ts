import request from 'supertest';
import express from 'express';
import { prisma } from '../../lib/database';
import { redisClient } from '../../lib/redis';
import { createTestApp } from '../../utils/test-helpers';

// Import all routes
import authRoutes from '../../routes/auth.routes';
import employeeRoutes from '../../routes/employee.routes';
import searchRoutes from '../../routes/search.routes';
import adminRoutes from '../../routes/admin.routes';

// Test data
const testTenant = {
  id: 'test-tenant-e2e',
  name: 'E2E Test Company',
  subdomain: 'e2e-test',
  subscriptionTier: 'premium',
  userLimit: 1000,
  primaryColor: '#FF0000',
  accentColor: '#00FF00',
};

const testAdmin = {
  id: 'admin-e2e',
  email: 'admin@e2etest.com',
  role: 'admin',
  tenantId: testTenant.id,
  isActive: true,
  passwordHash: '$2b$10$hashedpassword', // Mock hash
};

const testUser = {
  id: 'user-e2e',
  email: 'user@e2etest.com',
  role: 'user',
  tenantId: testTenant.id,
  isActive: true,
  passwordHash: '$2b$10$hashedpassword', // Mock hash
};

const testEmployees = [
  {
    id: 'employee-1-e2e',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@e2etest.com',
    title: 'Software Engineer',
    department: 'Engineering',
    phone: '+1-555-0123',
    skills: ['JavaScript', 'TypeScript', 'React'],
    tenantId: testTenant.id,
    isActive: true,
  },
  {
    id: 'employee-2-e2e',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@e2etest.com',
    title: 'Product Manager',
    department: 'Product',
    phone: '+1-555-0456',
    skills: ['Product Management', 'Analytics'],
    tenantId: testTenant.id,
    isActive: true,
  },
  {
    id: 'employee-3-e2e',
    firstName: 'Bob',
    lastName: 'Johnson',
    email: 'bob.johnson@e2etest.com',
    title: 'Designer',
    department: 'Design',
    phone: '+1-555-0789',
    skills: ['UI/UX', 'Figma', 'Sketch'],
    tenantId: testTenant.id,
    isActive: true,
  },
];

describe('E2E Critical Flows', () => {
  let app: express.Application;
  let adminTokens: { accessToken: string; refreshToken: string };
  let userTokens: { accessToken: string; refreshToken: string };

  beforeAll(async () => {
    // Create test app
    app = createTestApp();

    // Setup test data in database
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData();
    
    // Close connections
    await prisma.$disconnect();
    await redisClient.quit();
  });

  beforeEach(async () => {
    // Clear Redis cache before each test
    await redisClient.flushdb();
  });

  describe('1. SSO Login Flow', () => {
    it('should complete full SSO authentication flow', async () => {
      // Step 1: Initiate SSO authentication
      const ssoInitResponse = await request(app)
        .get('/api/auth/sso/google')
        .query({ subdomain: testTenant.subdomain })
        .expect(302);

      expect(ssoInitResponse.headers.location).toContain('accounts.google.com');

      // Step 2: Mock SSO callback with successful authentication
      const callbackResponse = await request(app)
        .get('/api/auth/sso/google/callback')
        .query({ 
          state: testTenant.subdomain,
          code: 'mock-auth-code'
        })
        .expect(200);

      expect(callbackResponse.body.success).toBe(true);
      expect(callbackResponse.body.data).toHaveProperty('user');
      expect(callbackResponse.body.data).toHaveProperty('tenant');
      expect(callbackResponse.body.data).toHaveProperty('tokens');
      expect(callbackResponse.body.data.user.email).toBe(testAdmin.email);
      expect(callbackResponse.body.data.tenant.subdomain).toBe(testTenant.subdomain);

      // Store tokens for subsequent tests
      adminTokens = callbackResponse.body.data.tokens;

      // Step 3: Verify session is created and valid
      const sessionId = callbackResponse.body.data.session.id;
      const validateResponse = await request(app)
        .get(`/api/auth/validate/${sessionId}`)
        .expect(200);

      expect(validateResponse.body.data.valid).toBe(true);
      expect(validateResponse.body.data.session.userId).toBe(testAdmin.id);
    });

    it('should handle SSO authentication failure', async () => {
      const callbackResponse = await request(app)
        .get('/api/auth/sso/google/callback')
        .query({ 
          state: testTenant.subdomain,
          error: 'access_denied'
        })
        .expect(401);

      expect(callbackResponse.body.success).toBe(false);
      expect(callbackResponse.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should handle invalid tenant in SSO flow', async () => {
      const callbackResponse = await request(app)
        .get('/api/auth/sso/google/callback')
        .query({ 
          state: 'nonexistent-tenant',
          code: 'mock-auth-code'
        })
        .expect(404);

      expect(callbackResponse.body.success).toBe(false);
      expect(callbackResponse.body.error.message).toBe('Tenant not found');
    });
  });

  describe('2. Search and View Employee Flow', () => {
    beforeAll(async () => {
      // Login as regular user for search tests
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'password123',
          subdomain: testTenant.subdomain,
        })
        .expect(200);

      userTokens = loginResponse.body.data.tokens;
    });

    it('should complete full search and view employee flow', async () => {
      // Step 1: Perform search query
      const searchResponse = await request(app)
        .get('/api/search')
        .query({ q: 'john' })
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data.results).toHaveLength(1);
      expect(searchResponse.body.data.results[0].firstName).toBe('John');
      expect(searchResponse.body.data.results[0].lastName).toBe('Doe');

      const employeeId = searchResponse.body.data.results[0].id;

      // Step 2: View employee profile
      const profileResponse = await request(app)
        .get(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.id).toBe(employeeId);
      expect(profileResponse.body.data.firstName).toBe('John');
      expect(profileResponse.body.data.lastName).toBe('Doe');
      expect(profileResponse.body.data.title).toBe('Software Engineer');
      expect(profileResponse.body.data.department).toBe('Engineering');
      expect(profileResponse.body.data.skills).toEqual(['JavaScript', 'TypeScript', 'React']);

      // Step 3: Verify search analytics were tracked
      const analyticsResponse = await request(app)
        .get('/api/admin/analytics/summary')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.summary.totalSearches).toBeGreaterThan(0);
      expect(analyticsResponse.body.data.summary.totalProfileViews).toBeGreaterThan(0);
    });

    it('should handle advanced search with filters', async () => {
      const searchResponse = await request(app)
        .get('/api/search')
        .query({
          q: 'engineer',
          department: 'Engineering',
          skills: 'JavaScript,TypeScript'
        })
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data.results).toHaveLength(1);
      expect(searchResponse.body.data.results[0].department).toBe('Engineering');
      expect(searchResponse.body.data.results[0].skills).toContain('JavaScript');
    });

    it('should handle search with no results', async () => {
      const searchResponse = await request(app)
        .get('/api/search')
        .query({ q: 'nonexistentperson' })
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data.results).toHaveLength(0);
      expect(searchResponse.body.data.total).toBe(0);
    });

    it('should handle search suggestions', async () => {
      const suggestionsResponse = await request(app)
        .get('/api/search/suggestions')
        .query({ q: 'jo' })
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(suggestionsResponse.body.success).toBe(true);
      expect(suggestionsResponse.body.data).toBeInstanceOf(Array);
    });
  });

  describe('3. Edit Own Profile Flow', () => {
    it('should allow user to edit their own profile', async () => {
      // Step 1: Get current profile
      const currentProfileResponse = await request(app)
        .get(`/api/employees/${testUser.id}`)
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      const currentProfile = currentProfileResponse.body.data;

      // Step 2: Update profile
      const updateData = {
        phone: '+1-555-9999',
        skills: ['JavaScript', 'TypeScript', 'Node.js', 'React'],
        bio: 'Updated bio for E2E testing',
      };

      const updateResponse = await request(app)
        .put(`/api/employees/${testUser.id}`)
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.phone).toBe(updateData.phone);
      expect(updateResponse.body.data.skills).toEqual(updateData.skills);
      expect(updateResponse.body.data.bio).toBe(updateData.bio);

      // Step 3: Verify changes persisted
      const verifyResponse = await request(app)
        .get(`/api/employees/${testUser.id}`)
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(verifyResponse.body.data.phone).toBe(updateData.phone);
      expect(verifyResponse.body.data.skills).toEqual(updateData.skills);
      expect(verifyResponse.body.data.bio).toBe(updateData.bio);

      // Step 4: Verify audit log was created
      const auditResponse = await request(app)
        .get('/api/admin/audit-logs')
        .query({ entityId: testUser.id, action: 'UPDATE' })
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(auditResponse.body.data.logs.length).toBeGreaterThan(0);
      const auditLog = auditResponse.body.data.logs[0];
      expect(auditLog.entityType).toBe('employee');
      expect(auditLog.action).toBe('UPDATE');
      expect(auditLog.userId).toBe(testUser.id);
    });

    it('should prevent user from editing other profiles', async () => {
      const otherEmployeeId = testEmployees[0].id;

      const updateResponse = await request(app)
        .put(`/api/employees/${otherEmployeeId}`)
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send({ phone: '+1-555-0000' })
        .expect(403);

      expect(updateResponse.body.success).toBe(false);
      expect(updateResponse.body.error.code).toBe('FORBIDDEN');
    });

    it('should handle profile photo upload', async () => {
      const photoBuffer = Buffer.from('fake image data');

      const uploadResponse = await request(app)
        .post(`/api/employees/${testUser.id}/photo`)
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .attach('photo', photoBuffer, 'profile.jpg')
        .expect(200);

      expect(uploadResponse.body.success).toBe(true);
      expect(uploadResponse.body.data.photoUrl).toBeDefined();
      expect(uploadResponse.body.data.photoUrl).toContain('http');
    });
  });

  describe('4. Admin Create Employee Flow', () => {
    it('should complete full admin create employee flow', async () => {
      const newEmployeeData = {
        firstName: 'Alice',
        lastName: 'Wilson',
        email: 'alice.wilson@e2etest.com',
        title: 'Marketing Manager',
        department: 'Marketing',
        phone: '+1-555-1111',
        skills: ['Marketing', 'Content Strategy', 'Analytics'],
        managerId: testEmployees[1].id, // Jane Smith as manager
        customFields: {
          startDate: '2024-01-15',
          employeeId: 'EMP004',
        },
      };

      // Step 1: Create employee
      const createResponse = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send(newEmployeeData)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.firstName).toBe(newEmployeeData.firstName);
      expect(createResponse.body.data.lastName).toBe(newEmployeeData.lastName);
      expect(createResponse.body.data.email).toBe(newEmployeeData.email);
      expect(createResponse.body.data.managerId).toBe(newEmployeeData.managerId);

      const newEmployeeId = createResponse.body.data.id;

      // Step 2: Verify employee appears in search
      const searchResponse = await request(app)
        .get('/api/search')
        .query({ q: 'alice wilson' })
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(searchResponse.body.data.results).toHaveLength(1);
      expect(searchResponse.body.data.results[0].id).toBe(newEmployeeId);

      // Step 3: Verify employee appears in employee list
      const listResponse = await request(app)
        .get('/api/employees')
        .query({ department: 'Marketing' })
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(listResponse.body.data.employees).toHaveLength(1);
      expect(listResponse.body.data.employees[0].id).toBe(newEmployeeId);

      // Step 4: Verify audit log was created
      const auditResponse = await request(app)
        .get('/api/admin/audit-logs')
        .query({ entityId: newEmployeeId, action: 'CREATE' })
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(auditResponse.body.data.logs.length).toBeGreaterThan(0);
      const auditLog = auditResponse.body.data.logs[0];
      expect(auditLog.entityType).toBe('employee');
      expect(auditLog.action).toBe('CREATE');
      expect(auditLog.userId).toBe(testAdmin.id);

      // Step 5: Verify organizational chart includes new employee
      const orgChartResponse = await request(app)
        .get('/api/org-chart')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(orgChartResponse.body.success).toBe(true);
      const allEmployees = flattenOrgChart(orgChartResponse.body.data);
      const newEmployee = allEmployees.find(emp => emp.id === newEmployeeId);
      expect(newEmployee).toBeDefined();
      expect(newEmployee.managerId).toBe(newEmployeeData.managerId);
    });

    it('should prevent non-admin from creating employees', async () => {
      const newEmployeeData = {
        firstName: 'Unauthorized',
        lastName: 'User',
        email: 'unauthorized@e2etest.com',
        title: 'Test Role',
        department: 'Test',
      };

      const createResponse = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .send(newEmployeeData)
        .expect(403);

      expect(createResponse.body.success).toBe(false);
      expect(createResponse.body.error.code).toBe('FORBIDDEN');
    });

    it('should validate required fields', async () => {
      const invalidEmployeeData = {
        firstName: '', // Empty required field
        email: 'invalid-email', // Invalid email format
      };

      const createResponse = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send(invalidEmployeeData)
        .expect(400);

      expect(createResponse.body.success).toBe(false);
      expect(createResponse.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('5. Bulk Import Flow', () => {
    it('should complete full bulk import flow', async () => {
      const csvData = `firstName,lastName,email,title,department,phone,skills
Michael,Brown,michael.brown@e2etest.com,DevOps Engineer,Engineering,+1-555-2222,"Docker,Kubernetes,AWS"
Sarah,Davis,sarah.davis@e2etest.com,UX Designer,Design,+1-555-3333,"Figma,Sketch,User Research"
Tom,Miller,tom.miller@e2etest.com,Sales Manager,Sales,+1-555-4444,"Sales,CRM,Negotiation"`;

      // Step 1: Upload CSV file
      const importResponse = await request(app)
        .post('/api/admin/employees/bulk-import')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .attach('file', Buffer.from(csvData), 'employees.csv')
        .expect(200);

      expect(importResponse.body.success).toBe(true);
      expect(importResponse.body.data.summary.created).toBe(3);
      expect(importResponse.body.data.summary.updated).toBe(0);
      expect(importResponse.body.data.summary.errors).toBe(0);

      // Step 2: Verify employees were created
      const listResponse = await request(app)
        .get('/api/employees')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      const importedEmployees = listResponse.body.data.employees.filter(emp =>
        ['michael.brown@e2etest.com', 'sarah.davis@e2etest.com', 'tom.miller@e2etest.com']
          .includes(emp.email)
      );

      expect(importedEmployees).toHaveLength(3);

      // Step 3: Verify employees appear in search
      const searchResponse = await request(app)
        .get('/api/search')
        .query({ q: 'michael brown' })
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(searchResponse.body.data.results).toHaveLength(1);
      expect(searchResponse.body.data.results[0].email).toBe('michael.brown@e2etest.com');

      // Step 4: Verify audit logs were created for all imports
      const auditResponse = await request(app)
        .get('/api/admin/audit-logs')
        .query({ action: 'CREATE' })
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      const importAuditLogs = auditResponse.body.data.logs.filter(log =>
        log.entityType === 'employee' && log.action === 'CREATE'
      );

      expect(importAuditLogs.length).toBeGreaterThanOrEqual(3);
    });

    it('should handle CSV validation errors', async () => {
      const invalidCsvData = `firstName,lastName,email,title,department
,Brown,invalid-email,DevOps Engineer,Engineering
Sarah,,sarah.davis@e2etest.com,UX Designer,Design`;

      const importResponse = await request(app)
        .post('/api/admin/employees/bulk-import')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .attach('file', Buffer.from(invalidCsvData), 'invalid.csv')
        .expect(200);

      expect(importResponse.body.success).toBe(true);
      expect(importResponse.body.data.summary.errors).toBeGreaterThan(0);
      expect(importResponse.body.data.errors).toBeInstanceOf(Array);
      expect(importResponse.body.data.errors.length).toBeGreaterThan(0);
    });

    it('should prevent non-admin from bulk importing', async () => {
      const csvData = 'firstName,lastName,email\nTest,User,test@example.com';

      const importResponse = await request(app)
        .post('/api/admin/employees/bulk-import')
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .attach('file', Buffer.from(csvData), 'test.csv')
        .expect(403);

      expect(importResponse.body.success).toBe(false);
      expect(importResponse.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('6. Cross-Flow Integration Tests', () => {
    it('should maintain data consistency across all flows', async () => {
      // Create employee via admin
      const newEmployee = {
        firstName: 'Integration',
        lastName: 'Test',
        email: 'integration.test@e2etest.com',
        title: 'Test Engineer',
        department: 'QA',
        skills: ['Testing', 'Automation'],
      };

      const createResponse = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send(newEmployee)
        .expect(201);

      const employeeId = createResponse.body.data.id;

      // Search for employee
      const searchResponse = await request(app)
        .get('/api/search')
        .query({ q: 'integration test' })
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(searchResponse.body.data.results).toHaveLength(1);
      expect(searchResponse.body.data.results[0].id).toBe(employeeId);

      // Update employee
      const updateResponse = await request(app)
        .put(`/api/employees/${employeeId}`)
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .send({ title: 'Senior Test Engineer' })
        .expect(200);

      expect(updateResponse.body.data.title).toBe('Senior Test Engineer');

      // Verify updated data in search
      const updatedSearchResponse = await request(app)
        .get('/api/search')
        .query({ q: 'senior test engineer' })
        .set('Authorization', `Bearer ${userTokens.accessToken}`)
        .expect(200);

      expect(updatedSearchResponse.body.data.results).toHaveLength(1);
      expect(updatedSearchResponse.body.data.results[0].title).toBe('Senior Test Engineer');

      // Verify analytics tracked all operations
      const analyticsResponse = await request(app)
        .get('/api/admin/analytics/summary')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.summary.totalSearches).toBeGreaterThan(0);
      expect(analyticsResponse.body.data.summary.totalProfileViews).toBeGreaterThan(0);
      expect(analyticsResponse.body.data.summary.totalProfileUpdates).toBeGreaterThan(0);
    });

    it('should handle concurrent operations correctly', async () => {
      // Perform multiple concurrent searches
      const searchPromises = Array(5).fill(null).map((_, index) =>
        request(app)
          .get('/api/search')
          .query({ q: `test${index}` })
          .set('Authorization', `Bearer ${userTokens.accessToken}`)
      );

      const searchResults = await Promise.all(searchPromises);

      searchResults.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Verify all searches were tracked
      const analyticsResponse = await request(app)
        .get('/api/admin/analytics/summary')
        .set('Authorization', `Bearer ${adminTokens.accessToken}`)
        .expect(200);

      expect(analyticsResponse.body.data.summary.totalSearches).toBeGreaterThanOrEqual(5);
    });
  });

  // Helper functions
  async function setupTestData() {
    // Create tenant
    await prisma.tenant.create({ data: testTenant });

    // Create users
    await prisma.user.create({ data: testAdmin });
    await prisma.user.create({ data: testUser });

    // Create employees
    for (const employee of testEmployees) {
      await prisma.employee.create({ data: employee });
    }
  }

  async function cleanupTestData() {
    // Delete in reverse order of dependencies
    await prisma.auditLog.deleteMany({ where: { tenantId: testTenant.id } });
    await prisma.analyticsEvent.deleteMany({ where: { tenantId: testTenant.id } });
    await prisma.employee.deleteMany({ where: { tenantId: testTenant.id } });
    await prisma.user.deleteMany({ where: { tenantId: testTenant.id } });
    await prisma.tenant.delete({ where: { id: testTenant.id } });
  }

  function flattenOrgChart(orgChart: any[]): any[] {
    const result: any[] = [];
    
    function traverse(nodes: any[]) {
      for (const node of nodes) {
        result.push(node);
        if (node.directReports && node.directReports.length > 0) {
          traverse(node.directReports);
        }
      }
    }
    
    traverse(orgChart);
    return result;
  }
});