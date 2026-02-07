import multer from 'multer';
import { Request } from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { AppError, ValidationError } from '../utils/errors';

// AWS SDK v2 imports
import AWS from 'aws-sdk';

export interface UploadConfig {
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  destination: 'local' | 's3' | 'azure';
  s3Config?: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  };
  azureConfig?: {
    connectionString: string;
    containerName: string;
  };
  localConfig?: {
    uploadPath: string;
    baseUrl: string;
  };
}

export interface UploadResult {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  path?: string;
  key?: string;
}

/**
 * File upload service supporting multiple storage backends
 */
export class FileUploadService {
  private config: UploadConfig;
  private s3?: AWS.S3;

  constructor(config: UploadConfig) {
    this.config = config;
    
    if (config.destination === 's3' && config.s3Config) {
      this.s3 = new AWS.S3({
        region: config.s3Config.region,
        accessKeyId: config.s3Config.accessKeyId,
        secretAccessKey: config.s3Config.secretAccessKey,
        endpoint: config.s3Config.endpoint,
      });
    }
  }

  /**
   * Create multer middleware for file uploads
   */
  createUploadMiddleware(fieldName: string = 'photo') {
    const storage = this.config.destination === 'local' 
      ? this.createLocalStorage()
      : multer.memoryStorage();

    return multer({
      storage,
      limits: {
        fileSize: this.config.maxFileSize,
        files: 1,
      },
      fileFilter: this.createFileFilter(),
    }).single(fieldName);
  }

  /**
   * Create local storage configuration
   */
  private createLocalStorage(): multer.StorageEngine {
    return multer.diskStorage({
      destination: async (_req, _file, cb) => {
        const uploadPath = this.config.localConfig?.uploadPath || 'uploads';
        
        // Create directory if it doesn't exist
        try {
          await fs.mkdir(uploadPath, { recursive: true });
          cb(null, uploadPath);
        } catch (error) {
          cb(error as Error, '');
        }
      },
      filename: (_req, file, cb) => {
        const uniqueName = this.generateUniqueFilename(file.originalname);
        cb(null, uniqueName);
      },
    });
  }

