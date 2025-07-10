import { TMDbService } from './tmdb.service';
import { DiaryEntry, WatchlistEntry, RatingEntry } from '../data/loader';

interface TasteProfile {
  genres: Map<string, number>;
  actors: Map<string, number>;
  directors: Map<string, number>;
  writers: Map<string, number>;
  keywords: Map<string, number>;
}

interface ScoredMovieCandidate {
  id: number;
  title: string;
  genre_ids: number[];
  score: number;
  // Add other properties from TMDb movie object if needed for display or further processing
}

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
    const tasteProfile = await this.buildTasteProfile(highlyRatedMovies);
    console.log('Your top genres:', [...tasteProfile.genres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(entry => entry[0]));
    console.log('Your top actors:', [...tasteProfile.actors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(entry => entry[0]));
    console.log('Your top directors:', [...tasteProfile.directors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(entry => entry[0]));
    console.log('Your top writers:', [...tasteProfile.writers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(entry => entry[0]));

    console.log('Finding movies you might like...');
    const watchedMovieNames = new Set(diary.map(d => d.Name.toLowerCase()));
    const watchlistMovieNames = new Set(watchlist.map(w => w.Name.toLowerCase()));

    const candidates = await this.getCandidateMovies();
    console.log(`Total candidate movies from TMDb: ${candidates.length}`);
    
    const filteredCandidates = candidates
      .filter(c => !watchedMovieNames.has(c.title.toLowerCase()) && !watchlistMovieNames.has(c.title.toLowerCase()));
    console.log(`Candidates after filtering watched/watchlist: ${filteredCandidates.length}`);

    const scoredCandidatesPromises = filteredCandidates
      .map(async candidate => {
        let score = 0;
        const movieDetails = await this.tmdbService.getMovieDetails(candidate.id);
        const movieCredits = await this.tmdbService.getMovieCredits(candidate.id);

        // Score by genre
        if (movieDetails && movieDetails.genres) {
          const movieGenres = new Set(movieDetails.genres.map((g: any) => g.name));
          for (const [genre, count] of tasteProfile.genres.entries()) {
            if (movieGenres.has(genre)) {
              score += count; // Weight score by how much you like the genre
            }
          }
        }

        // Score by actors
        if (movieCredits && movieCredits.cast) {
          const movieActors = new Set(movieCredits.cast.map((c: any) => c.name));
          for (const [actor, count] of tasteProfile.actors.entries()) {
            if (movieActors.has(actor)) {
              score += count; // Weight score by how much you like the actor
            }
          }
        }

        // Score by directors
        if (movieCredits && movieCredits.crew) {
          const movieDirectors = new Set(movieCredits.crew.filter((c: any) => c.job === 'Director').map((c: any) => c.name));
          for (const [director, count] of tasteProfile.directors.entries()) {
            if (movieDirectors.has(director)) {
              score += count; // Weight score by how much you like the director
            }
          }
        }

        // Score by writers (screenplay, story, writer)
        if (movieCredits && movieCredits.crew) {
          const movieWriters = new Set(movieCredits.crew.filter((c: any) => ['Screenplay', 'Story', 'Writer'].includes(c.job)).map((c: any) => c.name));
          for (const [writer, count] of tasteProfile.writers.entries()) {
            if (movieWriters.has(writer)) {
              score += count; // Weight score by how much you like the writer
            }
          }
        }

        // Score by synopsis keywords (simple keyword matching for now)
        if (movieDetails && movieDetails.overview) {
          const overviewWords = new Set(movieDetails.overview.toLowerCase().split(/\W+/).filter((word: string) => word.length > 2));
          for (const [keyword, count] of tasteProfile.keywords.entries()) {
            if (overviewWords.has(keyword)) {
              score += count; // Weight score by how much you like the keyword
            }
          }
        }

        return { ...candidate, score };
      });

    const resolvedScoredCandidates: ScoredMovieCandidate[] = await Promise.all(scoredCandidatesPromises);

    const scoredCandidates = resolvedScoredCandidates
      .filter((c: ScoredMovieCandidate) => c.score > 0)
      .sort((a: ScoredMovieCandidate, b: ScoredMovieCandidate) => b.score - a.score);
    
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

  private async buildTasteProfile(highlyRatedMovies: RatingEntry[]): Promise<TasteProfile> {
    const genreCounts = new Map<string, number>();
    const actorCounts = new Map<string, number>();
    const directorCounts = new Map<string, number>();
    const writerCounts = new Map<string, number>();
    const keywordCounts = new Map<string, number>();

    for (const movie of highlyRatedMovies) {
      try {
        const tmdbMovie = await this.tmdbService.searchMovie(movie.Name);
        if (tmdbMovie) {
          const movieDetails = await this.tmdbService.getMovieDetails(tmdbMovie.id);
          const movieCredits = await this.tmdbService.getMovieCredits(tmdbMovie.id);

          if (movieDetails) {
            // Genres
            if (movieDetails.genres) {
              movieDetails.genres.forEach((genre: any) => {
                genreCounts.set(genre.name, (genreCounts.get(genre.name) || 0) + 1);
              });
            }

            // Synopsis Keywords (simple tokenization for now)
            if (movieDetails.overview) {
              const words = movieDetails.overview.toLowerCase().split(/\W+/).filter((word: string) => word.length > 2);
              words.forEach((word: string) => {
                keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
              });
            }
          }

          if (movieCredits) {
            // Actors (top 5 cast members)
            if (movieCredits.cast) {
              movieCredits.cast.slice(0, 5).forEach((castMember: any) => {
                actorCounts.set(castMember.name, (actorCounts.get(castMember.name) || 0) + 1);
              });
            }

            // Directors and Writers
            if (movieCredits.crew) {
              movieCredits.crew.forEach((crewMember: any) => {
                if (crewMember.job === 'Director') {
                  directorCounts.set(crewMember.name, (directorCounts.get(crewMember.name) || 0) + 1);
                } else if (['Screenplay', 'Story', 'Writer'].includes(crewMember.job)) {
                  writerCounts.set(crewMember.name, (writerCounts.get(crewMember.name) || 0) + 1);
                }
              });
            }
          }
        }
      } catch (error: any) { 
        console.error(`Error building taste profile for ${movie.Name}:`, error.message);
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

  private async getCandidateMovies(): Promise<any[]> {
    let allCandidates: any[] = [];
    // Fetch multiple pages of popular movies for a larger pool of candidates
    for (let page = 1; page <= 5; page++) { // Fetching 5 pages for now (up to 100 movies)
      const response = await this.tmdbService.discoverMovies({ sort_by: 'popularity.desc', page: page });
      allCandidates = allCandidates.concat(response.results);
    }
    return allCandidates;
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

  async getRandomRecommendationWithDetails(highlyRatedMovies: RatingEntry[], diary: DiaryEntry[], watchlist: WatchlistEntry[]) {
    console.log('Building your taste profile for random recommendation...');
    const tasteProfile = await this.buildTasteProfile(highlyRatedMovies);

    const watchedMovieNames = new Set(diary.map(d => d.Name.toLowerCase()));
    const watchlistMovieNames = new Set(watchlist.map(w => w.Name.toLowerCase()));

    let randomMovie: any = null;
    let attempts = 0;
    const maxAttempts = 20; // Increased attempts to find an unwatched/unlisted movie

    while (!randomMovie && attempts < maxAttempts) {
      attempts++;
      const randomPage = Math.floor(Math.random() * 100) + 1;
      const response = await this.tmdbService.discoverMovies({ sort_by: 'popularity.desc', page: randomPage });
      
      if (response.results && response.results.length > 0) {
        const availableMovies = response.results.filter((movie: any) => 
          !watchedMovieNames.has(movie.title.toLowerCase()) && 
          !watchlistMovieNames.has(movie.title.toLowerCase())
        );
        if (availableMovies.length > 0) {
          randomMovie = availableMovies[Math.floor(Math.random() * availableMovies.length)];
        }
      }
    }

    if (!randomMovie) {
      return { movie: null, reasons: ['Could not find a random movie.'] };
    }

    const movieDetails = await this.tmdbService.getMovieDetails(randomMovie.id);
    const movieCredits = await this.tmdbService.getMovieCredits(randomMovie.id);

    const reasons: string[] = [];

    // Check for genre matches
    if (movieDetails && movieDetails.genres && tasteProfile.genres.size > 0) {
      const movieGenres = new Set(movieDetails.genres.map((g: any) => g.name));
      const matchedGenres = [...tasteProfile.genres.keys()].filter(genre => movieGenres.has(genre));
      if (matchedGenres.length > 0) {
        reasons.push(`It's in your favorite genres: ${matchedGenres.slice(0, 3).join(', ')}.`);
      }
    }

    // Check for actor matches
    if (movieCredits && movieCredits.cast && tasteProfile.actors.size > 0) {
      const movieActors = new Set(movieCredits.cast.map((c: any) => c.name));
      const matchedActors = [...tasteProfile.actors.keys()].filter(actor => movieActors.has(actor));
      if (matchedActors.length > 0) {
        reasons.push(`It features actors you like: ${matchedActors.slice(0, 2).join(', ')}.`);
      }
    }

    // Check for director matches
    if (movieCredits && movieCredits.crew && tasteProfile.directors.size > 0) {
      const movieDirectors = new Set(movieCredits.crew.filter((c: any) => c.job === 'Director').map((c: any) => c.name));
      const matchedDirectors = [...tasteProfile.directors.keys()].filter(director => movieDirectors.has(director));
      if (matchedDirectors.length > 0) {
        reasons.push(`It's directed by ${matchedDirectors.slice(0, 1).join(', ')}.`);
      }
    }

    // Add synopsis if available
    if (movieDetails && movieDetails.overview) {
      reasons.push(`Synopsis: ${movieDetails.overview.substring(0, 150)}...`);
    }

    return { movie: randomMovie, reasons: reasons.length > 0 ? reasons : [`No specific reasons found, but it's a popular movie!`] };
  }
}

