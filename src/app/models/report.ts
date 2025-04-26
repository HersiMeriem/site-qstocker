export interface Report {
  id: string;
  name: string;
  type: ReportType;
  generatedDate: Date;
  data: ReportData[];
  metadata: ReportMetadata;
}

export type ReportType = 'sales' | 'inventory' | 'users';

export interface ReportData {
  [key: string]: string | number;
}

export interface ReportMetadata {
  generatedBy: string;
  generationTime: number;
  recordsProcessed: number;
  lastUpdated?: string;
  dateDébut?: string;
  dateFin?: string;
}

export interface ReportCriteria {
  type: ReportType;
  startDate: string;
  endDate: string;
  name?: string;
}