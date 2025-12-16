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
	LoggedDate: Date; // Date the entry was logged
	Name: string;
	Year: number;
	LetterboxdURI: string;
	Rating: number;
	Rewatch: boolean;
	Tags: string;
	WatchedDate: Date; // Date the movie was watched
}

export interface WatchlistEntry {
	Date: Date;
	Name: string;
	Year: number;
	LetterboxdURI: string;
}

export interface RatingEntry {
	Date: Date;
	Name: string;
	Year: number;
	LetterboxdURI: string;
	Rating: number;
}
