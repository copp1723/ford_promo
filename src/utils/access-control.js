/**
 * Access Control Utility
 * Manages user roles and permissions for the PromoPilot system
 */

import { AppError, ErrorTypes, ErrorSeverity } from './error-handler.js';
import logger from './logger.js';

// Define user roles
export const UserRoles = {
  ADMIN: 'admin',
  OPERATOR: 'operator',
  VIEWER: 'viewer',
  API: 'api'
};

// Define permissions
export const Permissions = {
  // Data permissions
  READ_INVENTORY: 'read:inventory',
  WRITE_INVENTORY: 'write:inventory',
  READ_INCENTIVES: 'read:incentives',
  WRITE_INCENTIVES: 'write:incentives',
  
  // Report permissions
  GENERATE_REPORTS: 'generate:reports',
  VIEW_REPORTS: 'view:reports',
  EXPORT_REPORTS: 'export:reports',
  
  // System permissions
  MANAGE_CONFIG: 'manage:config',
  VIEW_LOGS: 'view:logs',
  MANAGE_USERS: 'manage:users',
  
  // API permissions
  API_FULL_ACCESS: 'api:full',
  API_READ_ONLY: 'api:read'
};

// Role-permission mapping
const rolePermissions = {
  [UserRoles.ADMIN]: [
    Permissions.READ_INVENTORY,
    Permissions.WRITE_INVENTORY,
    Permissions.READ_INCENTIVES,
    Permissions.WRITE_INCENTIVES,
    Permissions.GENERATE_REPORTS,
    Permissions.VIEW_REPORTS,
    Permissions.EXPORT_REPORTS,
    Permissions.MANAGE_CONFIG,
    Permissions.VIEW_LOGS,
    Permissions.MANAGE_USERS,
    Permissions.API_FULL_ACCESS
  ],
  
  [UserRoles.OPERATOR]: [
    Permissions.READ_INVENTORY,
    Permissions.READ_INCENTIVES,
    Permissions.GENERATE_REPORTS,
    Permissions.VIEW_REPORTS,
    Permissions.EXPORT_REPORTS,
    Permissions.VIEW_LOGS
  ],
  
  [UserRoles.VIEWER]: [
    Permissions.READ_INVENTORY,
    Permissions.READ_INCENTIVES,
    Permissions.VIEW_REPORTS
  ],
  
  [UserRoles.API]: [
    Permissions.API_READ_ONLY,
    Permissions.READ_INVENTORY,
    Permissions.READ_INCENTIVES,
    Permissions.VIEW_REPORTS
  ]
};

// User context class
export class UserContext {
  constructor(userId, role, additionalPermissions = []) {
    this.userId = userId;
    this.role = role;
    this.permissions = new Set([
      ...(rolePermissions[role] || []),
      ...additionalPermissions
    ]);
    this.sessionId = generateSessionId();
    this.createdAt = new Date();
  }
  
  hasPermission(permission) {
    return this.permissions.has(permission);
  }
  
  hasAnyPermission(permissions) {
    return permissions.some(p => this.permissions.has(p));
  }
  
  hasAllPermissions(permissions) {
    return permissions.every(p => this.permissions.has(p));
  }
  
  toJSON() {
    return {
      userId: this.userId,
      role: this.role,
      permissions: Array.from(this.permissions),
      sessionId: this.sessionId,
      createdAt: this.createdAt.toISOString()
    };
  }
}

// Generate session ID
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Check permission middleware
export function requirePermission(permission) {
  return (userContext) => {
    const log = logger.child('access-control');
    
    if (!userContext) {
      throw new AppError(
        'No user context provided',
        ErrorTypes.VALIDATION,
        ErrorSeverity.HIGH
      );
    }
    
    if (!userContext.hasPermission(permission)) {
      log.warn('Permission denied', {
        userId: userContext.userId,
        required: permission,
        userPermissions: Array.from(userContext.permissions)
      });
      
      throw new AppError(
        `Permission denied: ${permission}`,
        ErrorTypes.VALIDATION,
        ErrorSeverity.HIGH,
        { required: permission, userId: userContext.userId }
      );
    }
    
    log.debug('Permission granted', {
      userId: userContext.userId,
      permission
    });
    
    return true;
  };
}

// Check multiple permissions
export function requireAnyPermission(...permissions) {
  return (userContext) => {
    const log = logger.child('access-control');
    
    if (!userContext) {
      throw new AppError(
        'No user context provided',
        ErrorTypes.VALIDATION,
        ErrorSeverity.HIGH
      );
    }
    
    if (!userContext.hasAnyPermission(permissions)) {
      log.warn('Permission denied - none of required permissions', {
        userId: userContext.userId,
        required: permissions,
        userPermissions: Array.from(userContext.permissions)
      });
      
      throw new AppError(
        `Permission denied: requires one of ${permissions.join(', ')}`,
        ErrorTypes.VALIDATION,
        ErrorSeverity.HIGH,
        { required: permissions, userId: userContext.userId }
      );
    }
    
    return true;
  };
}

// Audit log helper
export function auditLog(userContext, action, details = {}) {
  const log = logger.child('audit');
  
  log.info('Audit log', {
    userId: userContext.userId,
    role: userContext.role,
    sessionId: userContext.sessionId,
    action,
    details,
    timestamp: new Date().toISOString()
  });
}

// Create default user contexts for testing
export function createDefaultUserContext(role = UserRoles.OPERATOR) {
  return new UserContext(`default_${role}`, role);
}

// Validate role
export function validateRole(role) {
  if (!Object.values(UserRoles).includes(role)) {
    throw new AppError(
      `Invalid role: ${role}`,
      ErrorTypes.VALIDATION,
      ErrorSeverity.MEDIUM,
      { validRoles: Object.values(UserRoles) }
    );
  }
  return role;
}