import winston from 'winston'
import path from 'path'

const isDevelopment = process.env.NODE_ENV !== 'production'
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info')

// Custom format to ensure sensitive data is never logged
const sanitizeFormat = winston.format((info) => {
  // Remove any potential sensitive fields
  const sensitiveKeys = [
    'password',
    'token',
    'apiKey',
    'api_key',
    'secret',
    'credential',
    'authorization',
    'cookie',
    'session',
  ]

  const sanitize = (obj: any): any => {
    if (typeof obj !== 'object' || obj === null) {
      return obj
    }

    const sanitized: any = Array.isArray(obj) ? [] : {}
    
    for (const key in obj) {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]'
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitized[key] = sanitize(obj[key])
      } else {
        sanitized[key] = obj[key]
      }
    }
    
    return sanitized
  }

  return sanitize(info)
})

// Base format for all logs
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  sanitizeFormat(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Console format with colors for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, module, ...metadata }) => {
    let msg = `${timestamp} [${level}]`
    if (module) {
      msg += ` [${module}]`
    }
    msg += `: ${message}`
    
    if (Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`
    }
    
    return msg
  })
)

// Create transports based on environment
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isDevelopment ? consoleFormat : baseFormat,
  }),
]

// Add file rotation in production
if (!isDevelopment) {
  // Note: winston-daily-rotate-file needs to be installed separately
  // For now, we'll use standard file transport
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: baseFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: baseFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  )
}

// Create default logger
const defaultLogger = winston.createLogger({
  level: logLevel,
  format: baseFormat,
  transports,
  exitOnError: false,
})

// Factory function to create logger with module context
export function createLogger(module: string): winston.Logger {
  return defaultLogger.child({ module })
}

// Export default logger
export default defaultLogger
