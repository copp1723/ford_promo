#!/usr/bin/env node

/**
 * Test Scenarios for PromoPilot AI
 * Comprehensive testing including happy path and destructive scenarios
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getDirname } from './src/utils/common-utils.js';

const { __dirname, __filename } = getDirname(import.meta.url);

// Test scenarios
const scenarios = [
  {
    name: 'Happy Path - Full Analysis',
    command: ['node', 'index.js', 'analyze'],
    expectedOutput: ['Analysis completed successfully', 'Check the ./output directory'],
    shouldFail: false
  },
  {
    name: 'Inventory Summary',
    command: ['node', 'index.js', 'inventory'],
    expectedOutput: ['Total Vehicles:', 'Average Days on Lot:'],
    shouldFail: false
  },
  {
    name: 'Incentive Summary',
    command: ['node', 'index.js', 'incentives'],
    expectedOutput: ['Total Active Incentives:', 'Average Incentive Value:'],
    shouldFail: false
  },
  {
    name: 'Agent Status Check',
    command: ['node', 'index.js', 'status'],
    expectedOutput: ['Initialized:', 'Model:', 'Tools Loaded:'],
    shouldFail: false
  },
  {
    name: 'Custom Query',
    command: ['node', 'index.js', 'What vehicles have the highest aging?'],
    expectedOutput: ['Processing query:', 'Response:'],
    shouldFail: false
  },
  {
    name: 'Help Command',
    command: ['node', 'index.js', 'help'],
    expectedOutput: ['PromoPilot AI Commands', 'node index.js analyze'],
    shouldFail: false
  }
];

// Destructive test scenarios
const destructiveScenarios = [
  {
    name: 'Missing API Key',
    setup: () => {
      process.env.ORIGINAL_API_KEY = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
    },
    cleanup: () => {
      if (process.env.ORIGINAL_API_KEY) {
        process.env.OPENAI_API_KEY = process.env.ORIGINAL_API_KEY;
        delete process.env.ORIGINAL_API_KEY;
      }
    },
    command: ['node', 'index.js', 'status'],
    expectedOutput: ['OPENAI_API_KEY environment variable is required'],
    shouldFail: true
  },
  {
    name: 'Missing Inventory File',
    setup: () => {
      const inventoryPath = path.join(__dirname, 'data', 'sample-inventory.csv');
      const backupPath = path.join(__dirname, 'data', 'sample-inventory.csv.backup');
      if (fs.existsSync(inventoryPath)) {
        fs.renameSync(inventoryPath, backupPath);
      }
    },
    cleanup: () => {
      const inventoryPath = path.join(__dirname, 'data', 'sample-inventory.csv');
      const backupPath = path.join(__dirname, 'data', 'sample-inventory.csv.backup');
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, inventoryPath);
      }
    },
    command: ['node', 'index.js', 'inventory'],
    expectedOutput: ['Failed to get inventory summary', 'Inventory file not found'],
    shouldFail: false // App should handle gracefully
  },
  {
    name: 'Invalid Command',
    command: ['node', 'index.js', 'invalid-command'],
    expectedOutput: ['Processing query:', 'invalid-command'],
    shouldFail: false // Should treat as custom query
  }
];

// Test runner
async function runTest(scenario, isDestructive = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running ${isDestructive ? 'DESTRUCTIVE' : 'SCENARIO'}: ${scenario.name}`);
  console.log('='.repeat(60));
  
  // Setup for destructive tests
  if (scenario.setup) {
    try {
      scenario.setup();
      console.log('✓ Setup completed');
    } catch (error) {
      console.error('✗ Setup failed:', error.message);
      return false;
    }
  }
  
  return new Promise((resolve) => {
    const startTime = Date.now();
    const child = spawn(scenario.command[0], scenario.command.slice(1), {
      cwd: __dirname,
      env: { ...process.env }
    });
    
    let output = '';
    let errorOutput = '';
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
      process.stderr.write(data);
    });
    
    child.on('close', (code) => {
      const duration = Date.now() - startTime;
      const fullOutput = output + errorOutput;
      
      // Cleanup for destructive tests
      if (scenario.cleanup) {
        try {
          scenario.cleanup();
          console.log('\n✓ Cleanup completed');
        } catch (error) {
          console.error('\n✗ Cleanup failed:', error.message);
        }
      }
      
      // Check results
      let passed = true;
      const results = [];
      
      // Check exit code
      if (scenario.shouldFail) {
        if (code === 0) {
          passed = false;
          results.push('✗ Expected non-zero exit code but got 0');
        } else {
          results.push('✓ Got expected non-zero exit code');
        }
      } else {
        if (code !== 0) {
          passed = false;
          results.push(`✗ Expected zero exit code but got ${code}`);
        } else {
          results.push('✓ Got expected zero exit code');
        }
      }
      
      // Check expected output
      for (const expected of scenario.expectedOutput) {
        if (fullOutput.includes(expected)) {
          results.push(`✓ Found expected output: "${expected}"`);
        } else {
          passed = false;
          results.push(`✗ Missing expected output: "${expected}"`);
        }
      }
      
      // Print results
      console.log('\n' + '-'.repeat(40));
      console.log('Test Results:');
      results.forEach(result => console.log(result));
      console.log(`Duration: ${duration}ms`);
      console.log(`Status: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
      
      resolve(passed);
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      console.error('\n✗ Test timed out after 30 seconds');
      resolve(false);
    }, 30000);
  });
}

// Main test runner
async function runAllTests() {
  console.log('🧪 PromoPilot AI Test Suite');
  console.log('===========================\n');
  
  // Check if .env exists
  if (!fs.existsSync(path.join(__dirname, '.env'))) {
    console.error('❌ ERROR: .env file not found');
    console.log('Please copy .env.example to .env and add your OPENAI_API_KEY');
    process.exit(1);
  }
  
  let totalTests = 0;
  let passedTests = 0;
  
  // Run normal scenarios
  console.log('\n📋 Running Happy Path Scenarios...\n');
  for (const scenario of scenarios) {
    totalTests++;
    const passed = await runTest(scenario);
    if (passed) passedTests++;
  }
  
  // Run destructive scenarios
  console.log('\n\n💥 Running Destructive Scenarios...\n');
  for (const scenario of destructiveScenarios) {
    totalTests++;
    const passed = await runTest(scenario, true);
    if (passed) passedTests++;
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('\n' + (passedTests === totalTests ? '✅ ALL TESTS PASSED!' : '❌ SOME TESTS FAILED'));
  
  process.exit(passedTests === totalTests ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});