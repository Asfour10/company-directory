#!/usr/bin/env tsx

/**
 * Test script to verify audit endpoints are properly configured
 */

import express from 'express';
import request from 'supertest';
import adminRoutes from '../routes/admin.routes';

// Mock middleware for testing
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { id: 'test-user', role: 'admin' };
  next();
};

const mockTenant = (req: any, res: any, next: any) => {
  req.tenant = { id: 'test-tenant', name: 'Test Tenant' };
  next();
};

async function testAuditEndpoints() {
  console.log('🔍 Testing Audit Endpoints...\n');

  // Create test app
  const app = express();
  app.use(express.json());
  app.use(mockAuth);
  app.use(mockTenant);
  app.use('/api/admin', adminRoutes);

  try {
    console.log('1. Testing GET /api/admin/audit-logs endpoint...');
    
    // This will fail with database connection, but we can verify the route exists
    const response1 = await request(app)
      .get('/api/admin/audit-logs')
      .expect((res) => {
        // We expect either a 200 (if DB works) or 500 (if DB fails)
        // But not 404 (route not found)
        if (res.status === 404) {
          throw new Error('Route not found');
        }
      });

    console.log(`✅ Audit logs endpoint exists (status: ${response1.status})`);

    console.log('\n2. Testing GET /api/admin/audit-logs/export endpoint...');
    
    const response2 = await request(app)
      .get('/api/admin/audit-logs/export')
      .expect((res) => {
        if (res.status === 404) {
          throw new Error('Route not found');
        }
      });

    console.log(`✅ Audit logs export endpoint exists (status: ${response2.status})`);

    console.log('\n3. Testing GET /api/admin/audit-logs/statistics endpoint...');
    
    const response3 = await request(app)
      .get('/api/admin/audit-logs/statistics')
      .expect((res) => {
        if (res.status === 404) {
          throw new Error('Route not found');
        }
      });

    console.log(`✅ Audit logs statistics endpoint exists (status: ${response3.status})`);

    console.log('\n4. Testing POST /api/admin/audit-logs/cleanup endpoint...');
    
    // Mock super admin for this endpoint
    const superAdminApp = express();
    superAdminApp.use(express.json());
    superAdminApp.use((req: any, res: any, next: any) => {
      req.user = { id: 'test-user', role: 'super_admin' };
      next();
    });
    superAdminApp.use(mockTenant);
    superAdminApp.use('/api/admin', adminRoutes);

    const response4 = await request(superAdminApp)
      .post('/api/admin/audit-logs/cleanup')
      .expect((res) => {
        if (res.status === 404) {
          throw new Error('Route not found');
        }
      });

    console.log(`✅ Audit logs cleanup endpoint exists (status: ${response4.status})`);

    console.log('\n🎉 All audit endpoints are properly configured!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testAuditEndpoints()
  .then(() => {
    console.log('\n✅ Audit endpoints test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Audit endpoints test failed:', error);
    process.exit(1);
  });