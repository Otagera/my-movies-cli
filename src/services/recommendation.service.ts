import { Collection } from "chromadb";
import {
	DiaryEntry,
	RatingEntry,
	ScoredMovieCandidate,
	TMDbCredits,
	TMDbMovie,
	TasteProfile,
	WatchlistEntry,
} from "../interface";
import { getConfig } from "../app.config";
import { EmbeddingService } from "./embedding.service";
import { TMDbService } from "./tmdb.service";
import { VectorService } from "./vector.service";
import { createLogger } from "../logger";
import { EmbeddingError } from "../errors";

export class RecommendationService {
	private config = getConfig();
	private tmdbService: TMDbService;
	private embeddingService?: EmbeddingService;
	private vectorService: VectorService;
	private logger = createLogger("RecommendationService");

	constructor(tmdbService: TMDbService) {
		this.tmdbService = tmdbService;
		this.vectorService = new VectorService();
	}

	public async init() {
		this.embeddingService = await EmbeddingService.getInstance();
	}

	async getRecommendations(
		diary: DiaryEntry[],
		watchlist: WatchlistEntry[],
		highlyRatedMovies: RatingEntry[],
		subscribedServices?: string[],
		countryCode?: string
	) {
		if (!this.embeddingService) {
			throw new Error("Embedding service not initialized. Call init() first.");
		}

		console.log("Building your taste profile...");

		// Ensure embeddings for highly rated movies are in ChromaDB
		await this.ensureMovieEmbeddingsPopulated(highlyRatedMovies);

		console.log(`Highly rated movies provided: ${highlyRatedMovies.length}`);

		// Generate a "taste profile" embedding by averaging embeddings of highlyRatedMovies
		const highlyRatedMovieEmbeddings: number[][] = [];
		for (const movie of highlyRatedMovies) {
			const embedding = await this.ensureMovieEmbedding(movie);
			if (embedding) {
				highlyRatedMovieEmbeddings.push(embedding);
			}
		}

		if (highlyRatedMovieEmbeddings.length === 0) {
			console.log(
				"No embeddings found for highly rated movies. Cannot generate recommendations based on taste profile."
			);
			return [];
		}

		// Average the embeddings to create a taste profile embedding
		const tasteProfileEmbedding = highlyRatedMovieEmbeddings[0].map(
			(_, i) =>
				highlyRatedMovieEmbeddings.reduce((sum, vec) => sum + vec[i], 0) /
				highlyRatedMovieEmbeddings.length
		);

		console.log("Finding movies you might like using semantic search...");
		const watchedMovieNames = new Set(diary.map((d) => d.Name.toLowerCase()));
		const watchlistMovieNames = new Set(
			watchlist.map((w) => w.Name.toLowerCase())
		);

		const chromaResults = await this.vectorService.queryCollection(
			this.config.chromaDB.collectionName,
			tasteProfileEmbedding,
			this.config.recommendations.chromaTopK
		);

		const candidateMovieIds = new Set<string>();
		const chromaScoredCandidates: ScoredMovieCandidate[] = [];

		if (chromaResults && chromaResults.ids && chromaResults.ids.length > 0) {
			for (let i = 0; i < chromaResults.ids[0].length; i++) {
				const id = chromaResults.ids[0][i];
				const distance = chromaResults.distances[0][i];
				const _metadata = chromaResults.metadatas[0][i];
				const _document = chromaResults.documents[0][i];

				// Ensure movie details are available for full scoring
				const tmdbMovieId = parseInt(id, 10);
				if (isNaN(tmdbMovieId)) continue;

				const movieDetails: TMDbMovie = await this.tmdbService.getMovieDetails(
					tmdbMovieId
				);
				if (!movieDetails) continue;

				if (
					!watchedMovieNames.has(movieDetails.title.toLowerCase()) &&
					!watchlistMovieNames.has(movieDetails.title.toLowerCase())
				) {
					if (!candidateMovieIds.has(id)) {
						// Lower distance means higher similarity in ChromaDB, so invert for a "score"
						const semanticScore = 1 - distance; // Normalize distance to a similarity score (0 to 1)

						// For now, only include id, title, genre_ids, and semantic score
						// We'll re-apply detailed scoring later if needed or integrate it.
						chromaScoredCandidates.push({
							id: movieDetails.id,
							title: movieDetails.title,
							genre_ids: movieDetails.genre_ids,
							score: semanticScore,
						});
						candidateMovieIds.add(id);
					}
				}
			}
		}

		// Sort by semantic score (higher is better)
		chromaScoredCandidates.sort((a, b) => b.score - a.score);

		console.log(
			`Candidates after semantic search and filtering: ${chromaScoredCandidates.length}`
		);

		// Re-introduce original taste profile building for detailed scoring
		const tasteProfile = await this.buildTasteProfile(highlyRatedMovies);

		const finalScoredCandidates: ScoredMovieCandidate[] = [];

		// Now, apply the detailed scoring from the original recommendation logic
		// to the semantically filtered candidates
		for (const candidate of chromaScoredCandidates) {
			const movieDetails: TMDbMovie = await this.tmdbService.getMovieDetails(
				candidate.id
			);
			const movieCredits: TMDbCredits = await this.tmdbService.getMovieCredits(
				candidate.id
			);

			let detailedScore = 0;

			// Score by genre
			if (movieDetails && movieDetails.genres) {
				const movieGenres = new Set(movieDetails.genres.map((g) => g.name));
				for (const [genre, count] of tasteProfile.genres.entries()) {
					if (movieGenres.has(genre)) {
						detailedScore += count;
					}
				}
			}

			// Score by actors
			if (movieCredits && movieCredits.cast) {
				const movieActors = new Set(movieCredits.cast.map((c) => c.name));
				for (const [actor, count] of tasteProfile.actors.entries()) {
					if (movieActors.has(actor)) {
						detailedScore += count;
					}
				}
			}

			// Score by directors
			if (movieCredits && movieCredits.crew) {
				const movieDirectors = new Set(
					movieCredits.crew
						.filter((c) => c.job === "Director")
						.map((c) => c.name)
				);
				for (const [director, count] of tasteProfile.directors.entries()) {
					if (movieDirectors.has(director)) {
						detailedScore += count;
					}
				}
			}

			// Score by writers (screenplay, story, writer)
			if (movieCredits && movieCredits.crew) {
				const movieWriters = new Set(
					movieCredits.crew
						.filter((c) => ["Screenplay", "Story", "Writer"].includes(c.job))
						.map((c) => c.name)
				);
				for (const [writer, count] of tasteProfile.writers.entries()) {
					if (movieWriters.has(writer)) {
						detailedScore += count;
					}
				}
			}

			// Score by synopsis keywords (simple keyword matching for now)
			if (movieDetails && movieDetails.overview) {
				const overviewWords = new Set(
					movieDetails.overview
						.toLowerCase()
						.split(/\W+/)
						.filter((word: string) => word.length > 2)
				);
				for (const [keyword, count] of tasteProfile.keywords.entries()) {
					if (overviewWords.has(keyword)) {
						detailedScore += count;
					}
				}
			}

			// Combine semantic score with detailed score.
			// The weighting between semanticScore and detailedScore might need tuning.
			// For now, let's give semanticScore a base weight and add detailedScore.
			finalScoredCandidates.push({
				...candidate,
				score:
					candidate.score * this.config.recommendations.semanticWeight * 10 +
					detailedScore * this.config.recommendations.detailedWeight, // Semantic score (0-1) * 10 + detailed score
			});
		}

		const scoredCandidates = finalScoredCandidates
			.filter((c: ScoredMovieCandidate) => c.score > 0)
			.sort(
				(a: ScoredMovieCandidate, b: ScoredMovieCandidate) => b.score - a.score
			);

		console.log(
			`Final scored candidates with score > 0: ${scoredCandidates.length}`
		);

		const top5Recommendations = scoredCandidates.slice(0, 5);

		if (subscribedServices && countryCode) {
			const finalRecommendations = [];
			for (const movie of top5Recommendations) {
				try {
					const providers = await this.tmdbService.getWatchProviders(movie.id);
					const countryProviders = providers[countryCode.toUpperCase()];

					if (countryProviders && countryProviders.flatrate) {
						const availableOnSubscribed = countryProviders.flatrate.filter(
							(provider: { provider_name: string }) =>
								subscribedServices.includes(
									provider.provider_name.toLowerCase()
								)
						);
						if (availableOnSubscribed.length > 0) {
							finalRecommendations.push(movie);
						}
					}
				} catch (error: unknown) {
					if (error instanceof Error) {
						console.error(
							`Error checking watch providers for ${movie.title}:`,
							error.message
						);
					}
				}
			}
			return finalRecommendations;
		} else {
			return top5Recommendations;
		}
	}

