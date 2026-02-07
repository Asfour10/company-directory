import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { KeyClient } from '@azure/keyvault-keys';
import { DefaultAzureCredential } from '@azure/identity';
import crypto from 'crypto';

export interface EncryptionKey {
  keyId: string;
  encryptedKey: string;
  plainTextKey?: Buffer;
}

export interface KeyManagementConfig {
  provider: 'aws' | 'azure' | 'local';
  awsConfig?: {
    region: string;
    keyId: string;
  };
  azureConfig?: {
    vaultUrl: string;
    keyName: string;
  };
}

export class EncryptionKeyService {
  private kmsClient?: KMSClient;
  private keyClient?: KeyClient;
  private config: KeyManagementConfig;
  private keyCache: Map<string, Buffer> = new Map();

  constructor(config: KeyManagementConfig) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients(): void {
    if (this.config.provider === 'aws' && this.config.awsConfig) {
      this.kmsClient = new KMSClient({ 
        region: this.config.awsConfig.region 
      });
    } else if (this.config.provider === 'azure' && this.config.azureConfig) {
      const credential = new DefaultAzureCredential();
      this.keyClient = new KeyClient(this.config.azureConfig.vaultUrl, credential);
    }
  }

  /**
   * Generate a new data encryption key for a tenant
   */
  async generateTenantKey(tenantId: string): Promise<EncryptionKey> {
    const cacheKey = `tenant:${tenantId}`;
    
    if (this.config.provider === 'aws' && this.kmsClient && this.config.awsConfig) {
      return this.generateAwsKey(cacheKey);
    } else if (this.config.provider === 'azure' && this.keyClient && this.config.azureConfig) {
      return this.generateAzureKey(cacheKey);
    } else {
      // Local development fallback
      return this.generateLocalKey(cacheKey);
    }
  }

  private async generateAwsKey(keyId: string): Promise<EncryptionKey> {
    if (!this.kmsClient || !this.config.awsConfig) {
      throw new Error('AWS KMS not configured');
    }

    const command = new GenerateDataKeyCommand({
      KeyId: this.config.awsConfig.keyId,
      KeySpec: 'AES_256'
    });

    const result = await this.kmsClient.send(command);
    
    if (!result.Plaintext || !result.CiphertextBlob) {
      throw new Error('Failed to generate AWS data key');
    }

    const plainTextKey = Buffer.from(result.Plaintext);
    const encryptedKey = Buffer.from(result.CiphertextBlob).toString('base64');

    // Cache the plaintext key
    this.keyCache.set(keyId, plainTextKey);

    return {
      keyId,
      encryptedKey,
      plainTextKey
    };
  }

  private async generateAzureKey(keyId: string): Promise<EncryptionKey> {
    if (!this.keyClient || !this.config.azureConfig) {
      throw new Error('Azure Key Vault not configured');
    }

    // Generate a random 256-bit key
    const plainTextKey = crypto.randomBytes(32);
    
    // In a real implementation, you would encrypt this key using Azure Key Vault
    // For now, we'll use a simplified approach
    const encryptedKey = Buffer.from(plainTextKey).toString('base64');

    // Cache the plaintext key
    this.keyCache.set(keyId, plainTextKey);

    return {
      keyId,
      encryptedKey,
      plainTextKey
    };
  }

  private generateLocalKey(keyId: string): EncryptionKey {
    // For local development only - NOT for production
    const plainTextKey = crypto.randomBytes(32);
    const encryptedKey = Buffer.from(plainTextKey).toString('base64');

    // Cache the plaintext key
    this.keyCache.set(keyId, plainTextKey);

    return {
      keyId,
      encryptedKey,
      plainTextKey
    };
  }

  /**
   * Decrypt an encrypted data key
   */
  async decryptKey(encryptedKey: string, keyId: string): Promise<Buffer> {
    // Check cache first
    const cachedKey = this.keyCache.get(keyId);
    if (cachedKey) {
      return cachedKey;
    }

    if (this.config.provider === 'aws' && this.kmsClient) {
      return this.decryptAwsKey(encryptedKey, keyId);
    } else if (this.config.provider === 'azure') {
      return this.decryptAzureKey(encryptedKey, keyId);
    } else {
      // Local development fallback
      return this.decryptLocalKey(encryptedKey, keyId);
    }
  }

  private async decryptAwsKey(encryptedKey: string, keyId: string): Promise<Buffer> {
    if (!this.kmsClient) {
      throw new Error('AWS KMS not configured');
    }

    const command = new DecryptCommand({
      CiphertextBlob: Buffer.from(encryptedKey, 'base64')
    });

    const result = await this.kmsClient.send(command);
    
    if (!result.Plaintext) {
      throw new Error('Failed to decrypt AWS data key');
    }

    const plainTextKey = Buffer.from(result.Plaintext);
    
    // Cache the decrypted key
    this.keyCache.set(keyId, plainTextKey);
    
    return plainTextKey;
  }

  private decryptAzureKey(encryptedKey: string, keyId: string): Buffer {
    // For local development - in production this would use Azure Key Vault
    const plainTextKey = Buffer.from(encryptedKey, 'base64');
    
    // Cache the decrypted key
    this.keyCache.set(keyId, plainTextKey);
    
    return plainTextKey;
  }

  private decryptLocalKey(encryptedKey: string, keyId: string): Buffer {
    // For local development only
    const plainTextKey = Buffer.from(encryptedKey, 'base64');
    
    // Cache the decrypted key
    this.keyCache.set(keyId, plainTextKey);
    
    return plainTextKey;
  }

  /**
   * Clear cached keys (for security)
   */
  clearKeyCache(): void {
    this.keyCache.clear();
  }

  /**
   * Get cached key if available
   */
  getCachedKey(keyId: string): Buffer | undefined {
    return this.keyCache.get(keyId);
  }
}

// Factory function to create encryption key service
export function createEncryptionKeyService(): EncryptionKeyService {
  const config: KeyManagementConfig = {
    provider: (process.env.ENCRYPTION_PROVIDER as 'aws' | 'azure' | 'local') || 'local',
    awsConfig: process.env.ENCRYPTION_PROVIDER === 'aws' ? {
      region: process.env.AWS_REGION || 'us-east-1',
      keyId: process.env.AWS_KMS_KEY_ID || ''
    } : undefined,
    azureConfig: process.env.ENCRYPTION_PROVIDER === 'azure' ? {
      vaultUrl: process.env.AZURE_KEY_VAULT_URL || '',
      keyName: process.env.AZURE_KEY_NAME || ''
    } : undefined
  };

  return new EncryptionKeyService(config);
}