#!/usr/bin/env tsx

/**
 * Migration Helper Script
 * Provides utilities for managing database migrations
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface MigrationInfo {
  id: string;
  checksum: string;
  finished_at: Date | null;
  migration_name: string;
  logs: string | null;
  rolled_back_at: Date | null;
  started_at: Date;
  applied_steps_count: number;
}

class MigrationHelper {
  async getMigrationStatus(): Promise<MigrationInfo[]> {
    try {
      const migrations = await prisma.$queryRaw<MigrationInfo[]>`
        SELECT * FROM "_prisma_migrations" ORDER BY started_at DESC;
      `;
      return migrations;
    } catch (error) {
      console.error('Error fetching migration status:', error);
      throw error;
    }
  }

  async getLastAppliedMigration(): Promise<MigrationInfo | null> {
    const migrations = await this.getMigrationStatus();
    return migrations.find(m => m.finished_at !== null && m.rolled_back_at === null) || null;
  }

  async getPendingMigrations(): Promise<string[]> {
    try {
      const output = execSync('npx prisma migrate status --json', { 
        encoding: 'utf8',
        cwd: path.join(__dirname, '..')
      });
      
      const status = JSON.parse(output);
      return status.pendingMigrations || [];
    } catch (error) {
      console.error('Error getting pending migrations:', error);
      return [];
    }
  }

  async validateMigrationIntegrity(): Promise<boolean> {
    try {
      // Check if all applied migrations exist in the migrations folder
      const appliedMigrations = await this.getMigrationStatus();
      const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
      
      for (const migration of appliedMigrations) {
        if (migration.finished_at && !migration.rolled_back_at) {
          const migrationPath = path.join(migrationsDir, migration.migration_name);
          if (!fs.existsSync(migrationPath)) {
            console.error(`Migration folder not found: ${migration.migration_name}`);
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error validating migration integrity:', error);
      return false;
    }
  }

  async createMigrationSnapshot(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotFile = `migration-snapshot-${timestamp}.json`;
    
    try {
      const migrations = await this.getMigrationStatus();
      const snapshot = {
        timestamp: new Date().toISOString(),
        migrations: migrations,
        schema_hash: await this.getSchemaHash()
      };
      
      fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
      console.log(`Migration snapshot created: ${snapshotFile}`);
      return snapshotFile;
    } catch (error) {
      console.error('Error creating migration snapshot:', error);
      throw error;
    }
  }

  private async getSchemaHash(): Promise<string> {
    try {
      const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      
      // Simple hash of schema content
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(schemaContent).digest('hex');
    } catch (error) {
      console.error('Error generating schema hash:', error);
      return '';
    }
  }

  async generateMigrationReport(): Promise<void> {
    try {
      const migrations = await this.getMigrationStatus();
      const pendingMigrations = await this.getPendingMigrations();
      const isValid = await this.validateMigrationIntegrity();
      
      const report = {
        timestamp: new Date().toISOString(),
        database_url: process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@'), // Hide password
        total_migrations: migrations.length,
        applied_migrations: migrations.filter(m => m.finished_at && !m.rolled_back_at).length,
        pending_migrations: pendingMigrations.length,
        failed_migrations: migrations.filter(m => !m.finished_at && !m.rolled_back_at).length,
        rolled_back_migrations: migrations.filter(m => m.rolled_back_at).length,
        integrity_check: isValid ? 'PASSED' : 'FAILED',
        migrations: migrations.map(m => ({
          name: m.migration_name,
          status: m.finished_at ? (m.rolled_back_at ? 'ROLLED_BACK' : 'APPLIED') : 'FAILED',
          started_at: m.started_at,
          finished_at: m.finished_at,
          rolled_back_at: m.rolled_back_at
        })),
        pending: pendingMigrations
      };
      
      console.log('\n=== MIGRATION REPORT ===');
      console.log(JSON.stringify(report, null, 2));
      
      // Save report to file
      const reportFile = `migration-report-${new Date().toISOString().split('T')[0]}.json`;
      fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
      console.log(`\nReport saved to: ${reportFile}`);
      
    } catch (error) {
      console.error('Error generating migration report:', error);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const helper = new MigrationHelper();
  
  try {
    switch (command) {
      case 'status':
        const migrations = await helper.getMigrationStatus();
        console.log('Migration Status:');
        migrations.forEach(m => {
          const status = m.finished_at ? (m.rolled_back_at ? 'ROLLED_BACK' : 'APPLIED') : 'FAILED';
          console.log(`  ${m.migration_name}: ${status}`);
        });
        break;
        
      case 'pending':
        const pending = await helper.getPendingMigrations();
        console.log('Pending Migrations:');
        pending.forEach(m => console.log(`  ${m}`));
        break;
        
      case 'validate':
        const isValid = await helper.validateMigrationIntegrity();
        console.log(`Migration integrity: ${isValid ? 'VALID' : 'INVALID'}`);
        process.exit(isValid ? 0 : 1);
        break;
        
      case 'snapshot':
        await helper.createMigrationSnapshot();
        break;
        
      case 'report':
        await helper.generateMigrationReport();
        break;
        
      default:
        console.log('Usage: tsx migration-helper.ts [status|pending|validate|snapshot|report]');
        console.log('');
        console.log('Commands:');
        console.log('  status    - Show applied migrations');
        console.log('  pending   - Show pending migrations');
        console.log('  validate  - Validate migration integrity');
        console.log('  snapshot  - Create migration snapshot');
        console.log('  report    - Generate comprehensive migration report');
        break;
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { MigrationHelper };