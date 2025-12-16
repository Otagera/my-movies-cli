export interface TasteProfile {
	genres: Map<string, number>;
	actors: Map<string, number>;
	directors: Map<string, number>;
	writers: Map<string, number>;
	keywords: Map<string, number>;
}

export interface ScoredMovieCandidate {
	id: number;
	title: string;
	genre_ids: number[];
	score: number;
	// Add other properties from TMDb movie object if needed for display or further processing
}

export interface TMDbMovie {
	id: number;
	title: string;
	overview: string;
	release_date: string;
	genre_ids: number[];
	genres: { id: number; name: string }[];
}

export interface TMDbCredits {
	cast: { name: string }[];
	crew: { name: string; job: string }[];
}

export interface DiaryEntry {
	Date: string;
	Name: string;
	Year: string;
	"Letterboxd URI": string;
	Rating: string;
	Rewatch: "Yes" | "";
	Tags: string;
	"Watched Date": string;
}

export interface WatchlistEntry {
	Date: string;
	Name: string;
	Year: string;
	"Letterboxd URI": string;
}

export interface RatingEntry {
	Date: string;
	Name: string;
	Year: string;
	"Letterboxd URI": string;
	Rating: number;
}
