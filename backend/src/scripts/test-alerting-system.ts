#!/usr/bin/env ts-node

/**
 * Test script for the alerting system
 * Tests alert triggering, resolution, and webhook handling
 */

import { alertingService } from '../services/alerting.service';
import { logger } from '../lib/logger';

async function testAlertingSystem() {
  console.log('🚨 Testing Company Directory Alerting System...\n');

  try {
    // Test 1: Trigger a test alert
    console.log('1. Testing alert triggering...');
    const testAlert = {
      name: 'test_high_error_rate',
      severity: 'critical' as const,
      message: 'Test alert: High error rate detected in test environment',
      details: {
        errorRate: '7.5%',
        threshold: '5%',
        duration: '5 minutes',
        affectedEndpoints: ['/api/employees', '/api/search']
      },
      timestamp: new Date()
    };

    await alertingService.triggerAlert(testAlert);
    console.log('✅ Test alert triggered successfully');

    // Test 2: Check active alerts
    console.log('\n2. Checking active alerts...');
    const activeAlerts = alertingService.getActiveAlerts();
    console.log(`✅ Found ${activeAlerts.length} active alerts`);
    
    if (activeAlerts.length > 0) {
      console.log('Active alerts:');
      activeAlerts.forEach(alert => {
        console.log(`  - ${alert.name} (${alert.severity}): ${alert.message}`);
      });
    }

    // Test 3: Test webhook alert handling
    console.log('\n3. Testing webhook alert handling...');
    const webhookData = {
      alerts: [
        {
          labels: {
            alertname: 'HighAPILatency',
            severity: 'warning',
            service: 'company-directory'
          },
          annotations: {
            summary: 'High API latency detected',
            description: '95th percentile latency is 2.5s, above 2s threshold'
          },
          status: 'firing',
          startsAt: new Date().toISOString()
        }
      ]
    };

    await alertingService.handleWebhookAlert(webhookData);
    console.log('✅ Webhook alert processed successfully');

    // Test 4: Check alert history
    console.log('\n4. Checking alert history...');
    const alertHistory = alertingService.getAlertHistory(10);
    console.log(`✅ Found ${alertHistory.length} alerts in history`);

    // Test 5: Resolve an alert
    console.log('\n5. Testing alert resolution...');
    await alertingService.resolveAlert('test_high_error_rate');
    console.log('✅ Test alert resolved successfully');

    // Test 6: Check active alerts after resolution
    console.log('\n6. Checking active alerts after resolution...');
    const activeAlertsAfterResolution = alertingService.getActiveAlerts();
    console.log(`✅ Found ${activeAlertsAfterResolution.length} active alerts after resolution`);

    // Test 7: Test alert rule checking
    console.log('\n7. Testing alert rule checking...');
    await alertingService.checkAlertRules();
    console.log('✅ Alert rule checking completed successfully');

    console.log('\n🎉 All alerting system tests passed!');
    console.log('\nNext steps:');
    console.log('1. Configure Prometheus with the provided alerting-rules.yml');
    console.log('2. Set up Alertmanager with the provided configuration');
    console.log('3. Configure email settings in environment variables:');
    console.log('   - ALERT_RECIPIENTS=admin@company.com,oncall@company.com');
    console.log('4. Test the full monitoring stack with docker-compose.monitoring.yml');

  } catch (error) {
    console.error('❌ Alerting system test failed:', error.message);
    logger.error('Alerting system test failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testAlertingSystem()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

export { testAlertingSystem };