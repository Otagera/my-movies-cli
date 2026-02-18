"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TMDbService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../logger");
const errors_1 = require("../errors");
const TMDB_API_BASE_URL = "https://api.themoviedb.org/3";
class TMDbService {
    logger = (0, logger_1.createLogger)("TMDbService");
    apiKey;
    cacheService;
    constructor(apiKey, cacheService) {
        if (!apiKey) {
            throw new Error("TMDb API key is required.");
        }
        this.apiKey = apiKey;
        this.cacheService = cacheService;
    }
    async searchMovie(title) {
        try {
            this.logger.debug("Searching for movie", { title });
            // TMDb search results don't have a stable ID for caching by title directly
            // We'll rely on caching movie details and credits by their TMDb ID after search
            const response = await axios_1.default.get(`${TMDB_API_BASE_URL}/search/movie`, {
                params: {
                    api_key: this.apiKey,
                    query: title,
                },
                timeout: 5000,
            });
            if (response.data.results.length === 0) {
                this.logger.warn("No results found for movie", { title });
                return null;
            }
            return response.data.results[0];
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response) {
                    throw new errors_1.TMDBError(`TMDb API error: ${error.response.status} ${error.response.statusText}`, {
                        title,
                        status: error.response.status,
                        data: error.response.data,
                    });
                }
                else if (error.request) {
                    throw new errors_1.TMDBError(`TMDb API request error: No response received`, {
                        title,
                        request: error.request,
                    });
                }
            }
            this.logger.error("Error searching for movie", { title, error });
            throw new errors_1.TMDBError("Failed to search for movie", {
                title,
                originalError: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getWatchProviders(movieId) {
        try {
            this.logger.debug("Getting watch providers for movie", { movieId });
            const response = await axios_1.default.get(`${TMDB_API_BASE_URL}/movie/${movieId}/watch/providers`, {
                params: {
                    api_key: this.apiKey,
                },
                timeout: 5000,
            });
            return response.data.results;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response) {
                    throw new errors_1.TMDBError(`TMDb API error: ${error.response.status} ${error.response.statusText}`, {
                        movieId,
                        status: error.response.status,
                        data: error.response.data,
                    });
                }
                else if (error.request) {
                    throw new errors_1.TMDBError(`TMDb API request error: No response received`, {
                        movieId,
                        request: error.request,
                    });
                }
            }
            this.logger.error("Error getting watch providers", { movieId, error });
            throw new errors_1.TMDBError("Failed to get watch providers", {
                movieId,
                originalError: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getMovieDetails(movieId) {
        try {
            this.logger.debug("Getting movie details", { movieId });
            const cachedMovie = await this.cacheService.getMovie(movieId);
            if (cachedMovie) {
                this.logger.debug("Found cached movie details", { movieId });
                return cachedMovie;
            }
            this.logger.debug("Fetching movie details from API", { movieId });
            const response = await axios_1.default.get(`${TMDB_API_BASE_URL}/movie/${movieId}`, {
                params: {
                    api_key: this.apiKey,
                },
                timeout: 5000,
            });
            const movieDetails = response.data;
            await this.cacheService.saveMovie(movieDetails);
            return movieDetails;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response) {
                    throw new errors_1.TMDBError(`TMDb API error: ${error.response.status} ${error.response.statusText}`, {
                        movieId,
                        status: error.response.status,
                        data: error.response.data,
                    });
                }
                else if (error.request) {
                    throw new errors_1.TMDBError(`TMDb API request error: No response received`, {
                        movieId,
                        request: error.request,
                    });
                }
            }
            this.logger.error("Error getting movie details", { movieId, error });
            throw new errors_1.TMDBError("Failed to get movie details", {
                movieId,
                originalError: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getAvailableProviders(countryCode) {
        try {
            this.logger.debug("Getting available providers", { countryCode });
            const response = await axios_1.default.get(`${TMDB_API_BASE_URL}/watch/providers/movie`, {
                params: {
                    api_key: this.apiKey,
                    watch_region: countryCode.toUpperCase(),
                },
                timeout: 5000,
            });
            return response.data.results;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response) {
                    throw new errors_1.TMDBError(`TMDb API error: ${error.response.status} ${error.response.statusText}`, {
                        countryCode,
                        status: error.response.status,
                        data: error.response.data,
                    });
                }
                else if (error.request) {
                    throw new errors_1.TMDBError(`TMDb API request error: No response received`, {
                        countryCode,
                        request: error.request,
                    });
                }
            }
            this.logger.error("Error getting available providers", {
                countryCode,
                error,
            });
            throw new errors_1.TMDBError("Failed to get available providers", {
                countryCode,
                originalError: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async discoverMovies(params) {
        const queryParams = new URLSearchParams(params).toString();
        try {
            this.logger.debug("Discovering movies", { params });
            const cachedDiscover = await this.cacheService.getDiscoverMovies(queryParams);
            if (cachedDiscover) {
                this.logger.debug("Found cached discover movies results", { params });
                return cachedDiscover.results;
            }
            this.logger.debug("Fetching discover movies from API", { params });
            const response = await axios_1.default.get(`${TMDB_API_BASE_URL}/discover/movie`, {
                params: {
                    api_key: this.apiKey,
                    ...params,
                },
                timeout: 5000,
            });
            const discoverResults = response.data;
            await this.cacheService.saveDiscoverMovies(queryParams, discoverResults);
            return discoverResults;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response) {
                    throw new errors_1.TMDBError(`TMDb API error: ${error.response.status} ${error.response.statusText}`, {
                        params,
                        status: error.response.status,
                        data: error.response.data,
                    });
                }
                else if (error.request) {
                    throw new errors_1.TMDBError(`TMDb API request error: No response received`, {
                        params,
                        request: error.request,
                    });
                }
            }
            this.logger.error("Error discovering movies", { params, error });
            throw new errors_1.TMDBError("Failed to discover movies", {
                params,
                originalError: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getMovieCredits(movieId) {
        try {
            this.logger.debug("Getting movie credits", { movieId });
            const cachedCredits = await this.cacheService.getMovieCredits(movieId);
            if (cachedCredits) {
                this.logger.debug("Found cached movie credits", { movieId });
                return cachedCredits;
            }
            this.logger.debug("Fetching movie credits from API", { movieId });
            const response = await axios_1.default.get(`${TMDB_API_BASE_URL}/movie/${movieId}/credits`, {
                params: {
                    api_key: this.apiKey,
                },
                timeout: 5000,
            });
            const movieCredits = response.data;
            await this.cacheService.saveMovieCredits(movieId, movieCredits);
            return movieCredits;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response) {
                    throw new errors_1.TMDBError(`TMDb API error: ${error.response.status} ${error.response.statusText}`, {
                        movieId,
                        status: error.response.status,
                        data: error.response.data,
                    });
                }
                else if (error.request) {
                    throw new errors_1.TMDBError(`TMDb API request error: No response received`, {
                        movieId,
                        request: error.request,
                    });
                }
            }
            this.logger.error("Error getting movie credits", { movieId, error });
            throw new errors_1.TMDBError("Failed to get movie credits", {
                movieId,
                originalError: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getPopularMovies(page = 1) {
        const cacheKey = `popular-movies-page-${page}`;
        try {
            this.logger.debug("Getting popular movies", { page });
            // biome-ignore lint/suspicious/noExplicitAny: any
            const cachedMovies = await this.cacheService.get(cacheKey, 86400); // 1 day TTL
            if (cachedMovies) {
                this.logger.debug("Found cached popular movies", { page });
                return cachedMovies;
            }
            this.logger.debug("Fetching popular movies from API", { page });
            const response = await axios_1.default.get(`${TMDB_API_BASE_URL}/movie/popular`, {
                params: {
                    api_key: this.apiKey,
                    page,
                },
                timeout: 5000,
            });
            const movies = response.data.results;
            await this.cacheService.set(cacheKey, movies);
            return movies;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response) {
                    throw new errors_1.TMDBError(`TMDb API error: ${error.response.status} ${error.response.statusText}`, {
                        page,
                        status: error.response.status,
                        data: error.response.data,
                    });
                }
                else if (error.request) {
                    throw new errors_1.TMDBError(`TMDb API request error: No response received`, {
                        page,
                        request: error.request,
                    });
                }
            }
            this.logger.error("Error getting popular movies", { page, error });
            throw new errors_1.TMDBError("Failed to get popular movies", {
                page,
                originalError: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getTopRatedMovies(page = 1) {
        const cacheKey = `top-rated-movies-page-${page}`;
        try {
            this.logger.debug("Getting top rated movies", { page });
            // biome-ignore lint/suspicious/noExplicitAny: any
            const cachedMovies = await this.cacheService.get(cacheKey, 86400); // 1 day TTL
            if (cachedMovies) {
                this.logger.debug("Found cached top rated movies", { page });
                return cachedMovies;
            }
            this.logger.debug("Fetching top rated movies from API", { page });
            const response = await axios_1.default.get(`${TMDB_API_BASE_URL}/movie/top_rated`, {
                params: {
                    api_key: this.apiKey,
                    page,
                },
                timeout: 5000,
            });
            const movies = response.data.results;
            await this.cacheService.set(cacheKey, movies);
            return movies;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response) {
                    throw new errors_1.TMDBError(`TMDb API error: ${error.response.status} ${error.response.statusText}`, {
                        page,
                        status: error.response.status,
                        data: error.response.data,
                    });
                }
                else if (error.request) {
                    throw new errors_1.TMDBError(`TMDb API request error: No response received`, {
                        page,
                        request: error.request,
                    });
                }
            }
            this.logger.error("Error getting top rated movies", { page, error });
            throw new errors_1.TMDBError("Failed to get top rated movies", {
                page,
                originalError: error instanceof Error ? error.message : String(error),
            });
        }
    }
    async getNowPlayingMovies(page = 1) {
        const cacheKey = `now-playing-movies-page-${page}`;
        try {
            this.logger.debug("Getting now playing movies", { page });
            // biome-ignore lint/suspicious/noExplicitAny: any
            const cachedMovies = await this.cacheService.get(cacheKey, 86400); // 1 day TTL
            if (cachedMovies) {
                this.logger.debug("Found cached now playing movies", { page });
                return cachedMovies;
            }
            this.logger.debug("Fetching now playing movies from API", { page });
            const response = await axios_1.default.get(`${TMDB_API_BASE_URL}/movie/now_playing`, {
                params: {
                    api_key: this.apiKey,
                    page,
                },
                timeout: 5000,
            });
            const movies = response.data.results;
            await this.cacheService.set(cacheKey, movies);
            return movies;
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error)) {
                if (error.response) {
                    throw new errors_1.TMDBError(`TMDb API error: ${error.response.status} ${error.response.statusText}`, {
                        page,
                        status: error.response.status,
                        data: error.response.data,
                    });
                }
                else if (error.request) {
                    throw new errors_1.TMDBError(`TMDb API request error: No response received`, {
                        page,
                        request: error.request,
                    });
                }
            }
            this.logger.error("Error getting now playing movies", { page, error });
            throw new errors_1.TMDBError("Failed to get now playing movies", {
                page,
                originalError: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
exports.TMDbService = TMDbService;
