#!/usr/bin/env tsx

/**
 * Script to verify database schema and Row-Level Security setup
 */

import { prisma } from '../lib/database';

async function verifyDatabaseSchema() {
  try {
    console.log('🔍 Verifying database schema...');
    
    // Check if all tables exist
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    const expectedTables = [
      'tenants',
      'users', 
      'employees',
      'custom_fields',
      'audit_logs',
      'sessions',
      'analytics_events'
    ];
    
    console.log('📋 Found tables:', tables.map(t => t.table_name));
    
    const missingTables = expectedTables.filter(
      table => !tables.some(t => t.table_name === table)
    );
    
    if (missingTables.length > 0) {
      console.error('❌ Missing tables:', missingTables);
      return false;
    }
    
    console.log('✅ All required tables exist');
    
    // Check indexes
    const indexes = await prisma.$queryRaw<Array<{ indexname: string, tablename: string }>>`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public'
      AND indexname NOT LIKE '%_pkey'
      ORDER BY tablename, indexname
    `;
    
    console.log('📊 Found indexes:', indexes.length);
    
    // Check Row-Level Security
    const rlsTables = await prisma.$queryRaw<Array<{ tablename: string, rowsecurity: boolean }>>`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND rowsecurity = true
    `;
    
    console.log('🔒 Tables with RLS enabled:', rlsTables.map(t => t.tablename));
    
    // Check RLS policies
    const policies = await prisma.$queryRaw<Array<{ policyname: string, tablename: string }>>`
      SELECT policyname, tablename 
      FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `;
    
    console.log('🛡️ RLS policies:', policies.length);
    
    // Check extensions
    const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname 
      FROM pg_extension 
      WHERE extname IN ('pgcrypto', 'pg_trgm')
    `;
    
    console.log('🔧 Extensions:', extensions.map(e => e.extname));
    
    // Test search vector functionality
    console.log('🔍 Testing search vector...');
    const searchTest = await prisma.$queryRaw`
      SELECT to_tsvector('english', 'John Doe Software Engineer') as search_vector
    `;
    console.log('✅ Search vector test successful');
    
    // Test tenant context
    console.log('🏢 Testing tenant context...');
    await prisma.$executeRaw`SET app.current_tenant = 'test-tenant-123'`;
    const tenantContext = await prisma.$queryRaw`SELECT current_setting('app.current_tenant', true) as tenant_id`;
    console.log('✅ Tenant context test successful:', tenantContext);
    
    console.log('🎉 Database schema verification completed successfully!');
    return true;
    
  } catch (error) {
    console.error('❌ Database schema verification failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyDatabaseSchema().then(success => {
  process.exit(success ? 0 : 1);
});