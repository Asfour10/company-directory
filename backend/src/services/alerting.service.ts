import { logger } from '../lib/logger';
import { emailService } from './email.service';

export interface Alert {
  name: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  resolved?: boolean;
}

export interface AlertRule {
  name: string;
  condition: () => Promise<boolean>;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  cooldownMinutes: number;
  lastTriggered?: Date;
}

class AlertingService {
  private activeAlerts: Map<string, Alert> = new Map();
  private alertRules: AlertRule[] = [];
  private alertRecipients: string[] = [];

  constructor() {
    this.setupDefaultRules();
    this.loadAlertRecipients();
  }

  private setupDefaultRules() {
    // These rules complement the Prometheus alerting rules
    // They provide application-level alerting for business logic issues
    
    this.alertRules = [
      {
        name: 'high_failed_login_rate',
        condition: async () => {
          // This would check authentication failure rate
          // Implementation would depend on auth metrics
          return false;
        },
        severity: 'warning',
        message: 'High rate of failed login attempts detected',
        cooldownMinutes: 15
      },
      {
        name: 'tenant_data_breach_attempt',
        condition: async () => {
          // This would check for cross-tenant data access attempts
          // Implementation would depend on audit logs
          return false;
        },
        severity: 'critical',
        message: 'Potential tenant data breach attempt detected',
        cooldownMinutes: 5
      },
      {
        name: 'bulk_import_failures',
        condition: async () => {
          // This would check for high bulk import failure rates
          return false;
        },
        severity: 'warning',
        message: 'High rate of bulk import failures',
        cooldownMinutes: 30
      }
    ];
  }

  private loadAlertRecipients() {
    // Load from environment variables or configuration
    const recipients = process.env.ALERT_RECIPIENTS;
    if (recipients) {
      this.alertRecipients = recipients.split(',').map(email => email.trim());
    } else {
      // Default recipients for development
      this.alertRecipients = ['admin@company-directory.com'];
    }
  }

  async triggerAlert(alert: Alert): Promise<void> {
    const alertKey = `${alert.name}_${alert.timestamp.getTime()}`;
    
    // Check if this alert is already active
    if (this.activeAlerts.has(alert.name) && !alert.resolved) {
      logger.warn('Alert already active, skipping duplicate', { alertName: alert.name });
      return;
    }

    // Store the alert
    this.activeAlerts.set(alertKey, alert);

    // Log the alert
    logger.error('Alert triggered', {
      name: alert.name,
      severity: alert.severity,
      message: alert.message,
      details: alert.details,
      timestamp: alert.timestamp
    });

    // Send notifications
    await this.sendAlertNotifications(alert);

    // Update metrics
    this.updateAlertMetrics(alert);
  }

  async resolveAlert(alertName: string): Promise<void> {
    const activeAlert = Array.from(this.activeAlerts.values())
      .find(alert => alert.name === alertName && !alert.resolved);

    if (activeAlert) {
      activeAlert.resolved = true;
      activeAlert.timestamp = new Date();

      logger.info('Alert resolved', {
        name: activeAlert.name,
        resolvedAt: activeAlert.timestamp
      });

      // Send resolution notification
      await this.sendResolutionNotification(activeAlert);
    }
  }

  private async sendAlertNotifications(alert: Alert): Promise<void> {
    const subject = `[${alert.severity.toUpperCase()}] Company Directory Alert: ${alert.name}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${this.getSeverityColor(alert.severity)}; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h2 style="margin: 0;">🚨 Alert Triggered</h2>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h3>Alert Details</h3>
          <p><strong>Name:</strong> ${alert.name}</p>
          <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
          <p><strong>Timestamp:</strong> ${alert.timestamp.toISOString()}</p>
          
          ${alert.details ? `
            <h4>Additional Details:</h4>
            <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 3px; overflow-x: auto;">
${JSON.stringify(alert.details, null, 2)}
            </pre>
          ` : ''}
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
          <p><strong>Next Steps:</strong></p>
          <ul>
            <li>Check the application logs for more details</li>
            <li>Verify system health at /health endpoint</li>
            <li>Review Prometheus metrics dashboard</li>
            <li>Follow the appropriate runbook for this alert type</li>
          </ul>
        </div>
      </div>
    `;

    try {
      for (const recipient of this.alertRecipients) {
        await emailService.sendEmail({
          to: recipient,
          subject,
          html: htmlContent
        });
      }
    } catch (error) {
      logger.error('Failed to send alert notifications', { error: error.message, alert: alert.name });
    }
  }

