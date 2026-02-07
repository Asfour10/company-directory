import crypto from 'crypto';
import { EncryptionKeyService } from './encryption-key.service';

export interface EncryptedField {
  value: string;
  iv: string;
}

export class FieldEncryptionService {
  private keyService: EncryptionKeyService;
  private algorithm = 'aes-256-gcm';

  constructor(keyService: EncryptionKeyService) {
    this.keyService = keyService;
  }

  /**
   * Encrypt a sensitive field value
   */
  async encryptField(value: string, tenantId: string): Promise<EncryptedField> {
    if (!value || value.trim() === '') {
      return { value: '', iv: '' };
    }

    try {
      // Get or generate tenant encryption key
      const keyId = `tenant:${tenantId}`;
      let encryptionKey = this.keyService.getCachedKey(keyId);
      
      if (!encryptionKey) {
        // Generate new key if not cached
        const keyData = await this.keyService.generateTenantKey(tenantId);
        encryptionKey = keyData.plainTextKey!;
      }

      // Generate random IV for each encryption
      const iv = crypto.randomBytes(16);
      
      // Create cipher
      const cipher = crypto.createCipher(this.algorithm, encryptionKey);
      cipher.setAAD(Buffer.from(tenantId)); // Additional authenticated data
      
      // Encrypt the value
      let encrypted = cipher.update(value, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine encrypted data with auth tag
      const encryptedWithTag = encrypted + ':' + authTag.toString('base64');

      return {
        value: encryptedWithTag,
        iv: iv.toString('base64')
      };
    } catch (error) {
      throw new Error(`Field encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt a sensitive field value
   */
  async decryptField(encryptedField: EncryptedField, tenantId: string): Promise<string> {
    if (!encryptedField.value || encryptedField.value.trim() === '') {
      return '';
    }

    try {
      // Get tenant encryption key
      const keyId = `tenant:${tenantId}`;
      let encryptionKey = this.keyService.getCachedKey(keyId);
      
      if (!encryptionKey) {
        throw new Error('Encryption key not found for tenant');
      }

      // Split encrypted data and auth tag
      const parts = encryptedField.value.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted field format');
      }
      
      const encrypted = parts[0];
      const authTag = Buffer.from(parts[1], 'base64');
      const iv = Buffer.from(encryptedField.iv, 'base64');
      
      // Create decipher
      const decipher = crypto.createDecipher(this.algorithm, encryptionKey);
      decipher.setAAD(Buffer.from(tenantId)); // Additional authenticated data
      decipher.setAuthTag(authTag);
      
      // Decrypt the value
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Field decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt multiple fields in an object
   */
  async encryptFields(data: Record<string, any>, fieldsToEncrypt: string[], tenantId: string): Promise<Record<string, any>> {
    const result = { ...data };
    
    for (const fieldName of fieldsToEncrypt) {
      if (result[fieldName] && typeof result[fieldName] === 'string') {
        const encrypted = await this.encryptField(result[fieldName], tenantId);
        result[fieldName] = encrypted;
      }
    }
    
    return result;
  }

  /**
   * Decrypt multiple fields in an object
   */
  async decryptFields(data: Record<string, any>, fieldsToDecrypt: string[], tenantId: string): Promise<Record<string, any>> {
    const result = { ...data };
    
    for (const fieldName of fieldsToDecrypt) {
      if (result[fieldName] && typeof result[fieldName] === 'object' && result[fieldName].value) {
        const decrypted = await this.decryptField(result[fieldName], tenantId);
        result[fieldName] = decrypted;
      }
    }
    
    return result;
  }

  /**
   * Check if a field is encrypted
   */
  isFieldEncrypted(value: any): boolean {
    return value && 
           typeof value === 'object' && 
           typeof value.value === 'string' && 
           typeof value.iv === 'string';
  }
}

// List of sensitive fields that should be encrypted
export const SENSITIVE_FIELDS = [
  'phone',
  'personalEmail',
  'ssn',
  'bankAccount',
  'emergencyContact'
];

// Factory function
export function createFieldEncryptionService(keyService: EncryptionKeyService): FieldEncryptionService {
  return new FieldEncryptionService(keyService);
}