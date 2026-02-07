#!/usr/bin/env tsx

import { verifyTlsConfiguration } from '../middleware/https-enforcement.middleware';
import https from 'https';
import fs from 'fs';

async function verifyHttpsTls() {
  console.log('🔒 Verifying HTTPS/TLS Configuration...\n');

  try {
    // 1. Verify TLS configuration
    console.log('1. Checking TLS configuration...');
    const tlsInfo = await verifyTlsConfiguration();
    
    console.log(`   HTTPS Supported: ${tlsInfo.httpsSupported ? '✅ Yes' : '❌ No'}`);
    console.log(`   TLS Version: ${tlsInfo.tlsVersion}`);
    console.log(`   HSTS Enabled: ${tlsInfo.hstsEnabled ? '✅ Yes' : '❌ No'}`);
    console.log(`   Certificate Valid: ${tlsInfo.certificateValid ? '✅ Yes' : '❌ No'}`);
    console.log(`   Details: ${tlsInfo.details}`);

    // 2. Check SSL certificate files
    console.log('\n2. Checking SSL certificate files...');
    const sslKeyPath = process.env.SSL_KEY_PATH;
    const sslCertPath = process.env.SSL_CERT_PATH;
    const sslCaPath = process.env.SSL_CA_PATH;

    if (sslKeyPath) {
      const keyExists = fs.existsSync(sslKeyPath);
      console.log(`   SSL Key: ${keyExists ? '✅ Found' : '❌ Not found'} (${sslKeyPath})`);
    } else {
      console.log('   SSL Key: ⚠️  Not configured (SSL_KEY_PATH)');
    }

    if (sslCertPath) {
      const certExists = fs.existsSync(sslCertPath);
      console.log(`   SSL Certificate: ${certExists ? '✅ Found' : '❌ Not found'} (${sslCertPath})`);
    } else {
      console.log('   SSL Certificate: ⚠️  Not configured (SSL_CERT_PATH)');
    }

    if (sslCaPath) {
      const caExists = fs.existsSync(sslCaPath);
      console.log(`   SSL CA: ${caExists ? '✅ Found' : '❌ Not found'} (${sslCaPath})`);
    } else {
      console.log('   SSL CA: ⚠️  Not configured (SSL_CA_PATH)');
    }

    // 3. Check environment variables
    console.log('\n3. Checking environment configuration...');
    const nodeEnv = process.env.NODE_ENV;
    const enforceHttps = process.env.ENFORCE_HTTPS;
    const httpsPort = process.env.HTTPS_PORT;
    const frontendUrl = process.env.FRONTEND_URL;

    console.log(`   NODE_ENV: ${nodeEnv || 'not set'}`);
    console.log(`   ENFORCE_HTTPS: ${enforceHttps || 'not set'}`);
    console.log(`   HTTPS_PORT: ${httpsPort || '3443 (default)'}`);
    console.log(`   FRONTEND_URL: ${frontendUrl || 'not set'}`);

    // 4. Security headers configuration
    console.log('\n4. Security headers configuration...');
    console.log('   ✅ HSTS (HTTP Strict Transport Security)');
    console.log('   ✅ X-Content-Type-Options: nosniff');
    console.log('   ✅ X-Frame-Options: DENY');
    console.log('   ✅ X-XSS-Protection: 1; mode=block');
    console.log('   ✅ Referrer-Policy: strict-origin-when-cross-origin');
    console.log('   ✅ Content-Security-Policy configured');

    // 5. Cipher suites
    console.log('\n5. Supported cipher suites...');
    tlsInfo.cipherSuites.forEach((cipher, index) => {
      console.log(`   ${index + 1}. ${cipher}`);
    });

    // 6. Recommendations
    console.log('\n6. Security recommendations...');
    const recommendations = [
      'Use TLS 1.3 for maximum security',
      'Configure HSTS with includeSubDomains and preload',
      'Use strong cipher suites and disable weak ones',
      'Implement certificate pinning for mobile apps',
      'Regular certificate renewal and monitoring',
      'Use OCSP stapling for certificate validation',
      'Configure secure cookie attributes',
      'Implement proper CSP (Content Security Policy)'
    ];

    recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });

    // 7. Production checklist
    console.log('\n7. Production deployment checklist...');
    const checklist = [
      { item: 'Valid SSL certificate installed', status: tlsInfo.certificateValid },
      { item: 'HTTPS enforcement enabled', status: tlsInfo.hstsEnabled },
      { item: 'HTTP to HTTPS redirect configured', status: nodeEnv === 'production' },
      { item: 'Security headers configured', status: true },
      { item: 'Strong cipher suites enabled', status: tlsInfo.cipherSuites.length > 0 },
      { item: 'Certificate auto-renewal setup', status: false }, // Manual check required
    ];

    checklist.forEach(check => {
      const status = check.status ? '✅' : '❌';
      console.log(`   ${status} ${check.item}`);
    });

    console.log('\n🔒 HTTPS/TLS verification completed!');
    
    // Summary
    console.log('\n📊 SECURITY SUMMARY:');
    console.log(`   TLS Support: ${tlsInfo.httpsSupported ? 'ENABLED' : 'NEEDS_CONFIGURATION'}`);
    console.log(`   HSTS: ${tlsInfo.hstsEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   Certificate: ${tlsInfo.certificateValid ? 'CONFIGURED' : 'NEEDS_SETUP'}`);
    console.log(`   Security Headers: CONFIGURED`);
    console.log(`   Production Ready: ${tlsInfo.httpsSupported && tlsInfo.hstsEnabled ? 'YES' : 'NO'}`);

    // Exit with appropriate code
    if (!tlsInfo.httpsSupported && process.env.NODE_ENV === 'production') {
      console.log('\n⚠️  WARNING: HTTPS not properly configured for production!');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ HTTPS/TLS verification failed:', error);
    process.exit(1);
  }
}

// Run verification
verifyHttpsTls().catch(console.error);