	private async buildTasteProfile(
		highlyRatedMovies: RatingEntry[]
	): Promise<TasteProfile> {
		const genreCounts = new Map<string, number>();
		const actorCounts = new Map<string, number>();
		const directorCounts = new Map<string, number>();
		const writerCounts = new Map<string, number>();
		const keywordCounts = new Map<string, number>();

		for (const movie of highlyRatedMovies) {
			try {
				const tmdbMovie = await this.tmdbService.searchMovie(movie.Name);
				if (tmdbMovie) {
					const movieDetails: TMDbMovie =
						await this.tmdbService.getMovieDetails(tmdbMovie.id);
					const movieCredits: TMDbCredits =
						await this.tmdbService.getMovieCredits(tmdbMovie.id);

					if (movieDetails) {
						// Genres
						if (movieDetails.genres) {
							movieDetails.genres.forEach((genre) => {
								genreCounts.set(
									genre.name,
									(genreCounts.get(genre.name) || 0) + 1
								);
							});
						}

						// Synopsis Keywords (simple tokenization for now)
						if (movieDetails.overview) {
							const words = movieDetails.overview
								.toLowerCase()
								.split(/\W+/)
								.filter((word: string) => word.length > 2);
							words.forEach((word: string) => {
								keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
							});
						}
					}

					if (movieCredits) {
						// Actors (top 5 cast members)
						if (movieCredits.cast) {
							movieCredits.cast.slice(0, 5).forEach((castMember) => {
								actorCounts.set(
									castMember.name,
									(actorCounts.get(castMember.name) || 0) + 1
								);
							});
						}

						// Directors and Writers
						if (movieCredits.crew) {
							movieCredits.crew.forEach((crewMember) => {
								if (crewMember.job === "Director") {
									directorCounts.set(
										crewMember.name,
										(directorCounts.get(crewMember.name) || 0) + 1
									);
								} else if (
									["Screenplay", "Story", "Writer"].includes(crewMember.job)
								) {
									writerCounts.set(
										crewMember.name,
										(writerCounts.get(crewMember.name) || 0) + 1
									);
								}
							});
						}
					}
				}
			} catch (error: unknown) {
				if (error instanceof Error) {
					console.error(
						`Error building taste profile for ${movie.Name}:`,
						error.message
					);
				}
			}
		}

		return {
			genres: genreCounts,
			actors: actorCounts,
			directors: directorCounts,
			writers: writerCounts,
			keywords: keywordCounts,
		};
	}

