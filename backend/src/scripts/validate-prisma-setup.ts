#!/usr/bin/env tsx

/**
 * Validation script to check Prisma setup and client generation
 */

import fs from 'fs';
import path from 'path';

function validatePrismaSetup() {
  console.log('🔍 Validating Prisma setup...');
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check if schema file exists
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    errors.push('❌ Prisma schema file not found at prisma/schema.prisma');
  } else {
    console.log('✅ Prisma schema file found');
    
    // Check schema content
    const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    
    // Check for required components
    const requiredComponents = [
      { name: 'generator client', pattern: /generator\s+client\s*{/ },
      { name: 'datasource db', pattern: /datasource\s+db\s*{/ },
      { name: 'PostgreSQL provider', pattern: /provider\s*=\s*"postgresql"/ },
      { name: 'Tenant model', pattern: /model\s+Tenant\s*{/ },
      { name: 'User model', pattern: /model\s+User\s*{/ },
      { name: 'Employee model', pattern: /model\s+Employee\s*{/ },
      { name: 'AuditLog model', pattern: /model\s+AuditLog\s*{/ },
    ];
    
    requiredComponents.forEach(component => {
      if (component.pattern.test(schemaContent)) {
        console.log(`✅ ${component.name} found in schema`);
      } else {
        errors.push(`❌ ${component.name} not found in schema`);
      }
    });
  }
  
  // Check if migrations directory exists
  const migrationsPath = path.join(process.cwd(), 'prisma', 'migrations');
  if (!fs.existsSync(migrationsPath)) {
    warnings.push('⚠️  Migrations directory not found - run prisma migrate dev to create');
  } else {
    console.log('✅ Migrations directory found');
    
    // Check for migration files
    const migrationFiles = fs.readdirSync(migrationsPath);
    if (migrationFiles.length === 0) {
      warnings.push('⚠️  No migration files found - run prisma migrate dev to create initial migration');
    } else {
      console.log(`✅ Found ${migrationFiles.length} migration(s)`);
    }
  }
  
  // Check if package.json has required scripts
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const requiredScripts = [
      'prisma:generate',
      'prisma:migrate',
      'prisma:studio',
    ];
    
    requiredScripts.forEach(script => {
      if (packageJson.scripts && packageJson.scripts[script]) {
        console.log(`✅ Script "${script}" found in package.json`);
      } else {
        warnings.push(`⚠️  Script "${script}" not found in package.json`);
      }
    });
  }
  
  // Check if Prisma dependencies are installed
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    const prismaClientPath = path.join(nodeModulesPath, '@prisma', 'client');
    const prismaPath = path.join(nodeModulesPath, 'prisma');
    
    if (fs.existsSync(prismaClientPath)) {
      console.log('✅ @prisma/client dependency found');
    } else {
      errors.push('❌ @prisma/client dependency not found - run npm install');
    }
    
    if (fs.existsSync(prismaPath)) {
      console.log('✅ prisma dependency found');
    } else {
      errors.push('❌ prisma dependency not found - run npm install');
    }
  } else {
    errors.push('❌ node_modules not found - run npm install');
  }
  
  // Check environment configuration
  const envExamplePath = path.join(process.cwd(), '.env.example');
  if (fs.existsSync(envExamplePath)) {
    console.log('✅ .env.example file found');
    
    const envContent = fs.readFileSync(envExamplePath, 'utf-8');
    if (envContent.includes('DATABASE_URL')) {
      console.log('✅ DATABASE_URL configuration found in .env.example');
    } else {
      warnings.push('⚠️  DATABASE_URL not found in .env.example');
    }
  } else {
    warnings.push('⚠️  .env.example file not found');
  }
  
  // Check database connection file
  const dbConnectionPath = path.join(process.cwd(), 'src', 'lib', 'database.ts');
  if (fs.existsSync(dbConnectionPath)) {
    console.log('✅ Database connection file found');
  } else {
    errors.push('❌ Database connection file not found at src/lib/database.ts');
  }
  
  // Summary
  console.log('\n📊 Validation Summary:');
  
  if (errors.length === 0) {
    console.log('🎉 Prisma setup validation passed!');
    
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    console.log('\n📋 Next steps:');
    console.log('   1. Copy .env.example to .env and configure DATABASE_URL');
    console.log('   2. Run: npm run prisma:generate');
    console.log('   3. Run: npm run prisma:migrate');
    console.log('   4. Run: npm run test:db');
    
    return true;
  } else {
    console.log('❌ Prisma setup validation failed!');
    console.log('\n🚨 Errors:');
    errors.forEach(error => console.log(`   ${error}`));
    
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    return false;
  }
}

// Run validation
const success = validatePrismaSetup();
process.exit(success ? 0 : 1);