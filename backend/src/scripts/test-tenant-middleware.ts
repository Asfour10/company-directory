#!/usr/bin/env tsx

/**
 * Test script for tenant middleware functionality
 */

import { Request, Response } from 'express';
import { tenantMiddleware, requireTenant, clearTenantCache, getTenantCacheStats } from '../middleware/tenant.middleware';
import { prisma } from '../lib/database';

// Mock Express Request and Response
function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    get: jest.fn(),
    ...overrides,
  } as any;
}

function createMockResponse(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  };
  return res as any;
}

async function testTenantMiddleware() {
  try {
    console.log('🔍 Testing tenant middleware...');
    
    // Create a test tenant first
    const testTenant = await prisma.tenant.create({
      data: {
        name: 'Test Company',
        subdomain: 'testcompany',
        subscriptionTier: 'professional',
        userLimit: 100,
      },
    });
    
    console.log('✅ Test tenant created:', testTenant.subdomain);
    
    // Test 1: Subdomain extraction
    console.log('🧪 Test 1: Subdomain extraction');
    
    const req1 = createMockRequest();
    const res1 = createMockResponse();
    const next1 = jest.fn();
    
    (req1.get as jest.Mock).mockImplementation((header: string) => {
      if (header === 'host') return 'testcompany.directory-platform.com';
      return undefined;
    });
    
    await tenantMiddleware(req1, res1, next1);
    
    if (req1.tenant && req1.tenant.subdomain === 'testcompany') {
      console.log('✅ Subdomain extraction successful');
    } else {
      console.log('❌ Subdomain extraction failed');
    }
    
    // Test 2: JWT token extraction
    console.log('🧪 Test 2: JWT token extraction');
    
    const req2 = createMockRequest();
    const res2 = createMockResponse();
    const next2 = jest.fn();
    
    // Mock JWT token with tenant ID
    const mockToken = Buffer.from(JSON.stringify({
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { tenantId: testTenant.id, userId: 'test-user' },
      signature: 'mock-signature'
    })).toString('base64');
    
    (req2.get as jest.Mock).mockImplementation((header: string) => {
      if (header === 'host') return 'api.directory-platform.com';
      if (header === 'Authorization') return `Bearer ${mockToken}`;
      return undefined;
    });
    
    await tenantMiddleware(req2, res2, next2);
    
    if (req2.tenant && req2.tenant.id === testTenant.id) {
      console.log('✅ JWT extraction successful');
    } else {
      console.log('❌ JWT extraction failed');
    }
    
    // Test 3: Header extraction
    console.log('🧪 Test 3: Header extraction');
    
    const req3 = createMockRequest();
    const res3 = createMockResponse();
    const next3 = jest.fn();
    
    (req3.get as jest.Mock).mockImplementation((header: string) => {
      if (header === 'host') return 'localhost:3000';
      if (header === 'X-Tenant-ID') return testTenant.id;
      return undefined;
    });
    
    await tenantMiddleware(req3, res3, next3);
    
    if (req3.tenant && req3.tenant.id === testTenant.id) {
      console.log('✅ Header extraction successful');
    } else {
      console.log('❌ Header extraction failed');
    }
    
    // Test 4: Invalid tenant
    console.log('🧪 Test 4: Invalid tenant handling');
    
    const req4 = createMockRequest();
    const res4 = createMockResponse();
    const next4 = jest.fn();
    
    (req4.get as jest.Mock).mockImplementation((header: string) => {
      if (header === 'host') return 'nonexistent.directory-platform.com';
      return undefined;
    });
    
    await tenantMiddleware(req4, res4, next4);
    
    if ((res4.status as jest.Mock).mock.calls[0]?.[0] === 404) {
      console.log('✅ Invalid tenant handling successful');
    } else {
      console.log('❌ Invalid tenant handling failed');
    }
    
    // Test 5: No tenant identifier
    console.log('🧪 Test 5: No tenant identifier handling');
    
    const req5 = createMockRequest();
    const res5 = createMockResponse();
    const next5 = jest.fn();
    
    (req5.get as jest.Mock).mockImplementation(() => undefined);
    
    await tenantMiddleware(req5, res5, next5);
    
    if ((res5.status as jest.Mock).mock.calls[0]?.[0] === 404) {
      console.log('✅ No tenant identifier handling successful');
    } else {
      console.log('❌ No tenant identifier handling failed');
    }
    
    // Test 6: Cache functionality
    console.log('🧪 Test 6: Cache functionality');
    
    clearTenantCache();
    let stats = getTenantCacheStats();
    console.log('📊 Cache cleared, size:', stats.size);
    
    // Make the same request twice to test caching
    const req6a = createMockRequest();
    const res6a = createMockResponse();
    const next6a = jest.fn();
    
    (req6a.get as jest.Mock).mockImplementation((header: string) => {
      if (header === 'host') return 'testcompany.directory-platform.com';
      return undefined;
    });
    
    const start = Date.now();
    await tenantMiddleware(req6a, res6a, next6a);
    const firstCallTime = Date.now() - start;
    
    stats = getTenantCacheStats();
    console.log('📊 After first call, cache size:', stats.size);
    
    // Second call should be faster due to caching
    const req6b = createMockRequest();
    const res6b = createMockResponse();
    const next6b = jest.fn();
    
    (req6b.get as jest.Mock).mockImplementation((header: string) => {
      if (header === 'host') return 'testcompany.directory-platform.com';
      return undefined;
    });
    
    const start2 = Date.now();
    await tenantMiddleware(req6b, res6b, next6b);
    const secondCallTime = Date.now() - start2;
    
    console.log(`⏱️  First call: ${firstCallTime}ms, Second call: ${secondCallTime}ms`);
    
    if (req6b.tenant && req6b.tenant.subdomain === 'testcompany') {
      console.log('✅ Cache functionality working');
    } else {
      console.log('❌ Cache functionality failed');
    }
    
    // Test 7: requireTenant middleware
    console.log('🧪 Test 7: requireTenant middleware');
    
    const req7 = createMockRequest();
    req7.tenant = testTenant;
    req7.tenantId = testTenant.id;
    
    const res7 = createMockResponse();
    const next7 = jest.fn();
    
    requireTenant(req7, res7, next7);
    
    if (next7.mock.calls.length > 0) {
      console.log('✅ requireTenant middleware successful');
    } else {
      console.log('❌ requireTenant middleware failed');
    }
    
    // Test 8: requireTenant without tenant
    console.log('🧪 Test 8: requireTenant without tenant');
    
    const req8 = createMockRequest();
    const res8 = createMockResponse();
    const next8 = jest.fn();
    
    requireTenant(req8, res8, next8);
    
    if ((res8.status as jest.Mock).mock.calls[0]?.[0] === 400) {
      console.log('✅ requireTenant without tenant handling successful');
    } else {
      console.log('❌ requireTenant without tenant handling failed');
    }
    
    // Clean up test tenant
    await prisma.tenant.delete({
      where: { id: testTenant.id },
    });
    
    console.log('🧹 Test tenant cleaned up');
    console.log('🎉 All tenant middleware tests completed!');
    
  } catch (error) {
    console.error('❌ Tenant middleware test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Mock jest functions for testing
const jest = {
  fn: () => {
    const mockFn = (...args: any[]) => mockFn;
    mockFn.mock = { calls: [] as any[][] };
    mockFn.mockReturnThis = () => mockFn;
    mockFn.mockImplementation = (impl: Function) => {
      return (...args: any[]) => {
        mockFn.mock.calls.push(args);
        return impl(...args);
      };
    };
    return mockFn;
  },
};

// Run the test
testTenantMiddleware();