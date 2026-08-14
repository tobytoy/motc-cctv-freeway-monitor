import { useState, useMemo, useEffect } from 'react';
import { CCTVItem } from '../types/cctv';
import { getCctvPlaceholderSvg } from '../utils/cctvPlaceholder';
import { Play, RefreshCw, Filter, ArrowUpDown, Radio, Share2 } from 'lucide-react';

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
}

export const CctvList: React.FC<CctvListProps> = ({
  cctvs,
  onSelectCctv,
  onCheckStatus,
  onMarkOffline,
  onShareCamera,
  searchQuery,
  roadFilter,
  setRoadFilter,
  regionFilter,
  setRegionFilter,
  statusFilter,
  setStatusFilter,
}) => {
  const [sortBy, setSortBy] = useState<'road' | 'status' | 'responseTime' | 'cctvId'>('road');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  // Performance P1: Batch pagination limit (default 24 cards)
  const [displayLimit, setDisplayLimit] = useState<number>(24);

  // Reset pagination limit when filters change
  useEffect(() => {
    setDisplayLimit(24);
  }, [searchQuery, roadFilter, regionFilter, statusFilter, sortBy, sortOrder]);

  // Filter & Sort Logic
  const processedCctvs = useMemo(() => {
    return cctvs
      .filter(c => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchLocation = c.locationName.toLowerCase().includes(q);
          const matchRoad = c.roadName.toLowerCase().includes(q);
          const matchId = c.cctvId.toLowerCase().includes(q);
          const matchMileage = c.mileage?.toLowerCase().includes(q);
          if (!matchLocation && !matchRoad && !matchId && !matchMileage) return false;
        }

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
  }, [cctvs, searchQuery, roadFilter, regionFilter, statusFilter, sortBy, sortOrder]);

  // Slice visible items for batch rendering
  const visibleCctvs = useMemo(() => {
    return processedCctvs.slice(0, displayLimit);
  }, [processedCctvs, displayLimit]);

  const uniqueRoads = useMemo(() => {
    const roads = Array.from(new Set(cctvs.map(c => c.roadName)));
    return roads.sort((a, b) => a.localeCompare(b, 'zh-TW'));
  }, [cctvs]);

  return (
    <div className="space-y-4">
      
      {/* Filter Control Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Road Filter Select */}
          <div className="flex items-center space-x-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400 font-medium">路線:</span>
            <select
              value={roadFilter}
              onChange={(e) => setRoadFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">全選公路 (全部)</option>
              {uniqueRoads.map(road => (
                <option key={road} value={road}>{road}</option>
              ))}
            </select>
          </div>

          {/* Region Filter Select */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">區域:</span>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">全部區域</option>
              <option value="北部">北部 (基北桃園竹)</option>
              <option value="中部">中部 (苗台中彰雲)</option>
              <option value="南部">南部 (嘉台南高雄)</option>
              <option value="東部">東部 (宜花東)</option>
            </select>
          </div>

          {/* Status Filter Select */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">狀態:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">全部狀態 (綠/黃/紅)</option>
              <option value="online">🟢 ● 連線正常</option>
              <option value="unstable">🟡 ▲ 連線不穩</option>
              <option value="offline">🔴 ✖ 離線/故障</option>
            </select>
          </div>

        </div>

        {/* Sorting Options */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1 text-slate-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>排序方式:</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'road' | 'status' | 'responseTime' | 'cctvId')}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="road">按國道編號</option>
            <option value="status">按運作狀態</option>
            <option value="responseTime">按 Ping 延遲時間</option>
            <option value="cctvId">按監視器代碼</option>
          </select>
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 font-mono font-bold"
            title="切換升降序"
          >
            {sortOrder === 'asc' ? '↑ 升序' : '↓ 降序'}
          </button>
        </div>

      </div>

      {/* CCTV Grid View */}
      {processedCctvs.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
          <Radio className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-300">未找到符合條件的 CCTV 監視器</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            請嘗試調整關鍵字搜尋或重置路線、區域篩選條件。
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleCctvs.map(cctv => {
              const placeholderSvg = getCctvPlaceholderSvg(cctv.locationName, cctv.roadName, '即時訊號傳輸中');
              const hasError = imgErrors[cctv.cctvId];
              const snapshotSrc = hasError ? placeholderSvg : (cctv.snapshotUrl || cctv.videoUrl || placeholderSvg);

              return (
                <div
                  key={cctv.cctvId}
                  className="bg-slate-900 border border-slate-800/80 hover:border-blue-500/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col group"
                >
                  
                  {/* Card Header Tag */}
                  <div className="p-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-600/20 text-blue-400 border border-blue-500/30">
                      {cctv.roadName} {cctv.mileage || ''}
                    </span>
                    
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      cctv.status === 'online' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      cctv.status === 'unstable' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]' :
                      'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {cctv.status === 'online' ? '● 正常' : cctv.status === 'unstable' ? '▲ 連線不穩' : '✖ 斷線'}
                    </span>
                  </div>

                  {/* Card Snapshot Image Stage */}
                  <div className="relative aspect-video bg-slate-950 overflow-hidden group-hover:opacity-95 transition-opacity">
                    <img
                      src={snapshotSrc}
                      alt={cctv.locationName}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = placeholderSvg;
                        setImgErrors(prev => ({ ...prev, [cctv.cctvId]: true }));
                        onMarkOffline?.(cctv.cctvId);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"></div>
                    
                    <button
                      onClick={() => onSelectCctv(cctv)}
                      className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-blue-600/90 text-white flex items-center justify-center shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:scale-110"
                      title="播放即時畫面"
                    >
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </button>

                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-slate-300">
                      <span className="bg-slate-900/80 backdrop-blur px-2 py-0.5 rounded border border-slate-800 truncate max-w-[70%]">
                        {cctv.direction || '雙向'} • {cctv.region}
                      </span>
                      {cctv.status === 'offline' ? (
                        <span className="text-rose-400 bg-slate-900/80 backdrop-blur px-1.5 py-0.5 rounded border border-slate-800 font-semibold">
                          ✖ 離線
                        </span>
                      ) : cctv.status === 'unstable' ? (
                        <span className="font-mono text-amber-400 bg-slate-900/80 backdrop-blur px-1.5 py-0.5 rounded border border-slate-800 font-semibold">
                          {cctv.responseTimeMs || 0}ms (不穩)
                        </span>
                      ) : cctv.responseTimeMs !== undefined ? (
                        <span className="font-mono text-emerald-400 bg-slate-900/80 backdrop-blur px-1.5 py-0.5 rounded border border-slate-800">
                          {cctv.responseTimeMs}ms
                        </span>
                      ) : (
                        <span className="text-slate-400 bg-slate-900/80 backdrop-blur px-1.5 py-0.5 rounded border border-slate-800">
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Info & Details */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {cctv.locationName}
                      </h4>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                        ID: {cctv.cctvId}
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                      <button
                        onClick={() => onSelectCctv(cctv)}
                        className="col-span-1 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-1.5 px-2 rounded-lg text-xs flex items-center justify-center gap-1 transition shadow-md shadow-blue-900/30"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>影像</span>
                      </button>
                      
                      <button
                        onClick={() => onCheckStatus(cctv.cctvId)}
                        className="col-span-1 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-1.5 px-2 rounded-lg text-xs flex items-center justify-center gap-1 border border-slate-700 transition"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Ping</span>
                      </button>

                      {/* F3: Share button */}
                      <button
                        onClick={() => {
                          onShareCamera(cctv);
                          setCopiedId(cctv.cctvId);
                          setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="col-span-1 w-full bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 font-semibold py-1.5 px-2 rounded-lg text-xs flex items-center justify-center gap-1 border border-slate-700 hover:border-emerald-500/40 transition"
                        title="複製分享連結"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{copiedId === cctv.cctvId ? '已複製' : '分享'}</span>
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Batch Pagination Control Footer */}
          {displayLimit < processedCctvs.length && (
            <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 text-center flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur shadow-xl">
              <span className="text-xs text-slate-400 font-medium">
                已顯示 <strong className="text-white font-mono">{visibleCctvs.length}</strong> 筆 / 篩選條件共 <strong className="text-blue-400 font-mono">{processedCctvs.length}</strong> 筆監控設備
              </span>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setDisplayLimit(prev => prev + 32)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2 rounded-xl text-xs transition shadow-lg shadow-blue-900/40 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>載入更多 (+32 筆)</span>
                </button>

                <button
                  onClick={() => setDisplayLimit(processedCctvs.length)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-3 py-2 rounded-xl text-xs border border-slate-700 transition"
                >
                  載入全部 ({processedCctvs.length})
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
