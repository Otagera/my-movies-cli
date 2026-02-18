"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatchlistService = void 0;
class WatchlistService {
    tmdbService;
    cacheService;
    subscribedServices;
    countryCode;
    constructor(tmdbService, cacheService, subscribedServices, countryCode) {
        this.tmdbService = tmdbService;
        this.cacheService = cacheService;
        this.subscribedServices = subscribedServices;
        this.countryCode = countryCode;
    }
    async checkForAvailabilityChanges() {
        const watchlist = await this.cacheService.getWatchlistEntries();
        const previousAvailability = await this.cacheService.getPreviousAvailability();
        const currentAvailability = {};
        const changes = [];
        for (const entry of watchlist) {
            const movieName = entry.Name;
            const movie = await this.tmdbService.searchMovie(movieName);
            if (movie) {
                const providers = await this.tmdbService.getWatchProviders(movie.id);
                const countryProviders = providers[this.countryCode.toUpperCase()];
                const isAvailable = countryProviders?.flatrate?.some((p) => this.subscribedServices.includes(p.provider_name.toLowerCase()));
                currentAvailability[movieName] = {
                    isAvailable: !!isAvailable,
                    providers: isAvailable
                        ? countryProviders.flatrate.map((p) => p.provider_name)
                        : [],
                    link: isAvailable ? countryProviders.link : undefined,
                };
                if (previousAvailability[movieName]?.isAvailable !==
                    currentAvailability[movieName].isAvailable) {
                    if (currentAvailability[movieName].isAvailable) {
                        changes.push(`${movieName} is now available on ${currentAvailability[movieName].providers.join(", ")}. Watch here: ${currentAvailability[movieName].link}`);
                    }
                    else {
                        changes.push(`${movieName} is no longer available on your subscribed services.`);
                    }
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 250)); // 250ms delay
        }
        await this.cacheService.set("watchlist-availability", currentAvailability);
        return changes;
    }
    async getAvailableMoviesFromCache() {
        const availability = await this.cacheService.get("watchlist-availability");
        if (!availability) {
            return [];
        }
        const availableMovies = [];
        for (const movieName in availability) {
            if (availability[movieName].isAvailable) {
                availableMovies.push(`${movieName} is available on ${availability[movieName].providers.join(", ")}. Watch here: ${availability[movieName].link}`);
            }
        }
        return availableMovies;
    }
}
exports.WatchlistService = WatchlistService;
