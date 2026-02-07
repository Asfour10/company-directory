// SCIM 2.0 Schema Types
// Based on RFC 7643: System for Cross-domain Identity Management (SCIM) Schema

export interface SCIMResource {
  id?: string;
  externalId?: string;
  meta?: SCIMMeta;
  schemas: string[];
}

export interface SCIMMeta {
  resourceType: string;
  created?: string;
  lastModified?: string;
  location?: string;
  version?: string;
}

export interface SCIMName {
  formatted?: string;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
}

export interface SCIMEmail {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMPhoneNumber {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMAddress {
  formatted?: string;
  streetAddress?: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMPhoto {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMEntitlement {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMRole {
  value: string;
  display?: string;
  type?: string;
  primary?: boolean;
}

export interface SCIMUser extends SCIMResource {
  userName: string;
  name?: SCIMName;
  displayName?: string;
  nickName?: string;
  profileUrl?: string;
  title?: string;
  userType?: string;
  preferredLanguage?: string;
  locale?: string;
  timezone?: string;
  active?: boolean;
  password?: string;
  emails?: SCIMEmail[];
  phoneNumbers?: SCIMPhoneNumber[];
  ims?: any[];
  photos?: SCIMPhoto[];
  addresses?: SCIMAddress[];
  groups?: any[];
  entitlements?: SCIMEntitlement[];
  roles?: SCIMRole[];
  x509Certificates?: any[];
  // Enterprise User Schema Extension
  'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'?: SCIMEnterpriseUser;
}

export interface SCIMEnterpriseUser {
  employeeNumber?: string;
  costCenter?: string;
  organization?: string;
  division?: string;
  department?: string;
  manager?: {
    value?: string;
    $ref?: string;
    displayName?: string;
  };
}

export interface SCIMListResponse<T> {
  schemas: string[];
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources: T[];
}

export interface SCIMError {
  schemas: string[];
  status: string;
  scimType?: string;
  detail?: string;
}

export interface SCIMPatchOperation {
  op: 'add' | 'remove' | 'replace';
  path?: string;
  value?: any;
}

export interface SCIMPatchRequest {
  schemas: string[];
  Operations: SCIMPatchOperation[];
}

// SCIM Schema URNs
export const SCIM_SCHEMAS = {
  USER: 'urn:ietf:params:scim:schemas:core:2.0:User',
  ENTERPRISE_USER: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
  LIST_RESPONSE: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
  PATCH_OP: 'urn:ietf:params:scim:api:messages:2.0:PatchOp',
  ERROR: 'urn:ietf:params:scim:api:messages:2.0:Error',
} as const;

// SCIM Error Types
export const SCIM_ERROR_TYPES = {
  INVALID_FILTER: 'invalidFilter',
  TOO_MANY: 'tooMany',
  UNIQUENESS: 'uniqueness',
  MUTABILITY: 'mutability',
  INVALID_SYNTAX: 'invalidSyntax',
  INVALID_PATH: 'invalidPath',
  NO_TARGET: 'noTarget',
  INVALID_VALUE: 'invalidValue',
  INVALID_VERS: 'invalidVers',
  SENSITIVE: 'sensitive',
} as const;