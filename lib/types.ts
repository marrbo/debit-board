// lib/types.ts
export interface SearchItem {
  patternId: string;
  query: string;
  fileName: string;
  path: string;
  hitCount: number;
  hits: Hits[];
  azureCollection: string;
  project: string;
  repository: string;
  branch: string;
}

export interface Hits {
    charOffset: number;
    length: number;
    line: number;
    column: number;
    codeSnippet: string | null;
    type: string | null
}

export interface SearchResponse {
  query: any;
  results: {
    count: number;
    values: SearchItem[];
  };
}

export interface Settings {
  instanceUrl: string;
  azureCollection: string;
  pat: string;
  username?: string;
  defaultProject?: string;
  defaultRepository?: string;
  reportTitle?: string;
  ignoreTlsErrors?: boolean; // <-- NOVO CAMPO
}

export interface ChartDataPoint {
  label: string;
  value: number;
}