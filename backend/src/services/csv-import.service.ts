import { parse } from 'csv-parse';
import { validateImportEmployee } from '../validators/employee.validator';
import { ValidationError } from '../utils/errors';

export interface ImportEmployeeData {
  firstName: string;
  lastName: string;
  email: string;
  title?: string;
  department?: string;
  phone?: string;
  extension?: string;
  officeLocation?: string;
  managerEmail?: string;
  bio?: string;
  skills?: string;
}

export interface ParsedEmployeeRow {
  rowNumber: number;
  data: ImportEmployeeData;
  isValid: boolean;
  errors: string[];
}

export interface CSVParseResult {
  rows: ParsedEmployeeRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateEmails: string[];
  };
  isValid: boolean;
}

/**
 * Service for parsing and validating CSV files for employee import
 */
export class CSVImportService {
  private static readonly REQUIRED_COLUMNS = ['firstName', 'lastName', 'email'];
  private static readonly OPTIONAL_COLUMNS = [
    'title', 'department', 'phone', 'extension', 
    'officeLocation', 'managerEmail', 'bio', 'skills'
  ];
  private static readonly ALL_COLUMNS = [
    ...CSVImportService.REQUIRED_COLUMNS,
    ...CSVImportService.OPTIONAL_COLUMNS
  ];

  /**
   * Parse CSV buffer and validate employee data
   */
  static async parseCSV(csvBuffer: Buffer): Promise<CSVParseResult> {
    const csvString = csvBuffer.toString('utf-8');
    
    // Validate CSV format
    const formatValidation = this.validateCSVFormat(csvString);
    if (!formatValidation.isValid) {
      throw new ValidationError(
        `Invalid CSV format: ${formatValidation.errors.join(', ')}`,
        'csvFormat'
      );
    }

    const rows: ParsedEmployeeRow[] = [];
    const emailSet = new Set<string>();
    const duplicateEmails: string[] = [];

    return new Promise((resolve, reject) => {
      const records: any[] = [];
      
      parse(csvString, {
        columns: (headers) => {
          // Validate and normalize headers
          return this.validateAndNormalizeHeaders(headers);
        },
        skip_empty_lines: true,
        trim: true,
        cast: true,
        cast_date: false
      })
      .on('readable', function(this: any) {
        let record;
        while (record = this.read()) {
          records.push(record);
        }
      })
      .on('error', (error) => {
        reject(new ValidationError(
          `CSV parsing failed: ${error.message}`,
          'csvParsing'
        ));
      })
      .on('end', () => {
        // Process all records
        records.forEach((record, index) => {
          const rowNumber = index + 2; // +2 because index starts at 0 and we skip header
          
          try {
            // Parse and validate the row
            const parsedRow = this.parseEmployeeRow(record, rowNumber);
            
            // Check for duplicate emails
            const email = parsedRow.data.email.toLowerCase();
            if (emailSet.has(email)) {
              duplicateEmails.push(email);
              parsedRow.isValid = false;
              parsedRow.errors.push(`Duplicate email: ${email}`);
            } else {
              emailSet.add(email);
            }
            
            rows.push(parsedRow);
          } catch (error) {
            rows.push({
              rowNumber,
              data: {} as ImportEmployeeData,
              isValid: false,
              errors: [`Failed to parse row: ${(error as Error).message}`]
            });
          }
        });

        const validRows = rows.filter(row => row.isValid).length;
        const result: CSVParseResult = {
          rows,
          summary: {
            totalRows: rows.length,
            validRows,
            invalidRows: rows.length - validRows,
            duplicateEmails: Array.from(new Set(duplicateEmails))
          },
          isValid: validRows > 0 && duplicateEmails.length === 0
        };
        
        resolve(result);
      });
    });
  }

