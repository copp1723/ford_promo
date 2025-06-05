/**
 * Incentive Fetcher Tool
 * Fetches and processes OEM incentive data from various sources
 */

import fs from 'fs-extra';
import path from 'path';
import { checkFileExists, createResponse, handleError, formatVehicleLine, incrementCounter, getISODate, consoleWithEmoji } from '../src/utils/common-utils.js';
import logger from '../src/utils/logger.js';

export const incentiveFetcherDefinition = {
  type: 'function',
  function: {
    name: 'fetch_incentive_data',
    description: 'Fetch and process OEM incentive data from file or API. Returns structured incentive information with values and eligibility criteria.',
    parameters: {
      type: 'object',
      properties: {
        source_path: {
          type: 'string',
          description: 'Path to the incentive data file (JSON format)'
        },
        filter_active_only: {
          type: 'boolean',
          description: 'Whether to filter for only currently active incentives',
          default: true
        },
        include_expired: {
          type: 'boolean',
          description: 'Whether to include recently expired incentives for reference',
          default: false
        }
      },
      required: ['source_path']
    }
  }
};

export async function fetch_incentive_data({ 
  source_path, 
  filter_active_only = true, 
  include_expired = false 
}) {
  const log = logger.child('incentive-fetcher');
  
  try {
    log.info(`Fetching incentive data from: ${source_path}`);
    
    // Check if file exists
    await checkFileExists(source_path, 'Incentive file');

    // Read and parse the incentive data
    const rawData = await fs.readJson(source_path);
    const currentDate = new Date();
    
    let incentives = [];
    
    // Handle different data structures
    if (Array.isArray(rawData)) {
      incentives = rawData;
    } else if (rawData.incentives && Array.isArray(rawData.incentives)) {
      incentives = rawData.incentives;
    } else {
      throw new Error('Invalid incentive data format. Expected array or object with incentives property.');
    }

    // Process and filter incentives
    const processedIncentives = incentives.map(incentive => {
      const processed = {
        id: incentive.id || generateIncentiveId(incentive),
        program_name: incentive.program_name || incentive.name,
        make: incentive.make,
        model: incentive.model,
        year: incentive.year,
        trim: incentive.trim,
        incentive_type: incentive.type || incentive.incentive_type,
        value: parseFloat(incentive.value || incentive.amount || 0),
        description: incentive.description,
        start_date: new Date(incentive.start_date),
        end_date: new Date(incentive.end_date),
        eligibility: incentive.eligibility || [],
        stackable: incentive.stackable || false,
        customer_type: incentive.customer_type || 'All',
        region: incentive.region || 'National',
        dealer_cash: incentive.dealer_cash || false,
        customer_cash: incentive.customer_cash || false,
        financing_rate: incentive.financing_rate || null,
        lease_rate: incentive.lease_rate || null
      };

      // Calculate status
      processed.status = getIncentiveStatus(processed.start_date, processed.end_date, currentDate);
      processed.days_remaining = Math.ceil((processed.end_date - currentDate) / (1000 * 60 * 60 * 24));
      processed.vehicle_line = formatVehicleLine(processed.year, processed.make, processed.model);

      return processed;
    });

    // Apply filters
    let filteredIncentives = processedIncentives;
    
    if (filter_active_only) {
      filteredIncentives = filteredIncentives.filter(inc => inc.status === 'Active');
    }
    
    if (!include_expired) {
      filteredIncentives = filteredIncentives.filter(inc => inc.status !== 'Expired');
    }

    // Calculate summary statistics
    const summary = calculateIncentiveSummary(filteredIncentives);

    log.info(`Successfully processed ${filteredIncentives.length} incentives`);

    return createResponse(true, {
      data: filteredIncentives,
      summary: summary,
      total_incentives: filteredIncentives.length,
      fetch_date: getISODate()
    });

  } catch (error) {
    return handleError(error, 'Incentive fetch', log);
  }
}

function generateIncentiveId(incentive) {
  const base = `${incentive.make}_${incentive.model}_${incentive.type || 'incentive'}`;
  return base.toLowerCase().replace(/\s+/g, '_');
}

function getIncentiveStatus(startDate, endDate, currentDate) {
  if (currentDate < startDate) return 'Upcoming';
  if (currentDate > endDate) return 'Expired';
  return 'Active';
}

function calculateIncentiveSummary(incentives) {
  const summary = {
    total_incentives: incentives.length,
    by_make: {},
    by_type: {},
    by_status: { Active: 0, Upcoming: 0, Expired: 0 },
    total_value: 0,
    average_value: 0,
    vehicle_lines: {},
    high_value_incentives: [],
    expiring_soon: []
  };

  incentives.forEach(incentive => {
    // Count by make
    incrementCounter(summary.by_make, incentive.make);
    
    // Count by type
    incrementCounter(summary.by_type, incentive.incentive_type);
    
    // Count by status
    summary.by_status[incentive.status]++;
    
    // Calculate totals
    summary.total_value += incentive.value;
    
    // Track high-value incentives (>$2000)
    if (incentive.value > 2000) {
      summary.high_value_incentives.push({
        vehicle_line: incentive.vehicle_line,
        value: incentive.value,
        type: incentive.incentive_type
      });
    }
    
    // Track expiring soon (within 30 days)
    if (incentive.status === 'Active' && incentive.days_remaining <= 30) {
      summary.expiring_soon.push({
        vehicle_line: incentive.vehicle_line,
        days_remaining: incentive.days_remaining,
        value: incentive.value
      });
    }
    
    // Group by vehicle line
    const line = incentive.vehicle_line;
    if (!summary.vehicle_lines[line]) {
      summary.vehicle_lines[line] = {
        count: 0,
        total_value: 0,
        max_value: 0,
        types: new Set()
      };
    }
    summary.vehicle_lines[line].count++;
    summary.vehicle_lines[line].total_value += incentive.value;
    summary.vehicle_lines[line].max_value = Math.max(summary.vehicle_lines[line].max_value, incentive.value);
    summary.vehicle_lines[line].types.add(incentive.incentive_type);
  });

  // Calculate average
  summary.average_value = Math.round(summary.total_value / incentives.length);
  
  // Convert Sets to Arrays for JSON serialization
  Object.keys(summary.vehicle_lines).forEach(line => {
    summary.vehicle_lines[line].types = Array.from(summary.vehicle_lines[line].types);
  });

  return summary;
}

// Export for OpenAI Agents SDK
export default {
  fetch_incentive_data: fetch_incentive_data,
  incentiveFetcherDefinition: incentiveFetcherDefinition
};
