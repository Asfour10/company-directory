import { EmployeeService, EmployeeServiceContext } from './employee.service';
import { createEncryptionKeyService } from './encryption-key.service';
import { createFieldEncryptionService, SENSITIVE_FIELDS } from './field-encryption.service';
import { CreateEmployeeData, UpdateEmployeeData } from '../repositories/employee.repository';

/**
 * Extended employee service with encryption capabilities
 */
export class EmployeeEncryptionService extends EmployeeService {
  private static keyService = createEncryptionKeyService();
  private static fieldService = createFieldEncryptionService(this.keyService);

  /**
   * Create employee with field encryption
   */
  static async createEmployeeWithEncryption(
    data: CreateEmployeeData,
    context: EmployeeServiceContext
  ) {
    // Encrypt sensitive fields before saving
    const encryptedData = await this.encryptSensitiveFields(data, context.tenantId);
    
    // Call parent create method with encrypted data
    const employee = await super.createEmployee(encryptedData, context);
    
    // Decrypt fields for response
    return await this.decryptSensitiveFields(employee, context.tenantId);
  }

  /**
   * Update employee with field encryption
   */
  static async updateEmployeeWithEncryption(
    employeeId: string,
    data: UpdateEmployeeData,
    context: EmployeeServiceContext
  ) {
    // Encrypt sensitive fields before saving
    const encryptedData = await this.encryptSensitiveFields(data, context.tenantId);
    
    // Call parent update method with encrypted data
    const employee = await super.updateEmployee(employeeId, encryptedData, context);
    
    // Decrypt fields for response
    return await this.decryptSensitiveFields(employee, context.tenantId);
  }

  /**
   * Get employee by ID with decryption
   */
  static async getEmployeeByIdWithDecryption(
    employeeId: string,
    context: EmployeeServiceContext
  ) {
    const employee = await super.getEmployeeById(employeeId, context);
    
    if (!employee) {
      return null;
    }
    
    // Decrypt sensitive fields for response
    return await this.decryptSensitiveFields(employee, context.tenantId);
  }

  /**
   * Get employees with decryption
   */
  static async getEmployeesWithDecryption(
    filters: any,
    pagination: any,
    context: EmployeeServiceContext
  ) {
    const result = await super.getEmployees(filters, pagination, context);
    
    // Decrypt sensitive fields for all employees
    const decryptedEmployees = await Promise.all(
      result.employees.map(employee => 
        this.decryptSensitiveFields(employee, context.tenantId)
      )
    );
    
    return {
      ...result,
      employees: decryptedEmployees
    };
  }

  /**
   * Encrypt sensitive fields in employee data
   */
  private static async encryptSensitiveFields(data: any, tenantId: string): Promise<any> {
    const result = { ...data };
    
    // Ensure tenant has encryption key
    await this.ensureTenantEncryptionKey(tenantId);
    
    // Encrypt each sensitive field
    for (const fieldName of SENSITIVE_FIELDS) {
      if (result[fieldName] && typeof result[fieldName] === 'string') {
        try {
          const encrypted = await this.fieldService.encryptField(result[fieldName], tenantId);
          result[fieldName] = encrypted;
        } catch (error) {
          console.error(`Failed to encrypt field ${fieldName}:`, error);
          // Continue with unencrypted value for now
        }
      }
    }
    
    return result;
  }

  /**
   * Decrypt sensitive fields in employee data
   */
  private static async decryptSensitiveFields(data: any, tenantId: string): Promise<any> {
    if (!data) return data;
    
    const result = { ...data };
    
    // Decrypt each sensitive field
    for (const fieldName of SENSITIVE_FIELDS) {
      if (result[fieldName] && this.fieldService.isFieldEncrypted(result[fieldName])) {
        try {
          const decrypted = await this.fieldService.decryptField(result[fieldName], tenantId);
          result[fieldName] = decrypted;
        } catch (error) {
          console.error(`Failed to decrypt field ${fieldName}:`, error);
          // Set to null if decryption fails
          result[fieldName] = null;
        }
      }
    }
    
    return result;
  }

  /**
   * Ensure tenant has an encryption key
   */
  private static async ensureTenantEncryptionKey(tenantId: string): Promise<void> {
    const keyId = `tenant:${tenantId}`;
    
    // Check if key is already cached
    if (this.keyService.getCachedKey(keyId)) {
      return;
    }
    
    try {
      // Generate or retrieve tenant encryption key
      await this.keyService.generateTenantKey(tenantId);
    } catch (error) {
      console.error(`Failed to ensure encryption key for tenant ${tenantId}:`, error);
      throw new Error('Encryption key setup failed');
    }
  }

  /**
   * Initialize encryption for existing tenant
   */
  static async initializeTenantEncryption(tenantId: string): Promise<void> {
    try {
      const keyData = await this.keyService.generateTenantKey(tenantId);
      
      // Store the encrypted key in the tenant record
      // This would require updating the tenant service
      console.log(`Encryption initialized for tenant ${tenantId}`);
    } catch (error) {
      console.error(`Failed to initialize encryption for tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Migrate existing employee data to encrypted format
   */
  static async migrateEmployeeDataToEncrypted(tenantId: string): Promise<void> {
    // This would be used for migrating existing data
    // Implementation would depend on specific migration requirements
    console.log(`Migration to encrypted format for tenant ${tenantId} - not implemented`);
  }
}