import { PrismaClient } from '@prisma/client';

export interface DatabaseEncryptionConfig {
  enabled: boolean;
  algorithm: string;
  keyRotationDays: number;
  verificationQuery: string;
}

/**
 * Service for managing database encryption at rest
 */
export class DatabaseEncryptionService {
  private prisma: PrismaClient;
  private config: DatabaseEncryptionConfig;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.config = {
      enabled: process.env.DB_ENCRYPTION_ENABLED === 'true',
      algorithm: process.env.DB_ENCRYPTION_ALGORITHM || 'AES-256',
      keyRotationDays: parseInt(process.env.DB_KEY_ROTATION_DAYS || '90'),
      verificationQuery: 'SELECT current_setting(\'encrypt.enabled\') as encryption_status'
    };
  }

  /**
   * Verify that database encryption is enabled
   */
  async verifyEncryptionAtRest(): Promise<{
    isEnabled: boolean;
    algorithm?: string;
    details: string;
  }> {
    try {
      // Check if PostgreSQL has encryption enabled
      // This is a simplified check - actual implementation would depend on PostgreSQL configuration
      const result = await this.prisma.$queryRaw`
        SELECT 
          current_setting('ssl', true) as ssl_enabled,
          current_setting('shared_preload_libraries', true) as preload_libs,
          version() as pg_version
      ` as any[];

      const sslEnabled = result[0]?.ssl_enabled === 'on';
      const version = result[0]?.pg_version || 'Unknown';
      
      // Check for TDE (Transparent Data Encryption) extensions
      const extensionCheck = await this.prisma.$queryRaw`
        SELECT extname FROM pg_extension WHERE extname IN ('pg_tde', 'tde_heap_basic')
      ` as any[];

      const hasTdeExtension = extensionCheck.length > 0;

      return {
        isEnabled: sslEnabled || hasTdeExtension || this.config.enabled,
        algorithm: this.config.algorithm,
        details: `SSL: ${sslEnabled}, TDE Extensions: ${hasTdeExtension}, PostgreSQL: ${version}`
      };
    } catch (error) {
      return {
        isEnabled: false,
        details: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get encryption configuration recommendations
   */
  getEncryptionRecommendations(): {
    postgresql: string[];
    application: string[];
    infrastructure: string[];
  } {
    return {
      postgresql: [
        'Enable SSL/TLS for all connections (ssl = on)',
        'Configure data_encryption_key for transparent data encryption',
        'Use encrypted tablespaces for sensitive data',
        'Enable log_statement encryption',
        'Configure pg_tde extension if available'
      ],
      application: [
        'Use field-level encryption for sensitive data',
        'Implement proper key management with KMS',
        'Rotate encryption keys regularly',
        'Use secure connection strings with SSL parameters'
      ],
      infrastructure: [
        'Enable disk encryption at the OS level',
        'Use encrypted storage volumes (AWS EBS encryption, Azure Disk Encryption)',
        'Configure encrypted backups',
        'Implement network encryption (VPN, private networks)'
      ]
    };
  }

  /**
   * Generate database encryption configuration
   */
  generateEncryptionConfig(): {
    connectionString: string;
    sslConfig: Record<string, any>;
    recommendations: string[];
  } {
    const baseUrl = process.env.DATABASE_URL || '';
    const url = new URL(baseUrl);
    
    // Add SSL parameters for encryption in transit
    url.searchParams.set('sslmode', 'require');
    url.searchParams.set('sslcert', process.env.DB_SSL_CERT || '');
    url.searchParams.set('sslkey', process.env.DB_SSL_KEY || '');
    url.searchParams.set('sslrootcert', process.env.DB_SSL_ROOT_CERT || '');

    return {
      connectionString: url.toString(),
      sslConfig: {
        rejectUnauthorized: true,
        ca: process.env.DB_SSL_CA,
        cert: process.env.DB_SSL_CERT,
        key: process.env.DB_SSL_KEY
      },
      recommendations: [
        'Configure PostgreSQL with ssl = on',
        'Use encrypted storage volumes',
        'Enable connection encryption with SSL certificates',
        'Consider transparent data encryption (TDE) for highly sensitive data',
        'Implement regular key rotation policies'
      ]
    };
  }

  /**
   * Test database connection with encryption
   */
  async testEncryptedConnection(): Promise<{
    success: boolean;
    sslEnabled: boolean;
    encryptionDetails: string;
    error?: string;
  }> {
    try {
      // Test basic connection
      await this.prisma.$connect();
      
      // Check SSL status
      const sslCheck = await this.prisma.$queryRaw`
        SELECT 
          inet_server_addr() as server_addr,
          inet_server_port() as server_port,
          current_setting('ssl', true) as ssl_setting
      ` as any[];

      const sslEnabled = sslCheck[0]?.ssl_setting === 'on';
      
      // Get connection encryption info
      const encryptionInfo = await this.prisma.$queryRaw`
        SELECT 
          current_setting('ssl_cipher', true) as ssl_cipher,
          current_setting('ssl_version', true) as ssl_version
      ` as any[];

      const cipher = encryptionInfo[0]?.ssl_cipher || 'Not available';
      const version = encryptionInfo[0]?.ssl_version || 'Not available';

      return {
        success: true,
        sslEnabled,
        encryptionDetails: `SSL Cipher: ${cipher}, SSL Version: ${version}`
      };
    } catch (error) {
      return {
        success: false,
        sslEnabled: false,
        encryptionDetails: 'Connection failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Create encrypted backup configuration
   */
  generateBackupEncryptionConfig(): {
    pgDumpCommand: string;
    encryptionCommand: string;
    restoreCommand: string;
  } {
    const dbUrl = process.env.DATABASE_URL || '';
    const backupKey = process.env.BACKUP_ENCRYPTION_KEY || 'backup-key';
    
    return {
      pgDumpCommand: `pg_dump "${dbUrl}" --no-password --verbose`,
      encryptionCommand: `openssl enc -aes-256-cbc -salt -in backup.sql -out backup.sql.enc -k ${backupKey}`,
      restoreCommand: `openssl enc -aes-256-cbc -d -in backup.sql.enc -out backup.sql -k ${backupKey} && psql "${dbUrl}" < backup.sql`
    };
  }
}

// Factory function
export function createDatabaseEncryptionService(prisma: PrismaClient): DatabaseEncryptionService {
  return new DatabaseEncryptionService(prisma);
}