  private async sendResolutionNotification(alert: Alert): Promise<void> {
    const subject = `[RESOLVED] Company Directory Alert: ${alert.name}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #28a745; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
          <h2 style="margin: 0;">✅ Alert Resolved</h2>
        </div>
        
        <div style="padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
          <h3>Resolution Details</h3>
          <p><strong>Alert Name:</strong> ${alert.name}</p>
          <p><strong>Original Severity:</strong> ${alert.severity.toUpperCase()}</p>
          <p><strong>Resolved At:</strong> ${alert.timestamp.toISOString()}</p>
          <p><strong>Message:</strong> ${alert.message}</p>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #d4edda; border-radius: 5px;">
          <p>The alert has been automatically resolved. The system is now operating normally.</p>
        </div>
      </div>
    `;

    try {
      for (const recipient of this.alertRecipients) {
        await emailService.sendEmail({
          to: recipient,
          subject,
          html: htmlContent
        });
      }
    } catch (error) {
      logger.error('Failed to send resolution notifications', { error: error.message, alert: alert.name });
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical':
        return '#dc3545';
      case 'warning':
        return '#ffc107';
      case 'info':
        return '#17a2b8';
      default:
        return '#6c757d';
    }
  }

  private updateAlertMetrics(alert: Alert): void {
    // This would update Prometheus metrics for alerting
    // For now, we'll just log the metric update
    logger.info('Alert metrics updated', {
      alertName: alert.name,
      severity: alert.severity,
      timestamp: alert.timestamp
    });
  }

  async checkAlertRules(): Promise<void> {
    for (const rule of this.alertRules) {
      try {
        // Check cooldown period
        if (rule.lastTriggered) {
          const cooldownMs = rule.cooldownMinutes * 60 * 1000;
          const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
          
          if (timeSinceLastTrigger < cooldownMs) {
            continue; // Still in cooldown period
          }
        }

        // Check the condition
        const shouldTrigger = await rule.condition();
        
        if (shouldTrigger) {
          const alert: Alert = {
            name: rule.name,
            severity: rule.severity,
            message: rule.message,
            timestamp: new Date()
          };

          await this.triggerAlert(alert);
          rule.lastTriggered = new Date();
        }
      } catch (error) {
        logger.error('Error checking alert rule', {
          ruleName: rule.name,
          error: error.message
        });
      }
    }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getAlertHistory(limit: number = 100): Alert[] {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // Method to be called by external monitoring systems (like Prometheus Alertmanager)
  async handleWebhookAlert(webhookData: any): Promise<void> {
    try {
      const alerts = webhookData.alerts || [];
      
      for (const alertData of alerts) {
        const alert: Alert = {
          name: alertData.labels?.alertname || 'unknown_alert',
          severity: alertData.labels?.severity || 'warning',
          message: alertData.annotations?.summary || 'Alert triggered',
          details: {
            labels: alertData.labels,
            annotations: alertData.annotations,
            status: alertData.status,
            startsAt: alertData.startsAt,
            endsAt: alertData.endsAt
          },
          timestamp: new Date(alertData.startsAt || Date.now()),
          resolved: alertData.status === 'resolved'
        };

        if (alert.resolved) {
          await this.resolveAlert(alert.name);
        } else {
          await this.triggerAlert(alert);
        }
      }
    } catch (error) {
      logger.error('Error handling webhook alert', { error: error.message, webhookData });
    }
  }
}

export const alertingService = new AlertingService();