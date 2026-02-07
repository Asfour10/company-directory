import { EmployeeRepository, CreateEmployeeData } from '../repositories/employee.repository';
import { AuditService } from './audit.service';
import { TenantService } from './tenant.service';
import { CSVImportService, ParsedEmployeeRow, ImportEmployeeData } from './csv-import.service';
import { ValidationError, ConflictError, UserLimitExceededError } from '../utils/errors';
import { EmployeeServiceContext } from './employee.service';

export interface BulkImportResult {
  summary: {
    totalRows: number;
    processed: number;
    created: number;
    updated: number;
    failed: number;
    skipped: number;
  };
  results: BulkImportRowResult[];
  errors: string[];
}

export interface BulkImportRowResult {
  rowNumber: number;
  email: string;
  status: 'created' | 'updated' | 'failed' | 'skipped';
  employeeId?: string;
  errors: string[];
  warnings: string[];
}

export interface BulkImportOptions {
  batchSize?: number;
  updateExisting?: boolean;
  skipInvalidRows?: boolean;
  validateManagerEmails?: boolean;
}

/**
 * Service for bulk importing employees from CSV data
 */
export class BulkImportService {
  private static readonly DEFAULT_BATCH_SIZE = 50;
  private static readonly MAX_BATCH_SIZE = 100;

