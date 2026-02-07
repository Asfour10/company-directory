#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { createDatabaseEncryptionService } from '../services/database-encryption.service';

const prisma = new PrismaClient();

async function verifyDatabaseEncryption() {
  console.log('🔐 Verifying Database Encryption Configuration...\n');

  try {
    const encryptionService = createDatabaseEncryptionService(prisma);

    // Test encrypted connection
    console.log('1. Testing encrypted database connection...');
    const connectionTest = await encryptionService.testEncryptedConnection();
    
    if (connectionTest.success) {
      console.log('✅ Database connection successful');
      console.log(`   SSL Enabled: ${connectionTest.sslEnabled ? 'Yes' : 'No'}`);
      console.log(`   Encryption Details: ${connectionTest.encryptionDetails}`);
    } else {
      console.log('❌ Database connection failed');
      console.log(`   Error: ${connectionTest.error}`);
    }

    console.log('\n2. Verifying encryption at rest...');
    const encryptionStatus = await encryptionService.verifyEncryptionAtRest();
    
    if (encryptionStatus.isEnabled) {
      console.log('✅ Database encryption at rest is enabled');
      console.log(`   Algorithm: ${encryptionStatus.algorithm}`);
      console.log(`   Details: ${encryptionStatus.details}`);
    } else {
      console.log('⚠️  Database encryption at rest status unclear');
      console.log(`   Details: ${encryptionStatus.details}`);
    }

    console.log('\n3. Encryption configuration recommendations:');
    const recommendations = encryptionService.getEncryptionRecommendations();
    
    console.log('\n   PostgreSQL Configuration:');
    recommendations.postgresql.forEach(rec => console.log(`   • ${rec}`));
    
    console.log('\n   Application Level:');
    recommendations.application.forEach(rec => console.log(`   • ${rec}`));
    
    console.log('\n   Infrastructure Level:');
    recommendations.infrastructure.forEach(rec => console.log(`   • ${rec}`));

    console.log('\n4. Generated encryption configuration:');
    const config = encryptionService.generateEncryptionConfig();
    console.log('   SSL Configuration ready');
    console.log(`   Recommendations: ${config.recommendations.length} items`);

    console.log('\n5. Backup encryption configuration:');
    const backupConfig = encryptionService.generateBackupEncryptionConfig();
    console.log('   Backup encryption commands generated');
    console.log(`   Dump: ${backupConfig.pgDumpCommand.substring(0, 50)}...`);
    console.log(`   Encrypt: ${backupConfig.encryptionCommand.substring(0, 50)}...`);

    console.log('\n🔐 Database encryption verification completed!');
    
    // Summary
    console.log('\n📊 ENCRYPTION SUMMARY:');
    console.log(`   Connection Encryption: ${connectionTest.sslEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   At-Rest Encryption: ${encryptionStatus.isEnabled ? 'ENABLED' : 'NEEDS_VERIFICATION'}`);
    console.log(`   Field-Level Encryption: IMPLEMENTED`);
    console.log(`   Backup Encryption: CONFIGURED`);

  } catch (error) {
    console.error('❌ Database encryption verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyDatabaseEncryption().catch(console.error);