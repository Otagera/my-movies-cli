import { TMDbService } from './tmdb.service';
import { DiaryEntry, WatchlistEntry } from '../data/loader';

export class RecommendationService {
  private tmdbService: TMDbService;

  constructor(tmdbService: TMDbService) {
    this.tmdbService = tmdbService;
  }

  async getRecommendations(
    diary: DiaryEntry[],
    watchlist: WatchlistEntry[],
    highlyRatedMovies: any[] // from ratings.csv
  ) {
    // For now, this is a placeholder.
    // In the next steps, we will build the full recommendation logic here.
    console.log('Building your taste profile and finding recommendations...');
    
    const favoriteGenres = await this.buildTasteProfile(highlyRatedMovies);
    console.log('Your favorite genres:', favoriteGenres);

    // Placeholder for actual recommendations
    return [];
  }

  private async buildTasteProfile(highlyRatedMovies: any[]) {
    const genreCounts = new Map<string, number>();

    for (const movie of highlyRatedMovies) {
      try {
        const tmdbMovie = await this.tmdbService.searchMovie(movie.Name);
        if (tmdbMovie && tmdbMovie.genre_ids) {
          const movieDetails = await this.tmdbService.getMovieDetails(tmdbMovie.id);
          movieDetails.genres.forEach((genre: any) => {
            genreCounts.set(genre.name, (genreCounts.get(genre.name) || 0) + 1);
          });
        }
      } catch (error) {
        // Ignore errors for individual movies
      }
    }

    // Sort genres by count
    const sortedGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]);
    return sortedGenres.map(entry => entry[0]);
  }
}