  /**
   * Validate CSV format and structure
   */
  private static validateCSVFormat(csvString: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if file is empty
    if (!csvString.trim()) {
      errors.push('CSV file is empty');
      return { isValid: false, errors };
    }

    // Check for basic CSV structure
    const lines = csvString.trim().split('\n');
    if (lines.length < 2) {
      errors.push('CSV file must contain at least a header row and one data row');
      return { isValid: false, errors };
    }

    // Check if first line looks like a header
    const headerLine = lines[0];
    if (!headerLine.includes(',') && !headerLine.includes(';') && !headerLine.includes('\t')) {
      errors.push('CSV file must use comma, semicolon, or tab as delimiter');
    }

    // Check for reasonable file size (max 10MB for CSV)
    const sizeInMB = Buffer.byteLength(csvString, 'utf-8') / (1024 * 1024);
    if (sizeInMB > 10) {
      errors.push('CSV file size exceeds 10MB limit');
    }

    // Check for reasonable number of rows (max 10,000)
    if (lines.length > 10001) { // +1 for header
      errors.push('CSV file contains more than 10,000 rows');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validate and normalize CSV headers
   */
  private static validateAndNormalizeHeaders(headers: string[]): string[] {
    const normalizedHeaders: string[] = [];
    const errors: string[] = [];

    // Normalize header names (trim, lowercase, remove special chars)
    const headerMap: Record<string, string> = {
      'first name': 'firstName',
      'firstname': 'firstName',
      'first_name': 'firstName',
      'last name': 'lastName',
      'lastname': 'lastName',
      'last_name': 'lastName',
      'email address': 'email',
      'email_address': 'email',
      'job title': 'title',
      'job_title': 'title',
      'position': 'title',
      'dept': 'department',
      'phone number': 'phone',
      'phone_number': 'phone',
      'telephone': 'phone',
      'ext': 'extension',
      'office': 'officeLocation',
      'office location': 'officeLocation',
      'office_location': 'officeLocation',
      'location': 'officeLocation',
      'manager email': 'managerEmail',
      'manager_email': 'managerEmail',
      'manageremail': 'managerEmail',
      'biography': 'bio',
      'description': 'bio',
      'skill': 'skills',
      'skill set': 'skills',
      'skillset': 'skills',
      'abilities': 'skills'
    };

    headers.forEach((header, index) => {
      const cleanHeader = header.trim().toLowerCase().replace(/[^a-z0-9\s_]/g, '');
      const normalizedHeader = headerMap[cleanHeader] || cleanHeader;
      
      // Check if it's a valid column
      if (this.ALL_COLUMNS.includes(normalizedHeader)) {
        normalizedHeaders.push(normalizedHeader);
      } else {
        // Try to find closest match
        const closestMatch = this.findClosestHeaderMatch(cleanHeader);
        if (closestMatch) {
          normalizedHeaders.push(closestMatch);
        } else {
          normalizedHeaders.push(`unknown_${index}`);
          errors.push(`Unknown column: ${header}`);
        }
      }
    });

    // Check for required columns
    const missingRequired = this.REQUIRED_COLUMNS.filter(
      col => !normalizedHeaders.includes(col)
    );

    if (missingRequired.length > 0) {
      throw new ValidationError(
        `Missing required columns: ${missingRequired.join(', ')}`,
        'csvHeaders'
      );
    }

    // Check for duplicate columns
    const duplicates = normalizedHeaders.filter(
      (header, index) => normalizedHeaders.indexOf(header) !== index
    );

    if (duplicates.length > 0) {
      throw new ValidationError(
        `Duplicate columns found: ${duplicates.join(', ')}`,
        'csvHeaders'
      );
    }

    return normalizedHeaders;
  }

  /**
   * Find closest header match using simple string similarity
   */
  private static findClosestHeaderMatch(header: string): string | null {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const validHeader of this.ALL_COLUMNS) {
      const score = this.calculateStringSimilarity(header, validHeader);
      if (score > bestScore && score > 0.6) { // 60% similarity threshold
        bestScore = score;
        bestMatch = validHeader;
      }
    }

    return bestMatch;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix: number[][] = [];
    
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return (maxLen - distance) / maxLen;
  }

  /**
   * Parse and validate a single employee row
   */
  private static parseEmployeeRow(row: any, rowNumber: number): ParsedEmployeeRow {
    const errors: string[] = [];
    
    // Extract and clean data
    const data: ImportEmployeeData = {
      firstName: this.cleanString(row.firstName) || '',
      lastName: this.cleanString(row.lastName) || '',
      email: this.cleanString(row.email)?.toLowerCase() || '',
      title: this.cleanString(row.title),
      department: this.cleanString(row.department),
      phone: this.cleanString(row.phone),
      extension: this.cleanString(row.extension),
      officeLocation: this.cleanString(row.officeLocation),
      managerEmail: this.cleanString(row.managerEmail)?.toLowerCase(),
      bio: this.cleanString(row.bio),
      skills: this.cleanString(row.skills)
    };

    // Validate using existing employee validator
    try {
      validateImportEmployee(data);
    } catch (error) {
      if (error instanceof Error) {
        errors.push(error.message.replace('Import validation failed: ', ''));
      }
    }

    // Additional CSV-specific validations
    this.validateRowSpecificRules(data, errors);

    return {
      rowNumber,
      data,
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Clean and normalize string values
   */
  private static cleanString(value: any): string | undefined {
    if (value === null || value === undefined || value === '') {
      return undefined;
    }
    
    if (typeof value !== 'string') {
      value = String(value);
    }
    
    return value.trim();
  }

  /**
   * Apply CSV-specific validation rules
   */
  private static validateRowSpecificRules(data: ImportEmployeeData, errors: string[]): void {
    // Validate email format more strictly for imports
    if (data.email && !this.isValidEmailFormat(data.email)) {
      errors.push(`Invalid email format: ${data.email}`);
    }

    // Validate manager email format if provided
    if (data.managerEmail && !this.isValidEmailFormat(data.managerEmail)) {
      errors.push(`Invalid manager email format: ${data.managerEmail}`);
    }

    // Parse and validate skills if provided as comma-separated string
    if (data.skills) {
      const skillsArray = data.skills.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (skillsArray.length > 20) {
        errors.push('Cannot have more than 20 skills');
      }
      
      // Check for duplicate skills
      const uniqueSkills = new Set(skillsArray.map(s => s.toLowerCase()));
      if (uniqueSkills.size !== skillsArray.length) {
        errors.push('Duplicate skills found');
      }
      
      // Validate individual skill length
      const invalidSkills = skillsArray.filter(skill => skill.length > 50);
      if (invalidSkills.length > 0) {
        errors.push(`Skills exceed 50 characters: ${invalidSkills.join(', ')}`);
      }
    }

    // Validate phone number format if provided
    if (data.phone && !this.isValidPhoneFormat(data.phone)) {
      errors.push(`Invalid phone number format: ${data.phone}`);
    }

    // Validate extension format if provided
    if (data.extension && !this.isValidExtensionFormat(data.extension)) {
      errors.push(`Invalid extension format: ${data.extension}`);
    }
  }

  /**
   * Validate email format
   */
  private static isValidEmailFormat(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  /**
   * Validate phone number format
   */
  private static isValidPhoneFormat(phone: string): boolean {
    // Remove all non-digit characters except + at the start
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('+')) {
      // International format: +1234567890 (7-15 digits after +)
      return /^\+\d{7,15}$/.test(cleaned);
    } else {
      // Domestic format: 1234567890 (7-15 digits)
      return /^\d{7,15}$/.test(cleaned);
    }
  }

  /**
   * Validate extension format
   */
  private static isValidExtensionFormat(extension: string): boolean {
    return /^[\d\-\#\*]+$/.test(extension) && extension.length <= 20;
  }

  /**
   * Generate CSV template for download
   */
  static generateCSVTemplate(): string {
    const headers = [
      'firstName',
      'lastName', 
      'email',
      'title',
      'department',
      'phone',
      'extension',
      'officeLocation',
      'managerEmail',
      'bio',
      'skills'
    ];

    const exampleRow = [
      'John',
      'Doe',
      'john.doe@company.com',
      'Software Engineer',
      'Engineering',
      '+1-555-123-4567',
      '1234',
      'Building A, Floor 2',
      'jane.smith@company.com',
      'Experienced software engineer with expertise in web development',
      'JavaScript, TypeScript, React, Node.js'
    ];

    return [
      headers.join(','),
      exampleRow.join(',')
    ].join('\n');
  }

  /**
   * Validate file size and type
   */
  static validateFile(file: Express.Multer.File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file type
    if (file.mimetype !== 'text/csv' && !file.originalname.toLowerCase().endsWith('.csv')) {
      errors.push('File must be a CSV file');
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      errors.push('File size exceeds 10MB limit');
    }

    // Check if file is empty
    if (file.size === 0) {
      errors.push('File is empty');
    }

    return { isValid: errors.length === 0, errors };
  }
}