import { useState, useMemo, useEffect } from 'react';
import { CCTVItem, RoadLayerType } from '../types/cctv';
import { getCctvPlaceholderSvg } from '../utils/cctvPlaceholder';
import { Play, RefreshCw, Filter, ArrowUpDown, Radio, Layers, Building2, ShieldCheck } from 'lucide-react';

interface CctvListProps {
  cctvs: CCTVItem[];
  onSelectCctv: (cctv: CCTVItem) => void;
  onCheckStatus: (cctvId: string) => void;
  onMarkOffline?: (cctvId: string) => void;
  onShareCamera: (cctv: CCTVItem) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  roadFilter: string;
  setRoadFilter: (road: string) => void;
  regionFilter: string;
  setRegionFilter: (region: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  layerFilter: RoadLayerType;
  setLayerFilter: (layer: RoadLayerType) => void;
  cityFilter: string;
  setCityFilter: (city: string) => void;
}

export const CctvList: React.FC<CctvListProps> = ({
  cctvs,
  onSelectCctv,
  onCheckStatus,
  onMarkOffline,
  searchQuery,
  roadFilter,
  setRoadFilter,
  regionFilter,
  setRegionFilter,
  statusFilter,
  setStatusFilter,
  layerFilter,
  setLayerFilter,
  cityFilter,
  setCityFilter,
}) => {
  const [sortBy, setSortBy] = useState<'road' | 'status' | 'responseTime' | 'cctvId'>('road');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [displayLimit, setDisplayLimit] = useState<number>(24);

  // Reset pagination limit when filters change
  useEffect(() => {
    setDisplayLimit(24);
  }, [searchQuery, roadFilter, regionFilter, statusFilter, layerFilter, cityFilter, sortBy, sortOrder]);

  const uniqueCities = useMemo(() => {
    const set = new Set<string>();
    cctvs.forEach(c => {
      if (c.city && c.city !== '跨區/國道' && c.city !== '公路局省道') {
        set.add(c.city);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-TW'));
  }, [cctvs]);

  const uniqueRoads = useMemo(() => {
    const roads = Array.from(new Set(cctvs.map(c => c.roadName)));
    return roads.sort((a, b) => a.localeCompare(b, 'zh-TW'));
  }, [cctvs]);

  // Filter & Sort Logic
  const processedCctvs = useMemo(() => {
    return cctvs
      .filter(c => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchLocation = c.locationName.toLowerCase().includes(q);
          const matchRoad = c.roadName.toLowerCase().includes(q);
          const matchId = c.cctvId.toLowerCase().includes(q);
          const matchCity = c.city?.toLowerCase().includes(q);
          const matchMileage = c.mileage?.toLowerCase().includes(q);
          if (!matchLocation && !matchRoad && !matchId && !matchCity && !matchMileage) return false;
        }

        if (layerFilter !== 'all' && c.layerType !== layerFilter) return false;
        if (cityFilter !== 'all' && c.city !== cityFilter) return false;
        if (roadFilter !== 'all' && c.roadName !== roadFilter && c.roadId !== roadFilter) return false;
        if (regionFilter !== 'all' && c.region !== regionFilter) return false;
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'road') {
          cmp = a.roadName.localeCompare(b.roadName, 'zh-TW');
        } else if (sortBy === 'status') {
          cmp = a.status.localeCompare(b.status);
        } else if (sortBy === 'responseTime') {
          cmp = (a.responseTimeMs || 0) - (b.responseTimeMs || 0);
        } else {
          cmp = a.cctvId.localeCompare(b.cctvId);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [cctvs, searchQuery, layerFilter, cityFilter, roadFilter, regionFilter, statusFilter, sortBy, sortOrder]);

  const visibleCctvs = useMemo(() => {
    return processedCctvs.slice(0, displayLimit);
  }, [processedCctvs, displayLimit]);

  return (
    <div className="space-y-4">
      
      {/* Filter Control Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Road Layer Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <span className="text-[10px] text-slate-400 font-semibold px-2 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              路網:
            </span>
            <button
              onClick={() => setLayerFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                layerFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              全部
            </button>
            <button
              onClick={() => setLayerFilter('freeway')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                layerFilter === 'freeway' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🛣️ 國道
            </button>
            <button
              onClick={() => setLayerFilter('highway')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                layerFilter === 'highway' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🚗 省道
            </button>
            <button
              onClick={() => setLayerFilter('city')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                layerFilter === 'city' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🏙️ 市區道路
            </button>
          </div>

          {/* City Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Building2 className="w-3.5 h-3.5 text-purple-400" />
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">全台所有縣市</option>
              {uniqueCities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Region Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">全部區域 (北部/中部/南部/東部)</option>
              <option value="北部">北部區域</option>
              <option value="中部">中部區域</option>
              <option value="南部">南部區域</option>
              <option value="東部">東部區域</option>
            </select>
          </div>

          {/* Road Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <select
              value={roadFilter}
              onChange={(e) => setRoadFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs max-w-[140px] truncate"
            >
              <option value="all">所有道路</option>
              {uniqueRoads.map(road => (
                <option key={road} value={road}>{road}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="all">全部狀態 (正常/不穩/離線)</option>
              <option value="online">🟢 正常連線</option>
              <option value="unstable">🟡 連線不穩</option>
              <option value="offline">🔴 訊號中斷</option>
            </select>
          </div>

          {/* Reset Filters Button */}
          {(layerFilter !== 'all' || cityFilter !== 'all' || roadFilter !== 'all' || regionFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setLayerFilter('all');
                setCityFilter('all');
                setRoadFilter('all');
                setRegionFilter('all');
                setStatusFilter('all');
              }}
              className="px-2.5 py-1.5 rounded-xl bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 text-xs transition font-semibold"
            >
              重置條件
            </button>
          )}

        </div>

        {/* Sort Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="road">依道路名稱</option>
              <option value="status">依健康狀態</option>
              <option value="responseTime">依延遲時間</option>
              <option value="cctvId">依鏡頭編號</option>
            </select>
          </div>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition font-mono"
            title="切換升冪/降冪排序"
          >
            {sortOrder === 'asc' ? '▲' : '▼'}
          </button>
        </div>

      </div>

      {/* Result Metrics Count */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-2">
        <div>
          符合條件鏡頭: <strong className="text-white font-mono">{processedCctvs.length.toLocaleString()}</strong> 支
          {displayLimit < processedCctvs.length && (
            <span className="text-slate-500 ml-1">
              (目前顯示前 {displayLimit} 筆)
            </span>
          )}
        </div>
      </div>

      {/* CCTV Grid View */}
      {processedCctvs.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">
          <Radio className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
          <p className="text-sm font-semibold">找不到符合篩選條件的監視器鏡頭</p>
          <p className="text-xs text-slate-500">請嘗試更換道路、區域或搜尋關鍵字</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleCctvs.map(cctv => {
            const hasError = imgErrors[cctv.cctvId];
            const placeholderSvg = getCctvPlaceholderSvg(
              cctv.locationName,
              cctv.roadName,
              hasError ? '伺服器訊號中斷' : '即時影像載入中'
            );
            const streamSrc = hasError ? placeholderSvg : (cctv.snapshotUrl || cctv.videoUrl || placeholderSvg);
            const sourceCount = cctv.sources?.length || 1;

            const layerBadge =
              cctv.layerType === 'freeway' ? '🛣️ 國道' :
              cctv.layerType === 'highway' ? '🚗 省道' :
              cctv.layerType === 'city' ? '🏙️ 市區' : '🌊 水利';

            return (
              <div
                key={cctv.cctvId}
                className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-lg hover:border-slate-700 transition flex flex-col group"
              >
                {/* Snapshot Player Preview Box */}
                <div
                  onClick={() => onSelectCctv(cctv)}
                  className="relative aspect-video bg-black cursor-pointer overflow-hidden flex items-center justify-center"
                >
                  <img
                    src={streamSrc}
                    alt={cctv.locationName}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={() => {
                      setImgErrors(prev => ({ ...prev, [cctv.cctvId]: true }));
                      onMarkOffline?.(cctv.cctvId);
                    }}
                  />

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="p-3 bg-blue-600/90 rounded-full text-white shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>

                  {/* Top Badges */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="bg-slate-950/80 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg border border-slate-800">
                      {layerBadge}
                    </span>
                    {sourceCount > 1 && (
                      <span className="bg-purple-950/80 backdrop-blur-md text-purple-300 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border border-purple-800/80 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-purple-400" />
                        雙源
                      </span>
                    )}
                  </div>

                  {/* Status Indicator */}
                  <div className="absolute top-2.5 right-2.5 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg border border-slate-800 text-[10px] font-bold flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${
                      cctv.status === 'online' ? 'bg-emerald-400 animate-pulse' :
                      cctv.status === 'unstable' ? 'bg-amber-400' : 'bg-rose-500'
                    }`}></span>
                    <span className="text-slate-200">
                      {cctv.status === 'online' ? '連線中' : cctv.status === 'unstable' ? '不穩' : '斷線'}
                    </span>
                  </div>
                </div>

                {/* Content Metadata */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-blue-400">{cctv.roadName} {cctv.mileage || ''}</span>
                      <span className="font-mono text-[11px]">{cctv.city || cctv.region}</span>
                    </div>
                    <h3
                      onClick={() => onSelectCctv(cctv)}
                      className="text-sm font-bold text-white mt-1 cursor-pointer hover:text-blue-400 transition line-clamp-1"
                      title={cctv.locationName}
                    >
                      {cctv.locationName}
                    </h3>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono text-[10px]">
                      {cctv.responseTimeMs != null ? `${cctv.responseTimeMs}ms` : '未測速'}
                    </span>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => onCheckStatus(cctv.cctvId)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                        title="測速檢查"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onSelectCctv(cctv)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition shadow-md shadow-blue-900/30 flex items-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>播放</span>
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Load More */}
      {displayLimit < processedCctvs.length && (
        <div className="text-center pt-4">
          <button
            onClick={() => setDisplayLimit(prev => prev + 24)}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition shadow-lg"
          >
            載入更多監視器 (+24 支)
          </button>
        </div>
      )}

    </div>
  );
};
