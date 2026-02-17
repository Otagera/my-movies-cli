export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

export class Logger {
	constructor(
		private context: string,
		private minLevel: LogLevel = LogLevel.INFO
	) {}

	private log(level: LogLevel, message: string, meta?: unknown) {
		if (level < this.minLevel) return;

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
			} else if (meta) {
				console.error("Meta:", JSON.stringify(meta, null, 2));
			}
		} else {
			const logMethod = level === LogLevel.WARN ? console.warn : console.log;
			logMethod(prefix, message);
			if (meta) {
				logMethod("Meta:", JSON.stringify(meta, null, 2));
			}
		}
	}
	public debug(message: string, meta?: unknown) {
		this.log(LogLevel.DEBUG, message, meta);
	}
	public info(message: string, meta?: unknown) {
		this.log(LogLevel.INFO, message, meta);
	}
	public warn(message: string, meta?: unknown) {
		this.log(LogLevel.WARN, message, meta);
	}
	public error(message: string, meta?: unknown) {
		this.log(LogLevel.ERROR, message, meta);
	}
}

export const createLogger = (context: string): Logger => {
	const level = LogLevel.INFO;
	return new Logger(context, level);
};
