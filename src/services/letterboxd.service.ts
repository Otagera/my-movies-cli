import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { CacheService } from "./cache.service";

export class LetterboxdService {
  private cacheService: CacheService;
  constructor(cacheService: CacheService) {
    this.cacheService = cacheService;
  }

  public async getMoviesFromList(listUrl: string): Promise<string[]> {
    const cachedMovies = await this.cacheService.get<string[]>(listUrl);
    if (cachedMovies) {
      return cachedMovies;
    }

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(listUrl, { waitUntil: "networkidle0" });

    const movies: string[] = [];
    let currentPageUrl = listUrl;

    while (currentPageUrl) {
      const content = await page.content();
      const $ = cheerio.load(content);

      $(".poster-container .film-poster img").each((_, element) => {
        const movieTitle = $(element).attr("alt");
        if (movieTitle) {
          movies.push(movieTitle);
        }
      });

      const nextPagePath = $("a.next").attr("href");
      if (nextPagePath) {
        currentPageUrl = new URL(nextPagePath, currentPageUrl).href;
        await page.goto(currentPageUrl, { waitUntil: "networkidle0" });
      } else {
        break;
      }
    }

    await browser.close();
    await this.cacheService.set(listUrl, movies); // Cache for 1 hour
    return movies;
  }
}
