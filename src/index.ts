import inquirer from 'inquirer';
import dotenv from 'dotenv';
import { loadCsvData, DiaryEntry, WatchlistEntry, RatingEntry } from './data/loader';
import { TMDbService } from './services/tmdb.service';
import { RecommendationService } from './services/recommendation.service';

dotenv.config();

async function main() {
  // Load data from all sources
  const diaryData = await loadCsvData<DiaryEntry>('diary.csv');
  const watchlistData = await loadCsvData<WatchlistEntry>('watchlist.csv');
  const ratingsData = await loadCsvData<RatingEntry>('ratings.csv');

  const subscribedServices = (process.env.STREAMING_SERVICES || '').split(',').map(s => s.trim().toLowerCase());
  const tmdbApiKey = process.env.TMDB_API_KEY;
  const countryCode = process.env.STREAMING_COUNTRY_CODE;

  if (!tmdbApiKey || !countryCode) {
    console.error('Please ensure TMDB_API_KEY and STREAMING_COUNTRY_CODE are set in your .env file.');
    return;
  }

  const tmdbService = new TMDbService(tmdbApiKey);
  const recommendationService = new RecommendationService(tmdbService);

  // Log loaded data
  if (diaryData.length > 0) console.log(`Successfully loaded ${diaryData.length} diary entries.`);
  if (watchlistData.length > 0) console.log(`Successfully loaded ${watchlistData.length} watchlist entries.`);
  if (ratingsData.length > 0) console.log(`Successfully loaded ${ratingsData.length} ratings.`);


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
        'Exit',
      ],
    },
  ]);

  switch (action) {
    case 'Get personalized recommendations':
      const { recommendationType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'recommendationType',
          message: 'Select recommendation type:',
          choices: [
            'All recommendations (no streaming filter)',
            'Recommendations available on my services',
          ],
        },
      ]);

      const highlyRatedMovies = ratingsData.filter(r => r.Rating >= 4);
      let recommendations;
      let recommendationMessage;

      if (recommendationType === 'Recommendations available on my services') {
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
        recommendations.forEach((movie, index) => {
          console.log(`${index + 1}. ${movie.title} (Score: ${movie.score})`);
        });
      } else {
        console.log('No new movie recommendations found at this time.');
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

    case 'Exit':
      console.log('Goodbye!');
      break;
  }
}

main();
