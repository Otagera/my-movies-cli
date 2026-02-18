# Letterboxd CLI

A powerful, local-first movie recommendation and watchlist management tool that integrates your Letterboxd history with TMDb data. It uses a hybrid approach with semantic search and a detailed taste profile to provide nuanced movie suggestions.

## Features

- **Hybrid Personalized Recommendations:** Get movie suggestions based on a sophisticated analysis of your highly-rated movies, combining semantic search on movie overviews with a detailed taste profile of your favorite genres, actors, and directors.
- **Automatic Setup:** No need to manually edit `.env` files. The CLI will guide you through the initial configuration on your first run.
- **Direct Data Sync:** Keep your local data up-to-date by syncing directly with your Letterboxd account, fetching your diary, ratings, and watchlist (via CSV or Scraping).
- **Watch Availability:** Check where movies are streaming in your country based on your specific subscriptions.
- **Watchlist Tracking:** Monitor your Letterboxd watchlist for availability changes on streaming platforms.
- **Random Movie Suggestions:** Get a random movie suggestion with details and reasons based on your taste profile, intelligently filtered to exclude movies you've already seen.
- **Local-First:** All your data and movie embeddings stay on your machine in a local SQLite and ChromaDB "sidecar" instance.

## Usage (The Easy Way)

You can run the CLI instantly from any directory using `npx`:

```bash
npx github:Otagera/my-movies-cli
```

### First Run:
1.  **Configuration:** The CLI will prompt you for your **TMDb API Key** and **Country Code**.
2.  **Data Sync:** Select **"Sync data with Letterboxd"** -> **"CSV files"**. 
    *   *Note: Ensure you have a `data/` folder in your current directory containing your Letterboxd export CSVs (`diary.csv`, `watchlist.csv`, `ratings.csv`).*

---

## How the Recommendation Engine Works

The recommendation engine is a hybrid system that combines the power of modern semantic search with a classic, detailed taste profile analysis.

### High-Level Overview

The process can be visualized as a funnel. We start by finding a broad set of movies that are thematically similar to what you like (semantic search), and then we meticulously re-rank that set based on the specific details (genres, actors, directors) that make up your unique taste.

```mermaid
graph TD
    A[Your Highly Rated Movies] --> B{Stage 1: Semantic Search};
    B --> C[Top 50 Thematically Similar Movies];
    C --> D{Stage 2: Detailed Scoring & Re-ranking};
    D --> E[Re-ranked List of Candidates];
    E --> F{Stage 3: Filter by Availability};
    F --> G[Top 5 Recommendations on Your Services];
```

### Stage 1: Semantic Search & Taste Profile Embedding
We generate embeddings for each of your highly-rated movies using a sentence-transformer model (`Xenova/all-MiniLM-L6-v2`). We then create a "Taste Profile Embedding" by averaging these vectors and use it to search ChromaDB for the top 50 thematically similar candidates.

### Stage 2: Detailed Scoring & Re-ranking
We build a detailed profile of your preferences by counting genres, actors, and directors from your history. Each candidate from Stage 1 is then scored against this profile. The final hybrid score ensures recommendations are both thematically relevant and feature the specific elements you enjoy.

---

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

## Offline / Restricted Network Setup

If you are on a network that blocks access to Hugging Face, you can use a local model cache:

1.  **Download the model files:**
    ```bash
    git clone https://huggingface.co/Xenova/all-MiniLM-L6-v2 ./.cache/transformers/Xenova/all-MiniLM-L6-v2
    ```

2.  **Enable Local Model Loading:**
    In your `.env` file, set:
    ```bash
    HUGGINGFACE_USE_LOCAL_MODELS=true
    HUGGINGFACE_MODEL_PATH=./.cache/transformers
    ```

## Troubleshooting

- **ChromaDB Issues:** The CLI starts ChromaDB automatically. If you encounter connection errors, ensure port `8000` is not being used by another application.
- **Scraping Capability:** Scraping requires `puppeteer`. If you wish to use web scraping instead of CSVs, you may need to install it manually: `npm install puppeteer`.

## Architecture

- **SQLite:** Local metadata storage.
- **ChromaDB:** Vector store for semantic search.
- **Inquirer.js:** Interactive terminal interface.
- **TMDb API:** Real-time movie and streaming data source.