	private getGenreList() {
		// This list could be fetched from TMDb API, but for simplicity, it's hardcoded here.
		return [
			{ id: 28, name: "Action" },
			{ id: 12, name: "Adventure" },
			{ id: 16, name: "Animation" },
			{ id: 35, name: "Comedy" },
			{ id: 80, name: "Crime" },
			{ id: 99, name: "Documentary" },
			{ id: 18, name: "Drama" },
			{ id: 10751, name: "Family" },
			{ id: 14, name: "Fantasy" },
			{ id: 36, name: "History" },
			{ id: 27, name: "Horror" },
			{ id: 10402, name: "Music" },
			{ id: 9648, name: "Mystery" },
			{ id: 10749, name: "Romance" },
			{ id: 878, name: "Science Fiction" },
			{ id: 10770, name: "TV Movie" },
			{ id: 53, name: "Thriller" },
			{ id: 10752, name: "War" },
			{ id: 37, name: "Western" },
		];
	}

	private async ensureMovieEmbeddingsPopulated(
		movies: (RatingEntry | TMDbMovie)[]
	): Promise<void> {
		const errors: Array<{ movie: string; error: any }> = [];
		let successCount = 0;

		this.logger.info(`Processing embeddings for ${movies.length} movies`);

		if (!this.embeddingService) {
			this.logger.warn(
				"EmbeddingService not initialized. Cannot populate movie embeddings."
			);
			return;
		}

		const movieEmbeddingsCollection =
			await this.vectorService.getOrCreateCollection("movie_embeddings");

		// Populate embeddings for highly-rated movies
		for (const movie of movies) {
			const movieName = "Name" in movie ? movie.Name : movie.title;
			try {
				await this.ensureMovieEmbedding(movie);
				successCount++;
			} catch (error) {
				errors.push({
					movie: movieName,
					error:
						error instanceof Error ? error.message : new Error(String(error)),
				});
				this.logger.warn(`Failed to embed movie ${movieName}`, error);
			}
		}

		// Also populate embeddings from a dynamic source to broaden the recommendation pool
		await this.populateMoviePool(movieEmbeddingsCollection);

		this.logger.info("Embedding batch complete", {
			total: movies.length,
			successful: successCount,
			failed: errors.length,
			successRate: ((successCount / movies.length) * 100).toFixed(2) + "%",
		});

		if (errors.length > movies.length * 0.3) {
			this.logger.error(
				`High failure rate: ${errors.length}/${movies.length} movies failed`,
				{
					sampleErrors: errors.slice(0, 3).map((e) => e.movie),
				}
			);

			throw new EmbeddingError(
				`Failed to process ${errors.length} out of ${movies.length} movies. Aborting.`,
				{
					failureRate: errors.length / movies.length,
					sampleFailures: errors.slice(0, 5).map((e) => ({
						movie: e.movie,
						error: e.error.message,
					})),
				}
			);
		}
		if (errors.length > 0) {
			this.logger.warn(
				`Some movies failed to embed: ${errors.length}/${movies.length}`,
				{
					sampleFailures: errors.slice(0, 5).map((e) => ({
						movie: e.movie,
						error: e.error.message,
					})),
				}
			);
		}
	}

