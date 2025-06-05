/**
 * PromoPilot AI Agent
 * Main agent class for automotive marketing automation
 */

import { OpenAIAgent } from 'openai-agents';
import { AGENT_CONFIG } from './config/agent-config.js';
import logger from './utils/logger.js';
import { AppError, ErrorTypes, ErrorSeverity, handleError } from './utils/error-handler.js';
import { createResponse, getISODate } from './utils/common-utils.js';

export class PromoPilotAgent {
  constructor(options = {}) {
    this.config = { ...AGENT_CONFIG, ...options };
    this.agent = null;
    this.isInitialized = false;
  }

  async initialize() {
    const log = logger.child('initialize');
    
    try {
      log.info('Initializing PromoPilot AI Agent...');
      
      // Initialize the OpenAI Agent with tools
      this.agent = new OpenAIAgent({
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: this.config.max_tokens,
        system_instruction: this.config.system_instruction
      });

      // Load tools from directory (fixed typo)
      await this.agent.loadToolFunctions(this.config.tools_directory);
      
      this.isInitialized = true;
      log.info('PromoPilot AI Agent initialized successfully');
      
      return createResponse(true, { message: 'Agent initialized' });
    } catch (error) {
      const appError = new AppError(
        'Failed to initialize PromoPilot AI Agent',
        ErrorTypes.CONFIGURATION,
        ErrorSeverity.CRITICAL,
        { originalError: error.message }
      );
      log.error(appError.message, appError.toJSON());
      return { success: false, error: handleError(appError, 'AgentInitialization') };
    }
  }

  async analyzeAndRecommend(options = {}) {
    if (!this.isInitialized) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      const log = logger.child('analyzeAndRecommend');
      log.info('Starting promotional analysis...');
      
      const {
        inventoryPath = this.config.data_sources.inventory_file,
        incentivesPath = this.config.data_sources.incentives_file,
        outputFormat = 'json'
      } = options;

      // Create analysis prompt
      const analysisPrompt = `
Please analyze the current dealership situation and provide promotional recommendations:

1. First, ingest the inventory data from: ${inventoryPath}
2. Then, fetch the incentive data from: ${incentivesPath}
3. Analyze the data to identify the top 3 vehicle lines for promotion
4. Generate a comprehensive report with your recommendations

Focus on:
- Vehicles with high aging (${this.config.business_rules.aging_threshold_days}+ days)
- Strong incentive opportunities (${this.config.business_rules.incentive_value_threshold}+ value)
- Inventory levels and sales velocity
- Strategic business impact

Provide clear rationales for each recommendation explaining why these vehicles should be prioritized for promotion.
`;

      // Execute the analysis
      const result = await this.agent.createChatCompletion(analysisPrompt, {
        tool_choices: ['ingest_inventory_data', 'fetch_incentive_data', 'generate_promotional_report']
      });

      log.info('Analysis completed successfully');
      
      return createResponse(true, {
        analysis_result: result,
        timestamp: getISODate()
      });

    } catch (error) {
      const log = logger.child('analyzeAndRecommend');
      return handleError(error, 'Analysis', log);
    }
  }

  async quickRecommendation(message) {
    if (!this.isInitialized) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    try {
      const result = await this.agent.createChatCompletion(message, {
        tool_choices: ['ingest_inventory_data', 'fetch_incentive_data', 'generate_promotional_report']
      });

      return createResponse(true, {
        response: result.choices[0],
        usage: result.total_usage
      });
    } catch (error) {
      const log = logger.child('quickRecommendation');
      return handleError(error, 'Quick recommendation', log);
    }
  }

  async getInventorySummary(filePath = null) {
    const path = filePath || this.config.data_sources.inventory_file;

    try {
      const result = await this.agent.createChatCompletion(
        `Please ingest and summarize the inventory data from: ${path}`,
        {
          tool_choices: ['ingest_inventory_data']
        }
      );

      return result;
    } catch (error) {
      const log = logger.child('getInventorySummary');
      return handleError(error, 'Get inventory summary', log);
    }
  }

  async getIncentiveSummary(filePath = null) {
    const path = filePath || this.config.data_sources.incentives_file;

    try {
      const result = await this.agent.createChatCompletion(
        `Please fetch and summarize the incentive data from: ${path}`,
        {
          tool_choices: ['fetch_incentive_data']
        }
      );

      return result;
    } catch (error) {
      const log = logger.child('getIncentiveSummary');
      return handleError(error, 'Get incentive summary', log);
    }
  }

  getConfig() {
    return this.config;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    const log = logger.child('updateConfig');
    log.info('Configuration updated');
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      model: this.config.model,
      tools_loaded: this.isInitialized,
      last_updated: getISODate()
    };
  }
}

export default PromoPilotAgent;
