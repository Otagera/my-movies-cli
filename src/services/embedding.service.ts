import { pipeline, env, FeatureExtractionPipeline } from "@xenova/transformers";
import dotenv from "dotenv";

dotenv.config();

// Set the path to the local models
env.localModelPath = "./.cache/transformers";

if (process.env.USE_LOCAL_HF_MODELS === "true") {
	env.allowRemoteModels = false;
}

let extractor: FeatureExtractionPipeline | null = null; // Variable to hold the singleton pipeline

export class EmbeddingService {
	private static instance: EmbeddingService;

	private constructor() {
		// Private constructor to enforce singleton pattern
	}

	public static async getInstance(): Promise<EmbeddingService> {
		if (!EmbeddingService.instance) {
			EmbeddingService.instance = new EmbeddingService();
			await EmbeddingService.instance.loadModel();
		}
		return EmbeddingService.instance;
	}

	private async loadModel() {
		if (!extractor) {
			console.log("Loading embedding model (this may take a moment)...");
			// Use the 'feature-extraction' pipeline with the specified model
			extractor = await pipeline(
				"feature-extraction",
				"Xenova/all-MiniLM-L6-v2",
				{ quantized: false },
			);
			console.log("Embedding model loaded.");
		}
	}

	/**
	 * Generates a vector embedding for the given text.
	 * @param text The input text to embed.
	 * @returns A promise that resolves to an array of numbers representing the embedding.
	 */
	public async generateEmbedding(text: string): Promise<number[]> {
		if (!extractor) {
			throw new Error("Embedding model not loaded. Call getInstance() first.");
		}
		// Generate embeddings. The output is a tensor, we need to convert it to a plain array.
		const output = await extractor(text, {
			pooling: "mean",
			normalize: true,
		});
		// Convert the tensor to a flat array of numbers
		return Array.from(output.data);
	}
}
