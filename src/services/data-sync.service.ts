import { CacheService } from "./cache.service";
import {
	loadCsvData,
	DiaryEntry,
	WatchlistEntry,
	RatingEntry,
} from "../data/loader";

interface SavedList {
	Date: string;
	Content: string;
}

export class DataSyncService {
	constructor(private cacheService: CacheService) {}

	public async syncData() {
		console.log("Starting data sync...");

		const diaryData = await loadCsvData<DiaryEntry>("diary.csv");
		await this.cacheService.saveDiaryEntries(diaryData);
		console.log(`Synced ${diaryData.length} diary entries.`);

		const watchlistData = await loadCsvData<WatchlistEntry>("watchlist.csv");
		await this.cacheService.saveWatchlistEntries(watchlistData);
		console.log(`Synced ${watchlistData.length} watchlist entries.`);

		const ratingsData = await loadCsvData<RatingEntry>("ratings.csv");
		await this.cacheService.saveRatingEntries(ratingsData);
		console.log(`Synced ${ratingsData.length} ratings entries.`);

		const savedLists = await loadCsvData<SavedList>("likes/lists.csv");
		await this.cacheService.saveSavedLists(savedLists);
		console.log(`Synced ${savedLists.length} saved lists.`);

		console.log("Data sync complete.");
	}
}
