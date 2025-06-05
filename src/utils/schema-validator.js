/**
 * Schema Validator Utility
 * Provides JSON schema validation for agent inputs and outputs
 */

import { AppError, ErrorTypes, ErrorSeverity } from './error-handler.js';

// Common field validators
export const FieldValidators = {
  filePath: (value) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new AppError('File path must be a non-empty string', ErrorTypes.VALIDATION);
    }
    return value.trim();
  },
  
  positiveNumber: (value, fieldName = 'value') => {
    const num = Number(value);
    if (isNaN(num) || num < 0) {
      throw new AppError(`${fieldName} must be a positive number`, ErrorTypes.VALIDATION);
    }
    return num;
  },
  
  dateString: (value, fieldName = 'date') => {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new AppError(`${fieldName} must be a valid date`, ErrorTypes.VALIDATION);
    }
    return date.toISOString();
  },
  
  enumValue: (value, allowedValues, fieldName = 'value') => {
    if (!allowedValues.includes(value)) {
      throw new AppError(
        `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        ErrorTypes.VALIDATION
      );
    }
    return value;
  }
};

// Schema definitions for agent inputs
export const InputSchemas = {
  inventoryIngestor: {
    file_path: { required: true, validator: FieldValidators.filePath },
    calculate_metrics: { required: false, type: 'boolean', default: true }
  },
  
  incentiveFetcher: {
    file_path: { required: true, validator: FieldValidators.filePath },
    filter_active: { required: false, type: 'boolean', default: true },
    min_value: { required: false, validator: (v) => FieldValidators.positiveNumber(v, 'min_value'), default: 0 }
  },
  
  reportGenerator: {
    inventory_data: { required: true, type: 'object' },
    incentive_data: { required: true, type: 'object' },
    output_format: {
      required: false,
      validator: (v) => FieldValidators.enumValue(v, ['json', 'html', 'pdf'], 'output_format'),
      default: 'json'
    },
    output_path: { required: false, validator: FieldValidators.filePath, default: './output' }
  }
};

// Schema definitions for agent outputs
export const OutputSchemas = {
  inventoryIngestor: {
    success: { required: true, type: 'boolean' },
    data: { required: false, type: 'array' },
    summary: { required: false, type: 'object' },
    total_vehicles: { required: false, type: 'number' },
    ingestion_date: { required: false, type: 'string' },
    error: { required: false, type: 'string' }
  },
  
  incentiveFetcher: {
    success: { required: true, type: 'boolean' },
    incentives: { required: false, type: 'array' },
    summary: { required: false, type: 'object' },
    error: { required: false, type: 'string' }
  },
  
  reportGenerator: {
    success: { required: true, type: 'boolean' },
    recommendations: { required: false, type: 'array' },
    report_path: { required: false, type: 'string' },
    timestamp: { required: false, type: 'string' },
    error: { required: false, type: 'string' }
  }
};

// Validate input against schema
export function validateInput(schemaName, input) {
  const schema = InputSchemas[schemaName];
  if (!schema) {
    throw new AppError(`Unknown input schema: ${schemaName}`, ErrorTypes.VALIDATION);
  }
  
  const validated = {};
  const errors = [];
  
  // Check required fields
  for (const [field, rules] of Object.entries(schema)) {
    if (rules.required && !(field in input)) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }
    
    let value = input[field];
    
    // Apply default if not provided
    if (!(field in input) && 'default' in rules) {
      value = rules.default;
    }
    
    // Skip if optional and not provided
    if (!(field in input) && !rules.required) {
      continue;
    }
    
    // Type validation
    if (rules.type && typeof value !== rules.type) {
      errors.push(`Field ${field} must be of type ${rules.type}`);
      continue;
    }
    
    // Custom validation
    if (rules.validator) {
      try {
        value = rules.validator(value);
      } catch (error) {
        errors.push(`Field ${field}: ${error.message}`);
        continue;
      }
    }
    
    validated[field] = value;
  }
  
  if (errors.length > 0) {
    throw new AppError(
      'Input validation failed',
      ErrorTypes.VALIDATION,
      ErrorSeverity.MEDIUM,
      { errors, input }
    );
  }
  
  return validated;
}

// Validate output against schema
export function validateOutput(schemaName, output) {
  const schema = OutputSchemas[schemaName];
  if (!schema) {
    throw new AppError(`Unknown output schema: ${schemaName}`, ErrorTypes.VALIDATION);
  }
  
  const errors = [];
  
  // Check required fields
  for (const [field, rules] of Object.entries(schema)) {
    if (rules.required && !(field in output)) {
      errors.push(`Missing required field: ${field}`);
      continue;
    }
    
    // Skip if optional and not provided
    if (!(field in output) && !rules.required) {
      continue;
    }
    
    // Type validation
    if (rules.type && field in output) {
      const actualType = Array.isArray(output[field]) ? 'array' : typeof output[field];
      if (actualType !== rules.type) {
        errors.push(`Field ${field} must be of type ${rules.type}, got ${actualType}`);
      }
    }
  }
  
  if (errors.length > 0) {
    throw new AppError(
      'Output validation failed',
      ErrorTypes.VALIDATION,
      ErrorSeverity.HIGH,
      { errors, output }
    );
  }
  
  return output;
}

// Create a standardized response
export function createStandardResponse(success, data = {}, error = null) {
  const response = {
    success,
    timestamp: new Date().toISOString()
  };
  
  if (success) {
    Object.assign(response, data);
  } else {
    response.error = error?.message || 'Unknown error';
    if (error instanceof AppError) {
      response.errorType = error.type;
      response.errorDetails = error.details;
    }
  }
  
  return response;
}