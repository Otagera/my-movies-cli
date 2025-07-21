import inquirer from 'inquirer';
import dotenv from 'dotenv';
// Helper function to create and manage a spinner
async function createSpinner(text: string) {
  const { default: spinners } = await import('cli-spinners');
  const spinner = spinners.dots;
  let i = 0;
  let interval: NodeJS.Timeout;

  const self = {
    start: () => {
      interval = setInterval(() => {
        process.stdout.write(`\r${spinner.frames[i = ++i % spinner.frames.length]} ${text}`);
      }, spinner.interval);
      return self;
    },
    stop: () => {
      clearInterval(interval);
      process.stdout.write('\r'); // Clear the line
      return self;
    },
    succeed: (message: string) => {
      clearInterval(interval);
      process.stdout.write(`\r✔ ${message}\n`);
      return self;
    },
    fail: (message: string) => {
      clearInterval(interval);
      process.stdout.write(`\r✖ ${message}\n`);
      return self;
    }
  };
  return self;
}
import { loadCsvData, DiaryEntry, WatchlistEntry, RatingEntry } from './data/loader';
import { TMDbService } from './services/tmdb.service';
import { RecommendationService } from './services/recommendation.service';
import { CacheService } from './services/cache.service';
import { LetterboxdService } from './services/letterboxd.service';
import { WatchlistService } from './services/watchlist.service';

dotenv.config();

interface SavedList {
  Date: string;
  Content: string;
}

