/**
 * Unit tests for common utility functions
 */

import { jest } from '@jest/globals';
import fs from 'fs-extra';
import {
  checkFileExists,
  createResponse,
  handleError,
  formatVehicleLine,
  incrementCounter,
  getISODate,
  getDirname,
  calculateSummary,
  consoleWithEmoji,
  createChildLogger,
  parseNumberSafe
} from '../../src/utils/common-utils.js';
import { AppError, ErrorTypes } from '../../src/utils/error-handler.js';

// Mock fs-extra
jest.mock('fs-extra');

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

beforeEach(() => {
  jest.clearAllMocks();
  console.log = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('checkFileExists', () => {
  it('should resolve when file exists', async () => {
    fs.pathExists.mockResolvedValue(true);
    
    await expect(checkFileExists('/path/to/file.csv')).resolves.toBeUndefined();
    expect(fs.pathExists).toHaveBeenCalledWith('/path/to/file.csv');
  });

  it('should throw AppError when file does not exist', async () => {
    fs.pathExists.mockResolvedValue(false);
    
    await expect(checkFileExists('/path/to/missing.csv', 'Inventory file'))
      .rejects.toThrow(AppError);
    
    await expect(checkFileExists('/path/to/missing.csv', 'Inventory file'))
      .rejects.toMatchObject({
        message: 'Inventory file not found: /path/to/missing.csv',
        type: ErrorTypes.FILE_SYSTEM
      });
  });
});

describe('createResponse', () => {
  it('should create success response with data', () => {
    const result = createResponse(true, { data: [1, 2, 3], count: 3 });
    
    expect(result).toMatchObject({
      success: true,
      data: [1, 2, 3],
      count: 3
    });
    expect(result.timestamp).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should create error response with error details', () => {
    const error = new AppError('Test error', ErrorTypes.VALIDATION);
    const result = createResponse(false, {}, error);
    
    expect(result).toMatchObject({
      success: false,
      error: 'Test error',
      errorType: ErrorTypes.VALIDATION
    });
    expect(result.timestamp).toBeDefined();
  });

  it('should handle regular Error objects', () => {
    const error = new Error('Regular error');
    const result = createResponse(false, {}, error);
    
    expect(result).toMatchObject({
      success: false,
      error: 'Regular error'
    });
    expect(result.errorType).toBeUndefined();
  });
});

describe('handleError', () => {
  it('should log error and return error response', () => {
    const mockLogger = { error: jest.fn() };
    const error = new Error('Test error');
    
    const result = handleError(error, 'Test operation', mockLogger);
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Test operation failed:',
      expect.objectContaining({
        error: 'Test error',
        stack: expect.any(String)
      })
    );
    
    expect(result).toMatchObject({
      success: false,
      error: 'Test error'
    });
  });
});

describe('formatVehicleLine', () => {
  it('should format vehicle line correctly', () => {
    expect(formatVehicleLine(2024, 'Honda', 'Civic')).toBe('2024 Honda Civic');
    expect(formatVehicleLine('2023', 'Toyota', 'Camry')).toBe('2023 Toyota Camry');
  });

  it('should handle missing values', () => {
    expect(formatVehicleLine(2024, '', 'Model')).toBe('2024  Model');
    expect(formatVehicleLine('', 'Make', '')).toBe(' Make ');
  });

  it('should trim whitespace', () => {
    expect(formatVehicleLine(2024, ' Honda ', ' Civic ')).toBe('2024  Honda   Civic');
  });
});

describe('incrementCounter', () => {
  it('should initialize counter at 1 if not exists', () => {
    const obj = {};
    const result = incrementCounter(obj, 'count');
    
    expect(result).toBe(1);
    expect(obj.count).toBe(1);
  });

  it('should increment existing counter', () => {
    const obj = { count: 5 };
    const result = incrementCounter(obj, 'count');
    
    expect(result).toBe(6);
    expect(obj.count).toBe(6);
  });

  it('should increment by custom amount', () => {
    const obj = { count: 10 };
    const result = incrementCounter(obj, 'count', 5);
    
    expect(result).toBe(15);
    expect(obj.count).toBe(15);
  });
});

describe('getISODate', () => {
  const RealDate = Date;
  
  beforeEach(() => {
    global.Date = jest.fn(() => ({
      toISOString: () => '2024-01-15T10:30:45.123Z'
    }));
  });
  
  afterEach(() => {
    global.Date = RealDate;
  });

  it('should return full ISO string by default', () => {
    expect(getISODate()).toBe('2024-01-15T10:30:45.123Z');
  });

  it('should return date only when requested', () => {
    expect(getISODate(true)).toBe('2024-01-15');
  });
});

describe('getDirname', () => {
  it('should return dirname and filename', () => {
    const testUrl = 'file:///Users/test/project/file.js';
    const result = getDirname(testUrl);
    
    expect(result).toHaveProperty('__filename');
    expect(result).toHaveProperty('__dirname');
    expect(result.__filename).toContain('file.js');
    expect(result.__dirname).toContain('project');
  });
});

describe('calculateSummary', () => {
  const testData = [
    { make: 'Honda', type: 'sedan', price: 25000, quantity: 10 },
    { make: 'Honda', type: 'suv', price: 35000, quantity: 5 },
    { make: 'Toyota', type: 'sedan', price: 28000, quantity: 8 },
    { make: 'Toyota', type: 'suv', price: 40000, quantity: 3 }
  ];

  it('should calculate basic summary', () => {
    const summary = calculateSummary(testData, {
      totalKey: 'total_vehicles',
      groupByFields: ['make', 'type'],
      sumFields: [
        { field: 'price', key: 'total_price' },
        { field: 'quantity', key: 'total_quantity' }
      ]
    });

    expect(summary).toMatchObject({
      total_vehicles: 4,
      by_make: { Honda: 2, Toyota: 2 },
      by_type: { sedan: 2, suv: 2 },
      total_price: 128000,
      total_quantity: 26,
      average_price: 32000,
      average_quantity: 7 // Math.round(26/4)
    });
  });

  it('should handle empty array', () => {
    const summary = calculateSummary([], {
      totalKey: 'total_items',
      groupByFields: ['category'],
      sumFields: [{ field: 'value', key: 'total_value' }]
    });

    expect(summary).toMatchObject({
      total_items: 0,
      by_category: {},
      total_value: 0
    });
  });

  it('should apply item transform', () => {
    const summary = calculateSummary(testData, {
      totalKey: 'total',
      groupByFields: ['category'],
      sumFields: [],
      itemTransform: (item) => ({ ...item, category: item.make.toUpperCase() })
    });

    expect(summary.by_category).toMatchObject({
      HONDA: 2,
      TOYOTA: 2
    });
  });
});

describe('consoleWithEmoji', () => {
  it('should log success messages with emoji', () => {
    consoleWithEmoji('success', 'Operation completed');
    
    expect(console.log).toHaveBeenCalledWith('✅ Operation completed', '');
  });

  it('should log error messages with console.error', () => {
    consoleWithEmoji('error', 'Operation failed', { code: 'ERR_001' });
    
    expect(console.error).toHaveBeenCalledWith('❌ Operation failed', { code: 'ERR_001' });
  });

  it('should handle different message types', () => {
    consoleWithEmoji('info', 'Info message');
    consoleWithEmoji('warning', 'Warning message');
    consoleWithEmoji('action', 'Action message');
    
    expect(console.log).toHaveBeenCalledWith('📋 Info message', '');
    expect(console.log).toHaveBeenCalledWith('⚠️ Warning message', '');
    expect(console.log).toHaveBeenCalledWith('🎯 Action message', '');
  });

  it('should use default emoji for unknown types', () => {
    consoleWithEmoji('unknown', 'Unknown message');
    
    expect(console.log).toHaveBeenCalledWith('📝 Unknown message', '');
  });
});

describe('createChildLogger', () => {
  it('should create child logger when supported', () => {
    const mockLogger = {
      child: jest.fn().mockReturnValue({ log: 'child' })
    };
    
    const result = createChildLogger(mockLogger, 'test-context');
    
    expect(mockLogger.child).toHaveBeenCalledWith('test-context');
    expect(result).toEqual({ log: 'child' });
  });

  it('should return parent logger when child not supported', () => {
    const mockLogger = { log: 'parent' };
    
    const result = createChildLogger(mockLogger, 'test-context');
    
    expect(result).toBe(mockLogger);
  });
});

describe('parseNumberSafe', () => {
  it('should parse valid numbers', () => {
    expect(parseNumberSafe('123')).toBe(123);
    expect(parseNumberSafe('123.45')).toBe(123.45);
    expect(parseNumberSafe(456)).toBe(456);
    expect(parseNumberSafe('0')).toBe(0);
  });

  it('should return fallback for invalid numbers', () => {
    expect(parseNumberSafe('invalid')).toBe(0);
    expect(parseNumberSafe('')).toBe(0);
    expect(parseNumberSafe(null)).toBe(0);
    expect(parseNumberSafe(undefined)).toBe(0);
    expect(parseNumberSafe('abc', 100)).toBe(100);
  });

  it('should handle edge cases', () => {
    expect(parseNumberSafe('123abc')).toBe(123);
    expect(parseNumberSafe('  456  ')).toBe(456);
    expect(parseNumberSafe('-789')).toBe(-789);
  });
});