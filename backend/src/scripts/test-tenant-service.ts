#!/usr/bin/env ts-node

/**
 * Test script for tenant service functionality
 * Tests CRUD operations, branding, and subdomain management
 */

import { TenantService, CreateTenantData } from '../services/tenant.service';
import { prisma } from '../lib/database';

async function testTenantService() {
  console.log('🧪 Testing Tenant Service...\n');

  try {
    // Test 1: Create a new tenant
    console.log('1. Testing tenant creation...');
    const tenantData: CreateTenantData = {
      name: 'Test Company Ltd',
      subdomain: 'test-company-ltd',
      subscriptionTier: 'basic',
      userLimit: 50,
      primaryColor: '#FF6B35',
      accentColor: '#004E89',
    };

    const createdTenant = await TenantService.createTenant(tenantData);
    console.log('✅ Tenant created:', {
      id: createdTenant.id,
      name: createdTenant.name,
      subdomain: createdTenant.subdomain,
    });

    // Test 2: Get tenant by ID
    console.log('\n2. Testing get tenant by ID...');
    const retrievedTenant = await TenantService.getTenantById(createdTenant.id);
    console.log('✅ Tenant retrieved:', retrievedTenant?.name);

    // Test 3: Get tenant by subdomain
    console.log('\n3. Testing get tenant by subdomain...');
    const tenantBySubdomain = await TenantService.getTenantBySubdomain(createdTenant.subdomain);
    console.log('✅ Tenant found by subdomain:', tenantBySubdomain?.name);

    // Test 4: Update tenant branding
    console.log('\n4. Testing branding update...');
    const updatedTenant = await TenantService.updateBranding(createdTenant.id, {
      primaryColor: '#E74C3C',
      accentColor: '#3498DB',
    });
    console.log('✅ Branding updated:', {
      primaryColor: updatedTenant.primaryColor,
      accentColor: updatedTenant.accentColor,
    });

    // Test 5: Update SSO configuration
    console.log('\n5. Testing SSO configuration update...');
    const ssoUpdatedTenant = await TenantService.updateSSOConfig(createdTenant.id, {
      provider: 'azure-ad',
      config: {
        clientId: 'test-client-id',
        tenantId: 'test-tenant-id',
        authority: 'https://login.microsoftonline.com/test-tenant-id',
      },
    });
    console.log('✅ SSO configuration updated:', {
      provider: ssoUpdatedTenant.ssoProvider,
      hasConfig: !!ssoUpdatedTenant.ssoConfig,
    });

    // Test 6: Get tenant statistics
    console.log('\n6. Testing tenant statistics...');
    const stats = await TenantService.getTenantStats(createdTenant.id);
    console.log('✅ Tenant statistics:', stats);

    // Test 7: Check user limit
    console.log('\n7. Testing user limit check...');
    const isAtLimit = await TenantService.isAtUserLimit(createdTenant.id);
    console.log('✅ At user limit:', isAtLimit);

    // Test 8: Get tenant usage
    console.log('\n8. Testing tenant usage analytics...');
    const usage = await TenantService.getTenantUsage(createdTenant.id, 30);
    console.log('✅ Tenant usage:', usage);

    // Test 9: Generate subdomain suggestions
    console.log('\n9. Testing subdomain suggestions...');
    const suggestions = await TenantService.generateSubdomainSuggestions('Amazing Company');
    console.log('✅ Subdomain suggestions:', suggestions);

    // Test 10: List tenants
    console.log('\n10. Testing tenant listing...');
    const tenantList = await TenantService.listTenants({ page: 1, pageSize: 10 });
    console.log('✅ Tenant list:', {
      count: tenantList.tenants.length,
      total: tenantList.pagination.total,
    });

    // Test 11: Test validation errors
    console.log('\n11. Testing validation errors...');
    
    // Test invalid subdomain
    try {
      await TenantService.createTenant({
        ...tenantData,
        subdomain: 'Invalid_Subdomain!',
      });
      console.log('❌ Should have thrown validation error for invalid subdomain');
    } catch (error) {
      console.log('✅ Validation error caught for invalid subdomain:', (error as Error).message);
    }

    // Test invalid color
    try {
      await TenantService.updateBranding(createdTenant.id, {
        primaryColor: 'invalid-color',
      });
      console.log('❌ Should have thrown validation error for invalid color');
    } catch (error) {
      console.log('✅ Validation error caught for invalid color:', (error as Error).message);
    }

    // Test duplicate subdomain
    try {
      await TenantService.createTenant({
        ...tenantData,
        name: 'Another Company',
        subdomain: createdTenant.subdomain, // Same subdomain
      });
      console.log('❌ Should have thrown error for duplicate subdomain');
    } catch (error) {
      console.log('✅ Duplicate subdomain error caught:', (error as Error).message);
    }

    // Test 12: Test edge cases
    console.log('\n12. Testing edge cases...');
    
    // Test with non-existent tenant
    const nonExistentTenant = await TenantService.getTenantById('non-existent-id');
    console.log('✅ Non-existent tenant returns null:', nonExistentTenant === null);

    // Test user limit with zero users
    const emptyTenantStats = await TenantService.getTenantStats(createdTenant.id);
    console.log('✅ Empty tenant stats:', {
      userCount: emptyTenantStats.userCount,
      utilizationPercentage: emptyTenantStats.utilizationPercentage,
    });

    // Cleanup: Delete the test tenant
    console.log('\n13. Cleaning up test tenant...');
    await TenantService.deleteTenant(createdTenant.id);
    console.log('✅ Test tenant deleted');

    console.log('\n🎉 All tenant service tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

async function testSubdomainValidation() {
  console.log('\n🧪 Testing subdomain validation...\n');

  const validSubdomains = [
    'test',
    'test-company',
    'company123',
    'a1b2c3',
    'my-awesome-company',
    'abc',
  ];

  const invalidSubdomains = [
    'ab', // too short
    'Test', // uppercase
    'test_company', // underscore
    'test.company', // dot
    '-test', // starts with hyphen
    'test-', // ends with hyphen
    'test--company', // consecutive hyphens
    'www', // reserved
    'admin', // reserved
    'api', // reserved
  ];

  console.log('Valid subdomains:');
  validSubdomains.forEach(subdomain => {
    const isValid = (TenantService as any).isValidSubdomain(subdomain);
    console.log(`  ${subdomain}: ${isValid ? '✅' : '❌'}`);
  });

  console.log('\nInvalid subdomains:');
  invalidSubdomains.forEach(subdomain => {
    const isValid = (TenantService as any).isValidSubdomain(subdomain);
    console.log(`  ${subdomain}: ${isValid ? '❌' : '✅'}`);
  });
}

async function testColorValidation() {
  console.log('\n🧪 Testing color validation...\n');

  const validColors = [
    '#FF0000',
    '#00ff00',
    '#123',
    '#ABC',
    '#123456',
    '#abcdef',
  ];

  const invalidColors = [
    'FF0000', // missing #
    '#GG0000', // invalid hex characters
    '#12345', // wrong length
    'rgb(255,0,0)', // not hex format
    '#1234567', // too long
    '#12', // too short
  ];

  console.log('Valid colors:');
  validColors.forEach(color => {
    const isValid = (TenantService as any).isValidHexColor(color);
    console.log(`  ${color}: ${isValid ? '✅' : '❌'}`);
  });

  console.log('\nInvalid colors:');
  invalidColors.forEach(color => {
    const isValid = (TenantService as any).isValidHexColor(color);
    console.log(`  ${color}: ${isValid ? '❌' : '✅'}`);
  });
}

async function main() {
  try {
    await testTenantService();
    await testSubdomainValidation();
    await testColorValidation();
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
if (require.main === module) {
  main();
}