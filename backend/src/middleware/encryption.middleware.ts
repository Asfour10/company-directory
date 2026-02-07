import { Request, Response, NextFunction } from 'express';
import { createEncryptionKeyService } from '../services/encryption-key.service';
import { createFieldEncryptionService, SENSITIVE_FIELDS } from '../services/field-encryption.service';

export interface EncryptionContext {
  keyService: any;
  fieldService: any;
}

// Add encryption services to request context
export function encryptionMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const keyService = createEncryptionKeyService();
    const fieldService = createFieldEncryptionService(keyService);
    
    // Add encryption services to request
    (req as any).encryption = {
      keyService,
      fieldService
    };
    
    next();
  } catch (error) {
    console.error('Encryption middleware error:', error);
    res.status(500).json({ error: 'Encryption service unavailable' });
  }
}

// Helper function to encrypt employee data before saving
export async function encryptEmployeeData(data: any, tenantId: string, fieldService: any): Promise<any> {
  const fieldsToEncrypt = SENSITIVE_FIELDS.filter(field => 
    data[field] && typeof data[field] === 'string'
  );
  
  if (fieldsToEncrypt.length === 0) {
    return data;
  }
  
  return await fieldService.encryptFields(data, fieldsToEncrypt, tenantId);
}

// Helper function to decrypt employee data after retrieval
export async function decryptEmployeeData(data: any, tenantId: string, fieldService: any): Promise<any> {
  const fieldsToDecrypt = SENSITIVE_FIELDS.filter(field => 
    data[field] && fieldService.isFieldEncrypted(data[field])
  );
  
  if (fieldsToDecrypt.length === 0) {
    return data;
  }
  
  return await fieldService.decryptFields(data, fieldsToDecrypt, tenantId);
}