import * as fs from "fs";
import * as path from "path";
import csv from "csv-parser";

const DATA_DIR = path.join(process.cwd(), "data");

export async function loadCsvData<T>(fileName: string): Promise<T[]> {
  const filePath = path.join(DATA_DIR, fileName);
  const results: T[] = [];

  if (!fs.existsSync(filePath)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error) => reject(error));
  });
}
