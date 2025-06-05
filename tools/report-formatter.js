/**
 * Report Formatter Tool
 * Generates structured reports with promotional recommendations
 */

import fs from 'fs-extra';
import path from 'path';
import { createResponse, handleError, getISODate, consoleWithEmoji } from '../src/utils/common-utils.js';
import logger from '../src/utils/logger.js';

export const reportFormatterDefinition = {
  type: 'function',
  function: {
    name: 'generate_promotional_report',
    description: 'Generate a structured promotional report with vehicle recommendations, rationales, and supporting data.',
    parameters: {
      type: 'object',
      properties: {
        recommendations: {
          type: 'array',
          description: 'Array of promotional recommendations with rankings and rationales'
        },
        inventory_summary: {
          type: 'object',
          description: 'Summary of inventory data'
        },
        incentive_summary: {
          type: 'object',
          description: 'Summary of incentive data'
        },
        output_format: {
          type: 'string',
          enum: ['json', 'html', 'markdown'],
          description: 'Output format for the report',
          default: 'json'
        }
      },
      required: ['recommendations']
    }
  }
};

export async function generate_promotional_report({
  recommendations,
  inventory_summary = null,
  incentive_summary = null,
  output_format = 'json'
}) {
  const log = logger.child('report-formatter');
  
  try {
    log.info(`Generating promotional report in ${output_format} format`);
    
    const reportData = {
      report_metadata: {
        generated_at: getISODate(),
        report_type: 'promotional_recommendations',
        version: '1.0',
        agent: 'PromoPilot AI'
      },
      executive_summary: {
        overview: `PromoPilot AI has identified ${recommendations.length} priority vehicle lines for promotional focus.`,
        top_priority: recommendations[0]?.vehicle_line || 'N/A',
        urgency_level: recommendations.length >= 3 ? 'HIGH' : 'MEDIUM'
      },
      recommendations: recommendations.map((rec, index) => ({
        ...rec,
        rank: index + 1,
        priority: index === 0 ? 'HIGH' : 'MEDIUM'
      })),
      supporting_data: {
        inventory_summary,
        incentive_summary
      },
      next_steps: [
        'Implement promotional campaigns for recommended vehicle lines',
        'Monitor sales performance and adjust strategies',
        'Schedule follow-up analysis in 2 weeks'
      ]
    };

    // Format based on output type
    let formattedReport = JSON.stringify(reportData, null, 2);
    let filename = `promotional_report_${getDateString()}.json`;
    
    // Ensure output directory exists
    const outputDir = './output';
    await fs.ensureDir(outputDir);
    
    const filePath = path.join(outputDir, filename);
    await fs.writeFile(filePath, formattedReport, 'utf8');
    log.info(`Report saved to: ${filePath}`);

    return createResponse(true, {
      report_data: reportData,
      formatted_report: formattedReport,
      file_path: filePath,
      format: output_format,
      recommendations_count: recommendations.length
    });

  } catch (error) {
    return handleError(error, 'Report generation', log);
  }
}

function getDateString() {
  return getISODate(true);
}

// Export for OpenAI Agents SDK
export default {
  generate_promotional_report: generate_promotional_report,
  reportFormatterDefinition: reportFormatterDefinition
};
