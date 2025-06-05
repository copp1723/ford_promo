/**
 * Common Utility Functions
 * Reusable functions to reduce code duplication across the PromoPilot application
 */

import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { AppError, ErrorTypes } from './error-handler.js';

/**
 * Check if a file exists and throw an error if not
 * @param {string} filePath - Path to the file to check
 * @param {string} [fileType='File'] - Type of file for error message
 * @returns {Promise<void>}
 * @throws {AppError} If file doesn't exist
 * @example
 * await checkFileExists('./data/inventory.csv', 'Inventory file');
 */
export async function checkFileExists(filePath, fileType = 'File') {
  if (!await fs.pathExists(filePath)) {
    throw new AppError(
      `${fileType} not found: ${filePath}`,
      ErrorTypes.FILE_SYSTEM
    );
  }
}

/**
 * Create a standardized response object
 * @param {boolean} success - Whether the operation was successful
 * @param {Object} [data={}] - Data to include in response
 * @param {Error|null} [error=null] - Error object if operation failed
 * @returns {Object} Standardized response object
 * @example
 * return createResponse(true, { data: results, summary: stats });
 * return createResponse(false, {}, error);
 */
export function createResponse(success, data = {}, error = null) {
  const response = {
    success,
    timestamp: new Date().toISOString(),
    ...data
  };
  
  if (!success && error) {
    response.error = error.message || 'Unknown error occurred';
    if (error instanceof AppError) {
      response.errorType = error.type;
      response.errorDetails = error.details;
    }
  }
  
  return response;
}

/**
 * Handle errors with consistent logging and response format
 * @param {Error} error - The error to handle
 * @param {string} operation - Name of the operation that failed
 * @param {Object} logger - Logger instance
 * @returns {Object} Error response object
 * @example
 * catch (error) {
 *   return handleError(error, 'Inventory ingestion', logger);
 * }
 */
export function handleError(error, operation, logger) {
  logger.error(`${operation} failed:`, { 
    error: error.message, 
    stack: error.stack 
  });
  
  return createResponse(false, {}, error);
}

/**
 * Format a vehicle line string
 * @param {number|string} year - Vehicle year
 * @param {string} make - Vehicle make
 * @param {string} model - Vehicle model
 * @returns {string} Formatted vehicle line
 * @example
 * const line = formatVehicleLine(2024, 'Honda', 'Civic'); // "2024 Honda Civic"
 */
export function formatVehicleLine(year, make, model) {
  return `${year} ${make} ${model}`.trim();
}

/**
 * Increment a counter in an object, creating it if it doesn't exist
 * @param {Object} obj - Object containing counters
 * @param {string} key - Key to increment
 * @param {number} [amount=1] - Amount to increment by
 * @returns {number} New value after increment
 * @example
 * const counts = {};
 * incrementCounter(counts, 'Honda'); // returns 1
 * incrementCounter(counts, 'Honda'); // returns 2
 */
export function incrementCounter(obj, key, amount = 1) {
  obj[key] = (obj[key] || 0) + amount;
  return obj[key];
}

/**
 * Get current date as ISO string
 * @param {boolean} [dateOnly=false] - If true, returns only date part (YYYY-MM-DD)
 * @returns {string} Formatted date string
 * @example
 * getISODate(); // "2024-01-15T10:30:45.123Z"
 * getISODate(true); // "2024-01-15"
 */
export function getISODate(dateOnly = false) {
  const isoString = new Date().toISOString();
  return dateOnly ? isoString.split('T')[0] : isoString;
}

/**
 * Get __dirname equivalent for ES modules
 * @param {string} importMetaUrl - The import.meta.url value
 * @returns {{__filename: string, __dirname: string}} File and directory paths
 * @example
 * const { __dirname, __filename } = getDirname(import.meta.url);
 */
export function getDirname(importMetaUrl) {
  const __filename = fileURLToPath(importMetaUrl);
  const __dirname = dirname(__filename);
  return { __filename, __dirname };
}

/**
 * Calculate a summary with counts by category
 * @param {Array} items - Array of items to summarize
 * @param {Object} config - Configuration for summary calculation
 * @param {string} config.totalKey - Key name for total count
 * @param {Array<string>} config.groupByFields - Fields to group by
 * @param {Array<{field: string, key: string}>} config.sumFields - Fields to sum
 * @param {Function} [config.itemTransform] - Optional transform for each item
 * @returns {Object} Summary object
 * @example
 * const summary = calculateSummary(vehicles, {
 *   totalKey: 'total_vehicles',
 *   groupByFields: ['make', 'aging_category'],
 *   sumFields: [{field: 'msrp', key: 'total_msrp_value'}],
 *   itemTransform: (vehicle) => ({ ...vehicle, line: formatVehicleLine(vehicle.year, vehicle.make, vehicle.model) })
 * });
 */
export function calculateSummary(items, config) {
  const {
    totalKey,
    groupByFields = [],
    sumFields = [],
    itemTransform = (item) => item
  } = config;
  
  const summary = {
    [totalKey]: items.length
  };
  
  // Initialize group by objects
  groupByFields.forEach(field => {
    summary[`by_${field}`] = {};
  });
  
  // Initialize sum fields
  sumFields.forEach(({ key }) => {
    summary[key] = 0;
  });
  
  // Process each item
  items.forEach(item => {
    const transformedItem = itemTransform(item);
    
    // Group by counts
    groupByFields.forEach(field => {
      const value = transformedItem[field];
      if (value !== undefined && value !== null) {
        incrementCounter(summary[`by_${field}`], value);
      }
    });
    
    // Sum fields
    sumFields.forEach(({ field, key }) => {
      const value = Number(transformedItem[field]) || 0;
      summary[key] += value;
    });
  });
  
  // Calculate averages if needed
  if (items.length > 0) {
    sumFields.forEach(({ field, key }) => {
      const avgKey = key.replace('total_', 'average_');
      if (avgKey !== key) {
        summary[avgKey] = Math.round(summary[key] / items.length);
      }
    });
  }
  
  return summary;
}

/**
 * Console output with emoji indicators
 * @param {'success'|'error'|'info'|'warning'|'action'} type - Type of message
 * @param {string} message - Message to output
 * @param {Object} [data] - Optional data to log
 * @example
 * consoleWithEmoji('success', 'Operation completed');
 * consoleWithEmoji('error', 'Operation failed', { details: error });
 */
export function consoleWithEmoji(type, message, data) {
  const emojis = {
    success: '✅',
    error: '❌',
    info: '📋',
    warning: '⚠️',
    action: '🎯'
  };
  
  const emoji = emojis[type] || '📝';
  const output = `${emoji} ${message}`;
  
  if (type === 'error') {
    console.error(output, data || '');
  } else {
    console.log(output, data || '');
  }
}

/**
 * Create a child logger context
 * @param {Object} logger - Parent logger instance
 * @param {string} context - Context name for child logger
 * @returns {Object} Child logger instance
 * @example
 * const log = createChildLogger(logger, 'inventory-processor');
 */
export function createChildLogger(logger, context) {
  return logger.child ? logger.child(context) : logger;
}

/**
 * Validate and parse a numeric value with fallback
 * @param {any} value - Value to parse
 * @param {number} [fallback=0] - Fallback value if parsing fails
 * @returns {number} Parsed number or fallback
 * @example
 * parseNumberSafe('123.45'); // 123.45
 * parseNumberSafe('invalid', 100); // 100
 */
export function parseNumberSafe(value, fallback = 0) {
  const parsed = Number(value);
  return isNaN(parsed) ? fallback : parsed;
}