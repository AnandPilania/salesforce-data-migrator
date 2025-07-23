const winston = require('winston');
const path = require('path');

const logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

const logColors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue'
};

winston.addColors(logColors);

const logger = winston.createLogger({
    levels: logLevels,
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/error.log'),
            level: 'error',
            maxsize: 10485760,
            maxFiles: 5
        }),
        new winston.transports.File({
            filename: path.join(__dirname, '../../logs/combined.log'),
            maxsize: 10485760,
            maxFiles: 5
        })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(({ timestamp, level, message, stack }) => {
                return `${timestamp} [${level}]: ${stack || message}`;
            })
        )
    }));
}

class Logger {
    static info(message, meta = {}) {
        logger.info(message, meta);
    }

    static error(message, error = null) {
        if (error && error.stack) {
            logger.error(message, { error: error.message, stack: error.stack });
        } else if (error) {
            logger.error(message, { error: error.toString() });
        } else {
            logger.error(message);
        }
    }

    static warn(message, meta = {}) {
        logger.warn(message, meta);
    }

    static debug(message, meta = {}) {
        logger.debug(message, meta);
    }

    static async getLogs(limit = 100, level = 'all') {
        return new Promise((resolve, reject) => {
            const options = {
                from: new Date(Date.now() - 24 * 60 * 60 * 1000),
                until: new Date(),
                limit: limit,
                start: 0,
                order: 'desc',
                fields: ['timestamp', 'level', 'message']
            };

            if (level !== 'all') {
                options.level = level;
            }

            logger.query(options, (err, results) => {
                if (err) {
                    reject(err);
                } else {
                    const logs = results.file || [];
                    resolve(logs.map(log => ({
                        timestamp: log.timestamp,
                        level: log.level,
                        message: log.message,
                        error: log.error,
                        stack: log.stack
                    })));
                }
            });
        });
    }
}

const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

module.exports = Logger;
