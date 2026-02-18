"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataSyncService = void 0;
const util_1 = require("../util");
class DataSyncService {
    cacheService;
    letterboxdService;
    useScraping;
    constructor(cacheService, letterboxdService, useScraping) {
        this.cacheService = cacheService;
        this.letterboxdService = letterboxdService;
        this.useScraping = useScraping;
    }
    async syncData(profileUrl) {
        console.log("Starting data sync...");
        if (this.useScraping) {
            if (!profileUrl) {
                throw new Error("Profile URL is required for scraping.");
            }
            if (!URL.canParse(profileUrl)) {
                throw new Error("Invalid profile URL.");
            }
            if (profileUrl[profileUrl.length - 1] !== "/") {
                profileUrl += "/";
            }
            const diaryData = await this.letterboxdService.scrapeDiary(profileUrl);
            await this.cacheService.saveDiaryEntries(diaryData);
            console.log(`Synced ${diaryData.length} diary entries.`);
            const watchlistData = await this.letterboxdService.scrapeWatchlist(profileUrl);
            await this.cacheService.saveWatchlistEntries(watchlistData);
            console.log(`Synced ${watchlistData.length} watchlist entries.`);
            const ratingsData = await this.letterboxdService.scrapeRatings(profileUrl);
            await this.cacheService.saveRatingEntries(ratingsData);
            console.log(`Synced ${ratingsData.length} ratings entries.`);
        }
        else {
            const rawDiaryData = await (0, util_1.loadCsvData)("diary.csv");
            const diaryData = rawDiaryData.map((entry) => ({
                LoggedDate: new Date(entry.Date), // Assuming 'Date' from CSV is the logged date
                Name: entry.Name,
                Year: parseInt(entry.Year, 10),
                LetterboxdURI: entry["Letterboxd URI"],
                Rating: parseFloat(entry.Rating),
                Rewatch: entry.Rewatch === "Yes",
                Tags: entry.Tags,
                WatchedDate: new Date(entry["Watched Date"]), // Map "Watched Date" from CSV
            }));
            await this.cacheService.saveDiaryEntries(diaryData);
            console.log(`Synced ${diaryData.length} diary entries.`);
            const rawWatchlistData = await (0, util_1.loadCsvData)("watchlist.csv");
            const watchlistData = rawWatchlistData.map((entry) => ({
                Date: new Date(entry.Date),
                Name: entry.Name,
                Year: parseInt(entry.Year, 10),
                LetterboxdURI: entry["Letterboxd URI"],
            }));
            await this.cacheService.saveWatchlistEntries(watchlistData);
            console.log(`Synced ${watchlistData.length} watchlist entries.`);
            const rawRatingsData = await (0, util_1.loadCsvData)("ratings.csv");
            const ratingsData = rawRatingsData.map((entry) => ({
                Date: new Date(entry.Date),
                Name: entry.Name,
                Year: parseInt(entry.Year, 10),
                LetterboxdURI: entry["Letterboxd URI"],
                Rating: parseFloat(entry.Rating),
            }));
            await this.cacheService.saveRatingEntries(ratingsData);
            console.log(`Synced ${ratingsData.length} ratings entries.`);
            // Assuming SavedList also needs transformation if its types are changed in interface.ts
            const savedLists = await (0, util_1.loadCsvData)("likes/lists.csv");
            await this.cacheService.saveSavedLists(savedLists);
            console.log(`Synced ${savedLists.length} saved lists.`);
        }
        console.log("Data sync complete.");
    }
}
exports.DataSyncService = DataSyncService;
