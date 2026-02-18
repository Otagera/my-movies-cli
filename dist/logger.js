"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = exports.Logger = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    context;
    minLevel;
    constructor(context, minLevel = LogLevel.INFO) {
        this.context = context;
        this.minLevel = minLevel;
    }
    log(level, message, meta) {
        if (level < this.minLevel)
            return;
        const levelName = LogLevel[level];
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${levelName}] [${this.context}]`;
        if (level === LogLevel.ERROR) {
            console.error(prefix, message);
            if (meta instanceof Error) {
                console.error("Stack:", meta.stack);
                console.error("Details:", {
                    name: meta.name,
                    message: meta.message,
                    // cause: meta.cause,
                });
            }
            else if (meta) {
                console.error("Meta:", JSON.stringify(meta, null, 2));
            }
        }
        else {
            const logMethod = level === LogLevel.WARN ? console.warn : console.log;
            logMethod(prefix, message);
            if (meta) {
                logMethod("Meta:", JSON.stringify(meta, null, 2));
            }
        }
    }
    debug(message, meta) {
        this.log(LogLevel.DEBUG, message, meta);
    }
    info(message, meta) {
        this.log(LogLevel.INFO, message, meta);
    }
    warn(message, meta) {
        this.log(LogLevel.WARN, message, meta);
    }
    error(message, meta) {
        this.log(LogLevel.ERROR, message, meta);
    }
}
exports.Logger = Logger;
const createLogger = (context) => {
    const level = LogLevel.INFO;
    return new Logger(context, level);
};
exports.createLogger = createLogger;
