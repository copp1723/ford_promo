/**
 * Inventory Ingestor Tool
 * Parses CSV inventory files and extracts relevant vehicle data
 */

import fs from 'fs-extra';
import csv from 'csv-parser';
import path from 'path';
import logger from '../src/utils/logger.js';
import { AppError, ErrorTypes, ErrorSeverity } from '../src/utils/error-handler.js';
import { validateInput, validateOutput } from '../src/utils/schema-validator.js';
import { 
  checkFileExists, 
  createResponse, 
  handleError, 
  formatVehicleLine, 
  incrementCounter,
  calculateSummary,
  createChildLogger,
  parseNumberSafe 
} from '../src/utils/common-utils.js';

export const inventoryIngestorDefinition = {
  type: 'function',
  function: {
    name: 'ingest_inventory_data',
    description: 'Parse and analyze dealership inventory from CSV file. Returns structured inventory data with calculated metrics like days on lot and sales velocity.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the inventory CSV file'
        },
        calculate_metrics: {
          type: 'boolean',
          description: 'Whether to calculate additional metrics like aging and velocity',
          default: true
        }
      },
      required: ['file_path']
    }
  }
};

export async function ingest_inventory_data(params) {
  const log = logger.child('inventory-ingestor');
  
  try {
    // Validate input
    const { file_path, calculate_metrics } = validateInput('inventoryIngestor', params);
    
    log.info(`Ingesting inventory data from: ${file_path}`);
    
    // Check if file exists
    if (!await fs.pathExists(file_path)) {
      throw new AppError(
        `Inventory file not found: ${file_path}`,
        ErrorTypes.FILE_SYSTEM,
        ErrorSeverity.HIGH
      );
    }

    const inventory = [];
    const currentDate = new Date();

    return new Promise((resolve, reject) => {
      fs.createReadStream(file_path)
        .pipe(csv())
        .on('data', (row) => {
          try {
            // Parse and clean the data
            const vehicle = {
              vin: row.VIN || row.vin,
              make: row.Make || row.make,
              model: row.Model || row.model,
              year: parseInt(row.Year || row.year),
              trim: row.Trim || row.trim,
              color: row.Color || row.color,
              msrp: parseFloat(row.MSRP || row.msrp || 0),
              invoice: parseFloat(row.Invoice || row.invoice || 0),
              stock_number: row.StockNumber || row.stock_number,
              date_received: new Date(row.DateReceived || row.date_received),
              status: row.Status || row.status || 'Available',
              location: row.Location || row.location || 'Main Lot'
            };

            // Calculate metrics if requested
            if (calculate_metrics) {
              const daysOnLot = Math.floor((currentDate - vehicle.date_received) / (1000 * 60 * 60 * 24));
              vehicle.days_on_lot = daysOnLot;
              vehicle.aging_category = getAgingCategory(daysOnLot);
              vehicle.vehicle_line = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
            }

            inventory.push(vehicle);
          } catch (error) {
            log.warn(`Skipping invalid row`, { error: error.message });
          }
        })
        .on('end', () => {
          log.info(`Successfully ingested ${inventory.length} vehicles`);
          
          // Calculate summary statistics
          const summary = calculateInventorySummary(inventory);
          
          const response = createStandardResponse(true, {
            data: inventory,
            summary: summary,
            total_vehicles: inventory.length,
            ingestion_date: currentDate.toISOString()
          });
          
          // Validate output
          validateOutput('inventoryIngestor', response);
          resolve(response);
        })
        .on('error', (error) => {
          reject(new AppError(
            `Failed to parse CSV: ${error.message}`,
            ErrorTypes.FILE_SYSTEM,
            ErrorSeverity.HIGH,
            { filePath: file_path }
          ));
        });
    });

  } catch (error) {
    log.error('Inventory ingestion failed', { error: error.message, stack: error.stack });
    return createStandardResponse(false, {}, error);
  }
}

function getAgingCategory(daysOnLot) {
  if (daysOnLot <= 30) return 'Fresh';
  if (daysOnLot <= 60) return 'Aging';
  if (daysOnLot <= 90) return 'Stale';
  return 'Critical';
}

function calculateInventorySummary(inventory) {
  const summary = {
    total_vehicles: inventory.length,
    by_make: {},
    by_aging: { Fresh: 0, Aging: 0, Stale: 0, Critical: 0 },
    average_days_on_lot: 0,
    total_msrp_value: 0,
    vehicle_lines: {}
  };

  let totalDays = 0;

  inventory.forEach(vehicle => {
    // Count by make
    summary.by_make[vehicle.make] = (summary.by_make[vehicle.make] || 0) + 1;
    
    // Count by aging category
    summary.by_aging[vehicle.aging_category]++;
    
    // Calculate totals
    totalDays += vehicle.days_on_lot;
    summary.total_msrp_value += vehicle.msrp;
    
    // Count by vehicle line
    const line = vehicle.vehicle_line;
    if (!summary.vehicle_lines[line]) {
      summary.vehicle_lines[line] = {
        count: 0,
        total_days: 0,
        avg_days: 0,
        total_value: 0
      };
    }
    summary.vehicle_lines[line].count++;
    summary.vehicle_lines[line].total_days += vehicle.days_on_lot;
    summary.vehicle_lines[line].total_value += vehicle.msrp;
  });

  // Calculate averages
  summary.average_days_on_lot = Math.round(totalDays / inventory.length);
  
  // Calculate vehicle line averages
  Object.keys(summary.vehicle_lines).forEach(line => {
    const lineData = summary.vehicle_lines[line];
    lineData.avg_days = Math.round(lineData.total_days / lineData.count);
  });

  return summary;
}

// Export for OpenAI Agents SDK
export default {
  ingest_inventory_data: ingest_inventory_data,
  inventoryIngestorDefinition: inventoryIngestorDefinition
};
