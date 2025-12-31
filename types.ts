
export interface Step {
  n: string; // Name
  p: number; // Plan index in CSV
  a: number; // Actual index in CSV
  s: number; // Status index in CSV
  d: number; // Delay index in CSV
}

export interface ColumnDef {
  l: string; // Label
  i: number; // Index in CSV
}

export interface MilestoneInfo {
  n: string; // Current milestone name
  d: boolean; // Is fully done?
  idx: number; // Current active index
}

export interface User {
  name: string;
  isAdmin: boolean;
}

export type RawRow = string[];
