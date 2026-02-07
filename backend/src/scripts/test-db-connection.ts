#!/usr/bin/env tsx

/**
 * Test script to verify Prisma database connection and configuration
 */

import { prisma } from '../lib/database';

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test query execution
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query execution successful:', result);
    
    // Test connection info
    const connectionInfo = await prisma.$queryRaw`
      SELECT 
        current_database() as database_name,
        current_user as user_name,
        version() as postgres_version
    `;
    console.log('📊 Connection info:', connectionInfo);
    
    // Test if we can access tenant-related functionality
    console.log('🔧 Testing tenant context functionality...');
    await prisma.$executeRaw`SET app.current_tenant = 'test-tenant-id'`;
    console.log('✅ Tenant context setting successful');
    
    console.log('🎉 All database tests passed!');
    
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Database connection closed');
  }
}

// Run the test
testDatabaseConnection();