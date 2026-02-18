"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LetterboxdService = void 0;
const cheerio = __importStar(require("cheerio"));
const axios_1 = __importDefault(require("axios"));
class LetterboxdService {
    cacheService;
    constructor(cacheService) {
        this.cacheService = cacheService;
    }
    async getBrowser() {
        try {
            const puppeteer = await Promise.resolve().then(() => __importStar(require("puppeteer")));
            return await puppeteer.default.launch({ headless: true });
        }
        catch (error) {
            console.error("\r\n❌ ERROR: Scraping capability is missing!");
            console.error("To enable Letterboxd scraping, you must manually install puppeteer:");
            console.error("\r\n   npm install puppeteer\r\n");
            throw new Error("Puppeteer not found. Install it to use scraping features.");
        }
    }
    async getMoviesFromList(listUrl) {
        const cachedMovies = await this.cacheService.get(listUrl);
        if (cachedMovies) {
            return cachedMovies;
        }
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.goto(listUrl, { waitUntil: "networkidle0" });
        const movies = [];
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
            }
            else {
                break;
            }
        }
        await browser.close();
        await this.cacheService.set(listUrl, movies); // Cache for 1 hour
        return movies;
    }
    async scrapeRatings(profileUrl) {
        const baseUrl = new URL(profileUrl);
        const ratingsUrl = new URL(`${baseUrl.pathname}/films/`, baseUrl.origin).href;
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.goto(ratingsUrl, { waitUntil: "networkidle0" });
        const ratings = [];
        let currentPageUrl = ratingsUrl;
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
            }
            else {
                currentPageUrl = undefined;
            }
        }
        await browser.close();
        console.log(`Scraped a total of ${ratings.length} ratings entries.`);
        return ratings;
    }
    async scrapeWatchlist(profileUrl) {
        const baseUrl = new URL(profileUrl);
        const watchlistUrl = new URL(`${baseUrl.pathname}/watchlist/`, baseUrl.origin).href;
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.goto(watchlistUrl, { waitUntil: "networkidle0" });
        const watchlist = [];
        let currentPageUrl = watchlistUrl;
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
            }
            else {
                currentPageUrl = undefined;
            }
        }
        await browser.close();
        console.log(`Scraped a total of ${watchlist.length} watchlist entries.`);
        return watchlist;
    }
    async scrapeDiary(profileUrl) {
        const baseUrl = new URL(profileUrl);
        const diaryUrl = new URL(`${baseUrl.pathname}/diary/`, baseUrl.origin).href;
        const { data } = await axios_1.default.get(diaryUrl);
        const $ = cheerio.load(data);
        const diary = [];
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
exports.LetterboxdService = LetterboxdService;
