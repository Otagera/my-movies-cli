import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';
import inquirer from 'inquirer';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const DATA_DIR = path.join(__dirname, '../data');
const TMDB_API_BASE_URL = 'https://api.themoviedb.org/3';

interface DiaryEntry {
  Date: string;
  Name: string;
  Year: string;
  'Letterboxd URI': string;
  Rating: string;
  Rewatch: 'Yes' | '';
  Tags: string;
  'Watched Date': string;
}

interface WatchlistEntry {
  Date: string;
  Name: string;
  Year: string;
  'Letterboxd URI': string;
}

async function loadCsvData<T>(fileName: string): Promise<T[]> {
  const filePath = path.join(DATA_DIR, fileName);
  const results: T[] = [];

  if (!fs.existsSync(filePath)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

async function main() {
  const diaryData = await loadCsvData<DiaryEntry>('diary.csv');
  const watchlistData = await loadCsvData<WatchlistEntry>('watchlist.csv');
  const subscribedServices = (process.env.STREAMING_SERVICES || '').split(',').map(s => s.trim().toLowerCase());


  if (diaryData.length === 0 && watchlistData.length === 0) {
    console.error(`No data files found in ${DATA_DIR}`);
    console.error('Please export your data from Letterboxd and place diary.csv and/or watchlist.csv in the data directory.');
    return;
  }

  if (diaryData.length > 0) {
    console.log(`Successfully loaded ${diaryData.length} diary entries.`);
  }
  if (watchlistData.length > 0) {
    console.log(`Successfully loaded ${watchlistData.length} watchlist entries.`);
  }

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What do you want to ask?',
      choices: [
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
      if (watchlistData.length > 0) {
        console.log(`You have ${watchlistData.length} movies on your watchlist.`);
      } else {
        console.log('Could not find your watchlist data. Make sure watchlist.csv is in the data directory.');
      }
      break;

    case 'List all movies on my watchlist':
      if (watchlistData.length > 0) {
        console.log('Movies on your watchlist:');
        watchlistData.forEach(entry => console.log(`- ${entry.Name}`));
      } else {
        console.log('Could not find your watchlist data. Make sure watchlist.csv is in the data directory.');
      }
      break;

    case 'Find where to watch a movie':
      const apiKey = process.env.TMDB_API_KEY;
      const countryCode = process.env.STREAMING_COUNTRY_CODE;

      if (!apiKey || !countryCode) {
        console.error('Please set your TMDB_API_KEY and STREAMING_COUNTRY_CODE in the .env file.');
        break;
      }

      const { movieTitle } = await inquirer.prompt([
        {
          type: 'input',
          name: 'movieTitle',
          message: 'Enter the movie title to search for:',
        },
      ]);

      try {
        const searchResponse = await axios.get(`${TMDB_API_BASE_URL}/search/movie`, {
          params: {
            api_key: apiKey,
            query: movieTitle,
          },
        });

        if (searchResponse.data.results.length === 0) {
          console.log('Movie not found on TMDb.');
          break;
        }

        const movie = searchResponse.data.results[0];
        console.log(`Found movie: ${movie.title} (${new Date(movie.release_date).getFullYear()})`);

        const providersResponse = await axios.get(`${TMDB_API_BASE_URL}/movie/${movie.id}/watch/providers`, {
          params: {
            api_key: apiKey,
          },
        });

        const countryProviders = providersResponse.data.results[countryCode.toUpperCase()];

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
        if (axios.isAxiosError(error) && error.response) {
          console.error('Error fetching data from TMDb:', error.response.data);
        } else {
          console.error('Error fetching data from TMDb:', error);
        }
      }
      break;

    case 'Suggest a random movie to watch':
      const tmdbApiKey = process.env.TMDB_API_KEY;
      const streamingCountryCode = process.env.STREAMING_COUNTRY_CODE;

      if (!tmdbApiKey || !streamingCountryCode) {
        console.error('Please set your TMDB_API_KEY and STREAMING_COUNTRY_CODE in the .env file.');
        break;
      }
       if (subscribedServices.length === 0 || subscribedServices[0] === '') {
        console.error('Please add your STREAMING_SERVICES to the .env file.');
        break;
      }

      if (watchlistData.length === 0) {
        console.log('Your watchlist is empty. Add some movies to your watchlist on Letterboxd and export your data again.');
        break;
      }

      let suggestionFound = false;
      const shuffledWatchlist = [...watchlistData].sort(() => 0.5 - Math.random());

      for (const movie of shuffledWatchlist) {
        try {
          const searchResponse = await axios.get(`${TMDB_API_BASE_URL}/search/movie`, {
            params: {
              api_key: tmdbApiKey,
              query: movie.Name,
            },
          });

          if (searchResponse.data.results.length === 0) {
            continue;
          }

          const tmdbMovie = searchResponse.data.results[0];
          const providersResponse = await axios.get(`${TMDB_API_BASE_URL}/movie/${tmdbMovie.id}/watch/providers`, {
            params: {
              api_key: tmdbApiKey,
            },
          });

          const countryProviders = providersResponse.data.results[streamingCountryCode.toUpperCase()];
          
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
        } catch (error) {
          // Ignore errors for individual movies and continue to the next
        }
      }

      if (!suggestionFound) {
        console.log('Could not find any movie from your watchlist available on your subscribed services.');
      }
      break;

    case 'List available streaming services':
      const listApiKey = process.env.TMDB_API_KEY;
      const listCountryCode = process.env.STREAMING_COUNTRY_CODE;

      if (!listApiKey || !listCountryCode) {
        console.error('Please set your TMDB_API_KEY and STREAMING_COUNTRY_CODE in the .env file.');
        break;
      }

      try {
        const response = await axios.get(`${TMDB_API_BASE_URL}/watch/providers/movie`, {
          params: {
            api_key: listApiKey,
            watch_region: listCountryCode.toUpperCase(),
          },
        });

        if (response.data.results && response.data.results.length > 0) {
          console.log(`Available streaming services in ${listCountryCode.toUpperCase()}:`);
          const providerNames = response.data.results.map((provider: any) => provider.provider_name).sort();
          console.log(providerNames.join('\n'));
          console.log('\nCopy the exact names of the services you subscribe to and add them to the STREAMING_SERVICES variable in your .env file, separated by commas.');
        } else {
          console.log(`Could not find any streaming services for country code: ${listCountryCode.toUpperCase()}`);
        }
      } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
          console.error('Error fetching streaming services:', error.response.data);
        } else {
          console.error('Error fetching streaming services:', error);
        }
      }
      break;

    case 'Exit':
      console.log('Goodbye!');
      break;
  }
}

main();