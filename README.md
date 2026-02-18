# Letterboxd CLI

A powerful, local-first movie recommendation and watchlist management tool that integrates your Letterboxd history with TMDb data. It uses a hybrid approach with semantic search and a detailed taste profile to provide nuanced movie suggestions.

## Features

- **Hybrid Personalized Recommendations:** Get movie suggestions based on a sophisticated analysis of your highly-rated movies, combining semantic search on movie overviews with a detailed taste profile of your favorite genres, actors, and directors.
- **Automatic Setup:** No need to manually edit `.env` files. The CLI will guide you through the initial configuration on your first run.
- **Smart Sidecar:** Automatically manages its own local ChromaDB instance for vector embeddings—no manual server management required.
- **Direct Data Sync:** Keep your local data up-to-date by syncing directly with your Letterboxd account (via CSV or Scraping).
- **Watch Availability:** Check where movies are streaming in your country based on your specific subscriptions.
- **Watchlist Tracking:** Monitor your Letterboxd watchlist for availability changes on streaming platforms.
- **Local-First:** All your data and movie embeddings stay on your machine in a local SQLite and ChromaDB instance.

## Usage (The Easy Way)

You can run the CLI instantly from any directory using `npx`:

```bash
npx github:Otagera/my-movies-cli
```

### First Run:
1.  **Configuration:** The CLI will prompt you for your **TMDb API Key** and **Country Code**.
2.  **Data Sync:** Select **"Sync data with Letterboxd"** -> **"CSV files"**. 
    *   *Note: Ensure you have a `data/` folder in your current directory containing your Letterboxd export CSVs (`diary.csv`, `watchlist.csv`, `ratings.csv`).*

## Manual Setup (Development)

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Otagera/my-movies-cli.git
    cd my-movies-cli
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run in Dev Mode:**
    ```bash
    npm run dev
    ```

## How the Recommendation Engine Works

The engine uses a two-stage process:
1.  **Semantic Search:** Converts movie synopses into vectors (embeddings) and finds thematically similar movies.
2.  **Detailed Re-ranking:** Re-scores candidates based on your specific affinity for certain actors, directors, and genres.

## Troubleshooting

- **ChromaDB Issues:** The CLI starts ChromaDB automatically. If you encounter connection errors, ensure port `8000` is not being used by another application.
- **Scraping Capability:** Scraping requires `puppeteer`. If you wish to use web scraping instead of CSVs, you may need to install it manually: `npm install puppeteer`.

## Architecture

- **SQLite:** Local metadata storage.
- **ChromaDB:** Vector store for semantic search.
- **TMDb API:** Real-time data source for movies and streaming availability.