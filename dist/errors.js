"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isOperationalError = exports.EmbeddingError = exports.ConfigError = exports.LetterboxdError = exports.TMDBError = exports.AppError = void 0;
class AppError extends Error {
    code;
    statusCode;
    isOperational;
    context;
    constructor(message, code, statusCode = 500, isOperational = true, context) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.context = context;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class TMDBError extends AppError {
    constructor(message, context) {
        super(message, "TMDB_ERROR", 503, true, context);
    }
}
exports.TMDBError = TMDBError;
class LetterboxdError extends AppError {
    constructor(message, context) {
        super(message, "LETTERBOXD_ERROR", 503, true, context);
    }
}
exports.LetterboxdError = LetterboxdError;
class ConfigError extends AppError {
    constructor(message, context) {
        super(message, "CONFIG_ERROR", 500, true, context);
    }
}
exports.ConfigError = ConfigError;
class EmbeddingError extends AppError {
    constructor(message, context) {
        super(message, "EMBEDDING_ERROR", 500, true, context);
    }
}
exports.EmbeddingError = EmbeddingError;
const isOperationalError = (error) => {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
};
exports.isOperationalError = isOperationalError;
