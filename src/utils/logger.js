/**
 * Logger Utility
 * Provides structured logging with different levels
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

export class Logger {
  constructor(options = {}) {
    this.name = options.name || 'PromoPilot';
    this.level = options.level !== undefined ? options.level : LogLevel.INFO;
    this.logToFile = options.logToFile || false;
    this.logDir = options.logDir || path.join(__dirname, '../../logs');
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    
    if (this.logToFile) {
      this.ensureLogDirectory();
    }
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFileName() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `promopilot-${date}.log`);
  }

  rotateLogIfNeeded() {
    const logFile = this.getLogFileName();
    if (fs.existsSync(logFile)) {
      const stats = fs.statSync(logFile);
      if (stats.size > this.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = logFile.replace('.log', `-${timestamp}.log`);
        fs.renameSync(logFile, rotatedFile);
      }
    }
  }

  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const levelName = this.getLevelName(level);
    
    const logEntry = {
      timestamp,
      level: levelName,
      logger: this.name,
      message,
      ...data
    };

    return logEntry;
  }

  getLevelName(level) {
    switch (level) {
      case LogLevel.ERROR: return 'ERROR';
      case LogLevel.WARN: return 'WARN';
      case LogLevel.INFO: return 'INFO';
      case LogLevel.DEBUG: return 'DEBUG';
      default: return 'UNKNOWN';
    }
  }

  getConsoleIcon(level) {
    switch (level) {
      case LogLevel.ERROR: return '❌';
      case LogLevel.WARN: return '⚠️';
      case LogLevel.INFO: return '✅';
      case LogLevel.DEBUG: return '🔍';
      default: return '📝';
    }
  }

  log(level, message, data = {}) {
    if (level > this.level) return;

    const logEntry = this.formatMessage(level, message, data);
    
    // Console output
    const icon = this.getConsoleIcon(level);
    const consoleMessage = `${icon} ${message}`;
    
    switch (level) {
      case LogLevel.ERROR:
        console.error(consoleMessage, data);
        break;
      case LogLevel.WARN:
        console.warn(consoleMessage, data);
        break;
      default:
        console.log(consoleMessage, data);
    }

    // File output
    if (this.logToFile) {
      this.writeToFile(logEntry);
    }
  }

  writeToFile(logEntry) {
    try {
      this.rotateLogIfNeeded();
      const logFile = this.getLogFileName();
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFileSync(logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error.message);
    }
  }

  error(message, data = {}) {
    this.log(LogLevel.ERROR, message, data);
  }

  warn(message, data = {}) {
    this.log(LogLevel.WARN, message, data);
  }

  info(message, data = {}) {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message, data = {}) {
    this.log(LogLevel.DEBUG, message, data);
  }

  // Create child logger with context
  child(context) {
    return new ContextLogger(this, context);
  }
}

class ContextLogger {
  constructor(parent, context) {
    this.parent = parent;
    this.context = context;
  }

  log(level, message, data = {}) {
    this.parent.log(level, message, { context: this.context, ...data });
  }

  error(message, data = {}) {
    this.log(LogLevel.ERROR, message, data);
  }

  warn(message, data = {}) {
    this.log(LogLevel.WARN, message, data);
  }

  info(message, data = {}) {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message, data = {}) {
    this.log(LogLevel.DEBUG, message, data);
  }
}

// Default logger instance
const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO,
  logToFile: process.env.LOG_TO_FILE === 'true'
});

export default defaultLogger;