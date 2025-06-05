/**
 * Metrics Utility
 * Tracks performance metrics and categorizes failures
 */

import logger from './logger.js';
import { ErrorTypes } from './error-handler.js';

// Metric types
export const MetricTypes = {
  COUNTER: 'counter',
  GAUGE: 'gauge',
  HISTOGRAM: 'histogram',
  TIMER: 'timer'
};

// Predefined metric names
export const MetricNames = {
  // Operation metrics
  INVENTORY_INGESTION: 'inventory.ingestion',
  INCENTIVE_FETCH: 'incentive.fetch',
  REPORT_GENERATION: 'report.generation',
  AGENT_ANALYSIS: 'agent.analysis',
  
  // Error metrics
  ERROR_COUNT: 'error.count',
  ERROR_BY_TYPE: 'error.by_type',
  
  // Performance metrics
  OPERATION_DURATION: 'operation.duration',
  API_LATENCY: 'api.latency',
  FILE_PROCESSING_TIME: 'file.processing_time'
};

// Thresholds for alerting
export const PerformanceThresholds = {
  CRITICAL: {
    [MetricNames.INVENTORY_INGESTION]: 30000, // 30 seconds
    [MetricNames.INCENTIVE_FETCH]: 10000, // 10 seconds
    [MetricNames.REPORT_GENERATION]: 60000, // 1 minute
    [MetricNames.AGENT_ANALYSIS]: 120000, // 2 minutes
    [MetricNames.API_LATENCY]: 5000 // 5 seconds
  },
  WARNING: {
    [MetricNames.INVENTORY_INGESTION]: 15000, // 15 seconds
    [MetricNames.INCENTIVE_FETCH]: 5000, // 5 seconds
    [MetricNames.REPORT_GENERATION]: 30000, // 30 seconds
    [MetricNames.AGENT_ANALYSIS]: 60000, // 1 minute
    [MetricNames.API_LATENCY]: 2000 // 2 seconds
  }
};

class MetricsCollector {
  constructor() {
    this.metrics = new Map();
    this.timers = new Map();
  }
  
  // Record a counter metric
  increment(name, value = 1, tags = {}) {
    const key = this.getMetricKey(name, tags);
    const current = this.metrics.get(key) || { type: MetricTypes.COUNTER, value: 0, tags };
    current.value += value;
    this.metrics.set(key, current);
    
    logger.debug('Metric incremented', { name, value, total: current.value, tags });
  }
  
  // Record a gauge metric
  gauge(name, value, tags = {}) {
    const key = this.getMetricKey(name, tags);
    this.metrics.set(key, { type: MetricTypes.GAUGE, value, tags, timestamp: Date.now() });
    
    logger.debug('Gauge recorded', { name, value, tags });
  }
  
  // Start a timer
  startTimer(name, tags = {}) {
    const key = this.getMetricKey(name, tags);
    this.timers.set(key, Date.now());
    
    return () => this.endTimer(name, tags);
  }
  
  // End a timer and record duration
  endTimer(name, tags = {}) {
    const key = this.getMetricKey(name, tags);
    const startTime = this.timers.get(key);
    
    if (!startTime) {
      logger.warn('Timer not found', { name, tags });
      return null;
    }
    
    const duration = Date.now() - startTime;
    this.timers.delete(key);
    
    // Record as histogram
    this.histogram(name, duration, tags);
    
    // Check thresholds
    this.checkThreshold(name, duration);
    
    return duration;
  }
  
  // Record a histogram metric
  histogram(name, value, tags = {}) {
    const key = this.getMetricKey(name, tags);
    const current = this.metrics.get(key) || {
      type: MetricTypes.HISTOGRAM,
      values: [],
      tags
    };
    
    current.values.push({ value, timestamp: Date.now() });
    
    // Keep only last 1000 values
    if (current.values.length > 1000) {
      current.values = current.values.slice(-1000);
    }
    
    this.metrics.set(key, current);
  }
  
  // Record an error with categorization
  recordError(error, context = {}) {
    const errorType = error.type || ErrorTypes.UNKNOWN;
    const severity = error.severity || 'medium';
    
    // Increment total error count
    this.increment(MetricNames.ERROR_COUNT);
    
    // Increment error by type
    this.increment(MetricNames.ERROR_BY_TYPE, 1, { type: errorType });
    
    // Log error details
    logger.error('Error recorded in metrics', {
      type: errorType,
      severity,
      message: error.message,
      context,
      timestamp: new Date().toISOString()
    });
    
    // Categorize error
    const category = this.categorizeError(error);
    this.increment('error.by_category', 1, { category });
    
    return category;
  }
  
