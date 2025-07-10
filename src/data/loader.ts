import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

const DATA_DIR = path.join(__dirname, '../../data');

export interface DiaryEntry {
  Date: string;
  Name: string;
  Year: string;
  'Letterboxd URI': string;
  Rating: string;
  Rewatch: 'Yes' | '';
  Tags: string;
  'Watched Date': string;
}

export interface WatchlistEntry {
  Date: string;
  Name: string;
  Year: string;
  'Letterboxd URI': string;
}

export interface RatingEntry {
  Date: string;
  Name: string;
  Year: string;
  'Letterboxd URI': string;
  Rating: number;
}

export async function loadCsvData<T>(fileName: string): Promise<T[]> {
  const filePath = path.join(DATA_DIR, fileName);
  const results: T[] = [];

  if (!fs.existsSync(filePath)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}
