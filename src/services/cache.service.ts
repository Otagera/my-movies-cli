import knex from "knex";
import path from "path";
import { DiaryEntry, RatingEntry, WatchlistEntry } from "../interface";
import { getConfig } from "../app.config";

export interface WatchlistAvailability {
	[movieName: string]: {
		isAvailable: boolean;
		providers: string[];
		link?: string;
	};
}

interface Movie {
	id: number;
	title: string;
	overview: string;
	release_date: string;
	genre_ids: number[];
}

interface Credits {
	cast: unknown[];
	crew: unknown[];
}

interface SavedList {
	Date: string;
	Content: string;
}

export class CacheService {
	private db: knex.Knex;
	private config = getConfig();

	constructor() {
		// Store the database in the user's current working directory
		const dbPath = path.resolve(process.cwd(), this.config.cache.dbPath);
		this.db = knex({
			client: "sqlite3",
			connection: {
				filename: dbPath,
			},
			useNullAsDefault: true,
		});
	}

	async init() {
		const hasMoviesTable = await this.db.schema.hasTable("movies");
		if (!hasMoviesTable) {
			await this.db.schema.createTable("movies", (table) => {
				table.integer("id").primary();
				table.string("title");
				table.text("overview");
				table.string("release_date");
				table.json("genre_ids");
				table.timestamp("cached_at").defaultTo(this.db.fn.now());
			});
		}

		const hasMovieCreditsTable = await this.db.schema.hasTable("movie_credits");
		if (!hasMovieCreditsTable) {
			await this.db.schema.createTable("movie_credits", (table) => {
				table.integer("movie_id").primary();
				table.json("cast");
				table.json("crew");
				table.timestamp("cached_at").defaultTo(this.db.fn.now());
			});
		}

		const hasDiscoverMoviesCacheTable = await this.db.schema.hasTable(
			"discover_movies_cache"
		);
		if (!hasDiscoverMoviesCacheTable) {
			await this.db.schema.createTable("discover_movies_cache", (table) => {
				table.string("query_params").primary(); // e.g., 'sort_by=popularity.desc&page=1'
				table.json("results");
				table.timestamp("cached_at").defaultTo(this.db.fn.now());
			});
		}

		const hasGenericCacheTable = await this.db.schema.hasTable("generic_cache");
		if (!hasGenericCacheTable) {
			await this.db.schema.createTable("generic_cache", (table) => {
				table.string("key").primary();
				table.text("value");
				table.timestamp("cached_at").defaultTo(this.db.fn.now());
			});
		}

		const hasDiaryTable = await this.db.schema.hasTable("diary");
		if (!hasDiaryTable) {
			await this.db.schema.createTable("diary", (table) => {
				table.string("LoggedDate");
				table.string("Name");
				table.integer("Year");
				table.string("LetterboxdURI").primary();
				table.float("Rating");
				table.boolean("Rewatch");
				table.string("Tags");
				table.string("WatchedDate");
			});
		}

		const hasRatingsTable = await this.db.schema.hasTable("ratings");
		if (!hasRatingsTable) {
			await this.db.schema.createTable("ratings", (table) => {
				table.string("Date");
				table.string("Name");
				table.integer("Year");
				table.string("LetterboxdURI").primary();
				table.float("Rating");
			});
		}

		const hasWatchlistTable = await this.db.schema.hasTable("watchlist");
		if (!hasWatchlistTable) {
			await this.db.schema.createTable("watchlist", (table) => {
				table.string("Date");
				table.string("Name");
				table.integer("Year");
				table.string("LetterboxdURI").primary();
			});
		}

		const hasSavedListsTable = await this.db.schema.hasTable("saved_lists");
		if (!hasSavedListsTable) {
			await this.db.schema.createTable("saved_lists", (table) => {
				table.string("Date");
				table.string("Content").primary();
			});
		}

		console.log("SQLite cache initialized.");
	}

	public async set<T>(key: string, value: T): Promise<void> {
		const data = {
			key,
			value: JSON.stringify(value),
			cached_at: new Date().toISOString(),
		};
		await this.db("generic_cache").insert(data).onConflict("key").merge();
	}

