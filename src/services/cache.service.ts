import knex from 'knex';
import path from 'path';

export class CacheService {
  private db: knex.Knex;

  constructor() {
    const dbPath = path.resolve(__dirname, '../../cache.sqlite');
    this.db = knex({
      client: 'sqlite3',
      connection: {
        filename: dbPath,
      },
      useNullAsDefault: true,
    });
  }

  async init() {
    await this.db.schema.createTableIfNotExists('movies', (table) => {
      table.integer('id').primary();
      table.string('title');
      table.text('overview');
      table.string('release_date');
      table.json('genre_ids'); // Store as JSON string
      table.timestamp('cached_at').defaultTo(this.db.fn.now());
    });

    await this.db.schema.createTableIfNotExists('movie_credits', (table) => {
      table.integer('movie_id').primary();
      table.json('cast'); // Store as JSON string
      table.json('crew'); // Store as JSON string
      table.timestamp('cached_at').defaultTo(this.db.fn.now());
    });

    // Table to store discover movie results (e.g., for popular movies by page)
    await this.db.schema.createTableIfNotExists('discover_movies_cache', (table) => {
      table.string('query_params').primary(); // e.g., 'sort_by=popularity.desc&page=1'
      table.json('results'); // Store array of movie IDs or simplified movie objects
      table.timestamp('cached_at').defaultTo(this.db.fn.now());
    });

    console.log('SQLite cache initialized.');
  }

  async saveMovie(movie: any) {
    await this.db('movies').insert({
      id: movie.id,
      title: movie.title,
      overview: movie.overview,
      release_date: movie.release_date,
      genre_ids: JSON.stringify(movie.genre_ids),
    }).onConflict('id').merge();
  }

  async getMovie(id: number) {
    const movie = await this.db('movies').where({ id }).first();
    if (movie) {
      movie.genre_ids = JSON.parse(movie.genre_ids);
    }
    return movie;
  }

  async saveMovieCredits(movieId: number, credits: any) {
    await this.db('movie_credits').insert({
      movie_id: movieId,
      cast: JSON.stringify(credits.cast),
      crew: JSON.stringify(credits.crew),
    }).onConflict('movie_id').merge();
  }

  async getMovieCredits(movieId: number) {
    const credits = await this.db('movie_credits').where({ movie_id: movieId }).first();
    if (credits) {
      credits.cast = JSON.parse(credits.cast);
      credits.crew = JSON.parse(credits.crew);
    }
    return credits;
  }

  async saveDiscoverMovies(queryParams: string, results: any[]) {
    await this.db('discover_movies_cache').insert({
      query_params: queryParams,
      results: JSON.stringify(results),
    }).onConflict('query_params').merge();
  }

  async getDiscoverMovies(queryParams: string) {
    const cached = await this.db('discover_movies_cache').where({ query_params: queryParams }).first();
    if (cached) {
      cached.results = JSON.parse(cached.results);
    }
    return cached;
  }
}