  /**
   * Import employees from CSV file
   */
  static async importFromCSV(
    csvBuffer: Buffer,
    context: EmployeeServiceContext,
    options: BulkImportOptions = {}
  ): Promise<BulkImportResult> {
    const {
      batchSize = this.DEFAULT_BATCH_SIZE,
      updateExisting = true,
      skipInvalidRows = true,
      validateManagerEmails = true
    } = options;

    // Validate batch size
    if (batchSize > this.MAX_BATCH_SIZE) {
      throw new ValidationError(
        `Batch size cannot exceed ${this.MAX_BATCH_SIZE}`,
        'batchSize',
        batchSize
      );
    }

    // Parse CSV
    const parseResult = await CSVImportService.parseCSV(csvBuffer);
    
    if (!parseResult.isValid && !skipInvalidRows) {
      throw new ValidationError(
        'CSV contains invalid data and skipInvalidRows is false',
        'csvData',
        parseResult.summary
      );
    }

    // Check tenant user limit
    const validRowsCount = parseResult.rows.filter(row => row.isValid).length;
    const currentEmployeeCount = await EmployeeRepository.getStatistics(context.tenantId);
    const tenant = await TenantService.getTenantById(context.tenantId);
    
    if (tenant?.userLimit && (currentEmployeeCount.activeEmployees + validRowsCount) > tenant.userLimit) {
      throw new UserLimitExceededError(tenant.userLimit);
    }

    // Process rows in batches
    const results: BulkImportRowResult[] = [];
    const errors: string[] = [];
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    // Filter valid rows or all rows based on skipInvalidRows option
    const rowsToProcess = skipInvalidRows 
      ? parseResult.rows.filter(row => row.isValid)
      : parseResult.rows;

    // Process in batches
    for (let i = 0; i < rowsToProcess.length; i += batchSize) {
      const batch = rowsToProcess.slice(i, i + batchSize);
      
      try {
        const batchResult = await this.processBatch(
          batch,
          context,
          { updateExisting, validateManagerEmails }
        );
        
        results.push(...batchResult.results);
        processed += batchResult.processed;
        created += batchResult.created;
        updated += batchResult.updated;
        failed += batchResult.failed;
        skipped += batchResult.skipped;
        
        if (batchResult.errors.length > 0) {
          errors.push(...batchResult.errors);
        }
      } catch (error) {
        const batchError = `Batch ${Math.floor(i / batchSize) + 1} failed: ${(error as Error).message}`;
        errors.push(batchError);
        
        // Mark all rows in this batch as failed
        batch.forEach(row => {
          results.push({
            rowNumber: row.rowNumber,
            email: row.data.email || 'unknown',
            status: 'failed',
            errors: [batchError],
            warnings: []
          });
          failed++;
        });
      }
    }

    // Log bulk import completion
    await AuditService.logChange({
      tenantId: context.tenantId,
      userId: context.userId,
      action: 'CREATE',
      entityType: 'employee',
      entityId: 'bulk',
      newValue: JSON.stringify({
        totalRows: parseResult.summary.totalRows,
        processed,
        created,
        updated,
        failed,
        skipped,
        type: 'bulk_import'
      }),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // Track analytics event
    await AuditService.trackEvent({
      tenantId: context.tenantId,
      userId: context.userId,
      eventType: 'bulk_import_completed',
      metadata: {
        totalRows: parseResult.summary.totalRows,
        processed,
        created,
        updated,
        failed,
        skipped,
        batchSize
      },
    });

    return {
      summary: {
        totalRows: parseResult.summary.totalRows,
        processed,
        created,
        updated,
        failed,
        skipped
      },
      results,
      errors
    };
  }

  /**
   * Process a batch of employee rows
   */
  private static async processBatch(
    batch: ParsedEmployeeRow[],
    context: EmployeeServiceContext,
    options: { updateExisting: boolean; validateManagerEmails: boolean }
  ): Promise<{
    results: BulkImportRowResult[];
    processed: number;
    created: number;
    updated: number;
    failed: number;
    skipped: number;
    errors: string[];
  }> {
    const results: BulkImportRowResult[] = [];
    const errors: string[] = [];
    let processed = 0;
    let created = 0;
    let updated = 0;
    let failed = 0;
    let skipped = 0;

    // Pre-validate manager emails if required
    const managerEmailMap = new Map<string, string>();
    if (options.validateManagerEmails) {
      const managerEmails = batch
        .filter(row => row.data.managerEmail)
        .map(row => row.data.managerEmail!)
        .filter((email, index, arr) => arr.indexOf(email) === index); // unique emails

      for (const managerEmail of managerEmails) {
        try {
          const manager = await EmployeeRepository.findByEmail(context.tenantId, managerEmail);
          if (manager) {
            managerEmailMap.set(managerEmail, manager.id);
          }
        } catch (error) {
          // Manager not found - will be handled per row
        }
      }
    }

    // Process each row in the batch
    for (const row of batch) {
      try {
        if (!row.isValid) {
          results.push({
            rowNumber: row.rowNumber,
            email: row.data.email || 'unknown',
            status: 'skipped',
            errors: row.errors,
            warnings: []
          });
          skipped++;
          continue;
        }

        const result = await this.processEmployeeRow(
          row,
          context,
          managerEmailMap,
          options.updateExisting
        );
        
        results.push(result);
        processed++;
        
        if (result.status === 'created') {
          created++;
        } else if (result.status === 'updated') {
          updated++;
        } else if (result.status === 'failed') {
          failed++;
        } else if (result.status === 'skipped') {
          skipped++;
        }
        
      } catch (error) {
        const errorMessage = (error as Error).message;
        results.push({
          rowNumber: row.rowNumber,
          email: row.data.email || 'unknown',
          status: 'failed',
          errors: [errorMessage],
          warnings: []
        });
        failed++;
        errors.push(`Row ${row.rowNumber}: ${errorMessage}`);
      }
    }

    return {
      results,
      processed,
      created,
      updated,
      failed,
      skipped,
      errors
    };
  }

  /**
   * Process a single employee row
   */
  private static async processEmployeeRow(
    row: ParsedEmployeeRow,
    context: EmployeeServiceContext,
    managerEmailMap: Map<string, string>,
    updateExisting: boolean
  ): Promise<BulkImportRowResult> {
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      // Check if employee already exists
      const existingEmployee = await EmployeeRepository.findByEmail(
        context.tenantId,
        row.data.email
      );

      if (existingEmployee) {
        if (!updateExisting) {
          return {
            rowNumber: row.rowNumber,
            email: row.data.email,
            status: 'skipped',
            employeeId: existingEmployee.id,
            errors: [],
            warnings: ['Employee already exists and updateExisting is false']
          };
        }

        // Update existing employee
        const updateData = await this.prepareEmployeeData(row.data, managerEmailMap, warnings);
        
        const updatedEmployee = await EmployeeRepository.update(
          context.tenantId,
          existingEmployee.id,
          updateData
        );

        // Log the update
        await AuditService.logChange({
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'UPDATE',
          entityType: 'employee',
          entityId: updatedEmployee.id,
          oldValue: 'bulk_import_update',
          newValue: JSON.stringify({
            firstName: updatedEmployee.firstName,
            lastName: updatedEmployee.lastName,
            email: updatedEmployee.email,
            source: 'bulk_import'
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return {
          rowNumber: row.rowNumber,
          email: row.data.email,
          status: 'updated',
          employeeId: updatedEmployee.id,
          errors,
          warnings
        };
      } else {
        // Create new employee
        const createData = await this.prepareEmployeeData(row.data, managerEmailMap, warnings);
        
        const newEmployee = await EmployeeRepository.create(context.tenantId, createData);

        // Log the creation
        await AuditService.logChange({
          tenantId: context.tenantId,
          userId: context.userId,
          action: 'CREATE',
          entityType: 'employee',
          entityId: newEmployee.id,
          newValue: JSON.stringify({
            firstName: newEmployee.firstName,
            lastName: newEmployee.lastName,
            email: newEmployee.email,
            source: 'bulk_import'
          }),
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        return {
          rowNumber: row.rowNumber,
          email: row.data.email,
          status: 'created',
          employeeId: newEmployee.id,
          errors,
          warnings
        };
      }
    } catch (error) {
      if (error instanceof ConflictError || error instanceof ValidationError) {
        errors.push(error.message);
      } else {
        errors.push(`Unexpected error: ${(error as Error).message}`);
      }

      return {
        rowNumber: row.rowNumber,
        email: row.data.email,
        status: 'failed',
        errors,
        warnings
      };
    }
  }

  /**
   * Prepare employee data for creation/update
   */
  private static async prepareEmployeeData(
    importData: ImportEmployeeData,
    managerEmailMap: Map<string, string>,
    warnings: string[]
  ): Promise<CreateEmployeeData> {
    const data: CreateEmployeeData = {
      firstName: importData.firstName,
      lastName: importData.lastName,
      email: importData.email,
      title: importData.title,
      department: importData.department,
      phone: importData.phone,
      extension: importData.extension,
      officeLocation: importData.officeLocation,
      bio: importData.bio,
    };

    // Handle manager relationship
    if (importData.managerEmail) {
      const managerId = managerEmailMap.get(importData.managerEmail);
      if (managerId) {
        data.managerId = managerId;
      } else {
        warnings.push(`Manager with email '${importData.managerEmail}' not found`);
      }
    }

    // Handle skills (convert from comma-separated string to array)
    if (importData.skills) {
      data.skills = importData.skills
        .split(',')
        .map(skill => skill.trim())
        .filter(skill => skill.length > 0)
        .slice(0, 20); // Limit to 20 skills
    }

    return data;
  }

  /**
   * Validate import data against tenant constraints
   */
  static async validateImportData(
    csvBuffer: Buffer,
    context: EmployeeServiceContext
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    summary: {
      totalRows: number;
      validRows: number;
      invalidRows: number;
      duplicateEmails: string[];
      missingManagers: string[];
    };
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse CSV
      const parseResult = await CSVImportService.parseCSV(csvBuffer);
      
      // Check tenant user limit
      const validRowsCount = parseResult.rows.filter(row => row.isValid).length;
      const currentStats = await EmployeeRepository.getStatistics(context.tenantId);
      const tenant = await TenantService.getTenantById(context.tenantId);
      
      if (tenant?.userLimit && (currentStats.activeEmployees + validRowsCount) > tenant.userLimit) {
        errors.push(`Import would exceed tenant user limit of ${tenant.userLimit}`);
      }

      // Validate manager emails
      const managerEmails = parseResult.rows
        .filter(row => row.isValid && row.data.managerEmail)
        .map(row => row.data.managerEmail!)
        .filter((email, index, arr) => arr.indexOf(email) === index);

      const missingManagers: string[] = [];
      for (const managerEmail of managerEmails) {
        try {
          const manager = await EmployeeRepository.findByEmail(context.tenantId, managerEmail);
          if (!manager) {
            missingManagers.push(managerEmail);
          }
        } catch (error) {
          missingManagers.push(managerEmail);
        }
      }

      if (missingManagers.length > 0) {
        warnings.push(`Manager emails not found: ${missingManagers.join(', ')}`);
      }

      // Check for existing employees
      const existingEmails: string[] = [];
      for (const row of parseResult.rows.filter(r => r.isValid)) {
        try {
          const existing = await EmployeeRepository.findByEmail(context.tenantId, row.data.email);
          if (existing) {
            existingEmails.push(row.data.email);
          }
        } catch (error) {
          // Employee doesn't exist - this is fine
        }
      }

      if (existingEmails.length > 0) {
        warnings.push(`${existingEmails.length} employees already exist and will be updated`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        summary: {
          totalRows: parseResult.summary.totalRows,
          validRows: parseResult.summary.validRows,
          invalidRows: parseResult.summary.invalidRows,
          duplicateEmails: parseResult.summary.duplicateEmails,
          missingManagers
        }
      };
    } catch (error) {
      errors.push(`Validation failed: ${(error as Error).message}`);
      
      return {
        isValid: false,
        errors,
        warnings,
        summary: {
          totalRows: 0,
          validRows: 0,
          invalidRows: 0,
          duplicateEmails: [],
          missingManagers: []
        }
      };
    }
  }

  /**
   * Get import progress (for long-running imports)
   */
  static async getImportProgress(
    _importId: string,
    _context: EmployeeServiceContext
  ): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    processed: number;
    total: number;
    errors: string[];
  }> {
    // This would typically be stored in Redis or database
    // For now, return a placeholder implementation
    return {
      status: 'completed',
      progress: 100,
      processed: 0,
      total: 0,
      errors: []
    };
  }
}