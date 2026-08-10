import { Camera, Map, List, BarChart3, RefreshCw, Search } from 'lucide-react';
import { CCTVStats } from '../types/cctv';

interface HeaderProps {
  stats: CCTVStats;
  activeTab: 'map' | 'list' | 'stats';
  setActiveTab: (tab: 'map' | 'list' | 'stats') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onRefreshAll: () => void;
  onCheckBatchStatus: () => void;
  isRefreshing: boolean;
  isCheckingStatus: boolean;
  dataSource: 'live' | 'json' | 'fallback';
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  onRefreshAll,
  onCheckBatchStatus,
  isRefreshing,
  isCheckingStatus,
  dataSource,
}) => {
  return (
    <header className="bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-40 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-blue-500/25 shrink-0">
              <Camera className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold leading-none text-white tracking-tight">
                  台灣國道 CCTV 即時監控儀表板
                </h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  dataSource === 'live' 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-ping"></span>
                  {dataSource === 'live' ? 'MOTC 即時' : '靜態資產包'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                TW Highway CCTV Network • 地圖監控 / 網路品質 / 即時影像
              </p>
            </div>
          </div>

          {/* Quick Metrics Bar - Monospace Telemetry */}
          <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-1 lg:pb-0">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">監控設備總數</span>
              <span className="text-xl font-mono font-bold text-blue-400">{stats.total.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-end border-l border-slate-800/80 pl-4 sm:pl-6">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">正常運作 ({stats.onlineRate}%)</span>
              <span className="text-xl font-mono font-bold text-emerald-400">{stats.online.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-end border-l border-slate-800/80 pl-4 sm:pl-6">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">異常 / 延遲</span>
              <span className="text-xl font-mono font-bold text-rose-400">{stats.offline + stats.unstable}</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 border-l border-slate-800/80 pl-4 sm:pl-6 shrink-0">
              <button
                onClick={onCheckBatchStatus}
                disabled={isCheckingStatus}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition disabled:opacity-50 shadow-sm"
                title="對重點路段 CCTV 進行 Ping 測試"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isCheckingStatus ? 'animate-spin' : ''}`} />
                {isCheckingStatus ? '測速中...' : '批次測速'}
              </button>

              <button
                onClick={onRefreshAll}
                disabled={isRefreshing}
                className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition disabled:opacity-50 shadow-sm"
                title="重新載入高公局 CCTV 最新資料"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                重新載入
              </button>
            </div>
          </div>

        </div>

        {/* View Tabs & Search Bar */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Navigation Tabs */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('map')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'map'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Map className="w-3.5 h-3.5 mr-1.5" />
              全台地圖視角
            </button>

            <button
              onClick={() => setActiveTab('list')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'list'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <List className="w-3.5 h-3.5 mr-1.5" />
              CCTV 清單檢視
            </button>

            <button
              onClick={() => setActiveTab('stats')}
              className={`flex-1 sm:flex-initial inline-flex items-center justify-center px-4 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'stats'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              健康度與分析
            </button>
          </div>

          {/* Quick Search Field */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋國道 (如: 國1)、里程 (如: 10K) 或地點..."
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-1.5 pl-9 pr-8 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
