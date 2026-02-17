export class AppError extends Error {
	constructor(
		message: string,
		public readonly code: string,
		public readonly statusCode: number = 500,
		public readonly isOperational: boolean = true,
		public readonly context?: Record<string, unknown>
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}
}

export class TMDBError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, "TMDB_ERROR", 503, true, context);
	}
}

export class LetterboxdError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, "LETTERBOXD_ERROR", 503, true, context);
	}
}

export class ConfigError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, "CONFIG_ERROR", 500, true, context);
	}
}

export class EmbeddingError extends AppError {
	constructor(message: string, context?: Record<string, unknown>) {
		super(message, "EMBEDDING_ERROR", 500, true, context);
	}
}

export const isOperationalError = (error: Error): boolean => {
	if (error instanceof AppError) {
		return error.isOperational;
	}
	return false;
};
