import axios from 'axios';

const SIMKL_API_BASE_URL = 'https://api.simkl.com';

export interface SimklWatchHistoryItem {
  last_watched_at: string;
  show: {
    title: string;
    year: number;
    ids: {
      simkl: number;
    };
  };
}

export class SimklService {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Simkl API key is required.');
    }
    this.apiKey = apiKey;
  }

  async getWatchHistory(username: string): Promise<SimklWatchHistoryItem[]> {
    try {
      const response = await axios.get(`${SIMKL_API_BASE_URL}/users/${username}/history/shows`, {
        headers: {
          'simkl-api-key': this.apiKey,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.error(`Error: Simkl user '${username}' not found. Please check your SIMKL_USERNAME in the .env file.`);
      } else {
        console.error('Error fetching watch history from Simkl:', error);
      }
      return [];
    }
  }
}
