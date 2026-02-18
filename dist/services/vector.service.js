"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorService = void 0;
const chromadb_1 = require("chromadb");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class VectorService {
    client;
    collections = new Map(); // Cache collections
    constructor() {
        // For a persistent local database, specify a path
        this.client = new chromadb_1.ChromaClient();
    }
    /**
     * Ensures the ChromaDB server is running.
     * If not, it attempts to start it in the background.
     */
    async ensureServerRunning() {
        try {
            await this.client.heartbeat();
            console.log("✅ ChromaDB is already running.");
            return;
        }
        catch (error) {
            console.log("🌀 ChromaDB not found. Starting sidecar instance...");
        }
        // Ensure data directory exists
        const dataDir = path.join(process.cwd(), "data", "chroma_db");
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        // Start ChromaDB using npx
        const chromaProcess = (0, child_process_1.spawn)("npx", ["chroma", "run", "--path", "./data/chroma_db"], {
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
            }
            catch (e) {
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
    async getOrCreateCollection(collectionName) {
        if (this.collections.has(collectionName)) {
            return this.collections.get(collectionName);
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
    async addDocument(collectionName, id, embedding, document, 
    // biome-ignore lint/suspicious/noExplicitAny: any
    metadata) {
        const collection = await this.getOrCreateCollection(collectionName);
        await collection.add({
            ids: [id],
            embeddings: [embedding],
            documents: [document],
            metadatas: [metadata || {}],
        });
    }
    // biome-ignore lint/suspicious/noExplicitAny: any
    async getDocument(collectionName, where) {
        const collection = await this.getOrCreateCollection(collectionName);
        const results = await collection.get({
            where: where,
            include: [
                chromadb_1.IncludeEnum.documents,
                chromadb_1.IncludeEnum.metadatas,
                chromadb_1.IncludeEnum.embeddings,
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
    async queryCollection(collectionName, queryEmbeddings, nResults, where) {
        const collection = await this.getOrCreateCollection(collectionName);
        const results = await collection.query({
            queryEmbeddings: [queryEmbeddings],
            nResults: nResults,
            where: where,
            include: [
                chromadb_1.IncludeEnum.documents,
                chromadb_1.IncludeEnum.metadatas,
                chromadb_1.IncludeEnum.distances,
            ],
        });
        return results;
    }
}
exports.VectorService = VectorService;
