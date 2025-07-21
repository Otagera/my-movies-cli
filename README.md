# Letterboxd CLI

This is a command-line interface (CLI) tool for interacting with your Letterboxd data. It allows you to get personalized movie recommendations, track your watched movies, manage your watchlist, and find where to watch movies based on your streaming services.

## Features

- **Personalized Recommendations:** Get movie recommendations based on your highly-rated movies.
- **Watched Movies Tracking:** See how many movies you've watched and list movies from specific years.
- **Watchlist Management:** View your watchlist and get suggestions for movies available on your subscribed streaming services.
- **Where to Watch:** Find streaming availability for any movie.
- **Random Movie Suggestions:** Get a random movie suggestion with details and reasons based on your taste profile, now with improved filtering to exclude already watched or watchlist movies.

## Recent Improvements by Gemini CLI

This project has recently benefited from significant enhancements and debugging assistance provided by the Gemini CLI, an AI assistant. Key contributions include:

-   **Bug Fixes:** Addressed and resolved critical TypeScript compilation errors, such as the "Cannot find name 'recommendationType'" error in `src/index.ts`, ensuring the application runs smoothly.
-   **Enhanced Random Movie Recommendations:** The "Suggest a random movie with details" feature has been substantially improved. It now intelligently filters out movies that you have already watched or have on your watchlist, providing more relevant and personalized suggestions. This involved modifying the `getRandomRecommendationWithDetails` method in `src/services/recommendation.service.ts` to incorporate comprehensive filtering logic.
-   **Refactored Recommendation Logic:** The underlying recommendation service (`src/services/recommendation.service.ts`) was updated to support the new filtering capabilities and improve overall recommendation quality.
-   **Comprehensive Documentation:** This `README.md` file and `AI.md` have been updated to accurately reflect all the latest changes, features, and ongoing development, providing clear guidance for users and contributors.

## Setup and Usage

### Prerequisites

-   Node.js (v18 or higher recommended)
-   npm (Node Package Manager)
-   A TMDb API Key (get one from [TMDb](https://www.themoviedb.org/documentation/api))
-   Your Letterboxd data exported as CSV files (`diary.csv`, `watchlist.csv`, `ratings.csv`) in the `data/` directory.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-repo/letterboxd-cli.git
    cd letterboxd-cli
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root directory based on `.env.example` and fill in your details:
    ```
    TMDB_API_KEY=your_tmdb_api_key_here
    STREAMING_SERVICES="Netflix, Amazon Prime Video, Hulu" # Comma-separated list of your subscribed services
    STREAMING_COUNTRY_CODE="US" # Your 2-letter country code (e.g., US, GB, NG)
    ```

4.  **Place your Letterboxd CSV data:**
    Ensure your `diary.csv`, `watchlist.csv`, and `ratings.csv` files are placed in the `data/` directory.

### Running the CLI

To start the application, run:

```bash
npm start
```

You will be presented with a menu of options to interact with your data.

## Development

### Project Structure

-   `src/index.ts`: Main application entry point, handles user interaction.
-   `src/data/loader.ts`: Handles loading and parsing of CSV data.
-   `src/services/tmdb.service.ts`: Interacts with the TMDb API.
-   `src/services/recommendation.service.ts`: Contains the logic for generating movie recommendations.
-   `src/services/cache.service.ts`: Manages SQLite caching for API responses.

### Contributing

Feel free to fork the repository and submit pull requests.
