"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = exports.loadConfig = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const ConfigSchema = zod_1.z.object({
    tmdb: zod_1.z.object({
        apiKey: zod_1.z.string().min(1, "TMDb API key is required"),
        accessToken: zod_1.z.string().min(1, "TMDb Access Token key is required"),
        rateLimit: zod_1.z.number().default(40),
    }),
    letterboxd: zod_1.z.object({
        username: zod_1.z.string().min(1, "Letterboxd username is required"),
        useScraping: zod_1.z.boolean().default(true),
    }),
    streaming: zod_1.z.object({
        countryCode: zod_1.z
            .string()
            .length(2, "Country code must be 2 characters (ISO 3166-1)")
            .toUpperCase()
            .default("NG"),
        services: zod_1.z.array(zod_1.z.string()).default([]),
    }),
    recommendations: zod_1.z.object({
        semanticWeight: zod_1.z.number().min(0).default(0.7),
        detailedWeight: zod_1.z.number().min(0).default(0.3),
        chromaTopK: zod_1.z.number().min(1).default(50),
        minScore: zod_1.z.number().min(0).max(1).default(0),
    }),
    cache: zod_1.z.object({
        ttlSeconds: zod_1.z.number().min(0).default(86400),
        dbPath: zod_1.z.string().default("./cache.sqlite"),
    }),
    chromaDB: zod_1.z.object({
        host: zod_1.z.string().default("localhost"),
        port: zod_1.z.number().default(8000),
        collectionName: zod_1.z.string().default("movie_embeddings"),
    }),
    huggingface: zod_1.z.object({
        useLocalModels: zod_1.z.boolean().default(false),
        modelPath: zod_1.z.string().default("./.cache/transformers"),
        modelName: zod_1.z.string().default("Xenova/all-mpnet-base-v2"),
    }),
    ssh: zod_1.z.object({
        enabled: zod_1.z.boolean().default(false),
        port: zod_1.z.number().default(2222),
        hostKeyPath: zod_1.z.string().default("./host.key"),
    }),
});
const loadConfig = () => {
    const rawConfig = {
        tmdb: {
            apiKey: process.env.TMDB_API_KEY,
            accessToken: process.env.TMDB_ACCESS_TOKEN,
            rateLimit: parseInt(process.env.TMDB_RATE_LIMIT || "40", 10),
        },
        letterboxd: {
            username: process.env.LETTERBOXD_USERNAME,
            useScraping: process.env.LETTERBOXD_USE_SCRAPING?.toLowerCase() === "true",
        },
        streaming: {
            countryCode: process.env.STREAMING_COUNTRY_CODE,
            services: process.env.STREAMING_SERVICES?.split(",").map((s) => s.trim()) || [],
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
            useLocalModels: process.env.HUGGINGFACE_USE_LOCAL_MODELS?.toLowerCase() === "true",
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            console.error("Configuration validation error:");
            error.issues.forEach((issue) => {
                console.error(`- ${issue.path.join(".")}: ${issue.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
};
exports.loadConfig = loadConfig;
let configInstance = null;
const getConfig = () => {
    if (!configInstance) {
        configInstance = (0, exports.loadConfig)();
    }
    return configInstance;
};
exports.getConfig = getConfig;
