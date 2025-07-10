import axios from 'axios';

const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';

export class TMDbService {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('TMDb API key is required.');
    }
    this.apiKey = apiKey;
  }

  async searchMovie(title: string) {
    const response = await axios.get(`${TMDB_API_BASE_URL}/search/movie`, {
      params: {
        api_key: this.apiKey,
        query: title,
      },
    });
    return response.data.results[0];
  }

  async getWatchProviders(movieId: number) {
    const response = await axios.get(`${TMDB_API_BASE_URL}/movie/${movieId}/watch/providers`, {
      params: {
        api_key: this.apiKey,
      },
    });
    return response.data.results;
  }

  async getMovieDetails(movieId: number) {
    const response = await axios.get(`${TMDB_API_BASE_URL}/movie/${movieId}`, {
      params: {
        api_key: this.apiKey,
      },
    });
    return response.data;
  }

  async getAvailableProviders(countryCode: string) {
    const response = await axios.get(`${TMDB_API_BASE_URL}/watch/providers/movie`, {
        params: {
            api_key: this.apiKey,
            watch_region: countryCode.toUpperCase(),
        },
    });
    return response.data.results;
  }
}