	private async ensureMovieEmbedding(
		movie: RatingEntry | TMDbMovie
	): Promise<number[] | null> {
		if (!this.embeddingService) {
			throw new Error("Embedding service not initialized.");
		}

		const movieName = "Name" in movie ? movie.Name : movie.title;
		const searchResult =
			"id" in movie ? movie : await this.tmdbService.searchMovie(movieName);

		if (!searchResult) {
			return null;
		}

		const movieId = searchResult.id.toString();

		// Try to fetch embedding from ChromaDB
		const result = await this.vectorService.getDocument("movie_embeddings", {
			id: movieId,
		});

		if (result.embeddings && result.embeddings.length > 0) {
			return result.embeddings[0][0]; // Chroma returns [[embedding]]
		}

		// If not found in ChromaDB, generate and add it
		const movieDetails = await this.tmdbService.getMovieDetails(
			searchResult.id
		);
		if (movieDetails && movieDetails.overview) {
			const embedding = await this.embeddingService.generateEmbedding(
				movieDetails.overview
			);
			await this.vectorService.addDocument(
				"movie_embeddings",
				movieId,
				embedding,
				movieDetails.overview,
				{
					title: movieDetails.title,
					genre_ids: movieDetails.genre_ids?.join(",") || "",
					release_date: movieDetails.release_date,
				}
			);
			return embedding;
		}

		return null;
	}

	private async populateMoviePool(
		collection: Collection,
		pagesToFetch = 1 // Fetch 1 page to keep it fast, but from a random category
	): Promise<void> {
		if (!this.embeddingService) {
			console.warn(
				"EmbeddingService not initialized. Cannot populate movie pool."
			);
			return;
		}

		// Dynamically select a movie category to fetch from
		const movieFetchers = [
			this.tmdbService.getPopularMovies.bind(this.tmdbService),
			this.tmdbService.getTopRatedMovies.bind(this.tmdbService),
			this.tmdbService.getNowPlayingMovies.bind(this.tmdbService),
		];
		const randomFetcher =
			movieFetchers[Math.floor(Math.random() * movieFetchers.length)];

		console.log(
			`Populating ChromaDB with new movie embeddings (fetching ${pagesToFetch} page(s) from a random category)...`
		);
		let newMovies: TMDbMovie[] = [];
		for (let i = 1; i <= pagesToFetch; i++) {
			const pageResults = await randomFetcher(i);
			newMovies = newMovies.concat(pageResults);
		}

		for (const movie of newMovies) {
			try {
				await this.ensureMovieEmbedding(movie);
			} catch (error) {
				console.error(
					`Error populating embedding for new movie ${movie.title}:`,
					error
				);
			}
		}
		console.log("Finished populating new movie embeddings.");
	}

