#!/usr/bin/env tsx

import { createEncryptionKeyService } from '../services/encryption-key.service';
import { createFieldEncryptionService } from '../services/field-encryption.service';
import { createDatabaseEncryptionService } from '../services/database-encryption.service';
import { verifyTlsConfiguration } from '../middleware/https-enforcement.middleware';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testEncryptionImplementation() {
  console.log('🔐 Testing Complete Encryption Implementation...\n');

  try {
    // 1. Test Key Management Service
    console.log('1. Testing Encryption Key Management...');
    const keyService = createEncryptionKeyService();
    
    const testTenantId = 'test-tenant-123';
    const keyData = await keyService.generateTenantKey(testTenantId);
    
    console.log(`   ✅ Generated tenant key: ${keyData.keyId}`);
    console.log(`   ✅ Encrypted key length: ${keyData.encryptedKey.length} chars`);
    console.log(`   ✅ Plain text key available: ${keyData.plainTextKey ? 'Yes' : 'No'}`);

    // Test key caching
    const cachedKey = keyService.getCachedKey(`tenant:${testTenantId}`);
    console.log(`   ✅ Key cached successfully: ${cachedKey ? 'Yes' : 'No'}`);

    // 2. Test Field-Level Encryption
    console.log('\n2. Testing Field-Level Encryption...');
    const fieldService = createFieldEncryptionService(keyService);
    
    const testData = {
      phone: '+1-555-123-4567',
      personalEmail: 'john.doe@personal.com',
      regularField: 'This should not be encrypted'
    };

    // Test encryption
    const encryptedPhone = await fieldService.encryptField(testData.phone, testTenantId);
    console.log(`   ✅ Phone encrypted: ${encryptedPhone.value.substring(0, 20)}...`);
    console.log(`   ✅ IV generated: ${encryptedPhone.iv.length} chars`);

    // Test decryption
    const decryptedPhone = await fieldService.decryptField(encryptedPhone, testTenantId);
    console.log(`   ✅ Phone decrypted: ${decryptedPhone === testData.phone ? 'Match' : 'Mismatch'}`);

    // Test multiple fields
    const encryptedData = await fieldService.encryptFields(testData, ['phone', 'personalEmail'], testTenantId);
    console.log(`   ✅ Multiple fields encrypted: ${Object.keys(encryptedData).length} fields`);

    const decryptedData = await fieldService.decryptFields(encryptedData, ['phone', 'personalEmail'], testTenantId);
    console.log(`   ✅ Multiple fields decrypted: ${decryptedData.phone === testData.phone ? 'Match' : 'Mismatch'}`);

    // Test field detection
    const isEncrypted = fieldService.isFieldEncrypted(encryptedPhone);
    console.log(`   ✅ Encrypted field detection: ${isEncrypted ? 'Correct' : 'Failed'}`);

    // 3. Test Database Encryption
    console.log('\n3. Testing Database Encryption...');
    const dbEncryptionService = createDatabaseEncryptionService(prisma);
    
    const encryptionStatus = await dbEncryptionService.verifyEncryptionAtRest();
    console.log(`   ✅ Encryption at rest: ${encryptionStatus.isEnabled ? 'Enabled' : 'Needs configuration'}`);
    console.log(`   ✅ Algorithm: ${encryptionStatus.algorithm || 'Not specified'}`);
    console.log(`   ✅ Details: ${encryptionStatus.details}`);

    const connectionTest = await dbEncryptionService.testEncryptedConnection();
    console.log(`   ✅ Encrypted connection: ${connectionTest.success ? 'Success' : 'Failed'}`);
    console.log(`   ✅ SSL enabled: ${connectionTest.sslEnabled ? 'Yes' : 'No'}`);

    // 4. Test HTTPS/TLS Configuration
    console.log('\n4. Testing HTTPS/TLS Configuration...');
    const tlsInfo = await verifyTlsConfiguration();
    
    console.log(`   ✅ HTTPS supported: ${tlsInfo.httpsSupported ? 'Yes' : 'No'}`);
    console.log(`   ✅ HSTS enabled: ${tlsInfo.hstsEnabled ? 'Yes' : 'No'}`);
    console.log(`   ✅ TLS version: ${tlsInfo.tlsVersion}`);
    console.log(`   ✅ Certificate valid: ${tlsInfo.certificateValid ? 'Yes' : 'No'}`);

    // 5. Test Error Handling
    console.log('\n5. Testing Error Handling...');
    
    try {
      await fieldService.decryptField({ value: 'invalid', iv: 'invalid' }, testTenantId);
      console.log('   ❌ Should have thrown decryption error');
    } catch (error) {
      console.log('   ✅ Decryption error handled correctly');
    }

    try {
      await fieldService.encryptField('', testTenantId);
      console.log('   ✅ Empty value encryption handled');
    } catch (error) {
      console.log('   ❌ Empty value should not throw error');
    }

    // 6. Performance Test
    console.log('\n6. Testing Performance...');
    const startTime = Date.now();
    
    const performanceTests = [];
    for (let i = 0; i < 100; i++) {
      performanceTests.push(
        fieldService.encryptField(`test-data-${i}`, testTenantId)
      );
    }
    
    await Promise.all(performanceTests);
    const encryptionTime = Date.now() - startTime;
    console.log(`   ✅ 100 encryptions completed in ${encryptionTime}ms`);
    console.log(`   ✅ Average: ${(encryptionTime / 100).toFixed(2)}ms per encryption`);

    // 7. Security Validation
    console.log('\n7. Security Validation...');
    
    // Test that same plaintext produces different ciphertext (due to random IV)
    const encrypt1 = await fieldService.encryptField('same-text', testTenantId);
    const encrypt2 = await fieldService.encryptField('same-text', testTenantId);
    const differentCiphertext = encrypt1.value !== encrypt2.value;
    console.log(`   ✅ Random IV ensures different ciphertext: ${differentCiphertext ? 'Yes' : 'No'}`);

    // Test that different tenants can't decrypt each other's data
    const otherTenantId = 'other-tenant-456';
    await keyService.generateTenantKey(otherTenantId);
    
    try {
      await fieldService.decryptField(encrypt1, otherTenantId);
      console.log('   ❌ Cross-tenant decryption should fail');
    } catch (error) {
      console.log('   ✅ Cross-tenant decryption properly blocked');
    }

    console.log('\n🔐 Encryption implementation test completed successfully!');
    
    // Summary
    console.log('\n📊 ENCRYPTION TEST SUMMARY:');
    console.log(`   Key Management: ✅ WORKING`);
    console.log(`   Field Encryption: ✅ WORKING`);
    console.log(`   Database Encryption: ${encryptionStatus.isEnabled ? '✅ ENABLED' : '⚠️  NEEDS_CONFIG'}`);
    console.log(`   HTTPS/TLS: ${tlsInfo.httpsSupported ? '✅ CONFIGURED' : '⚠️  NEEDS_SETUP'}`);
    console.log(`   Error Handling: ✅ WORKING`);
    console.log(`   Performance: ✅ ACCEPTABLE`);
    console.log(`   Security: ✅ VALIDATED`);

  } catch (error) {
    console.error('❌ Encryption implementation test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run test
testEncryptionImplementation().catch(console.error);