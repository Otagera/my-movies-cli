import { loadCsvData, WatchlistEntry } from "../data/loader";
import { TMDbService } from "./tmdb.service";
import { CacheService } from "./cache.service";

export interface WatchlistAvailability {
  [movieName: string]: {
    isAvailable: boolean;
    providers: string[];
    link?: string;
  };
}

interface Provider {
  provider_name: string;
}

export class WatchlistService {
  private tmdbService: TMDbService;
  private cacheService: CacheService;
  private subscribedServices: string[];
  private countryCode: string;
  constructor(
    tmdbService: TMDbService,
    cacheService: CacheService,
    subscribedServices: string[],
    countryCode: string,
  ) {
    this.tmdbService = tmdbService;
    this.cacheService = cacheService;
    this.subscribedServices = subscribedServices;
    this.countryCode = countryCode;
  }

  public async checkForAvailabilityChanges(): Promise<string[]> {
    const watchlist = await loadCsvData<WatchlistEntry>("watchlist.csv");
    const previousAvailability = await this.getPreviousAvailability();
    const currentAvailability: WatchlistAvailability = {};
    const changes: string[] = [];

    for (const entry of watchlist) {
      const movieName = entry.Name;
      const movie = await this.tmdbService.searchMovie(movieName);
      if (movie) {
        const providers = await this.tmdbService.getWatchProviders(movie.id);
        const countryProviders = providers[this.countryCode.toUpperCase()];
        const isAvailable = countryProviders?.flatrate?.some((p: Provider) =>
          this.subscribedServices.includes(p.provider_name.toLowerCase()),
        );

        currentAvailability[movieName] = {
          isAvailable: !!isAvailable,
          providers: isAvailable
            ? countryProviders.flatrate.map((p: Provider) => p.provider_name)
            : [],
          link: isAvailable ? countryProviders.link : undefined,
        };

        if (
          previousAvailability[movieName]?.isAvailable !==
          currentAvailability[movieName].isAvailable
        ) {
          if (currentAvailability[movieName].isAvailable) {
            changes.push(
              `${movieName} is now available on ${currentAvailability[movieName].providers.join(", ")}. Watch here: ${currentAvailability[movieName].link}`,
            );
          } else {
            changes.push(
              `${movieName} is no longer available on your subscribed services.`,
            );
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250)); // 250ms delay
    }

    await this.cacheService.set("watchlist-availability", currentAvailability);
    return changes;
  }

  private async getPreviousAvailability(): Promise<WatchlistAvailability> {
    const availability = await this.cacheService.get<WatchlistAvailability>(
      "watchlist-availability",
    );
    return availability || {};
  }
}
