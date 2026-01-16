
import { Step, ColumnDef } from './types';

export const SHEET_ID = '1JbxRqsZTDgmdlJ_3nrumfjPvjGVZdjJe43FPrh9kYw4';
export const QUERY_GID = '1662570079';
export const API_GID = '817322209';

// IMPORTANT: Replace this with your actual Google Apps Script Web App URL after deploying the backend script provided below.
export const TICKET_API_URL = 'https://script.google.com/macros/s/AKfycbzY7TJmfUEI2gz-vU4vMzuVqSXIf_kyU41LOeGbmR5jl8LMRLrgPHILW1_iVcRwYo_n/exec';

export const CSV_QUERY_URL = (cb: number) => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${QUERY_GID}&cb=${cb}`;
export const CSV_API_URL = (cb: number) => `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${API_GID}&cb=${cb}`;

export const ADMIN_COLS: ColumnDef[] = [
  { l: "Ticket Raised", i: 0 },
  { l: "Received By", i: 1 },
  { l: "Client Name", i: 2 },
  { l: "Expected Date", i: 5 },
  { l: "Ticket No", i: 6 },
  { l: "Issue / Query", i: 3 },
  { l: "Doer", i: 7 },
  { l: "Current status", i: -2 }, 
  { l: "Track", i: -1 },
  { l: "Re-Open", i: -3 }
];

export const USER_COLS: ColumnDef[] = [
  { l: "Ticket Raised", i: 0 },
  { l: "Ticket No", i: 6 },
  { l: "Expected Date", i: 5 },
  { l: "Issue / Query", i: 3 },
  { l: "Current status", i: -2 },
  { l: "Track", i: -1 },
  { l: "Re-Open", i: -3 }
];

export const STEPS: Step[] = [
  { n: "Update sales person", p: 8, a: 9, s: 10, d: 12, r: 13 },
  { n: "Inform to client", p: 14, a: 15, s: 16, d: 17, r: 18 },
  { n: "Revised-Update sales person", p: 19, a: 20, s: 21, d: 22, r: 23 },
  { n: "Inform to client (Revised Date)", p: 24, a: 25, s: 26, d: 27, r: 28 },
  { n: "Issue Status", p: 29, a: 30, s: 31, d: 32, r: 33 }
];

export const ROWS_PER_PAGE = 10;
