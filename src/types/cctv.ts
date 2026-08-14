export type CCTVStatus = 'online' | 'offline' | 'unstable' | 'checking' | 'unknown';

export type TaiwanRegion = '北部' | '中部' | '南部' | '東部';

export type DirectionType = '北向' | '南向' | '東向' | '西向' | '雙向' | '未知';

export interface CCTVItem {
  cctvId: string;
  roadId: string;
  roadName: string;
  locationName: string;
  longitude: number;
  latitude: number;
  videoUrl: string;
  snapshotUrl?: string;
  status: CCTVStatus;
  lastChecked?: string;
  responseTimeMs?: number;
  region: TaiwanRegion;
  direction?: DirectionType;
  mileage?: string;
}

export interface CCTVFilterOptions {
  searchQuery: string;
  roadFilter: string;
  regionFilter: string;
  statusFilter: string;
  sortBy: 'road' | 'status' | 'responseTime' | 'cctvId';
  sortOrder: 'asc' | 'desc';
}

export interface CCTVStats {
  total: number;
  online: number;
  offline: number;
  unstable: number;
  unknown: number;
  onlineRate: number;
  roadBreakdown: Record<string, { total: number; online: number; offline: number; unstable: number }>;
  lastUpdated: string;
}
