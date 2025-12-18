import { loadCsvData } from "../util";
import { DiaryEntry, RatingEntry, WatchlistEntry } from "../interface";
import { CacheService } from "./cache.service";
import { LetterboxdService } from "./letterboxd.service";

interface SavedList {
	Date: string;
	Content: string;
}

export class DataSyncService {
	constructor(
		private cacheService: CacheService,
		private letterboxdService: LetterboxdService,
		private useScraping: boolean
	) {}

	public async syncData(profileUrl?: string) {
		console.log("Starting data sync...");

		if (this.useScraping) {
			if (!profileUrl) {
				throw new Error("Profile URL is required for scraping.");
			}
			if(!URL.canParse(profileUrl)){
				throw new Error("Invalid profile URL.");
			}
			if(profileUrl[profileUrl.length-1] !== "/"){
				profileUrl += "/";
			}
			const diaryData = await this.letterboxdService.scrapeDiary(profileUrl);
			await this.cacheService.saveDiaryEntries(diaryData);
			console.log(`Synced ${diaryData.length} diary entries.`);

			const watchlistData = await this.letterboxdService.scrapeWatchlist(
				profileUrl
			);
			await this.cacheService.saveWatchlistEntries(watchlistData);
			console.log(`Synced ${watchlistData.length} watchlist entries.`);

			const ratingsData = await this.letterboxdService.scrapeRatings(
				profileUrl
			);
			await this.cacheService.saveRatingEntries(ratingsData);
			console.log(`Synced ${ratingsData.length} ratings entries.`);
		} else {
			interface RawDiaryEntry {
				Date: string;
				Name: string;
				Year: string;
				"Letterboxd URI": string;
				Rating: string;
				Rewatch: "Yes" | "";
				Tags: string;
				"Watched Date": string;
			}
			interface RawWatchlistEntry {
				Date: string;
				Name: string;
				Year: string;
				"Letterboxd URI": string;
			}
			interface RawRatingEntry {
				Date: string;
				Name: string;
				Year: string;
				"Letterboxd URI": string;
				Rating: string;
			}

			const rawDiaryData = await loadCsvData<RawDiaryEntry>("diary.csv");
			const diaryData: DiaryEntry[] = rawDiaryData.map((entry) => ({
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

			const rawWatchlistData = await loadCsvData<RawWatchlistEntry>(
				"watchlist.csv"
			);
			const watchlistData: WatchlistEntry[] = rawWatchlistData.map((entry) => ({
				Date: new Date(entry.Date),
				Name: entry.Name,
				Year: parseInt(entry.Year, 10),
				LetterboxdURI: entry["Letterboxd URI"],
			}));
			await this.cacheService.saveWatchlistEntries(watchlistData);
			console.log(`Synced ${watchlistData.length} watchlist entries.`);

			const rawRatingsData = await loadCsvData<RawRatingEntry>(
				"ratings.csv"
			);
			const ratingsData: RatingEntry[] = rawRatingsData.map((entry) => ({
				Date: new Date(entry.Date),
				Name: entry.Name,
				Year: parseInt(entry.Year, 10),
				LetterboxdURI: entry["Letterboxd URI"],
				Rating: parseFloat(entry.Rating),
			}));
			await this.cacheService.saveRatingEntries(ratingsData);
			console.log(`Synced ${ratingsData.length} ratings entries.`);

			// Assuming SavedList also needs transformation if its types are changed in interface.ts
			const savedLists = await loadCsvData<SavedList>("likes/lists.csv");
			await this.cacheService.saveSavedLists(savedLists);
			console.log(`Synced ${savedLists.length} saved lists.`);
		}

		console.log("Data sync complete.");
	}
}
