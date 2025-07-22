import axios from "axios";
import { CacheService } from "./cache.service";

const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";

export class TMDbService {
  private apiKey: string;
  private cacheService: CacheService;

  constructor(apiKey: string, cacheService: CacheService) {
    if (!apiKey) {
      throw new Error("TMDb API key is required.");
    }
    this.apiKey = apiKey;
    this.cacheService = cacheService;
  }

  async searchMovie(title: string) {
    // TMDb search results don't have a stable ID for caching by title directly
    // We'll rely on caching movie details and credits by their TMDb ID after search
    const response = await axios.get(`${TMDB_API_BASE_URL}/search/movie`, {
      params: {
        api_key: this.apiKey,
        query: title,
      },
    });
    return response.data.results[0];
  }

  async getWatchProviders(movieId: number) {
    const response = await axios.get(
      `${TMDB_API_BASE_URL}/movie/${movieId}/watch/providers`,
      {
        params: {
          api_key: this.apiKey,
        },
      },
    );
    return response.data.results;
  }

  async getMovieDetails(movieId: number) {
    const cachedMovie = await this.cacheService.getMovie(movieId);
    if (cachedMovie) {
      return cachedMovie;
    }

    const response = await axios.get(`${TMDB_API_BASE_URL}/movie/${movieId}`, {
      params: {
        api_key: this.apiKey,
      },
    });
    const movieDetails = response.data;
    await this.cacheService.saveMovie(movieDetails);
    return movieDetails;
  }

  async getAvailableProviders(countryCode: string) {
    const response = await axios.get(
      `${TMDB_API_BASE_URL}/watch/providers/movie`,
      {
        params: {
          api_key: this.apiKey,
          watch_region: countryCode.toUpperCase(),
        },
      },
    );
    return response.data.results;
  }

  async discoverMovies(params: {
    sort_by?: string;
    page?: number;
    with_genres?: string;
  }) {
    const queryParams = new URLSearchParams(
      params as Record<string, string>,
    ).toString();
    const cachedDiscover =
      await this.cacheService.getDiscoverMovies(queryParams);
    if (cachedDiscover) {
      return cachedDiscover.results;
    }

    const response = await axios.get(`${TMDB_API_BASE_URL}/discover/movie`, {
      params: {
        api_key: this.apiKey,
        ...params,
      },
    });
    const discoverResults = response.data;
    await this.cacheService.saveDiscoverMovies(queryParams, discoverResults);
    return discoverResults;
  }

  async getMovieCredits(movieId: number) {
    const cachedCredits = await this.cacheService.getMovieCredits(movieId);
    if (cachedCredits) {
      return cachedCredits;
    }

    const response = await axios.get(
      `${TMDB_API_BASE_URL}/movie/${movieId}/credits`,
      {
        params: {
          api_key: this.apiKey,
        },
      },
    );
    const movieCredits = response.data;
    await this.cacheService.saveMovieCredits(movieId, movieCredits);
    return movieCredits;
  }
}
