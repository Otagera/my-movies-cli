import { TMDbService } from './tmdb.service';
import { DiaryEntry, WatchlistEntry, RatingEntry } from '../data/loader';

export class RecommendationService {
  private tmdbService: TMDbService;

  constructor(tmdbService: TMDbService) {
    this.tmdbService = tmdbService;
  }

  async getRecommendations(
    diary: DiaryEntry[],
    watchlist: WatchlistEntry[],
    highlyRatedMovies: RatingEntry[],
    subscribedServices?: string[],
    countryCode?: string
  ) {
    console.log('Building your taste profile...');
    console.log(`Highly rated movies provided: ${highlyRatedMovies.length}`);
    const favoriteGenres = await this.buildTasteProfile(highlyRatedMovies);
    console.log('Your top genres:', favoriteGenres.slice(0, 5));

    console.log('Finding movies you might like...');
    const watchedMovieNames = new Set(diary.map(d => d.Name.toLowerCase()));
    const watchlistMovieNames = new Set(watchlist.map(w => w.Name.toLowerCase()));

    const candidates = await this.getCandidateMovies();
    console.log(`Total candidate movies from TMDb: ${candidates.length}`);
    
    const filteredCandidates = candidates
      .filter(c => !watchedMovieNames.has(c.title.toLowerCase()) && !watchlistMovieNames.has(c.title.toLowerCase()));
    console.log(`Candidates after filtering watched/watchlist: ${filteredCandidates.length}`);

    const scoredCandidates = filteredCandidates
      .map(candidate => {
        let score = 0;
        const movieGenres = new Set(candidate.genre_ids.map((id: number) => this.genreIdToName(id)));
        for (const genre of favoriteGenres) {
          if (movieGenres.has(genre)) {
            score++;
          }
        }
        return { ...candidate, score };
      })
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score);
    
    console.log(`Scored candidates with score > 0: ${scoredCandidates.length}`);

    const top5Recommendations = scoredCandidates.slice(0, 5);

    if (subscribedServices && countryCode) {
      const finalRecommendations = [];
      for (const movie of top5Recommendations) {
        try {
          const providers = await this.tmdbService.getWatchProviders(movie.id);
          const countryProviders = providers[countryCode.toUpperCase()];

          if (countryProviders && countryProviders.flatrate) {
            const availableOnSubscribed = countryProviders.flatrate.filter((provider: any) =>
              subscribedServices.includes(provider.provider_name.toLowerCase())
            );
            if (availableOnSubscribed.length > 0) {
              finalRecommendations.push(movie);
            }
          }
        } catch (error: any) {
          console.error(`Error checking watch providers for ${movie.title}:`, error.message);
        }
      }
      return finalRecommendations;
    } else {
      return top5Recommendations;
    }
  }

  private async buildTasteProfile(highlyRatedMovies: RatingEntry[]): Promise<string[]> {
    const genreCounts = new Map<string, number>();

    for (const movie of highlyRatedMovies) {
      try {
        const tmdbMovie = await this.tmdbService.searchMovie(movie.Name);
        if (tmdbMovie) {
          const movieDetails = await this.tmdbService.getMovieDetails(tmdbMovie.id);
          if (movieDetails && movieDetails.genres) {
            movieDetails.genres.forEach((genre: any) => {
              genreCounts.set(genre.name, (genreCounts.get(genre.name) || 0) + 1);
            });
          }
        }
      } catch (error) { /* Ignore */ }
    }

    const sortedGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]);
    return sortedGenres.map(entry => entry[0]);
  }

  private async getCandidateMovies(): Promise<any[]> {
    // Fetch popular movies without genre constraints initially
    const response = await this.tmdbService.discoverMovies({ sort_by: 'popularity.desc', page: 1 });
    // You might want to fetch more pages for a larger pool of candidates
    // For now, we'll just use the first page
    return response.results;
  }

  // Helper methods to convert between genre names and IDs
  private genreNameToId(name: string): number | undefined {
    const genres = this.getGenreList();
    const genre = genres.find(g => g.name.toLowerCase() === name.toLowerCase());
    return genre ? genre.id : undefined;
  }

  private genreIdToName(id: number): string | undefined {
    const genres = this.getGenreList();
    const genre = genres.find(g => g.id === id);
    return genre ? genre.name : undefined;
  }

  private getGenreList() {
    // This list could be fetched from TMDb API, but for simplicity, it's hardcoded here.
    return [
      { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 16, name: 'Animation' },
      { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' }, { id: 99, name: 'Documentary' },
      { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' }, { id: 14, name: 'Fantasy' },
      { id: 36, name: 'History' }, { id: 27, name: 'Horror' }, { id: 10402, name: 'Music' },
      { id: 9648, name: 'Mystery' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Science Fiction' },
      { id: 10770, name: 'TV Movie' }, { id: 53, name: 'Thriller' }, { id: 10752, name: 'War' },
      { id: 37, name: 'Western' }
    ];
  }
}
