"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCli = runCli;
const inquirer_1 = __importDefault(require("inquirer"));
const dotenv_1 = __importDefault(require("dotenv"));
const cli_spinners_1 = __importDefault(require("cli-spinners"));
const tmdb_service_1 = require("./services/tmdb.service");
const recommendation_service_1 = require("./services/recommendation.service");
const cache_service_1 = require("./services/cache.service");
const letterboxd_service_1 = require("./services/letterboxd.service");
const watchlist_service_1 = require("./services/watchlist.service");
const data_sync_service_1 = require("./services/data-sync.service");
// Helper function to create and manage a spinner
function createSpinner(text) {
    const spinner = cli_spinners_1.default.dots;
    let i = 0;
    let interval;
    const self = {
        start: () => {
            interval = setInterval(() => {
                process.stdout.write(`\r${spinner.frames[(i = ++i % spinner.frames.length)]} ${text}`);
            }, spinner.interval);
            return self;
        },
        stop: () => {
            clearInterval(interval);
            process.stdout.write("\r"); // Clear the line
            return self;
        },
        succeed: (message) => {
            clearInterval(interval);
            process.stdout.write(`\r✔ ${message}\n`);
            return self;
        },
        fail: (message) => {
            clearInterval(interval);
            process.stdout.write(`\r✖ ${message}\n`);
            return self;
        },
    };
    return self;
}
async function runCli() {
    console.log("⚙️  Loading configuration and services...");
    dotenv_1.default.config();
    const cacheService = new cache_service_1.CacheService();
    await cacheService.init();
    const tmdbApiKey = process.env.TMDB_API_KEY;
    const countryCode = process.env.STREAMING_COUNTRY_CODE;
    if (!tmdbApiKey || !countryCode) {
        console.error("\r\n❌ ERROR: Missing configuration!");
        console.error("This CLI requires a .env file in your current directory with:");
        console.error("- TMDB_API_KEY");
        console.error("- STREAMING_COUNTRY_CODE");
        console.error("\r\nPlease check .env.example for guidance.\r\n");
        process.exit(1);
    }
    // Load data from all sources
    let diaryData = await cacheService.getDiaryEntries();
    let watchlistData = await cacheService.getWatchlistEntries();
    let ratingsData = await cacheService.getRatingEntries();
    let savedLists = await cacheService.getSavedLists();
    let subscribedServices = (await cacheService.get("streaming_services")) || [];
    const letterboxdService = new letterboxd_service_1.LetterboxdService(cacheService);
    const useScraping = process.env.LETTERBOXD_USE_SCRAPING === "true";
    const dataSyncService = new data_sync_service_1.DataSyncService(cacheService, letterboxdService, useScraping);
    const tmdbService = new tmdb_service_1.TMDbService(tmdbApiKey, cacheService);
    const recommendationService = new recommendation_service_1.RecommendationService(tmdbService);
    const watchlistService = new watchlist_service_1.WatchlistService(tmdbService, cacheService, subscribedServices, countryCode);
    // Log loaded data summary
    if (diaryData.length > 0)
        console.log(`Successfully loaded ${diaryData.length} diary entries.`);
    if (watchlistData.length > 0)
        console.log(`Successfully loaded ${watchlistData.length} watchlist entries.`);
    if (ratingsData.length > 0)
        console.log(`Successfully loaded ${ratingsData.length} ratings.`);
    if (savedLists.length > 0)
        console.log(`Successfully loaded ${savedLists.length} saved lists.`);
    while (true) {
        try {
            const { action } = await inquirer_1.default.prompt([
                {
                    type: "list",
                    name: "action",
                    message: "What do you want to ask?",
                    choices: [
                        "Get personalized recommendations",
                        "Find where to watch a movie",
                        "Suggest a random movie to watch",
                        new inquirer_1.default.Separator(),
                        "How many movies have I watched?",
                        "How many movies are on my watchlist?",
                        "List movies watched in a specific year",
                        "List all movies on my watchlist",
                        "List available streaming services",
                        "List available movies on my watchlist",
                        new inquirer_1.default.Separator(),
                        "Get movies from a Letterboxd list",
                        "Check for watchlist availability changes",
                        new inquirer_1.default.Separator(),
                        "Set streaming services",
                        "Sync data with Letterboxd",
                        "Exit",
                    ],
                },
            ]);
            const highlyRatedMovies = ratingsData.filter((r) => r.Rating >= 4);
            switch (action) {
                case "List available movies on my watchlist": {
                    const availableMovies = await watchlistService.getAvailableMoviesFromCache();
                    if (availableMovies.length > 0) {
                        console.log("Available movies on your watchlist:");
                        availableMovies.forEach((movie) => console.log(`- ${movie}`));
                    }
                    else {
                        console.log("No available movies found on your watchlist. Run 'Check for watchlist availability changes' to update.");
                    }
                    break;
                }
                case "Set streaming services": {
                    const availableProviders = await tmdbService.getAvailableProviders(countryCode);
                    const availableProviderNames = availableProviders.map((p) => p.provider_name.toLowerCase());
                    const { services } = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "services",
                            message: "Enter your comma-separated streaming services (e.g. Netflix, Hulu):",
                        },
                    ]);
                    const servicesArray = services
                        .split(",")
                        .map((s) => s.trim().toLowerCase());
                    const invalidServices = servicesArray.filter((s) => !availableProviderNames.includes(s));
                    if (invalidServices.length > 0) {
                        console.error(`Invalid services: ${invalidServices.join(", ")}. Some were skipped.`);
                    }
                    const validServices = servicesArray.filter((s) => availableProviderNames.includes(s));
                    await cacheService.set("streaming_services", validServices);
                    subscribedServices = validServices;
                    console.log("Streaming services updated.");
                    break;
                }
                case "Sync data with Letterboxd": {
                    await dataSyncService.syncData();
                    // Reload data from cache
                    diaryData = await cacheService.getDiaryEntries();
                    watchlistData = await cacheService.getWatchlistEntries();
                    ratingsData = await cacheService.getRatingEntries();
                    savedLists = await cacheService.getSavedLists();
                    break;
                }
                case "Get personalized recommendations": {
                    let recommendations;
                    let recommendationMessage;
                    const { recommendationChoice } = await inquirer_1.default.prompt([
                        {
                            type: "list",
                            name: "recommendationChoice",
                            message: "What kind of recommendations do you want?",
                            choices: [
                                "Recommendations available on my services",
                                "All recommendations",
                            ],
                        },
                    ]);
                    if (recommendationChoice === "Recommendations available on my services") {
                        if (subscribedServices.length === 0) {
                            console.error("Please set your streaming services first.");
                            break;
                        }
                        recommendations = await recommendationService.getRecommendations(diaryData, watchlistData, highlyRatedMovies, subscribedServices, countryCode);
                        recommendationMessage =
                            "Here are your top 5 personalized movie recommendations (available on your subscribed services):";
                    }
                    else {
                        recommendations = await recommendationService.getRecommendations(diaryData, watchlistData, highlyRatedMovies);
                        recommendationMessage =
                            "Here are your top 5 personalized movie recommendations (all):";
                    }
                    if (recommendations.length > 0) {
                        console.log(`\n${recommendationMessage}`);
                        recommendations.forEach((movie, index) => {
                            console.log(`${index + 1}. ${movie.title} (Score: ${movie.score})`);
                        });
                    }
                    else {
                        console.log("No new movie recommendations found at this time.");
                    }
                    break;
                }
                case "How many movies have I watched?": {
                    console.log(`You have watched ${diaryData.length} movies.`);
                    break;
                }
                case "List movies watched in a specific year": {
                    const { year } = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "year",
                            message: "Enter the year:",
                            validate: (input) => /^\d{4}$/.test(input) ||
                                "Please enter a valid four-digit year.",
                        },
                    ]);
                    const moviesInYear = diaryData.filter((entry) => new Date(entry.WatchedDate).getFullYear() === parseInt(year));
                    if (moviesInYear.length > 0) {
                        console.log(`Movies watched in ${year}:`);
                        moviesInYear.forEach((entry) => console.log(`- ${entry.Name}`));
                    }
                    else {
                        console.log(`No movies found for the year ${year}.`);
                    }
                    break;
                }
                case "How many movies are on my watchlist?": {
                    console.log(`You have ${watchlistData.length} movies on your watchlist.`);
                    break;
                }
                case "List all movies on my watchlist": {
                    watchlistData.forEach((entry) => console.log(`- ${entry.Name}`));
                    break;
                }
                case "Find where to watch a movie": {
                    const { movieTitle } = await inquirer_1.default.prompt([
                        {
                            type: "input",
                            name: "movieTitle",
                            message: "Enter the movie title to search for:",
                        },
                    ]);
                    try {
                        const movie = await tmdbService.searchMovie(movieTitle);
                        if (!movie) {
                            console.log("Movie not found on TMDb.");
                            break;
                        }
                        console.log(`Found movie: ${movie.title} (${new Date(movie.release_date).getFullYear()})`);
                        const providers = await tmdbService.getWatchProviders(movie.id);
                        const countryProviders = providers[countryCode.toUpperCase()];
                        if (countryProviders &&
                            countryProviders.link &&
                            countryProviders.flatrate) {
                            console.log("Available to stream on:");
                            countryProviders.flatrate.forEach((provider) => {
                                const isSubscribed = subscribedServices.includes(provider.provider_name.toLowerCase());
                                console.log(`- ${provider.provider_name} ${isSubscribed ? "(Subscribed)" : ""}`);
                            });
                            console.log(`\nWatch it here: ${countryProviders.link}`);
                        }
                        else {
                            console.log("Not available for streaming in your country.");
                        }
                    }
                    catch (e) {
                        console.error("Error finding movie:", e);
                    }
                    break;
                }
                case "Suggest a random movie to watch": {
                    if (watchlistData.length === 0) {
                        console.log("Your watchlist is empty.");
                        break;
                    }
                    let suggestionFound = false;
                    const shuffledWatchlist = [...watchlistData].sort(() => 0.5 - Math.random());
                    for (const movie of shuffledWatchlist) {
                        try {
                            const tmdbMovie = await tmdbService.searchMovie(movie.Name);
                            if (!tmdbMovie)
                                continue;
                            const providers = await tmdbService.getWatchProviders(tmdbMovie.id);
                            const countryProviders = providers[countryCode.toUpperCase()];
                            if (countryProviders &&
                                countryProviders.link &&
                                countryProviders.flatrate) {
                                const availableOnSubscribed = countryProviders.flatrate.filter((provider) => subscribedServices.includes(provider.provider_name.toLowerCase()));
                                if (availableOnSubscribed.length > 0 || subscribedServices.length === 0) {
                                    console.log(`How about watching: ${movie.Name}?`);
                                    if (availableOnSubscribed.length > 0) {
                                        console.log("You can stream it on:");
                                        availableOnSubscribed.forEach((provider) => console.log(`- ${provider.provider_name}`));
                                    }
                                    console.log(`\nWatch it here: ${countryProviders.link}`);
                                    suggestionFound = true;
                                    break;
                                }
                            }
                        }
                        catch {
                            /* Ignore and continue */
                        }
                    }
                    if (!suggestionFound) {
                        console.log("Could not find a suitable movie from your watchlist.");
                    }
                    break;
                }
                case "List available streaming services": {
                    try {
                        const providers = await tmdbService.getAvailableProviders(countryCode);
                        if (providers && providers.length > 0) {
                            console.log(`Available streaming services in ${countryCode.toUpperCase()}:`);
                            const providerNames = providers
                                .map((provider) => provider.provider_name)
                                .sort();
                            console.log(providerNames.join("\n"));
                        }
                        else {
                            console.log(`Could not find any streaming services for country code: ${countryCode.toUpperCase()}`);
                        }
                    }
                    catch (e) {
                        console.error("Error fetching streaming services:", e);
                    }
                    break;
                }
                case "Get movies from a Letterboxd list": {
                    let listUrl;
                    const listChoices = [
                        ...savedLists.map((l) => ({ name: l.Content, value: l.Content })),
                        { name: "Enter a new URL", value: "new" },
                    ];
                    const { listSelection } = await inquirer_1.default.prompt([
                        {
                            type: "list",
                            name: "listSelection",
                            message: "Choose a saved list or enter a new one:",
                            choices: listChoices,
                        },
                    ]);
                    if (listSelection === "new") {
                        const { newListUrl } = await inquirer_1.default.prompt([
                            {
                                type: "input",
                                name: "newListUrl",
                                message: "Enter the Letterboxd list URL:",
                            },
                        ]);
                        listUrl = newListUrl;
                    }
                    else {
                        listUrl = listSelection;
                    }
                    if (!listUrl) {
                        console.error("No list URL provided.");
                        break;
                    }
                    const listSpinner = createSpinner("Fetching list from Letterboxd...").start();
                    try {
                        const movies = await letterboxdService.getMoviesFromList(listUrl);
                        listSpinner.succeed(`Found ${movies.length} movies in the list.`);
                        if (movies.length > 0) {
                            const { findWatchProviders } = await inquirer_1.default.prompt([
                                {
                                    type: "confirm",
                                    name: "findWatchProviders",
                                    message: "Do you want to find where to watch these movies?",
                                    default: true,
                                },
                            ]);
                            if (findWatchProviders) {
                                const providersSpinner = createSpinner("Finding watch providers...").start();
                                const subscribedMovies = [];
                                const otherAvailableMovies = [];
                                const unavailableMovies = [];
                                let errorCount = 0;
                                for (const movieTitle of movies) {
                                    try {
                                        const movie = await tmdbService.searchMovie(movieTitle);
                                        if (!movie) {
                                            unavailableMovies.push(`- ${movieTitle}: Not found on TMDb.`);
                                            continue;
                                        }
                                        const providers = await tmdbService.getWatchProviders(movie.id);
                                        const countryProviders = providers[countryCode.toUpperCase()];
                                        if (countryProviders &&
                                            countryProviders.link &&
                                            countryProviders.flatrate) {
                                            const subscribedProviderNames = countryProviders.flatrate
                                                .filter((p) => subscribedServices.includes(p.provider_name.toLowerCase()))
                                                .map((p) => p.provider_name)
                                                .join(", ");
                                            if (subscribedProviderNames) {
                                                subscribedMovies.push(`- ${movieTitle}: Available on your services (${subscribedProviderNames}). Watch here: ${countryProviders.link}`);
                                            }
                                            else {
                                                const otherProviderNames = countryProviders.flatrate
                                                    .map((p) => p.provider_name)
                                                    .join(", ");
                                                otherAvailableMovies.push(`- ${movieTitle}: Available on ${otherProviderNames}. Watch here: ${countryProviders.link}`);
                                            }
                                        }
                                        else {
                                            unavailableMovies.push(`- ${movieTitle}: Not available for streaming in your country.`);
                                        }
                                    }
                                    catch {
                                        if (errorCount === 0) {
                                            providersSpinner.fail(`- ${movieTitle}: Error finding watch providers. Further errors will be suppressed.`);
                                        }
                                        errorCount++;
                                        unavailableMovies.push(`- ${movieTitle}: Error finding watch providers.`);
                                    }
                                    await new Promise((resolve) => setTimeout(resolve, 250)); // 250ms delay
                                }
                                providersSpinner.succeed("Finished finding providers.");
                                console.log("\n--- Movies on Your Services ---");
                                if (subscribedMovies.length > 0) {
                                    subscribedMovies.forEach((m) => console.log(m));
                                }
                                else {
                                    console.log("None of the movies on this list are available on your subscribed services.");
                                }
                                console.log("\n--- Other Available Movies ---");
                                if (otherAvailableMovies.length > 0) {
                                    otherAvailableMovies.forEach((m) => console.log(m));
                                }
                                else {
                                    console.log("No other movies on this list are available for streaming.");
                                }
                                console.log("\n--- Unavailable Movies ---");
                                if (unavailableMovies.length > 0) {
                                    unavailableMovies.forEach((m) => console.log(m));
                                }
                                else {
                                    console.log("All movies on this list are available!");
                                }
                            }
                        }
                        else {
                            movies.forEach((movie) => console.log(`- ${movie}`));
                        }
                    }
                    catch (e) {
                        listSpinner.fail("Error fetching movies from Letterboxd list.");
                        console.error(e);
                    }
                    break;
                }
                case "Check for watchlist availability changes": {
                    const watchlistSpinner = createSpinner("Checking for watchlist availability changes...").start();
                    try {
                        const changes = await watchlistService.checkForAvailabilityChanges();
                        if (changes.length > 0) {
                            watchlistSpinner.succeed("Found availability changes:");
                            const newlyAvailable = changes.filter((c) => c.includes("is now available"));
                            const noLongerAvailable = changes.filter((c) => c.includes("is no longer available"));
                            if (newlyAvailable.length > 0) {
                                console.log("\n--- Newly Available ---");
                                newlyAvailable.forEach((change) => console.log(`- ${change}`));
                            }
                            if (noLongerAvailable.length > 0) {
                                console.log("\n--- No Longer Available ---");
                                noLongerAvailable.forEach((change) => console.log(`- ${change}`));
                            }
                        }
                        else {
                            watchlistSpinner.succeed("No changes in watchlist availability.");
                        }
                    }
                    catch (e) {
                        watchlistSpinner.fail("Error checking for watchlist availability changes.");
                        console.error(e);
                    }
                    break;
                }
                case "Exit": {
                    console.log("Goodbye!");
                    process.exit(0);
                }
            }
        }
        catch (e) {
            if (e instanceof Error) {
                if (e.message.includes("User force closed the prompt")) {
                    console.log("\nGoodbye!");
                    process.exit(0);
                }
            }
            throw e;
        }
    }
}
