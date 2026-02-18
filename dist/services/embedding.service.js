"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const transformers_1 = require("@xenova/transformers");
const app_config_1 = require("../app.config");
const config = (0, app_config_1.getConfig)();
transformers_1.env.localModelPath = config.huggingface.modelPath;
if (config.huggingface.useLocalModels) {
    transformers_1.env.allowRemoteModels = false;
}
let extractor = null; // Variable to hold the singleton pipeline
class EmbeddingService {
    static instance;
    constructor() { }
    static async getInstance() {
        if (!EmbeddingService.instance) {
            EmbeddingService.instance = new EmbeddingService();
            await EmbeddingService.instance.loadModel();
        }
        return EmbeddingService.instance;
    }
    async loadModel() {
        if (!extractor) {
            console.log("Loading embedding model (this may take a moment)...");
            extractor = await (0, transformers_1.pipeline)("feature-extraction", config.huggingface.modelName, { quantized: false });
            console.log("Embedding model loaded.");
        }
    }
    /**
     * Generates a vector embedding for the given text.
     * @param text The input text to embed.
     * @returns A promise that resolves to an array of numbers representing the embedding.
     */
    async generateEmbedding(text) {
        if (!extractor) {
            throw new Error("Embedding model not loaded. Call getInstance() first.");
        }
        const output = await extractor(text, {
            pooling: "mean",
            normalize: true,
        });
        return Array.from(output.data);
    }
}
exports.EmbeddingService = EmbeddingService;
