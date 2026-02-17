import dotenv from "dotenv";
import { access } from "fs";
import { z } from "zod";

dotenv.config();

const ConfigSchema = z.object({
	tmdb: z.object({
		apiKey: z.string().min(1, "TMDb API key is required"),
		accessToken: z.string().min(1, "TMDb Access Token key is required"),
		rateLimit: z.number().default(40),
	}),
	letterboxd: z.object({
		username: z.string().min(1, "Letterboxd username is required"),
		useScraping: z.boolean().default(true),
	}),
	streaming: z.object({
		countryCode: z
			.string()
			.length(2, "Country code must be 2 characters (ISO 3166-1)")
			.toUpperCase()
			.default("NG"),
		services: z.array(z.string()).default([]),
	}),
	recommendations: z.object({
		semanticWeight: z.number().min(0).default(0.7),
		detailedWeight: z.number().min(0).default(0.3),
		chromaTopK: z.number().min(1).default(50),
		minScore: z.number().min(0).max(1).default(0),
	}),
	cache: z.object({
		ttlSeconds: z.number().min(0).default(86400),
		dbPath: z.string().default("./cache.sqlite"),
	}),
	chromaDB: z.object({
		host: z.string().default("localhost"),
		port: z.number().default(8000),
		collectionName: z.string().default("movie_embeddings"),
	}),
	huggingface: z.object({
		useLocalModels: z.boolean().default(false),
		modelPath: z.string().default("./.cache/transformers"),
		modelName: z.string().default("Xenova/all-mpnet-base-v2"),
	}),
	ssh: z.object({
		enabled: z.boolean().default(false),
		port: z.number().default(2222),
		hostKeyPath: z.string().default("./host.key"),
	}),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export const loadConfig = (): AppConfig => {
	const rawConfig = {
		tmdb: {
			apiKey: process.env.TMDB_API_KEY,
			accessToken: process.env.TMDB_ACCESS_TOKEN,
			rateLimit: parseInt(process.env.TMDB_RATE_LIMIT || "40", 10),
		},
		letterboxd: {
			username: process.env.LETTERBOXD_USERNAME,
			useScraping:
				process.env.LETTERBOXD_USE_SCRAPING?.toLowerCase() === "true",
		},
		streaming: {
			countryCode: process.env.STREAMING_COUNTRY_CODE,
			services:
				process.env.STREAMING_SERVICES?.split(",").map((s) => s.trim()) || [],
		},
		recommendations: {
			semanticWeight: parseFloat(process.env.REC_SEMANTIC_WEIGHT || "0.7"),
			detailedWeight: parseFloat(process.env.REC_DETAILED_WEIGHT || "0.3"),
			chromaTopK: parseInt(process.env.REC_CHROMA_TOP_K || "50", 10),
			minScore: parseFloat(process.env.REC_MIN_SCORE || "0"),
		},
		cache: {
			ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || "86400", 10),
			dbPath: process.env.CACHE_DB_PATH,
		},
		chromaDB: {
			host: process.env.CHROMA_DB_HOST,
			port: parseInt(process.env.CHROMA_DB_PORT || "8000", 10),
			collectionName: process.env.CHROMA_DB_COLLECTION_NAME,
		},
		huggingface: {
			useLocalModels:
				process.env.HUGGINGFACE_USE_LOCAL_MODELS?.toLowerCase() === "true",
			modelPath: process.env.HUGGINGFACE_MODEL_PATH,
			modelName: process.env.HUGGINGFACE_MODEL_NAME,
		},
		ssh: {
			enabled: process.env.SSH_ENABLED?.toLowerCase() === "true",
			port: parseInt(process.env.SSH_PORT || "2222", 10),
			hostKeyPath: process.env.SSH_HOST_KEY_PATH,
		},
	};

	try {
		return ConfigSchema.parse(rawConfig);
	} catch (error) {
		if (error instanceof z.ZodError) {
			console.error("Configuration validation error:");
			error.issues.forEach((issue) => {
				console.error(`- ${issue.path.join(".")}: ${issue.message}`);
			});
			process.exit(1);
		}
		throw error;
	}
};

let configInstance: AppConfig | null = null;

export const getConfig = (): AppConfig => {
	if (!configInstance) {
		configInstance = loadConfig();
	}
	return configInstance;
};
