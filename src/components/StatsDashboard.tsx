import { useMemo } from 'react';
import { CCTVStats, CCTVItem } from '../types/cctv';
import { Activity, ShieldCheck, AlertTriangle, AlertCircle, Play, RefreshCw, Zap } from 'lucide-react';

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
            <span className="text-3xl font-extrabold font-mono text-white">{stats.total}</span>
            <span className="text-xs text-slate-400">個即時鏡頭</span>
          </div>
          <p className="text-[11px] text-slate-500">涵蓋高公局主要國道與快速公路</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">🟢 連線正常 (Online)</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-emerald-400">{stats.online}</span>
            <span className="text-xs font-semibold text-emerald-400/80">({stats.onlineRate}%)</span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${stats.onlineRate}%` }}></div>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">🟡 連線不穩 / 高延遲</span>
            <AlertTriangle className="w-5 h-5 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-amber-400">{stats.unstable}</span>
            <span className="text-xs text-slate-400">
              ({stats.total > 0 ? Math.round((stats.unstable / stats.total) * 100) : 0}%)
            </span>
          </div>
          <p className="text-[11px] text-amber-400/80">回應時間大於 1000ms 或封包延遲</p>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">🔴 斷線 / 故障 (Offline)</span>
            <AlertCircle className="w-5 h-5 text-rose-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-3xl font-extrabold font-mono text-rose-400">{stats.offline}</span>
            <span className="text-xs text-slate-400">
              ({stats.total > 0 ? Math.round((stats.offline / stats.total) * 100) : 0}%)
            </span>
          </div>
          <p className="text-[11px] text-rose-400/70">需進行設備硬體檢修</p>
        </div>

      </div>

      {/* Main Grid: Highways & Regions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Highway Breakdown Section */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              國道/公路三色健康度分析
            </h3>
            <span className="text-xs text-slate-400 font-mono">By Road Breakdown</span>
          </div>

          <div className="space-y-3.5">
            {Object.entries(stats.roadBreakdown).map(([roadName, data]) => {
              const rate = data.total > 0 ? Math.round((data.online / data.total) * 100) : 0;
              const unstableCount = data.unstable !== undefined ? data.unstable : (data.total - data.online - data.offline);
              const unstableRate = data.total > 0 ? Math.round((unstableCount / data.total) * 100) : 0;
              const offlineRate = data.total > 0 ? Math.round((data.offline / data.total) * 100) : 0;
              return (
                <div key={roadName} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-slate-200">{roadName}</span>
                    <span className="font-mono text-slate-400">
                      <strong className="text-emerald-400">{data.online}</strong> 正常 /{' '}
                      <strong className="text-amber-400">{unstableCount}</strong> 不穩 /{' '}
                      <strong className="text-rose-400">{data.offline}</strong> 斷線
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/80 flex">
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${rate}%` }} title={`正常: ${rate}%`}></div>
                    <div className="bg-amber-500 h-full transition-all" style={{ width: `${unstableRate}%` }} title={`不穩: ${unstableRate}%`}></div>
                    <div className="bg-rose-500 h-full transition-all" style={{ width: `${offlineRate}%` }} title={`離線: ${offlineRate}%`}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Regional Distribution Section */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              全台區域健康度覆蓋統計
            </h3>
            <span className="text-xs text-slate-400 font-mono">Regional Zones</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {Object.entries(regionBreakdown).map(([region, item]) => {
              const rate = item.total > 0 ? Math.round((item.online / item.total) * 100) : 0;
              return (
                <div key={region} className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-white">{region}區域</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">{rate}% 正常</span>
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-slate-200">
                    {item.total} <span className="text-xs font-normal text-slate-500">個鏡頭</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 pt-1 font-mono">
                    <span className="text-emerald-400">● 正常: {item.online}</span>
                    <span className="text-amber-400">▲ 不穩: {item.unstable}</span>
                    <span className="text-rose-400">✖ 離線: {item.offline}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Priority Attention List (Offline or High Latency CCTVs) */}
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">重點關心與異常鏡頭追蹤 ({issueCctvs.length})</h3>
          </div>
          <span className="text-xs text-slate-400">包含黃燈（連線不穩）與紅燈（斷線異常）</span>
        </div>

        {issueCctvs.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">
            🎉 目前全台監視器連線狀況良好，無異常斷線或不穩！
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {issueCctvs.map(cctv => (
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
                    {cctv.status === 'offline' ? '狀態: 訊號中斷' : `Ping: ${cctv.responseTimeMs || 0}ms`} • {cctv.region}
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