	public async get<T>(key: string, ttlSeconds?: number): Promise<T | null> {
		const record = await this.db("generic_cache").where({ key }).first();
		if (record) {
			if (ttlSeconds) {
				const now = new Date();
				const cachedAt = new Date(record.cached_at);
				const diff = (now.getTime() - cachedAt.getTime()) / 1000;
				if (diff > ttlSeconds) {
					await this.db("generic_cache").where({ key }).del();
					return null;
				}
			}
			return JSON.parse(record.value) as T;
		}
		return null;
	}

	async saveMovie(movie: Movie) {
		await this.db("movies")
			.insert({
				id: movie.id,
				title: movie.title,
				overview: movie.overview,
				release_date: movie.release_date,
				genre_ids: JSON.stringify(movie.genre_ids),
			})
			.onConflict("id")
			.merge();
	}

	async getMovie(id: number) {
		const movie = await this.db("movies").where({ id }).first();
		if (movie) {
			movie.genre_ids = JSON.parse(movie.genre_ids);
		}
		return movie;
	}

	async saveMovieCredits(movieId: number, credits: Credits) {
		await this.db("movie_credits")
			.insert({
				movie_id: movieId,
				cast: JSON.stringify(credits.cast),
				crew: JSON.stringify(credits.crew),
			})
			.onConflict("movie_id")
			.merge();
	}

	async getMovieCredits(movieId: number) {
		const credits = await this.db("movie_credits")
			.where({ movie_id: movieId })
			.first();
		if (credits) {
			credits.cast = JSON.parse(credits.cast);
			credits.crew = JSON.parse(credits.crew);
		}
		return credits;
	}

	async saveDiscoverMovies(queryParams: string, results: Movie[]) {
		await this.db("discover_movies_cache")
			.insert({
				query_params: queryParams,
				results: JSON.stringify(results),
			})
			.onConflict("query_params")
			.merge();
	}

	async getDiscoverMovies(queryParams: string) {
		const cached = await this.db("discover_movies_cache")
			.where({ query_params: queryParams })
			.first();
		if (cached) {
			cached.results = JSON.parse(cached.results);
		}
		return cached;
	}

	async saveDiaryEntries(entries: DiaryEntry[]) {
		await this.db("diary").del();
		// Convert Date objects to ISO strings for SQLite
		const serializedEntries = entries.map(e => ({
			...e,
			LoggedDate: e.LoggedDate.toISOString(),
			WatchedDate: e.WatchedDate.toISOString()
		}));
		await this.db.batchInsert("diary", serializedEntries);
	}

	async getDiaryEntries(): Promise<DiaryEntry[]> {
		const rows = await this.db("diary").select();
		return rows.map(r => ({
			...r,
			LoggedDate: new Date(r.LoggedDate),
			WatchedDate: new Date(r.WatchedDate),
			Rewatch: Boolean(r.Rewatch)
		}));
	}

	async saveRatingEntries(entries: RatingEntry[]) {
		await this.db("ratings").del();
		const serializedEntries = entries.map(e => ({
			...e,
			Date: e.Date.toISOString()
		}));
		await this.db.batchInsert("ratings", serializedEntries);
	}

	async getRatingEntries(): Promise<RatingEntry[]> {
		const rows = await this.db("ratings").select();
		return rows.map(r => ({
			...r,
			Date: new Date(r.Date)
		}));
	}

	async saveWatchlistEntries(entries: WatchlistEntry[]) {
		await this.db("watchlist").del();
		const serializedEntries = entries.map(e => ({
			...e,
			Date: e.Date.toISOString()
		}));
		await this.db.batchInsert("watchlist", serializedEntries);
	}

	async getWatchlistEntries(): Promise<WatchlistEntry[]> {
		const rows = await this.db("watchlist").select();
		return rows.map(r => ({
			...r,
			Date: new Date(r.Date)
		}));
	}

	async saveSavedLists(entries: SavedList[]) {
		await this.db("saved_lists").del();
		await this.db.batchInsert("saved_lists", entries);
	}

	async getSavedLists(): Promise<SavedList[]> {
		return this.db("saved_lists").select();
	}

	public async getPreviousAvailability(): Promise<WatchlistAvailability> {
		const availability = await this.get<WatchlistAvailability>(
			"watchlist-availability"
		);
		return availability || {};
	}
}