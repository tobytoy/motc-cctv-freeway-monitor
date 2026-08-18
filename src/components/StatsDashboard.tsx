import { useMemo } from 'react';
import { CCTVStats, CCTVItem } from '../types/cctv';
import { Activity, ShieldCheck, AlertTriangle, AlertCircle, Play, RefreshCw, Layers, Building2 } from 'lucide-react';

interface StatsDashboardProps {
  stats: CCTVStats;
  cctvs: CCTVItem[];
  onSelectCctv: (cctv: CCTVItem) => void;
  onCheckStatus: (cctvId: string) => void;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  stats,
  cctvs,
  onSelectCctv,
  onCheckStatus,
}) => {
  // Region Breakdown
  const regionBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; online: number; offline: number; unstable: number }> = {
      '北部': { total: 0, online: 0, offline: 0, unstable: 0 },
      '中部': { total: 0, online: 0, offline: 0, unstable: 0 },
      '南部': { total: 0, online: 0, offline: 0, unstable: 0 },
      '東部': { total: 0, online: 0, offline: 0, unstable: 0 },
    };

    cctvs.forEach(c => {
      if (counts[c.region]) {
        counts[c.region].total++;
        if (c.status === 'online') counts[c.region].online++;
        else if (c.status === 'offline') counts[c.region].offline++;
        else if (c.status === 'unstable') counts[c.region].unstable++;
      }
    });

    return counts;
  }, [cctvs]);

  // Road Layer Breakdown
  const layerBreakdown = useMemo(() => {
    const counts: Record<string, { total: number; online: number; offline: number; unstable: number }> = {
      '🛣️ 國道高速公路': { total: 0, online: 0, offline: 0, unstable: 0 },
      '🚗 省道快速道路': { total: 0, online: 0, offline: 0, unstable: 0 },
      '🏙️ 市區道路 (雙北/六都)': { total: 0, online: 0, offline: 0, unstable: 0 },
    };

    cctvs.forEach(c => {
      const key = c.layerType === 'freeway' ? '🛣️ 國道高速公路' :
                  c.layerType === 'highway' ? '🚗 省道快速道路' : '🏙️ 市區道路 (雙北/六都)';
      if (counts[key]) {
        counts[key].total++;
        if (c.status === 'online') counts[key].online++;
        else if (c.status === 'offline') counts[key].offline++;
        else if (c.status === 'unstable') counts[key].unstable++;
      }
    });

    return counts;
  }, [cctvs]);

  // City Breakdown Top 8
  const topCities = useMemo(() => {
    const counts: Record<string, number> = {};
    cctvs.forEach(c => {
      if (c.city && c.city !== '跨區/國道' && c.city !== '公路局省道') {
        counts[c.city] = (counts[c.city] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [cctvs]);

  // Multi-source enabled count
  const multiSourceCount = useMemo(() => {
    return cctvs.filter(c => c.sources && c.sources.length > 1).length;
  }, [cctvs]);

  // Unstable / Offline priority list
  const issueCctvs = useMemo(() => {
    return cctvs.filter(c => c.status === 'offline' || c.status === 'unstable');
  }, [cctvs]);

  return (
    <div className="space-y-6">
      
      {/* Top 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">全台 CCTV 總量</span>
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-white">{stats.total.toLocaleString()}</span>
            <span className="text-xs text-slate-400">支全天候鏡頭</span>
          </div>
          <p className="text-[11px] text-slate-500">涵蓋高公局、公路局與全台市區路網</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">🟢 連線正常 (Online)</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-400">{stats.online.toLocaleString()}</span>
            <span className="text-xs font-semibold text-emerald-400/80">({stats.onlineRate}%)</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${stats.onlineRate}%` }}></div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">⚡ 雙源/多源覆蓋</span>
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-purple-400">{multiSourceCount.toLocaleString()}</span>
            <span className="text-xs text-purple-300">
              ({stats.total > 0 ? Math.round((multiSourceCount / stats.total) * 100) : 0}%)
            </span>
          </div>
          <p className="text-[11px] text-purple-400/80">支援 HLS 高清 + 備用快照自動容錯</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">🔴 斷線 / 需檢修</span>
            <AlertCircle className="w-5 h-5 text-rose-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-rose-400">{stats.offline.toLocaleString()}</span>
            <span className="text-xs text-slate-400">
              ({stats.total > 0 ? Math.round((stats.offline / stats.total) * 100) : 0}%)
            </span>
          </div>
          <p className="text-[11px] text-rose-400/70">自動切換備援或等待伺服器恢復</p>
        </div>

      </div>

      {/* Main Grid: Road Layers & Regional Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Layer Breakdown Section */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              三大路網分層統計與健康度
            </h3>
            <span className="text-xs text-slate-400 font-mono">Layer Classification</span>
          </div>

          <div className="space-y-4">
            {Object.entries(layerBreakdown).map(([layerName, data]) => {
              const rate = data.total > 0 ? Math.round((data.online / data.total) * 100) : 0;
              return (
                <div key={layerName} className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-200 text-sm">{layerName}</span>
                    <span className="font-mono text-slate-400">
                      總計 <strong className="text-white font-bold">{data.total.toLocaleString()}</strong> 支 • 妥善率 <strong className="text-emerald-400 font-bold">{rate}%</strong>
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800 flex">
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${rate}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-500 pt-1">
                    <span className="text-emerald-400">🟢 正常: {data.online}</span>
                    <span className="text-amber-400">🟡 不穩: {data.unstable}</span>
                    <span className="text-rose-400">🔴 離線: {data.offline}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Cities Coverage */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-400" />
              主要都會區市區道路 CCTV 統計
            </h3>
            <span className="text-xs text-slate-400 font-mono">Urban City Rankings</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {topCities.map(([cityName, count]) => (
              <div key={cityName} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-white">{cityName}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300">市區網</span>
                </div>
                <div className="text-xl font-extrabold font-mono text-slate-200">
                  {count} <span className="text-xs font-normal text-slate-500">處監控點</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Regional Zones Distribution */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            全台四大地理分區妥善率統計
          </h3>
          <span className="text-xs text-slate-400 font-mono">Regional Zones</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(regionBreakdown).map(([region, item]) => {
            const rate = item.total > 0 ? Math.round((item.online / item.total) * 100) : 0;
            return (
              <div key={region} className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white">{region}區域</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">{rate}% 正常</span>
                </div>
                <div className="text-2xl font-extrabold font-mono text-slate-200">
                  {item.total.toLocaleString()} <span className="text-xs font-normal text-slate-500">個鏡頭</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 pt-1 font-mono">
                  <span className="text-emerald-400">● {item.online}</span>
                  <span className="text-amber-400">▲ {item.unstable}</span>
                  <span className="text-rose-400">✖ {item.offline}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Priority Attention List */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">重點異常鏡頭追蹤 ({issueCctvs.length})</h3>
          </div>
          <span className="text-xs text-slate-400">黃燈（連線不穩）與紅燈（斷線異常）</span>
        </div>

        {issueCctvs.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            🎉 目前全台監視器連線狀況良好，無異常斷線！
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {issueCctvs.slice(0, 18).map(cctv => (
              <div
                key={cctv.cctvId}
                className={`bg-slate-950 p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                  cctv.status === 'offline' ? 'border-rose-900/40 hover:border-rose-700/60' : 'border-amber-900/40 hover:border-amber-700/60'
                }`}
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-600/20 text-blue-400">
                      {cctv.roadName}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      cctv.status === 'offline' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {cctv.status === 'offline' ? '🔴 斷線' : '🟡 連線不穩'}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-200 mt-1.5 line-clamp-1">{cctv.locationName}</h4>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {cctv.status === 'offline' ? '狀態: 訊號中斷' : `Ping: ${cctv.responseTimeMs || 0}ms`} • {cctv.city || cctv.region}
                  </p>
                </div>

                <div className="flex items-center space-x-1 shrink-0">
                  <button
                    onClick={() => onSelectCctv(cctv)}
                    className="p-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 transition"
                    title="觀看"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                  <button
                    onClick={() => onCheckStatus(cctv.cctvId)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="重測"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
