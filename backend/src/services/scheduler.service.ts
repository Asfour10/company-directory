import { notificationService } from './notification.service';

export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];

  /**
   * Start all scheduled jobs
   */
  start(): void {
    console.log('📅 Starting scheduled jobs...');

    // Run notification checks daily at 9 AM
    this.scheduleDaily('09:00', async () => {
      console.log('🔔 Running daily notification checks...');
      await notificationService.runNotificationChecks();
    });

    // Run usage warnings weekly on Mondays at 10 AM
    this.scheduleWeekly(1, '10:00', async () => {
      console.log('📊 Running weekly usage limit checks...');
      await notificationService.sendUsageLimitWarnings();
    });

    console.log('✅ Scheduled jobs started');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    console.log('🛑 Stopping scheduled jobs...');
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('✅ Scheduled jobs stopped');
  }

  /**
   * Schedule a job to run daily at a specific time
   */
  private scheduleDaily(time: string, job: () => Promise<void>): void {
    const [hours, minutes] = time.split(':').map(Number);
    
    const runJob = async () => {
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      // If the scheduled time has passed today, schedule for tomorrow
      if (now > scheduledTime) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }
      
      const delay = scheduledTime.getTime() - now.getTime();
      
      setTimeout(async () => {
        try {
          await job();
        } catch (error) {
          console.error('Scheduled job failed:', error);
        }
        
        // Schedule the next run (24 hours later)
        const interval = setInterval(async () => {
          try {
            await job();
          } catch (error) {
            console.error('Scheduled job failed:', error);
          }
        }, 24 * 60 * 60 * 1000); // 24 hours
        
        this.intervals.push(interval);
      }, delay);
    };
    
    runJob();
  }

  /**
   * Schedule a job to run weekly on a specific day and time
   */
  private scheduleWeekly(dayOfWeek: number, time: string, job: () => Promise<void>): void {
    const [hours, minutes] = time.split(':').map(Number);
    
    const runJob = async () => {
      const now = new Date();
      const scheduledTime = new Date();
      
      // Set to the desired day of the week (0 = Sunday, 1 = Monday, etc.)
      const daysUntilTarget = (dayOfWeek - now.getDay() + 7) % 7;
      scheduledTime.setDate(now.getDate() + daysUntilTarget);
      scheduledTime.setHours(hours, minutes, 0, 0);
      
      // If the scheduled time has passed this week, schedule for next week
      if (now > scheduledTime) {
        scheduledTime.setDate(scheduledTime.getDate() + 7);
      }
      
      const delay = scheduledTime.getTime() - now.getTime();
      
      setTimeout(async () => {
        try {
          await job();
        } catch (error) {
          console.error('Scheduled job failed:', error);
        }
        
        // Schedule the next run (7 days later)
        const interval = setInterval(async () => {
          try {
            await job();
          } catch (error) {
            console.error('Scheduled job failed:', error);
          }
        }, 7 * 24 * 60 * 60 * 1000); // 7 days
        
        this.intervals.push(interval);
      }, delay);
    };
    
    runJob();
  }

  /**
   * Run notification checks immediately (for testing)
   */
  async runNotificationChecksNow(): Promise<void> {
    console.log('🔔 Running notification checks immediately...');
    await notificationService.runNotificationChecks();
  }
}

export const schedulerService = new SchedulerService();