import * as cheerio from "cheerio";
import axios from "axios";
import { CacheService } from "./cache.service";
import { DiaryEntry, RatingEntry, WatchlistEntry } from "../interface";

export class LetterboxdService {
	private cacheService: CacheService;
	constructor(cacheService: CacheService) {
		this.cacheService = cacheService;
	}

	private async getBrowser() {
		try {
			const puppeteer = await import("puppeteer");
			return await puppeteer.default.launch({ headless: true });
		} catch (error) {
			console.error("\r\n❌ ERROR: Scraping capability is missing!");
			console.error("To enable Letterboxd scraping, you must manually install puppeteer:");
			console.error("\r\n   npm install puppeteer\r\n");
			throw new Error("Puppeteer not found. Install it to use scraping features.");
		}
	}

	public async getMoviesFromList(listUrl: string): Promise<string[]> {
		const cachedMovies = await this.cacheService.get<string[]>(listUrl);
		if (cachedMovies) {
			return cachedMovies;
		}

		const browser = await this.getBrowser();
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

	public async scrapeRatings(profileUrl: string): Promise<RatingEntry[]> {
		const baseUrl = new URL(profileUrl);
		const ratingsUrl = new URL(
			`${baseUrl.pathname}/films/`,
			baseUrl.origin
		).href;

		const browser = await this.getBrowser();
		const page = await browser.newPage();
		await page.goto(ratingsUrl, { waitUntil: "networkidle0" });

		const ratings: RatingEntry[] = [];
		let currentPageUrl: string | undefined = ratingsUrl;

		while (currentPageUrl) {
			const content = await page.content();
			const $ = cheerio.load(content);

			const posters = $("li.griditem div.react-component");
			console.log(`Found ${posters.length} posters on ${currentPageUrl}`);

			posters.each((_, element) => {
				const name = $(element).attr("data-item-name");
				const letterboxdURI = $(element).attr("data-item-slug");
				// Ratings are in a sibling div, not a parent. Let's find it.
				const ratingSpan = $(element).find('span.rating');
				let rating = 0;
				if (ratingSpan.length > 0) {
					const ratingClasses = ratingSpan.attr('class')?.split(' ');
					const ratedClass = ratingClasses?.find(c => c.startsWith('rated-'));
					if (ratedClass) {
						rating = parseInt(ratedClass.split('-')[1], 10) / 2;
					}
				}

				if (name && letterboxdURI) {
					console.log(`- Found: ${name} (${letterboxdURI}) - Rating: ${rating}`);
					ratings.push({
						Name: name,
						LetterboxdURI: letterboxdURI,
						Rating: rating,
						Date: new Date(),
						Year: 0,
					});
				}
			});

			const nextPagePath = $("a.next").attr("href");
			if (nextPagePath) {
				currentPageUrl = new URL(nextPagePath, currentPageUrl).href;
				console.log(`Navigating to next page: ${currentPageUrl}`);
				await page.goto(currentPageUrl, { waitUntil: "networkidle0" });
			} else {
				currentPageUrl = undefined;
			}
		}

		await browser.close();
		console.log(`Scraped a total of ${ratings.length} ratings entries.`);
		return ratings;
	}

	public async scrapeWatchlist(profileUrl: string): Promise<WatchlistEntry[]> {
		const baseUrl = new URL(profileUrl);
		const watchlistUrl = new URL(
			`${baseUrl.pathname}/watchlist/`,
			baseUrl.origin
		).href;

		const browser = await this.getBrowser();
		const page = await browser.newPage();
		await page.goto(watchlistUrl, { waitUntil: "networkidle0" });

		const watchlist: WatchlistEntry[] = [];
		let currentPageUrl: string | undefined = watchlistUrl;

		while (currentPageUrl) {
			const content = await page.content();
			const $ = cheerio.load(content);

			const posters = $("li.griditem div.react-component");
			console.log(`Found ${posters.length} posters on ${currentPageUrl}`);

			posters.each((_, element) => {
				const movieTitle = $(element).attr("data-item-name");
				const letterboxdURI = $(element).attr("data-item-slug");
				if (movieTitle && letterboxdURI) {
					console.log(`- Found: ${movieTitle} (${letterboxdURI})`);
					watchlist.push({
						Name: movieTitle,
						LetterboxdURI: letterboxdURI,
						Date: new Date(),
						Year: 0,
					});
				}
			});

			const nextPagePath = $("a.next").attr("href");
			if (nextPagePath) {
				currentPageUrl = new URL(nextPagePath, currentPageUrl).href;
				console.log(`Navigating to next page: ${currentPageUrl}`);
				await page.goto(currentPageUrl, { waitUntil: "networkidle0" });
			} else {
				currentPageUrl = undefined;
			}
		}

		await browser.close();
		console.log(`Scraped a total of ${watchlist.length} watchlist entries.`);
		return watchlist;
	}

	public async scrapeDiary(profileUrl: string): Promise<DiaryEntry[]> {
		const baseUrl = new URL(profileUrl);
		const diaryUrl = new URL(`${baseUrl.pathname}/diary/`, baseUrl.origin).href;

		const { data } = await axios.get(diaryUrl);
		const $ = cheerio.load(data);
		const diary: DiaryEntry[] = [];

		const rows = $("tr.diary-entry-row");
		console.log(`Found ${rows.length} diary entries on the first page.`);

		rows.each((_, element) => {
			const title = $(element).find("h3 a").text();
			const year = parseInt($(element).find("td.td-year").text(), 10);
			const ratingStr = $(element).find("td.td-rating .rating").attr('class');
			const rating = ratingStr ? parseInt(ratingStr.split('rated-').pop() || '0', 10) / 2 : 0;
			const letterboxdURI = $(element).find('h3 a').attr('href');
			const rewatch = $(element).find('td.td-rewatch').text().includes('rewatch');
			const datePath = $(element).find('td.td-day a').attr('href')?.split('/');
			const date = datePath ? new Date(datePath[5]) : new Date();


			if (title && year && letterboxdURI) {
				console.log(`- Found: ${title} (${year}) - Rating: ${rating}`);
				diary.push({
					Name: title,
					Year: year,
					Rating: rating,
					LetterboxdURI: letterboxdURI,
					Rewatch: rewatch,
					LoggedDate: date,
					WatchedDate: date,
					Tags: ''
				});
			}
		});

		console.log(`Scraped a total of ${diary.length} diary entries.`);
		return diary;
	}
}