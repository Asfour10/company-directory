#!/usr/bin/env ts-node

/**
 * Test script for Redis caching implementation
 * Tests the caching functionality for sessions, employees, search, and tenant config
 */

import { redisClient } from '../lib/redis';

async function testRedisCaching() {
  console.log('🔄 Testing Redis caching implementation...\n');

  try {
    // Connect to Redis
    await redisClient.connect();
    console.log('✅ Redis connection established');

    // Test basic cache operations
    console.log('\n📝 Testing basic cache operations...');
    
    // Test set/get
    await redisClient.set('test:key', { message: 'Hello Redis!' }, 60);
    const testValue = await redisClient.get('test:key');
    console.log('✅ Basic set/get:', testValue?.message === 'Hello Redis!' ? 'PASS' : 'FAIL');

    // Test session caching
    console.log('\n👤 Testing session caching...');
    const sessionData = {
      userId: 'user-123',
      tenantId: 'tenant-456',
      email: 'test@example.com',
      role: 'user'
    };
    
    await redisClient.setSession('user-123', 'session-token-123', sessionData);
    const cachedSession = await redisClient.getSession('user-123', 'session-token-123');
    console.log('✅ Session caching:', cachedSession?.userId === 'user-123' ? 'PASS' : 'FAIL');

    // Test employee profile caching
    console.log('\n👥 Testing employee profile caching...');
    const employeeData = {
      id: 'emp-123',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      title: 'Software Engineer'
    };
    
    await redisClient.setEmployeeProfile('tenant-456', 'emp-123', employeeData);
    const cachedEmployee = await redisClient.getEmployeeProfile('tenant-456', 'emp-123');
    console.log('✅ Employee profile caching:', cachedEmployee?.firstName === 'John' ? 'PASS' : 'FAIL');

    // Test search results caching
    console.log('\n🔍 Testing search results caching...');
    const searchResults = {
      results: [{ id: 'emp-123', name: 'John Doe' }],
      total: 1,
      query: 'john'
    };
    
    await redisClient.setSearchResults('tenant-456', 'search-hash-123', searchResults);
    const cachedSearch = await redisClient.getSearchResults('tenant-456', 'search-hash-123');
    console.log('✅ Search results caching:', cachedSearch?.total === 1 ? 'PASS' : 'FAIL');

    // Test tenant config caching
    console.log('\n🏢 Testing tenant config caching...');
    const tenantData = {
      id: 'tenant-456',
      name: 'Test Company',
      subdomain: 'testco',
      primaryColor: '#FF0000'
    };
    
    await redisClient.setTenantConfig('tenant-456', tenantData);
    const cachedTenant = await redisClient.getTenantConfig('tenant-456');
    console.log('✅ Tenant config caching:', cachedTenant?.name === 'Test Company' ? 'PASS' : 'FAIL');

    // Test cache invalidation
    console.log('\n🗑️ Testing cache invalidation...');
    await redisClient.invalidateEmployeeProfile('tenant-456', 'emp-123');
    const invalidatedEmployee = await redisClient.getEmployeeProfile('tenant-456', 'emp-123');
    console.log('✅ Cache invalidation:', invalidatedEmployee === null ? 'PASS' : 'FAIL');

    // Test pattern-based invalidation
    console.log('\n🔄 Testing pattern-based invalidation...');
    await redisClient.setEmployeeProfile('tenant-456', 'emp-124', employeeData);
    await redisClient.setEmployeeProfile('tenant-456', 'emp-125', employeeData);
    await redisClient.invalidateEmployeesByTenant('tenant-456');
    const invalidatedEmployee1 = await redisClient.getEmployeeProfile('tenant-456', 'emp-124');
    const invalidatedEmployee2 = await redisClient.getEmployeeProfile('tenant-456', 'emp-125');
    console.log('✅ Pattern invalidation:', 
      (invalidatedEmployee1 === null && invalidatedEmployee2 === null) ? 'PASS' : 'FAIL');

    // Test Redis health check
    console.log('\n❤️ Testing Redis health check...');
    const isHealthy = await redisClient.ping();
    console.log('✅ Redis health check:', isHealthy ? 'PASS' : 'FAIL');

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await redisClient.del('test:key');
    await redisClient.deleteSession('user-123', 'session-token-123');
    await redisClient.invalidateSearchByTenant('tenant-456');
    await redisClient.invalidateTenantConfig('tenant-456');
    console.log('✅ Cleanup completed');

    console.log('\n🎉 All Redis caching tests completed successfully!');

  } catch (error) {
    console.error('❌ Redis caching test failed:', error);
    process.exit(1);
  } finally {
    await redisClient.disconnect();
    console.log('🔌 Redis connection closed');
  }
}

// Run the test
if (require.main === module) {
  testRedisCaching().catch(console.error);
}

export { testRedisCaching };