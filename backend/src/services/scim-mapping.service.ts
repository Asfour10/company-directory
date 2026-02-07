import { Employee, User } from '@prisma/client';
import {
  SCIMUser,
  SCIMName,
  SCIMEmail,
  SCIMPhoneNumber,
  SCIMEnterpriseUser,
  SCIM_SCHEMAS,
} from '../types/scim.types';

/**
 * SCIM Schema Mapping Service
 * Maps between SCIM 2.0 User schema and internal Employee/User models
 */
export class SCIMSchemaMapper {
  /**
   * Convert internal Employee/User models to SCIM User format
   */
  static toSCIMUser(employee: Employee, user?: User): SCIMUser {
    const scimUser: SCIMUser = {
      id: employee.id,
      externalId: user?.externalId || undefined,
      schemas: [SCIM_SCHEMAS.USER],
      userName: employee.email,
      active: employee.isActive && (user?.isActive ?? true),
      meta: {
        resourceType: 'User',
        created: employee.createdAt.toISOString(),
        lastModified: employee.updatedAt.toISOString(),
        location: `/scim/v2/Users/${employee.id}`,
      },
    };

    // Map name fields
    if (employee.firstName || employee.lastName) {
      scimUser.name = {
        givenName: employee.firstName,
        familyName: employee.lastName,
        formatted: `${employee.firstName} ${employee.lastName}`.trim(),
      };
    }

    // Map display name
    if (employee.firstName || employee.lastName) {
      scimUser.displayName = `${employee.firstName} ${employee.lastName}`.trim();
    }

    // Map title
    if (employee.title) {
      scimUser.title = employee.title;
    }

    // Map emails
    scimUser.emails = [
      {
        value: employee.email,
        primary: true,
        type: 'work',
      },
    ];

    // Map phone numbers
    if (employee.phone) {
      scimUser.phoneNumbers = [
        {
          value: employee.phone,
          primary: true,
          type: 'work',
        },
      ];
    }

    // Map photos
    if (employee.photoUrl) {
      scimUser.photos = [
        {
          value: employee.photoUrl,
          primary: true,
          type: 'photo',
        },
      ];
    }

    // Map enterprise extension
    if (employee.department || employee.managerId) {
      scimUser.schemas.push(SCIM_SCHEMAS.ENTERPRISE_USER);
      scimUser['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'] = {
        department: employee.department || undefined,
        manager: employee.managerId
          ? {
              value: employee.managerId,
            }
          : undefined,
      };
    }

    return scimUser;
  }

  /**
   * Convert SCIM User to internal Employee creation data
   */
  static fromSCIMUser(scimUser: SCIMUser): {
    employee: Partial<Employee>;
    user: Partial<User>;
  } {
    // Extract required fields
    const primaryEmail = this.getPrimaryEmail(scimUser);
    if (!primaryEmail) {
      throw new Error('Primary email is required');
    }

    // Map employee fields
    const employee: Partial<Employee> = {
      firstName: scimUser.name?.givenName || '',
      lastName: scimUser.name?.familyName || '',
      email: primaryEmail,
      title: scimUser.title || undefined,
      phone: this.getPrimaryPhoneNumber(scimUser) || undefined,
      photoUrl: this.getPrimaryPhoto(scimUser) || undefined,
      isActive: scimUser.active !== false, // Default to true if not specified
    };

    // Map enterprise extension fields
    const enterpriseUser = scimUser['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'];
    if (enterpriseUser) {
      employee.department = enterpriseUser.department || undefined;
      // Note: managerId will need to be resolved separately as it requires looking up the manager
    }

    // Map user fields
    const user: Partial<User> = {
      email: primaryEmail,
      externalId: scimUser.externalId || undefined,
      isActive: scimUser.active !== false,
    };

    return { employee, user };
  }

