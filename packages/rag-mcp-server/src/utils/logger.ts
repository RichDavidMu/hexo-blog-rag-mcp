import path from 'node:path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

// 日志格式：JSON
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// 按天轮转的文件传输器
const dailyRotateTransport = new DailyRotateFile({
  dirname: path.join(process.cwd(), 'logs'),
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
});

// 错误日志单独记录
const errorRotateTransport = new DailyRotateFile({
  dirname: path.join(process.cwd(), 'logs'),
  filename: 'error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
});

// 创建 logger 实例
export const logger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  transports: [dailyRotateTransport, errorRotateTransport],
});

// 开发环境下也输出到控制台（可选）
if (process.env.NODE_ENV === 'development') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  );
}

export default logger;
