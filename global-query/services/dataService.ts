
import { RawRow } from '../types';

export function parseCSVLine(line: string): RawRow {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  if (!line) return [];

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export async function fetchCSV(url: string): Promise<RawRow[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Network response was not ok');
  const text = await response.text();
  return text.split('\n').filter(line => line.trim()).map(parseCSVLine);
}