async function main() {
  // Load data from all sources
  const diaryData = await loadCsvData<DiaryEntry>('diary.csv');
  const watchlistData = await loadCsvData<WatchlistEntry>('watchlist.csv');
  const ratingsData = await loadCsvData<RatingEntry>('ratings.csv');
  const savedLists = await loadCsvData<SavedList>('likes/lists.csv');

  const subscribedServices = (process.env.STREAMING_SERVICES || '').split(',').map(s => s.trim().toLowerCase());
  const tmdbApiKey = process.env.TMDB_API_KEY;
  const countryCode = process.env.STREAMING_COUNTRY_CODE;

  if (!tmdbApiKey || !countryCode) {
    console.error('Please ensure TMDB_API_KEY and STREAMING_COUNTRY_CODE are set in your .env file.');
    return;
  }

  const cacheService = new CacheService();
  await cacheService.init();

  const tmdbService = new TMDbService(tmdbApiKey, cacheService);
  const recommendationService = new RecommendationService(tmdbService);
  const letterboxdService = new LetterboxdService(cacheService);
  const watchlistService = new WatchlistService(tmdbService, cacheService, subscribedServices, countryCode);

  // Log loaded data
  if (diaryData.length > 0) console.log(`Successfully loaded ${diaryData.length} diary entries.`);
  if (watchlistData.length > 0) console.log(`Successfully loaded ${watchlistData.length} watchlist entries.`);
  if (ratingsData.length > 0) console.log(`Successfully loaded ${ratingsData.length} ratings.`);
  if (savedLists.length > 0) console.log(`Successfully loaded ${savedLists.length} saved lists.`);

  while (true) {
    try {
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What do you want to ask?',
          choices: [
            'Get personalized recommendations',
            'How many movies have I watched?',
            'List movies watched in a specific year',
            'How many movies are on my watchlist?',
            'List all movies on my watchlist',
            'Find where to watch a movie',
            'Suggest a random movie to watch',
            'List available streaming services',
            'Get movies from a Letterboxd list',
            'Check for watchlist availability changes',
            'Exit',
          ],
        },
      ]);

      const highlyRatedMovies = ratingsData.filter(r => r.Rating >= 4);

      switch (action) {
        case 'Get personalized recommendations':
          let recommendations;
          let recommendationMessage;

          const { recommendationChoice } = await inquirer.prompt([
            {
              type: 'list',
              name: 'recommendationChoice',
              message: 'What kind of recommendations do you want?',
              choices: [
                'Recommendations available on my services',
                'All recommendations',
              ],
            },
          ]);

          if (recommendationChoice === 'Recommendations available on my services') {
            if (subscribedServices.length === 0 || subscribedServices[0] === '') {
              console.error('Please add your STREAMING_SERVICES to the .env file to use this option.');
              break;
            }
            recommendations = await recommendationService.getRecommendations(diaryData, watchlistData, highlyRatedMovies, subscribedServices, countryCode);
            recommendationMessage = 'Here are your top 5 personalized movie recommendations (available on your subscribed services):';
          } else {
            recommendations = await recommendationService.getRecommendations(diaryData, watchlistData, highlyRatedMovies);
            recommendationMessage = 'Here are your top 5 personalized movie recommendations (all):';
          }

          if (recommendations.length > 0) {
            console.log(`
${recommendationMessage}`);
            recommendations.forEach((movie: any, index: number) => {
              console.log(`${index + 1}. ${movie.title} (Score: ${movie.score})`);
            });
          } else {
            console.log('No new movie recommendations found at this time.');
          }
          break;

        case 'Suggest a random movie with details':
          const randomRecommendation = await recommendationService.getRandomRecommendationWithDetails(highlyRatedMovies, diaryData, watchlistData);
          if (randomRecommendation.movie) {
            console.log(`
How about watching: ${randomRecommendation.movie.title} (${new Date(randomRecommendation.movie.release_date).getFullYear()})?`);
            console.log('Reasons you might like this:');
            randomRecommendation.reasons.forEach(reason => console.log(`- ${reason}`));
          } else {
            console.log('Could not suggest a random movie at this time.');
          }
          break;

        case 'How many movies have I watched?':
          console.log(`You have watched ${diaryData.length} movies.`);
          break;

        case 'List movies watched in a specific year':
          const { year } = await inquirer.prompt([
            {
              type: 'input',
              name: 'year',
              message: 'Enter the year:',
              validate: (input) => /^\d{4}$/.test(input) || 'Please enter a valid four-digit year.',
            },
          ]);
          const moviesInYear = diaryData.filter(entry => new Date(entry['Watched Date']).getFullYear() === parseInt(year));
          if (moviesInYear.length > 0) {
            console.log(`Movies watched in ${year}:`);
            moviesInYear.forEach(entry => console.log(`- ${entry.Name}`));
          } else {
            console.log(`No movies found for the year ${year}.`);
          }
          break;

        case 'How many movies are on my watchlist?':
          console.log(`You have ${watchlistData.length} movies on your watchlist.`);
          break;

        case 'List all movies on my watchlist':
          watchlistData.forEach(entry => console.log(`- ${entry.Name}`));
          break;

        case 'Find where to watch a movie':
          const { movieTitle } = await inquirer.prompt([
            {
              type: 'input',
              name: 'movieTitle',
              message: 'Enter the movie title to search for:',
            },
          ]);
          try {
            const movie = await tmdbService.searchMovie(movieTitle);
            if (!movie) {
              console.log('Movie not found on TMDb.');
              break;
            }
            console.log(`Found movie: ${movie.title} (${new Date(movie.release_date).getFullYear()})`);
            const providers = await tmdbService.getWatchProviders(movie.id);
            const countryProviders = providers[countryCode.toUpperCase()];

            if (countryProviders && countryProviders.link && countryProviders.flatrate) {
              console.log('Available to stream on:');
              countryProviders.flatrate.forEach((provider: any) => {
                const isSubscribed = subscribedServices.includes(provider.provider_name.toLowerCase());
                console.log(`- ${provider.provider_name} ${isSubscribed ? '(Subscribed)' : ''}`);
              });
              console.log(`\nWatch it here: ${countryProviders.link}`);
            } else {
              console.log('Not available for streaming in your country.');
            }
          } catch (error) {
            console.error('Error finding movie:', error);
          }
          break;

        case 'Suggest a random movie to watch':
          if (watchlistData.length === 0) {
            console.log('Your watchlist is empty.');
            break;
          }
          if (subscribedServices.length === 0 || subscribedServices[0] === '') {
            console.error('Please add your STREAMING_SERVICES to the .env file.');
            break;
          }
          let suggestionFound = false;
          const shuffledWatchlist = [...watchlistData].sort(() => 0.5 - Math.random());

          for (const movie of shuffledWatchlist) {
            try {
              const tmdbMovie = await tmdbService.searchMovie(movie.Name);
              if (!tmdbMovie) continue;

              const providers = await tmdbService.getWatchProviders(tmdbMovie.id);
              const countryProviders = providers[countryCode.toUpperCase()];

              if (countryProviders && countryProviders.link && countryProviders.flatrate) {
                const availableOnSubscribed = countryProviders.flatrate.filter((provider: any) =>
                  subscribedServices.includes(provider.provider_name.toLowerCase())
                );

                if (availableOnSubscribed.length > 0) {
                  console.log(`How about watching: ${movie.Name}?`);
                  console.log('You can stream it on:');
                  availableOnSubscribed.forEach((provider: any) => console.log(`- ${provider.provider_name}`));
                  console.log(`\nWatch it here: ${countryProviders.link}`);
                  suggestionFound = true;
                  break;
                }
              }
            } catch (error) { /* Ignore and continue */ }
          }
          if (!suggestionFound) {
            console.log('Could not find any movie from your watchlist available on your subscribed services.');
          }
          break;

        case 'List available streaming services':
          try {
            const providers = await tmdbService.getAvailableProviders(countryCode);
            if (providers && providers.length > 0) {
              console.log(`Available streaming services in ${countryCode.toUpperCase()}:`);
              const providerNames = providers.map((provider: any) => provider.provider_name).sort();
              console.log(providerNames.join('\n'));
              console.log('\nCopy the exact names of the services you subscribe to and add them to the STREAMING_SERVICES variable in your .env file, separated by commas.');
            } else {
              console.log(`Could not find any streaming services for country code: ${countryCode.toUpperCase()}`);
            }
          } catch (error) {
            console.error('Error fetching streaming services:', error);
          }
          break;

        case 'Get movies from a Letterboxd list':
          let listUrl: string | undefined;
          const listChoices = [...savedLists.map(l => ({ name: l.Content, value: l.Content })), { name: 'Enter a new URL', value: 'new' }];
          const { listSelection } = await inquirer.prompt([
            {
              type: 'list',
              name: 'listSelection',
              message: 'Choose a saved list or enter a new one:',
              choices: listChoices,
            },
          ]);

          if (listSelection === 'new') {
            const { newListUrl } = await inquirer.prompt([
              {
                type: 'input',
                name: 'newListUrl',
                message: 'Enter the Letterboxd list URL:',
              },
            ]);
            listUrl = newListUrl;
            // We won't ask to save the list anymore since we're using a CSV
          } else {
            listUrl = listSelection;
          }

          if (!listUrl) {
            console.error('No list URL provided.');
            break;
          }

          const listSpinner = (await createSpinner('Fetching list from Letterboxd...')).start();
          try {
            const movies = await letterboxdService.getMoviesFromList(listUrl);
            listSpinner.succeed(`Found ${movies.length} movies in the list.`);

            if (movies.length > 0) {
              const { findWatchProviders } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'findWatchProviders',
                  message: 'Do you want to find where to watch these movies?',
                  default: true,
                },
              ]);

              if (findWatchProviders) {
                const providersSpinner = (await createSpinner('Finding watch providers...')).start();
                const subscribedMovies: string[] = [];
                const otherAvailableMovies: string[] = [];
                const unavailableMovies: string[] = [];
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
                    if (countryProviders && countryProviders.link && countryProviders.flatrate) {
                      const subscribedProviderNames = countryProviders.flatrate
                        .filter((p: any) => subscribedServices.includes(p.provider_name.toLowerCase()))
                        .map((p: any) => p.provider_name)
                        .join(', ');

                      if (subscribedProviderNames) {
                        subscribedMovies.push(`- ${movieTitle}: Available on your services (${subscribedProviderNames}). Watch here: ${countryProviders.link}`);
                      } else {
                        const otherProviderNames = countryProviders.flatrate.map((p: any) => p.provider_name).join(', ');
                        otherAvailableMovies.push(`- ${movieTitle}: Available on ${otherProviderNames}. Watch here: ${countryProviders.link}`);
                      }
                    } else {
                      unavailableMovies.push(`- ${movieTitle}: Not available for streaming in your country.`);
                    }
                  } catch (error) {
                    if (errorCount === 0) {
                      providersSpinner.fail(`- ${movieTitle}: Error finding watch providers. Further errors will be suppressed.`);
                    }
                    errorCount++;
                    unavailableMovies.push(`- ${movieTitle}: Error finding watch providers.`);
                  }
                  await new Promise(resolve => setTimeout(resolve, 250)); // 250ms delay
                }
                providersSpinner.succeed('Finished finding providers.');

                console.log('\n--- Movies on Your Services ---');
                if (subscribedMovies.length > 0) {
                  subscribedMovies.forEach(m => console.log(m));
                } else {
                  console.log('None of the movies on this list are available on your subscribed services.');
                }

                console.log('\n--- Other Available Movies ---');
                if (otherAvailableMovies.length > 0) {
                  otherAvailableMovies.forEach(m => console.log(m));
                } else {
                  console.log('No other movies on this list are available for streaming.');
                }

                console.log('\n--- Unavailable Movies ---');
                if (unavailableMovies.length > 0) {
                  unavailableMovies.forEach(m => console.log(m));
                } else {
                  console.log('All movies on this list are available!');
                }

              } else {
                movies.forEach(movie => console.log(`- ${movie}`));
              }
            }
          } catch (error) {
            listSpinner.fail('Error fetching movies from Letterboxd list.');
            console.error(error);
          }
          break;

        case 'Check for watchlist availability changes':
          const watchlistSpinner = (await createSpinner('Checking for watchlist availability changes...')).start();
          try {
            const changes = await watchlistService.checkForAvailabilityChanges();
            if (changes.length > 0) {
              watchlistSpinner.succeed('Found availability changes:');
              const newlyAvailable = changes.filter(c => c.includes('is now available'));
              const noLongerAvailable = changes.filter(c => c.includes('is no longer available'));

              if (newlyAvailable.length > 0) {
                console.log('\n--- Newly Available ---');
                newlyAvailable.forEach(change => console.log(`- ${change}`));
              }

              if (noLongerAvailable.length > 0) {
                console.log('\n--- No Longer Available ---');
                noLongerAvailable.forEach(change => console.log(`- ${change}`));
              }
            }
            else {
              watchlistSpinner.succeed('No changes in watchlist availability.');
            }
          } catch (error) {
            watchlistSpinner.fail('Error checking for watchlist availability changes.');
            console.error(error);
          }
          break;

        case 'Exit':
          console.log('Goodbye!');
          return;
      }
    } catch (error: any) {
      if (error.message.includes('User force closed the prompt')) {
        console.log('\nGoodbye!');
        process.exit(0);
      }
      throw error;
    }
  }
}

main();