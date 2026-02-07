#!/usr/bin/env ts-node

/**
 * Test script for tenant endpoints
 * Tests the API endpoints for tenant settings management
 */

import express from 'express';
import request from 'supertest';
import tenantRoutes from '../routes/tenant.routes';
import { TenantService } from '../services/tenant.service';
import { AuditService } from '../services/audit.service';
import { errorHandler } from '../middleware/error.middleware';

// Mock dependencies for testing
jest.mock('../services/tenant.service');
jest.mock('../services/audit.service');

const mockTenantService = TenantService as jest.Mocked<typeof TenantService>;
const mockAuditService = AuditService as jest.Mocked<typeof AuditService>;

// Create test app
const app = express();
app.use(express.json());

// Mock middleware
app.use((req, res, next) => {
  req.tenant = { id: 'tenant-1', subdomain: 'test-company' } as any;
  req.user = { id: 'user-1', role: 'super_admin', tenantId: 'tenant-1' } as any;
  next();
});

app.use('/api/tenant', tenantRoutes);
app.use(errorHandler);

async function testTenantEndpoints() {
  console.log('🧪 Testing Tenant Endpoints...\n');

  try {
    // Test 1: GET /api/tenant/settings
    console.log('1. Testing GET /api/tenant/settings...');
    const mockTenant = {
      id: 'tenant-1',
      name: 'Test Company',
      subdomain: 'test-company',
      logoUrl: 'https://example.com/logo.png',
      primaryColor: '#FF0000',
      accentColor: '#00FF00',
      subscriptionTier: 'basic',
      userLimit: 100,
      dataRetentionDays: 730,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockTenantService.getTenantById.mockResolvedValue(mockTenant as any);

    const settingsResponse = await request(app)
      .get('/api/tenant/settings')
      .expect(200);

    console.log('✅ Settings endpoint response:', {
      success: settingsResponse.body.success,
      hasData: !!settingsResponse.body.data,
      tenantName: settingsResponse.body.data?.name,
    });

    // Test 2: PUT /api/tenant/branding
    console.log('\n2. Testing PUT /api/tenant/branding...');
    const brandingData = {
      primaryColor: '#E74C3C',
      accentColor: '#3498DB',
    };

    const mockUpdatedTenant = {
      id: 'tenant-1',
      primaryColor: '#E74C3C',
      accentColor: '#3498DB',
      logoUrl: 'https://example.com/logo.png',
    };

    mockTenantService.updateBranding.mockResolvedValue(mockUpdatedTenant as any);
    mockAuditService.logChange.mockResolvedValue(undefined);

    const brandingResponse = await request(app)
      .put('/api/tenant/branding')
      .send(brandingData)
      .expect(200);

    console.log('✅ Branding endpoint response:', {
      success: brandingResponse.body.success,
      message: brandingResponse.body.message,
      primaryColor: brandingResponse.body.data?.primaryColor,
    });

    // Test 3: PUT /api/tenant/sso-config
    console.log('\n3. Testing PUT /api/tenant/sso-config...');
    const ssoData = {
      provider: 'azure-ad',
      config: {
        clientId: 'test-client-id',
        tenantId: 'test-tenant-id',
      },
    };

    const mockSSOTenant = {
      id: 'tenant-1',
      ssoProvider: 'azure-ad',
    };

    mockTenantService.updateSSOConfig.mockResolvedValue(mockSSOTenant as any);

    const ssoResponse = await request(app)
      .put('/api/tenant/sso-config')
      .send(ssoData)
      .expect(200);

    console.log('✅ SSO config endpoint response:', {
      success: ssoResponse.body.success,
      message: ssoResponse.body.message,
      provider: ssoResponse.body.data?.ssoProvider,
    });

    // Test 4: GET /api/tenant/stats
    console.log('\n4. Testing GET /api/tenant/stats...');
    const mockStats = {
      userCount: 25,
      employeeCount: 30,
      activeUsers: 20,
      userLimit: 100,
      subscriptionTier: 'basic',
      utilizationPercentage: 25,
    };

    mockTenantService.getTenantStats.mockResolvedValue(mockStats);

    const statsResponse = await request(app)
      .get('/api/tenant/stats')
      .expect(200);

    console.log('✅ Stats endpoint response:', {
      success: statsResponse.body.success,
      userCount: statsResponse.body.data?.userCount,
      utilizationPercentage: statsResponse.body.data?.utilizationPercentage,
    });

    // Test 5: GET /api/tenant/usage
    console.log('\n5. Testing GET /api/tenant/usage...');
    const mockUsage = {
      searchEvents: 100,
      profileViews: 200,
      logins: 50,
      period: '30 days',
    };

    mockTenantService.getTenantUsage.mockResolvedValue(mockUsage);

    const usageResponse = await request(app)
      .get('/api/tenant/usage')
      .expect(200);

    console.log('✅ Usage endpoint response:', {
      success: usageResponse.body.success,
      searchEvents: usageResponse.body.data?.searchEvents,
      period: usageResponse.body.data?.period,
    });

    // Test 6: GET /api/tenant/subdomain-suggestions
    console.log('\n6. Testing GET /api/tenant/subdomain-suggestions...');
    const mockSuggestions = ['testcompany', 'testcompanyco', 'testcompanyinc'];
    
    mockTenantService.generateSubdomainSuggestions.mockResolvedValue(mockSuggestions);

    const suggestionsResponse = await request(app)
      .get('/api/tenant/subdomain-suggestions?name=Test Company')
      .expect(200);

    console.log('✅ Subdomain suggestions response:', {
      success: suggestionsResponse.body.success,
      suggestions: suggestionsResponse.body.data?.suggestions,
      baseName: suggestionsResponse.body.data?.baseName,
    });

    console.log('\n🎉 All tenant endpoint tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

async function testValidationErrors() {
  console.log('\n🧪 Testing validation errors...\n');

  try {
    // Test invalid branding data
    console.log('1. Testing invalid branding data...');
    const invalidBrandingResponse = await request(app)
      .put('/api/tenant/branding')
      .send({ primaryColor: 123 }) // Should be string
      .expect(400);

    console.log('✅ Invalid branding validation:', {
      error: invalidBrandingResponse.body.error,
    });

    // Test invalid SSO data
    console.log('\n2. Testing invalid SSO data...');
    const invalidSSOResponse = await request(app)
      .put('/api/tenant/sso-config')
      .send({ provider: 123 }) // Should be string
      .expect(400);

    console.log('✅ Invalid SSO validation:', {
      error: invalidSSOResponse.body.error,
    });

    // Test missing subdomain suggestion name
    console.log('\n3. Testing missing subdomain suggestion name...');
    const missingSuggestionResponse = await request(app)
      .get('/api/tenant/subdomain-suggestions')
      .expect(400);

    console.log('✅ Missing name validation:', {
      error: missingSuggestionResponse.body.error,
    });

    console.log('\n🎉 All validation tests passed!');

  } catch (error) {
    console.error('❌ Validation test failed:', error);
    throw error;
  }
}

async function main() {
  try {
    await testTenantEndpoints();
    await testValidationErrors();
    console.log('\n✅ All tests completed successfully!');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Export for use in other test files
export { testTenantEndpoints, testValidationErrors };

// Run the tests if this file is executed directly
if (require.main === module) {
  main();
}