  /**
   * Update existing Employee/User from SCIM User data
   */
  static updateFromSCIMUser(
    scimUser: SCIMUser,
    existingEmployee: Employee,
    existingUser?: User
  ): {
    employee: Partial<Employee>;
    user: Partial<User>;
  } {
    const { employee, user } = this.fromSCIMUser(scimUser);

    // Only include fields that are actually being updated
    const employeeUpdate: Partial<Employee> = {};
    const userUpdate: Partial<User> = {};

    // Update employee fields if they differ
    if (employee.firstName !== undefined && employee.firstName !== existingEmployee.firstName) {
      employeeUpdate.firstName = employee.firstName;
    }
    if (employee.lastName !== undefined && employee.lastName !== existingEmployee.lastName) {
      employeeUpdate.lastName = employee.lastName;
    }
    if (employee.email !== undefined && employee.email !== existingEmployee.email) {
      employeeUpdate.email = employee.email;
    }
    if (employee.title !== undefined && employee.title !== existingEmployee.title) {
      employeeUpdate.title = employee.title;
    }
    if (employee.phone !== undefined && employee.phone !== existingEmployee.phone) {
      employeeUpdate.phone = employee.phone;
    }
    if (employee.photoUrl !== undefined && employee.photoUrl !== existingEmployee.photoUrl) {
      employeeUpdate.photoUrl = employee.photoUrl;
    }
    if (employee.department !== undefined && employee.department !== existingEmployee.department) {
      employeeUpdate.department = employee.department;
    }
    if (employee.isActive !== undefined && employee.isActive !== existingEmployee.isActive) {
      employeeUpdate.isActive = employee.isActive;
    }

    // Update user fields if they differ
    if (existingUser) {
      if (user.email !== undefined && user.email !== existingUser.email) {
        userUpdate.email = user.email;
      }
      if (user.externalId !== undefined && user.externalId !== existingUser.externalId) {
        userUpdate.externalId = user.externalId;
      }
      if (user.isActive !== undefined && user.isActive !== existingUser.isActive) {
        userUpdate.isActive = user.isActive;
      }
    }

    return { employee: employeeUpdate, user: userUpdate };
  }

  /**
   * Get primary email from SCIM user
   */
  private static getPrimaryEmail(scimUser: SCIMUser): string | null {
    if (!scimUser.emails || scimUser.emails.length === 0) {
      return scimUser.userName || null;
    }

    // Find primary email
    const primaryEmail = scimUser.emails.find(email => email.primary);
    if (primaryEmail) {
      return primaryEmail.value;
    }

    // Fall back to first email
    return scimUser.emails[0]?.value || null;
  }

  /**
   * Get primary phone number from SCIM user
   */
  private static getPrimaryPhoneNumber(scimUser: SCIMUser): string | null {
    if (!scimUser.phoneNumbers || scimUser.phoneNumbers.length === 0) {
      return null;
    }

    // Find primary phone
    const primaryPhone = scimUser.phoneNumbers.find(phone => phone.primary);
    if (primaryPhone) {
      return primaryPhone.value;
    }

    // Fall back to first phone
    return scimUser.phoneNumbers[0]?.value || null;
  }

  /**
   * Get primary photo from SCIM user
   */
  private static getPrimaryPhoto(scimUser: SCIMUser): string | null {
    if (!scimUser.photos || scimUser.photos.length === 0) {
      return null;
    }

    // Find primary photo
    const primaryPhoto = scimUser.photos.find(photo => photo.primary);
    if (primaryPhoto) {
      return primaryPhoto.value;
    }

    // Fall back to first photo
    return scimUser.photos[0]?.value || null;
  }

  /**
   * Validate required SCIM User fields
   */
  static validateSCIMUser(scimUser: SCIMUser): string[] {
    const errors: string[] = [];

    // Check required schemas
    if (!scimUser.schemas || !scimUser.schemas.includes(SCIM_SCHEMAS.USER)) {
      errors.push('Missing required schema: ' + SCIM_SCHEMAS.USER);
    }

    // Check userName
    if (!scimUser.userName) {
      errors.push('userName is required');
    }

    // Check name fields
    if (!scimUser.name?.givenName) {
      errors.push('name.givenName is required');
    }
    if (!scimUser.name?.familyName) {
      errors.push('name.familyName is required');
    }

    // Check email
    const primaryEmail = this.getPrimaryEmail(scimUser);
    if (!primaryEmail) {
      errors.push('At least one email is required');
    }

    return errors;
  }

  /**
   * Get manager ID from SCIM enterprise extension
   */
  static getManagerId(scimUser: SCIMUser): string | null {
    const enterpriseUser = scimUser['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'];
    return enterpriseUser?.manager?.value || null;
  }
}