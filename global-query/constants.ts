
import { Step, ColumnDef } from './types';

export const SHEET_ID = '1JbxRqsZTDgmdlJ_3nrumfjPvjGVZdjJe43FPrh9kYw4';
export const QUERY_GID = '1662570079';
export const API_GID = '817322209';

export const CSV_QUERY_URL = (cb: number) => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${QUERY_GID}&cb=${cb}`;
export const CSV_API_URL = (cb: number) => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${API_GID}&cb=${cb}`;

export const ADMIN_COLS: ColumnDef[] = [
  { l: "Timestamp", i: 0 },
  { l: "Received By", i: 1 },
  { l: "Client Name", i: 2 },
  { l: "Expected Date", i: 5 },
  { l: "Serial Key", i: 6 },
  { l: "Issue / Query", i: 3 },
  { l: "Doer", i: 7 },
  { l: "Current Milestone", i: -2 }, // Milestone Logic
  { l: "Track", i: -1 } // Track Button
];

export const USER_COLS: ColumnDef[] = [
  { l: "Timestamp", i: 0 },
  { l: "Expected Date", i: 5 },
  { l: "Serial Key", i: 6 },
  { l: "Issue / Query", i: 3 },
  { l: "Current Milestone", i: -2 },
  { l: "Track", i: -1 }
];

export const STEPS: Step[] = [
  { n: "Update sales person", p: 8, a: 9, s: 10, d: 11 },
  { n: "Inform to client", p: 13, a: 14, s: 15, d: 16 },
  { n: "Revised-Update sales person", p: 17, a: 18, s: 19, d: 20 },
  { n: "Inform to client (Revised Date)", p: 21, a: 22, s: 23, d: 24 },
  { n: "Issue Status", p: 25, a: 26, s: 27, d: 28 }
];

export const ROWS_PER_PAGE = 15;
