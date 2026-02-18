import { ChromaClient, Collection, IncludeEnum, Where } from "chromadb";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

export class VectorService {
	private client: ChromaClient;
	private collections: Map<string, Collection> = new Map(); // Cache collections

	constructor() {
		// For a persistent local database, specify a path
		this.client = new ChromaClient();
	}

	/**
	 * Ensures the ChromaDB server is running. 
	 * If not, it attempts to start it in the background.
	 */
	public async ensureServerRunning(): Promise<void> {
		try {
			await this.client.heartbeat();
			console.log("✅ ChromaDB is already running.");
			return;
		} catch (error) {
			console.log("🌀 ChromaDB not found. Starting sidecar instance...");
		}

		// Ensure data directory exists
		const dataDir = path.join(process.cwd(), "data", "chroma_db");
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}

		// Start ChromaDB using npx
		const chromaProcess = spawn("npx", ["chroma", "run", "--path", "./data/chroma_db"], {
			detached: true,
			stdio: "ignore",
			cwd: process.cwd(),
		});

		chromaProcess.unref();

		// Poll until server is ready
		let retries = 20;
		while (retries > 0) {
			try {
				await this.client.heartbeat();
				console.log("✅ ChromaDB sidecar started successfully.");
				return;
			} catch (e) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
				retries--;
			}
		}

		throw new Error("Failed to start ChromaDB after 20 seconds. Please run it manually: npx chroma run --path ./data/chroma_db");
	}

	/**
	 * Gets or creates a ChromaDB collection.
	 * @param collectionName The name of the collection.
	 * @returns A promise that resolves to the Collection object.
	 */
	public async getOrCreateCollection(
		collectionName: string,
	): Promise<Collection> {
		if (this.collections.has(collectionName)) {
			return this.collections.get(collectionName)!;
		}

		const collection = await this.client.getOrCreateCollection({
			name: collectionName,
		});
		this.collections.set(collectionName, collection);
		return collection;
	}

	/**
	 * Adds a document to a specified collection.
	 * @param collectionName The name of the collection.
	 * @param id A unique ID for the document.
	 * @param embedding The vector embedding of the document.
	 * @param document The original text document.
	 * @param metadata Optional metadata associated with the document.
	 * @returns A promise that resolves when the document is added.
	 */
	public async addDocument(
		collectionName: string,
		id: string,
		embedding: number[],
		document: string,
		// biome-ignore lint/suspicious/noExplicitAny: any
		metadata?: Record<string, string | number | boolean | any>,
	): Promise<void> {
		const collection = await this.getOrCreateCollection(collectionName);
		await collection.add({
			ids: [id],
			embeddings: [embedding],
			documents: [document],
			metadatas: [metadata || {}],
		});
	}

	// biome-ignore lint/suspicious/noExplicitAny: any
	public async getDocument(collectionName: string, where: Where): Promise<any> {
		const collection = await this.getOrCreateCollection(collectionName);
		const results = await collection.get({
			where: where,
			include: [
				IncludeEnum.documents,
				IncludeEnum.metadatas,
				IncludeEnum.embeddings,
			],
		});
		return results;
	}

	/**
	 * Queries a collection for similar documents.
	 * @param collectionName The name of the collection.
	 * @param queryEmbeddings The embedding(s) to query with.
	 * @param nResults The number of results to return.
	 * @param where Optional filter for metadata.
	 * @param whereDocument Optional filter for document content.
	 * @returns A promise that resolves to the query results.
	 */
	public async queryCollection(
		collectionName: string,
		queryEmbeddings: number[],
		nResults: number,
		where?: Where,
		// biome-ignore lint/suspicious/noExplicitAny: any
	): Promise<any> {
		const collection = await this.getOrCreateCollection(collectionName);
		const results = await collection.query({
			queryEmbeddings: [queryEmbeddings],
			nResults: nResults,
			where: where,
			include: [
				IncludeEnum.documents,
				IncludeEnum.metadatas,
				IncludeEnum.distances,
			],
		});
		return results;
	}
}