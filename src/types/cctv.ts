export type CCTVStatus = 'online' | 'offline' | 'unstable' | 'checking' | 'unknown';

export type TaiwanRegion = '北部' | '中部' | '南部' | '東部';

export type DirectionType = '北向' | '南向' | '東向' | '西向' | '雙向' | '未知';

export type RoadLayerType = 'all' | 'freeway' | 'highway' | 'city' | 'water' | 'scenic';

export interface CCTVStreamSource {
  id: string;
  name: string; // e.g. "官方高清 HLS", "市府備用串流", "即時快照輪播"
  type: 'hls' | 'mjpg' | 'flv' | 'snapshot';
  url: string;
  quality?: '1080p' | '720p' | '480p' | '360p' | 'SD';
  isPrimary?: boolean;
}

export interface CCTVItem {
  cctvId: string;
  roadId: string;
  roadName: string;
  locationName: string;
  longitude: number;
  latitude: number;
  type?: string;
  layerType?: RoadLayerType;
  city?: string;
  sources?: CCTVStreamSource[];
  activeSourceIndex?: number;
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
  layerFilter: RoadLayerType;
  cityFilter: string;
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
  layerBreakdown: Record<string, { total: number; online: number; offline: number; unstable: number }>;
  cityBreakdown: Record<string, number>;
  roadBreakdown: Record<string, { total: number; online: number; offline: number; unstable: number }>;
  lastUpdated: string;
}