	async getRandomRecommendationWithDetails(
		highlyRatedMovies: RatingEntry[],
		diary: DiaryEntry[],
		watchlist: WatchlistEntry[]
	) {
		console.log("Building your taste profile for random recommendation...");
		const tasteProfile = await this.buildTasteProfile(highlyRatedMovies);

		const watchedMovieNames = new Set(diary.map((d) => d.Name.toLowerCase()));
		const watchlistMovieNames = new Set(
			watchlist.map((w) => w.Name.toLowerCase())
		);

		let randomMovie: TMDbMovie | null = null;
		let attempts = 0;
		const maxAttempts = 20; // Increased attempts to find an unwatched/unlisted movie

		while (!randomMovie && attempts < maxAttempts) {
			attempts++;
			const randomPage = Math.floor(Math.random() * 100) + 1;
			const response = await this.tmdbService.discoverMovies({
				sort_by: "popularity.desc",
				page: randomPage,
			});

			if (response.results && response.results.length > 0) {
				const availableMovies = response.results.filter(
					(movie: TMDbMovie) =>
						!watchedMovieNames.has(movie.title.toLowerCase()) &&
						!watchlistMovieNames.has(movie.title.toLowerCase())
				);
				if (availableMovies.length > 0) {
					randomMovie =
						availableMovies[Math.floor(Math.random() * availableMovies.length)];
				}
			}
		}

		if (!randomMovie) {
			return { movie: null, reasons: ["Could not find a random movie."] };
		}

		const movieDetails: TMDbMovie = await this.tmdbService.getMovieDetails(
			randomMovie.id
		);
		const movieCredits: TMDbCredits = await this.tmdbService.getMovieCredits(
			randomMovie.id
		);

		const reasons: string[] = [];

		// Check for genre matches
		if (movieDetails && movieDetails.genres && tasteProfile.genres.size > 0) {
			const movieGenres = new Set(movieDetails.genres.map((g) => g.name));
			const matchedGenres = [...tasteProfile.genres.keys()].filter((genre) =>
				movieGenres.has(genre)
			);
			if (matchedGenres.length > 0) {
				reasons.push(
					`It's in your favorite genres: ${matchedGenres
						.slice(0, 3)
						.join(", ")}.`
				);
			}
		}

		// Check for actor matches
		if (movieCredits && movieCredits.cast && tasteProfile.actors.size > 0) {
			const movieActors = new Set(movieCredits.cast.map((c) => c.name));
			const matchedActors = [...tasteProfile.actors.keys()].filter((actor) =>
				movieActors.has(actor)
			);
			if (matchedActors.length > 0) {
				reasons.push(
					`It features actors you like: ${matchedActors
						.slice(0, 2)
						.join(", ")}.`
				);
			}
		}

		// Check for director matches
		if (movieCredits && movieCredits.crew && tasteProfile.directors.size > 0) {
			const movieDirectors = new Set(
				movieCredits.crew.filter((c) => c.job === "Director").map((c) => c.name)
			);
			const matchedDirectors = [...tasteProfile.directors.keys()].filter(
				(director) => movieDirectors.has(director)
			);
			if (matchedDirectors.length > 0) {
				reasons.push(
					`It's directed by ${matchedDirectors.slice(0, 1).join(", ")}.`
				);
			}
		}

		// Add synopsis if available
		if (movieDetails && movieDetails.overview) {
			reasons.push(`Synopsis: ${movieDetails.overview.substring(0, 150)}...`);
		}

		return {
			movie: randomMovie,
			reasons:
				reasons.length > 0
					? reasons
					: [`No specific reasons found, but it's a popular movie!`],
		};
	}
}
