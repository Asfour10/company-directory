import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      if (!process.env.SMTP_HOST) {
        console.log('📧 Email not configured, would send:', options.subject);
        return;
      }

      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@company-directory.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      console.log(`📧 Email sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      console.error('Failed to send email:', error);
      throw error;
    }
  }

  /**
   * Send billing renewal reminder
   */
  async sendRenewalReminder(tenantId: string, daysUntilRenewal: number): Promise<void> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          users: {
            where: { role: 'super_admin', isActive: true },
            select: { email: true },
          },
        },
      });

      if (!tenant || tenant.users.length === 0) {
        console.log('No super admin found for tenant:', tenantId);
        return;
      }

      const renewalDate = tenant.currentPeriodEnd 
        ? new Date(tenant.currentPeriodEnd).toLocaleDateString()
        : 'Unknown';

      const subject = `Subscription Renewal Reminder - ${tenant.name}`;
      const html = this.generateRenewalReminderHtml(tenant.name, daysUntilRenewal, renewalDate, tenant.subscriptionTier);

      // Send to all super admins
      for (const user of tenant.users) {
        await this.sendEmail({
          to: user.email,
          subject,
          html,
        });
      }
    } catch (error) {
      console.error('Failed to send renewal reminder:', error);
      throw error;
    }
  }

  /**
   * Send payment failure notification
   */
  async sendPaymentFailureNotification(tenantId: string, invoiceId: string, amount: number): Promise<void> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          users: {
            where: { role: 'super_admin', isActive: true },
            select: { email: true },
          },
        },
      });

      if (!tenant || tenant.users.length === 0) {
        console.log('No super admin found for tenant:', tenantId);
        return;
      }

      const subject = `Payment Failed - Action Required - ${tenant.name}`;
      const html = this.generatePaymentFailureHtml(tenant.name, invoiceId, amount, tenant.subdomain);

      // Send to all super admins
      for (const user of tenant.users) {
        await this.sendEmail({
          to: user.email,
          subject,
          html,
        });
      }
    } catch (error) {
      console.error('Failed to send payment failure notification:', error);
      throw error;
    }
  }

  /**
   * Send usage limit warning
   */
  async sendUsageLimitWarning(tenantId: string, usagePercentage: number, currentCount: number, limit: number): Promise<void> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          users: {
            where: { role: { in: ['admin', 'super_admin'] }, isActive: true },
            select: { email: true },
          },
        },
      });

      if (!tenant || tenant.users.length === 0) {
        console.log('No admin found for tenant:', tenantId);
        return;
      }

      const subject = `Usage Limit Warning - ${tenant.name}`;
      const html = this.generateUsageLimitWarningHtml(
        tenant.name, 
        usagePercentage, 
        currentCount, 
        limit, 
        tenant.subscriptionTier,
        tenant.subdomain
      );

      // Send to all admins and super admins
      for (const user of tenant.users) {
        await this.sendEmail({
          to: user.email,
          subject,
          html,
        });
      }
    } catch (error) {
      console.error('Failed to send usage limit warning:', error);
      throw error;
    }
  }

  private generateRenewalReminderHtml(tenantName: string, daysUntilRenewal: number, renewalDate: string, subscriptionTier: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Subscription Renewal Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Subscription Renewal Reminder</h2>
          </div>
          
          <p>Hello,</p>
          
          <p>This is a friendly reminder that your Company Directory subscription for <strong>${tenantName}</strong> will renew in <strong>${daysUntilRenewal} days</strong> on ${renewalDate}.</p>
          
          <p><strong>Current Plan:</strong> ${subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)}</p>
          
          <p>Your subscription will automatically renew unless you make changes to your billing settings.</p>
          
          <p>If you need to update your payment method or make changes to your subscription, please visit your billing portal:</p>
          
          <a href="https://${tenantName.toLowerCase().replace(/\s+/g, '-')}.directory-platform.com/admin/billing" class="button">Manage Billing</a>
          
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          
          <p>Best regards,<br>The Company Directory Team</p>
          
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePaymentFailureHtml(tenantName: string, invoiceId: string, amount: number, subdomain: string): string {
    const formattedAmount = (amount / 100).toFixed(2);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Payment Failed - Action Required</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .alert { background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⚠️ Payment Failed - Action Required</h2>
          </div>
          
          <div class="alert">
            <strong>Immediate Action Required:</strong> Your payment for ${tenantName} has failed and your service may be interrupted.
          </div>
          
          <p>Hello,</p>
          
          <p>We were unable to process your payment for your Company Directory subscription.</p>
          
          <p><strong>Details:</strong></p>
          <ul>
            <li>Organization: ${tenantName}</li>
            <li>Invoice ID: ${invoiceId}</li>
            <li>Amount: $${formattedAmount}</li>
            <li>Date: ${new Date().toLocaleDateString()}</li>
          </ul>
          
          <p>To avoid service interruption, please update your payment method and retry the payment as soon as possible.</p>
          
          <a href="https://${subdomain}.directory-platform.com/admin/billing" class="button">Update Payment Method</a>
          
          <p><strong>What happens next?</strong></p>
          <ul>
            <li>We'll retry the payment automatically over the next few days</li>
            <li>If payment continues to fail, your service may be suspended</li>
            <li>You'll receive additional notifications before any service interruption</li>
          </ul>
          
          <p>If you need assistance or have questions about this payment failure, please contact our support team immediately.</p>
          
          <p>Best regards,<br>The Company Directory Team</p>
          
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
            <p>If you believe this is an error, please contact support.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateUsageLimitWarningHtml(
    tenantName: string, 
    usagePercentage: number, 
    currentCount: number, 
    limit: number, 
    subscriptionTier: string,
    subdomain: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Usage Limit Warning</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ffc107; color: #212529; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .progress-bar { background-color: #e9ecef; height: 20px; border-radius: 10px; margin: 10px 0; }
          .progress-fill { background-color: ${usagePercentage >= 90 ? '#dc3545' : '#ffc107'}; height: 100%; border-radius: 10px; width: ${usagePercentage}%; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⚠️ Usage Limit Warning</h2>
          </div>
          
          <div class="warning">
            <strong>Warning:</strong> You are approaching your user limit for ${tenantName}.
          </div>
          
          <p>Hello,</p>
          
          <p>Your Company Directory usage is getting close to your subscription limit.</p>
          
          <p><strong>Current Usage:</strong></p>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
          <p>${currentCount} of ${limit} users (${usagePercentage}%)</p>
          
          <p><strong>Current Plan:</strong> ${subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)}</p>
          
          <p>To avoid service interruption when adding new employees, consider upgrading your subscription:</p>
          
          <a href="https://${subdomain}.directory-platform.com/admin/billing/upgrade" class="button">Upgrade Subscription</a>
          
          <p><strong>What happens when you reach the limit?</strong></p>
          <ul>
            <li>You won't be able to add new employees</li>
            <li>Existing employees will continue to work normally</li>
            <li>You'll see upgrade prompts in the admin interface</li>
          </ul>
          
          <p>If you have any questions about upgrading or need assistance, please contact our support team.</p>
          
          <p>Best regards,<br>The Company Directory Team</p>
          
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();