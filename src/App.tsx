import { useEffect, useState, useMemo } from 'react';
import { CCTVItem, CCTVStats } from './types/cctv';
import { FALLBACK_CCTVS } from './data/fallbackCCTV';
import { fetchCctvListClient, probeSingleCctvStatus } from './utils/cctvParser';
import { Header } from './components/Header';
import { CctvMap } from './components/CctvMap';
import { CctvList } from './components/CctvList';
import { CctvPlayerModal } from './components/CctvPlayerModal';
import { StatsDashboard } from './components/StatsDashboard';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [cctvs, setCctvs] = useState<CCTVItem[]>(FALLBACK_CCTVS);
  const [activeTab, setActiveTab] = useState<'map' | 'list' | 'stats'>('map');
  const [searchQuery, setSearchQuery] = useState('');
  const [roadFilter, setRoadFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dataSource, setDataSource] = useState<'live' | 'json' | 'fallback'>('json');

  const [selectedCctv, setSelectedCctv] = useState<CCTVItem | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load CCTV dataset
  const loadCctvData = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    try {
      const result = await fetchCctvListClient();
      setCctvs(result.data);
      setDataSource(result.source);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.warn('Failed to load CCTV data, using fallback:', err);
      setCctvs(FALLBACK_CCTVS);
      setDataSource('fallback');
      setErrorMsg('已載入預設全台國道 CCTV 資料');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCctvData();
  }, []);

  // Batch status check on client side
  const handleCheckBatchStatus = async () => {
    setIsCheckingStatus(true);
    try {
      // Test first 15 CCTVs for quick response
      const subset = cctvs.slice(0, 15);
      const probeResults = await Promise.all(
        subset.map(async (item) => {
          const res = await probeSingleCctvStatus(item);
          return { cctvId: item.cctvId, status: res.status, responseTimeMs: res.responseTimeMs };
        })
      );

      const statusMap = new Map(probeResults.map(r => [r.cctvId, r]));

      setCctvs(prev => prev.map(item => {
        const match = statusMap.get(item.cctvId);
        if (match) {
          return {
            ...item,
            status: match.status,
            responseTimeMs: match.responseTimeMs,
            lastChecked: new Date().toISOString()
          };
        }
        return item;
      }));
    } catch (err) {
      console.error('Batch status probe failed:', err);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Single CCTV status check
  const handleCheckSingleStatus = async (cctvId: string) => {
    const target = cctvs.find(c => c.cctvId === cctvId);
    if (!target) return;

    try {
      const res = await probeSingleCctvStatus(target);
      setCctvs(prev => prev.map(item => {
        if (item.cctvId === cctvId) {
          return {
            ...item,
            status: res.status,
            responseTimeMs: res.responseTimeMs,
            lastChecked: new Date().toISOString()
          };
        }
        return item;
      }));

      if (selectedCctv?.cctvId === cctvId) {
        setSelectedCctv(prev => prev ? {
          ...prev,
          status: res.status,
          responseTimeMs: res.responseTimeMs
        } : null);
      }
    } catch (err) {
      console.error('Single status probe failed:', err);
    }
  };

  // Compute overall stats
  const stats: CCTVStats = useMemo(() => {
    const total = cctvs.length;
    let online = 0;
    let offline = 0;
    let unstable = 0;
    let unknown = 0;

    const roadBreakdown: Record<string, { total: number; online: number; offline: number }> = {};

    cctvs.forEach(c => {
      if (c.status === 'online') online++;
      else if (c.status === 'offline') offline++;
      else if (c.status === 'unstable') unstable++;
      else unknown++;

      if (!roadBreakdown[c.roadName]) {
        roadBreakdown[c.roadName] = { total: 0, online: 0, offline: 0 };
      }
      roadBreakdown[c.roadName].total++;
      if (c.status === 'online') roadBreakdown[c.roadName].online++;
      if (c.status === 'offline') roadBreakdown[c.roadName].offline++;
    });

    const onlineRate = total > 0 ? Math.round((online / total) * 100) : 0;

    return {
      total,
      online,
      offline,
      unstable,
      unknown,
      onlineRate,
      roadBreakdown,
      lastUpdated
    };
  }, [cctvs, lastUpdated]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Navigation & Header */}
      <Header
        stats={stats}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRefreshAll={loadCctvData}
        onCheckBatchStatus={handleCheckBatchStatus}
        isRefreshing={isRefreshing}
        isCheckingStatus={isCheckingStatus}
        dataSource={dataSource}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        
        {/* Error / Notice Banner */}
        {errorMsg && (
          <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between text-xs text-amber-300 backdrop-blur-md">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-amber-400 hover:text-amber-200"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab 1: Taiwan Map View */}
        {activeTab === 'map' && (
          <CctvMap
            cctvs={cctvs}
            onSelectCctv={setSelectedCctv}
            onCheckStatus={handleCheckSingleStatus}
            selectedCctvId={selectedCctv?.cctvId}
            roadFilter={roadFilter}
            setRoadFilter={setRoadFilter}
            regionFilter={regionFilter}
            setRegionFilter={setRegionFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        )}

        {/* Tab 2: CCTV List View */}
        {activeTab === 'list' && (
          <CctvList
            cctvs={cctvs}
            onSelectCctv={setSelectedCctv}
            onCheckStatus={handleCheckSingleStatus}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            roadFilter={roadFilter}
            setRoadFilter={setRoadFilter}
            regionFilter={regionFilter}
            setRegionFilter={setRegionFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        )}

        {/* Tab 3: Health & Stats Dashboard */}
        {activeTab === 'stats' && (
          <StatsDashboard
            stats={stats}
            cctvs={cctvs}
            onSelectCctv={setSelectedCctv}
            onCheckStatus={handleCheckSingleStatus}
          />
        )}

      </main>

      {/* Live Video / Snapshot Player Modal */}
      <CctvPlayerModal
        cctv={selectedCctv}
        onClose={() => setSelectedCctv(null)}
        onCheckStatus={handleCheckSingleStatus}
      />

      {/* Footer Status Bar */}
      <footer className="h-9 px-4 sm:px-8 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
            <span>GitHub Pages (Client SPA)</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
            <span>Data Feed: MOTC Freeway CCTV XML v2.0</span>
          </div>
        </div>
        <div className="text-slate-400">
          LAST UPDATED: {lastUpdated}
        </div>
      </footer>

    </div>
  );
}