  /**
   * Create file filter for validation
   */
  private createFileFilter() {
    return (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
      // Check MIME type
      if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
        return cb(new ValidationError(
          `Invalid file type. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`,
          'file',
          file.mimetype
        ));
      }

      // Check file extension
      const ext = path.extname(file.originalname).toLowerCase();
      if (!this.config.allowedExtensions.includes(ext)) {
        return cb(new ValidationError(
          `Invalid file extension. Allowed extensions: ${this.config.allowedExtensions.join(', ')}`,
          'file',
          ext
        ));
      }

      cb(null, true);
    };
  }

  /**
   * Upload file to configured storage
   */
  async uploadFile(file: Express.Multer.File, tenantId: string, userId?: string): Promise<UploadResult> {
    if (!file) {
      throw new ValidationError('No file provided', 'file');
    }

    const filename = this.generateUniqueFilename(file.originalname, tenantId, userId);

    switch (this.config.destination) {
      case 's3':
        return this.uploadToS3(file, filename);
      case 'azure':
        return this.uploadToAzure(file, filename);
      case 'local':
      default:
        return this.uploadToLocal(file, filename);
    }
  }

  /**
   * Upload file to AWS S3
   */
  private async uploadToS3(file: Express.Multer.File, filename: string): Promise<UploadResult> {
    if (!this.s3 || !this.config.s3Config) {
      throw new AppError('S3 configuration not available', 500, 'S3_CONFIG_ERROR');
    }

    const key = `profile-photos/${filename}`;
    
    try {
      const params = {
        Bucket: this.config.s3Config.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      };

      await this.s3.upload(params).promise();

      const url = `https://${this.config.s3Config.bucket}.s3.${this.config.s3Config.region}.amazonaws.com/${key}`;

      return {
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url,
        key,
      };
    } catch (error) {
      throw new AppError(
        `Failed to upload file to S3: ${(error as Error).message}`,
        500,
        'S3_UPLOAD_ERROR'
      );
    }
  }

  /**
   * Upload file to Azure Blob Storage
   */
  private async uploadToAzure(_file: Express.Multer.File, _filename: string): Promise<UploadResult> {
    // Azure Blob Storage implementation would go here
    // For now, throw an error indicating it's not implemented
    throw new AppError('Azure Blob Storage not implemented yet', 501, 'AZURE_NOT_IMPLEMENTED');
  }

  /**
   * Upload file to local storage
   */
  private async uploadToLocal(file: Express.Multer.File, filename: string): Promise<UploadResult> {
    const uploadPath = this.config.localConfig?.uploadPath || 'uploads';
    const baseUrl = this.config.localConfig?.baseUrl || '/uploads';
    
    // If file is already saved by multer (disk storage), just return the info
    if (file.path) {
      return {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `${baseUrl}/${file.filename}`,
        path: file.path,
      };
    }

    // If using memory storage, save the file
    const filePath = path.join(uploadPath, filename);
    
    try {
      await fs.writeFile(filePath, file.buffer);
      
      return {
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `${baseUrl}/${filename}`,
        path: filePath,
      };
    } catch (error) {
      throw new AppError(
        `Failed to save file locally: ${(error as Error).message}`,
        500,
        'LOCAL_UPLOAD_ERROR'
      );
    }
  }

  /**
   * Delete file from storage
   */
  async deleteFile(fileUrl: string, key?: string): Promise<void> {
    switch (this.config.destination) {
      case 's3':
        return this.deleteFromS3(key || this.extractS3KeyFromUrl(fileUrl));
      case 'azure':
        return this.deleteFromAzure(fileUrl);
      case 'local':
      default:
        return this.deleteFromLocal(fileUrl);
    }
  }

  /**
   * Delete file from S3
   */
  private async deleteFromS3(key: string): Promise<void> {
    if (!this.s3 || !this.config.s3Config) {
      throw new AppError('S3 configuration not available', 500, 'S3_CONFIG_ERROR');
    }

    try {
      const params = {
        Bucket: this.config.s3Config.bucket,
        Key: key,
      };

      await this.s3.deleteObject(params).promise();
    } catch (error) {
      throw new AppError(
        `Failed to delete file from S3: ${(error as Error).message}`,
        500,
        'S3_DELETE_ERROR'
      );
    }
  }

  /**
   * Delete file from Azure
   */
  private async deleteFromAzure(_fileUrl: string): Promise<void> {
    // Azure implementation would go here
    throw new AppError('Azure Blob Storage not implemented yet', 501, 'AZURE_NOT_IMPLEMENTED');
  }

  /**
   * Delete file from local storage
   */
  private async deleteFromLocal(fileUrl: string): Promise<void> {
    const baseUrl = this.config.localConfig?.baseUrl || '/uploads';
    const uploadPath = this.config.localConfig?.uploadPath || 'uploads';
    
    // Extract filename from URL
    const filename = fileUrl.replace(baseUrl + '/', '');
    const filePath = path.join(uploadPath, filename);
    
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // Don't throw error if file doesn't exist
      if ((error as any).code !== 'ENOENT') {
        throw new AppError(
          `Failed to delete local file: ${(error as Error).message}`,
          500,
          'LOCAL_DELETE_ERROR'
        );
      }
    }
  }

  /**
   * Generate signed URL for private file access (S3 only)
   */
  async generateSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.config.destination !== 's3' || !this.s3 || !this.config.s3Config) {
      throw new AppError('Signed URLs only available for S3 storage', 400, 'SIGNED_URL_NOT_AVAILABLE');
    }

    try {
      const params = {
        Bucket: this.config.s3Config.bucket,
        Key: key,
        Expires: expiresIn,
      };

      return this.s3.getSignedUrl('getObject', params);
    } catch (error) {
      throw new AppError(
        `Failed to generate signed URL: ${(error as Error).message}`,
        500,
        'SIGNED_URL_ERROR'
      );
    }
  }

  /**
   * Validate image dimensions and content
   */
  async validateImage(file: Express.Multer.File): Promise<{
    width: number;
    height: number;
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    // Basic validation
    if (!file.buffer && !file.path) {
      errors.push('File buffer or path required for validation');
      return { width: 0, height: 0, isValid: false, errors };
    }

    // For a production implementation, you would use a library like 'sharp' or 'jimp'
    // to validate image dimensions and content. For now, we'll do basic validation.
    
    // Check file size
    if (file.size > this.config.maxFileSize) {
      errors.push(`File size ${file.size} exceeds maximum allowed size ${this.config.maxFileSize}`);
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
      errors.push(`MIME type ${file.mimetype} not allowed`);
    }

    // For demo purposes, assume valid dimensions
    const width = 800;
    const height = 600;

    return {
      width,
      height,
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate unique filename
   */
  private generateUniqueFilename(originalName: string, tenantId?: string, userId?: string): string {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    
    let filename = `${timestamp}-${random}${ext}`;
    
    if (tenantId && userId) {
      filename = `${tenantId}-${userId}-${filename}`;
    } else if (tenantId) {
      filename = `${tenantId}-${filename}`;
    }
    
    return filename;
  }

  /**
   * Extract S3 key from URL
   */
  private extractS3KeyFromUrl(url: string): string {
    // Extract key from S3 URL
    const urlParts = url.split('/');
    return urlParts.slice(-2).join('/'); // Get last two parts (folder/filename)
  }

  /**
   * Get file info without downloading
   */
  async getFileInfo(key: string): Promise<{
    exists: boolean;
    size?: number;
    lastModified?: Date;
    contentType?: string;
  }> {
    if (this.config.destination === 's3' && this.s3 && this.config.s3Config) {
      try {
        const params = {
          Bucket: this.config.s3Config.bucket,
          Key: key,
        };

        const response = await this.s3.headObject(params).promise();
        
        return {
          exists: true,
          size: response.ContentLength,
          lastModified: response.LastModified,
          contentType: response.ContentType,
        };
      } catch (error) {
        return { exists: false };
      }
    }

    // For local storage
    if (this.config.destination === 'local') {
      const uploadPath = this.config.localConfig?.uploadPath || 'uploads';
      const filePath = path.join(uploadPath, key);
      
      try {
        const stats = await fs.stat(filePath);
        return {
          exists: true,
          size: stats.size,
          lastModified: stats.mtime,
        };
      } catch (error) {
        return { exists: false };
      }
    }

    return { exists: false };
  }
}

/**
 * Default configuration for profile photos
 */
export const profilePhotoConfig: UploadConfig = {
  maxFileSize: 2 * 1024 * 1024, // 2MB
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
  destination: (process.env.UPLOAD_DESTINATION as 'local' | 's3' | 'azure') || 'local',
  s3Config: process.env.AWS_S3_BUCKET ? {
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
  localConfig: {
    uploadPath: process.env.UPLOAD_PATH || 'uploads/profile-photos',
    baseUrl: process.env.UPLOAD_BASE_URL || '/uploads/profile-photos',
  },
};

/**
 * Create file upload service instance for profile photos
 */
export const profilePhotoUploadService = new FileUploadService(profilePhotoConfig);