  // Categorize errors
  categorizeError(error) {
    const errorType = error.type || ErrorTypes.UNKNOWN;
    
    // Network errors
    if (errorType === ErrorTypes.NETWORK || 
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('ENOTFOUND')) {
      return 'network';
    }
    
    // Timeout errors
    if (error.message?.includes('timeout') ||
        error.message?.includes('timed out')) {
      return 'timeout';
    }
    
    // Bad input errors
    if (errorType === ErrorTypes.VALIDATION ||
        error.message?.includes('invalid') ||
        error.message?.includes('missing required')) {
      return 'bad_input';
    }
    
    // External API errors
    if (errorType === ErrorTypes.API ||
        error.message?.includes('API') ||
        error.message?.includes('external service')) {
      return 'external_api';
    }
    
    // File system errors
    if (errorType === ErrorTypes.FILE_SYSTEM ||
        error.message?.includes('ENOENT') ||
        error.message?.includes('file not found')) {
      return 'file_system';
    }
    
    // Configuration errors
    if (errorType === ErrorTypes.CONFIGURATION) {
      return 'configuration';
    }
    
    // Processing errors
    if (errorType === ErrorTypes.PROCESSING) {
      return 'processing';
    }
    
    return 'unknown';
  }
  
  // Check performance thresholds
  checkThreshold(metricName, value) {
    const critical = PerformanceThresholds.CRITICAL[metricName];
    const warning = PerformanceThresholds.WARNING[metricName];
    
    if (critical && value > critical) {
      logger.error('Performance threshold exceeded - CRITICAL', {
        metric: metricName,
        value,
        threshold: critical,
        exceeded_by: value - critical
      });
      this.increment('threshold.exceeded', 1, { level: 'critical', metric: metricName });
    } else if (warning && value > warning) {
      logger.warn('Performance threshold exceeded - WARNING', {
        metric: metricName,
        value,
        threshold: warning,
        exceeded_by: value - warning
      });
      this.increment('threshold.exceeded', 1, { level: 'warning', metric: metricName });
    }
  }
  
  // Get metric key
  getMetricKey(name, tags) {
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    
    return tagString ? `${name}{${tagString}}` : name;
  }
  
  // Get summary statistics
  getSummary() {
    const summary = {
      counters: {},
      gauges: {},
      histograms: {},
      errors: {
        total: 0,
        by_type: {},
        by_category: {}
      }
    };
    
    for (const [key, metric] of this.metrics.entries()) {
      const [name, ...rest] = key.split('{');
      const cleanName = name;
      
      switch (metric.type) {
        case MetricTypes.COUNTER:
          summary.counters[cleanName] = (summary.counters[cleanName] || 0) + metric.value;
          
          // Handle error metrics specially
          if (cleanName === MetricNames.ERROR_COUNT) {
            summary.errors.total = metric.value;
          } else if (cleanName === MetricNames.ERROR_BY_TYPE && metric.tags.type) {
            summary.errors.by_type[metric.tags.type] = metric.value;
          } else if (cleanName === 'error.by_category' && metric.tags.category) {
            summary.errors.by_category[metric.tags.category] = metric.value;
          }
          break;
          
        case MetricTypes.GAUGE:
          summary.gauges[cleanName] = metric.value;
          break;
          
        case MetricTypes.HISTOGRAM:
          const values = metric.values.map(v => v.value);
          summary.histograms[cleanName] = {
            count: values.length,
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            p50: this.percentile(values, 0.5),
            p95: this.percentile(values, 0.95),
            p99: this.percentile(values, 0.99)
          };
          break;
      }
    }
    
    return summary;
  }
  
  // Calculate percentile
  percentile(values, p) {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
  
  // Reset metrics
  reset() {
    this.metrics.clear();
    this.timers.clear();
    logger.info('Metrics reset');
  }
}

// Global metrics instance
const metrics = new MetricsCollector();

// Export convenience functions
export function increment(name, value = 1, tags = {}) {
  return metrics.increment(name, value, tags);
}

export function gauge(name, value, tags = {}) {
  return metrics.gauge(name, value, tags);
}

export function startTimer(name, tags = {}) {
  return metrics.startTimer(name, tags);
}

export function recordError(error, context = {}) {
  return metrics.recordError(error, context);
}

export function getSummary() {
  return metrics.getSummary();
}

export function resetMetrics() {
  return metrics.reset();
}

export default metrics;