#!/usr/bin/env node

/**
 * PromoPilot AI - Main Entry Point
 * Automotive marketing automation agent using OpenAI Agents SDK
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import PromoPilotAgent from './src/promopilot-agent.js';
import logger from './src/utils/logger.js';
import { AppError, ErrorTypes, ErrorSeverity } from './src/utils/error-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

async function main() {
  logger.info('PromoPilot AI - Automotive Marketing Agent');
  logger.info('================================================');

  // Ensure output directory exists
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    logger.info('Created output directory');
  }

  // Check for required environment variables
  if (!process.env.OPENAI_API_KEY) {
    const error = new AppError(
      'OPENAI_API_KEY environment variable is required',
      ErrorTypes.CONFIGURATION,
      ErrorSeverity.CRITICAL
    );
    logger.error(error.message);
    logger.info('Please set your OpenAI API key in a .env file or environment variable');
    logger.info('Copy .env.example to .env and add your API key');
    process.exit(1);
  }

  try {
    // Initialize the PromoPilot agent
    const agent = new PromoPilotAgent();
    const initResult = await agent.initialize();
    
    if (!initResult.success) {
      logger.error('Failed to initialize agent:', initResult.error);
      process.exit(1);
    }

    // Get command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'analyze';

    switch (command) {
      case 'analyze':
        await runFullAnalysis(agent);
        break;
      
      case 'inventory':
        await showInventorySummary(agent);
        break;
      
      case 'incentives':
        await showIncentiveSummary(agent);
        break;
      
      case 'status':
        showAgentStatus(agent);
        break;
      
      case 'help':
        showHelp();
        break;
      
      default:
        if (command) {
          await runCustomQuery(agent, args.join(' '));
        } else {
          await runFullAnalysis(agent);
        }
    }

  } catch (error) {
    logger.error('Application error:', { message: error.message, stack: error.stack });
    process.exit(1);
  }
}

async function runFullAnalysis(agent) {
  logger.info('Running full promotional analysis...');
  
  const result = await agent.analyzeAndRecommend({
    inventoryPath: './data/sample-inventory.csv',
    incentivesPath: './data/sample-incentives.json',
    outputFormat: 'json'
  });

  if (result.success) {
    logger.info('Analysis completed successfully!');
    logger.info('Check the ./output directory for detailed reports');
    
    if (result.analysis_result?.choices?.[0]) {
      logger.info('Agent Response:', { response: result.analysis_result.choices[0] });
    }
  } else {
    logger.error('Analysis failed:', result.error);
  }
}

async function showInventorySummary(agent) {
  logger.info('Inventory Summary');
  logger.info('===================');
  
  const result = await agent.getInventorySummary();
  
  if (result.success) {
    logger.info(`Total Vehicles: ${result.summary.total_vehicles}`);
    logger.info(`Average Days on Lot: ${result.summary.average_days_on_lot}`);
    logger.info(`Total MSRP Value: $${result.summary.total_msrp_value.toLocaleString()}`);
    
    logger.info('By Aging Category:');
    Object.entries(result.summary.by_aging).forEach(([category, count]) => {
      logger.info(`  ${category}: ${count} vehicles`);
    });
    
    logger.info('By Make:');
    Object.entries(result.summary.by_make).forEach(([make, count]) => {
      logger.info(`  ${make}: ${count} vehicles`);
    });
  } else {
    logger.error('Failed to get inventory summary:', result.error);
  }
}

async function showIncentiveSummary(agent) {
  logger.info('Incentive Summary');
  logger.info('===================');
  
  const result = await agent.getIncentiveSummary();
  
  if (result.success) {
    console.log(`Total Active Incentives: ${result.summary.total_incentives}`);
    console.log(`Average Incentive Value: $${result.summary.average_value}`);
    console.log(`Total Incentive Value: $${result.summary.total_value.toLocaleString()}`);
    
    console.log('\nBy Type:');
    Object.entries(result.summary.by_type).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} incentives`);
    });
    
    if (result.summary.high_value_incentives.length > 0) {
      console.log('\nHigh-Value Incentives (>$2000):');
      result.summary.high_value_incentives.forEach(incentive => {
        console.log(`  ${incentive.vehicle_line}: $${incentive.value} (${incentive.type})`);
      });
    }
    
    if (result.summary.expiring_soon.length > 0) {
      console.log('\nExpiring Soon (within 30 days):');
      result.summary.expiring_soon.forEach(incentive => {
        console.log(`  ${incentive.vehicle_line}: ${incentive.days_remaining} days remaining`);
      });
    }
  } else {
    console.error('❌ Failed to get incentive summary:', result.error);
  }
}

function showAgentStatus(agent) {
  logger.info('Agent Status');
  logger.info('===============');
  
  const status = agent.getStatus();
  logger.info(`Initialized: ${status.initialized ? 'Yes' : 'No'}`);
  logger.info(`Model: ${status.model}`);
  logger.info(`Tools Loaded: ${status.tools_loaded ? 'Yes' : 'No'}`);
  logger.info(`Last Updated: ${status.last_updated}`);
}

async function runCustomQuery(agent, query) {
  logger.info(`Processing query: "${query}"`);
  logger.info('================================');
  
  const result = await agent.quickRecommendation(query);
  
  if (result.success) {
    console.log('\n📝 Response:');
    console.log(result.response);
    
    if (result.usage) {
      console.log(`\n📊 Token Usage: ${result.usage.total_tokens} tokens`);
    }
  } else {
    console.error('❌ Query failed:', result.error);
  }
}

function showHelp() {
  logger.info('PromoPilot AI Commands');
  logger.info('=========================');
  logger.info('node index.js analyze     - Run full promotional analysis');
  logger.info('node index.js inventory   - Show inventory summary');
  logger.info('node index.js incentives  - Show incentive summary');
  logger.info('node index.js status      - Show agent status');
  logger.info('node index.js help        - Show this help');
  logger.info('node index.js "query"     - Ask a custom question');
  logger.info('\nExamples:');
  logger.info('node index.js "What vehicles should I promote this week?"');
  logger.info('node index.js "Which models have the highest aging?"');
}

// Run the application
main().catch(error => {
  logger.error('Unhandled error:', { message: error.message, stack: error.stack });
  process.exit(1);
});
