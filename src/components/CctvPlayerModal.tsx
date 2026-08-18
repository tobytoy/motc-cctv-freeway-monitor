import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { CCTVItem, CCTVStreamSource } from '../types/cctv';
import { getCctvPlaceholderSvg } from '../utils/cctvPlaceholder';
import {
  X, Play, Pause, RefreshCw, Copy, Check, Maximize2, Radio,
  Wifi, MapPin, Video, Image as ImageIcon, Layers, AlertTriangle, ShieldCheck
} from 'lucide-react';

interface CctvPlayerModalProps {
  cctv: CCTVItem | null;
  onClose: () => void;
  onCheckStatus: (cctvId: string) => void;
  onMarkOffline?: (cctvId: string) => void;
}

export const CctvPlayerModal: React.FC<CctvPlayerModalProps> = ({
  cctv,
  onClose,
  onCheckStatus,
  onMarkOffline,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(3);
  const [lastUpdatedTime, setLastUpdatedTime] = useState<string>(new Date().toLocaleTimeString());
  const [snapshotKey, setSnapshotKey] = useState<number>(Date.now());
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [imgLoadError, setImgLoadError] = useState<boolean>(false);
  const [autoFailoverTriggered, setAutoFailoverTriggered] = useState<boolean>(false);

  // Active stream source index in cctv.sources
  const [activeSourceIdx, setActiveSourceIdx] = useState<number>(0);

  // Derive sources from cctv or fallback
  const sources: CCTVStreamSource[] = cctv?.sources && cctv.sources.length > 0
    ? cctv.sources
    : cctv
      ? [
          {
            id: 'src-default',
            name: cctv.videoUrl?.includes('.m3u8') ? '官方高清串流 (HLS)' : '即時視訊串流',
            type: cctv.videoUrl?.includes('.m3u8') ? 'hls' : cctv.videoUrl?.includes('bmjpg') ? 'mjpg' : 'snapshot',
            url: cctv.videoUrl || cctv.snapshotUrl || '',
            quality: '720p',
            isPrimary: true,
          }
        ]
      : [];

  const currentSource: CCTVStreamSource | undefined = sources[activeSourceIdx] || sources[0];
  const currentUrl = currentSource?.url || cctv?.videoUrl || cctv?.snapshotUrl || '';
  const isHls = currentSource?.type === 'hls' || (!currentSource && currentUrl.includes('.m3u8'));
  const [streamMode, setStreamMode] = useState<'mjpg' | 'hls'>(() => isHls ? 'hls' : 'mjpg');

  // Reset states when CCTV changes
  useEffect(() => {
    if (!cctv) return;
    setActiveSourceIdx(cctv.activeSourceIndex ?? 0);
    setImgLoadError(false);
    setAutoFailoverTriggered(false);
    setSnapshotKey(Date.now());
    setLastUpdatedTime(new Date().toLocaleTimeString());
    
    const initSource = cctv.sources?.[0];
    const initIsHls = initSource ? initSource.type === 'hls' : cctv.videoUrl?.includes('.m3u8');
    setStreamMode(initIsHls ? 'hls' : 'mjpg');
  }, [cctv?.cctvId]);

  // When active source changes
  useEffect(() => {
    if (!currentSource) return;
    setImgLoadError(false);
    setSnapshotKey(Date.now());
    setLastUpdatedTime(new Date().toLocaleTimeString());
    setStreamMode(currentSource.type === 'hls' ? 'hls' : 'mjpg');
  }, [activeSourceIdx, currentSource?.url]);

  // Setup HLS Player if mode is HLS
  useEffect(() => {
    if (streamMode !== 'hls' || !videoRef.current || !currentUrl) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      hls.loadSource(currentUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch(() => setIsPlaying(false));
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          console.warn('HLS fatal stream error on source', activeSourceIdx, currentUrl, data);
          // Trigger Auto-Failover to next available source if possible
          if (sources.length > 1 && activeSourceIdx === 0) {
            console.log('Auto-failover: Switching to secondary source 1');
            setAutoFailoverTriggered(true);
            setActiveSourceIdx(1);
          } else {
            if (cctv?.cctvId) onMarkOffline?.(cctv.cctvId);
            setStreamMode('mjpg'); // Fallback to MJPEG
          }
        }
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = currentUrl;
      videoRef.current.play().catch(() => setIsPlaying(false));
    } else {
      setStreamMode('mjpg');
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [currentUrl, streamMode, activeSourceIdx, sources.length, onMarkOffline]);

  // Snapshot / MJPEG Auto-Refresh Timer
  useEffect(() => {
    if (streamMode === 'hls' || refreshInterval <= 0) return;

    const timer = setInterval(() => {
      setSnapshotKey(Date.now());
      setLastUpdatedTime(new Date().toLocaleTimeString());
    }, refreshInterval * 1000);

    return () => clearInterval(timer);
  }, [refreshInterval, streamMode]);

  if (!cctv) return null;

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${cctv.latitude}, ${cctv.longitude}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleManualRefresh = () => {
    setSnapshotKey(Date.now());
    setImgLoadError(false);
    setLastUpdatedTime(new Date().toLocaleTimeString());
    setIsChecking(true);
    onCheckStatus(cctv.cctvId);
    setTimeout(() => setIsChecking(false), 1000);
  };

  const handleTogglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleFullscreen = () => {
    if (videoRef.current?.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handleSwitchSource = (index: number) => {
    setActiveSourceIdx(index);
    setAutoFailoverTriggered(false);
    setImgLoadError(false);
  };

  const placeholderSvg = getCctvPlaceholderSvg(
    cctv.locationName,
    cctv.roadName,
    imgLoadError ? '伺服器訊號傳輸中斷 (離線/斷網)' : '即時影像傳輸中 / 防跨域保護'
  );

  const activeStreamSrc = imgLoadError
    ? placeholderSvg
    : currentUrl
      ? `${currentUrl}${currentUrl.includes('?') ? '&' : '?'}t=${snapshotKey}`
      : placeholderSvg;

  const effectiveStatus = imgLoadError ? 'offline' : cctv.status;

  const layerBadgeColor =
    cctv.layerType === 'freeway' ? 'bg-blue-600 shadow-blue-900/30' :
    cctv.layerType === 'highway' ? 'bg-emerald-600 shadow-emerald-900/30' :
    cctv.layerType === 'city' ? 'bg-purple-600 shadow-purple-900/30' :
    'bg-sky-600 shadow-sky-900/30';

  const layerLabel =
    cctv.layerType === 'freeway' ? '🛣️ 國道' :
    cctv.layerType === 'highway' ? '🚗 省道' :
    cctv.layerType === 'city' ? '🏙️ 市區道路' : '🌊 水利防汛';

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/85 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col my-auto border-slate-800/80">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <span className={`text-white font-bold text-xs px-2.5 py-1 rounded-lg shadow-md ${layerBadgeColor}`}>
              {layerLabel} • {cctv.roadName} {cctv.mileage || ''}
            </span>
            {cctv.city && cctv.city !== '跨區/國道' && (
              <span className="bg-slate-800 text-slate-300 font-semibold text-xs px-2 py-0.5 rounded-md border border-slate-700">
                {cctv.city}
              </span>
            )}
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                {cctv.locationName}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                <span>ID: {cctv.cctvId}</span>
                <span>•</span>
                <span>{cctv.region}</span>
                <span>•</span>
                <span>方向: {cctv.direction || '雙向'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-Source Switcher Bar (Dual-Stream / Multi-Source Selector) */}
        {sources.length > 1 && (
          <div className="px-6 py-2.5 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                訊號源選擇 (雙源/多源):
              </span>
              <div className="flex items-center space-x-1.5">
                {sources.map((src, idx) => {
                  const isSelected = activeSourceIdx === idx;
                  return (
                    <button
                      key={src.id || idx}
                      onClick={() => handleSwitchSource(idx)}
                      className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 border border-blue-400'
                          : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                      <span>{src.name}</span>
                      {src.quality && (
                        <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-900 text-slate-400'}`}>
                          {src.quality}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {autoFailoverTriggered && (
              <div className="flex items-center space-x-1 px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-semibold animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>已自動切換至備用訊號源 (Failover)</span>
              </div>
            )}
          </div>
        )}

        {/* Video / Snapshot Display Player Stage */}
        <div className="relative bg-black aspect-video flex items-center justify-center overflow-hidden group">
          
          {streamMode === 'hls' ? (
            <video
              ref={videoRef}
              controls={false}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <img
              src={activeStreamSrc}
              alt={cctv.locationName}
              className="w-full h-full object-contain"
              onError={() => {
                setImgLoadError(true);
                // Trigger auto-failover if another source exists
                if (sources.length > 1 && activeSourceIdx === 0) {
                  console.log('Image load error on primary, failover to secondary source');
                  setAutoFailoverTriggered(true);
                  setActiveSourceIdx(1);
                } else if (cctv?.cctvId) {
                  onMarkOffline?.(cctv.cctvId);
                  onCheckStatus(cctv.cctvId);
                }
                // Auto-reconnect retry after 5 seconds
                setTimeout(() => {
                  setImgLoadError(false);
                  setSnapshotKey(Date.now());
                  setLastUpdatedTime(new Date().toLocaleTimeString());
                }, 5000);
              }}
            />
          )}

          {/* Live Watermark / Status Badge Overlay */}
          <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-2">
            <Radio className={`w-4 h-4 ${effectiveStatus === 'offline' ? 'text-slate-500' : 'text-rose-500 animate-pulse'}`} />
            <span className="text-xs font-semibold text-white">
              {effectiveStatus === 'offline' ? '訊號中斷' : 'LIVE 即時畫面'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">({lastUpdatedTime})</span>
            {currentSource?.quality && (
              <span className="bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-1.5 py-0.5 rounded">
                {currentSource.quality}
              </span>
            )}
          </div>

          <div className="absolute top-4 right-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-2 text-xs shadow-xl">
            <span className={`w-2.5 h-2.5 rounded-full ${
              effectiveStatus === 'online' ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]' :
              effectiveStatus === 'unstable' ? 'bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]' :
              effectiveStatus === 'offline' ? 'bg-rose-500 shadow-[0_0_8px_#ef4444]' : 'bg-slate-400'
            }`}></span>
            <span className="font-semibold text-slate-200">
              {effectiveStatus === 'online' ? '🟢 連線正常' :
               effectiveStatus === 'unstable' ? '🟡 連線不穩' :
               effectiveStatus === 'offline' ? '🔴 訊號中斷' : '⚪ 待測中'}
            </span>
            {cctv.responseTimeMs != null && (
              <span className={`font-mono text-[11px] ${
                effectiveStatus === 'online' ? 'text-emerald-400' :
                effectiveStatus === 'unstable' ? 'text-amber-400' : 'text-slate-400'
              }`}>
                ({cctv.responseTimeMs}ms)
              </span>
            )}
          </div>

          {/* On-Player Quick Controls Bar */}
          <div className="absolute bottom-4 left-4 right-4 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-2xl px-4 py-2.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            
            <div className="flex items-center space-x-3">
              {streamMode === 'hls' && (
                <button
                  onClick={handleTogglePlay}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                  title={isPlaying ? '暫停播放' : '繼續播放'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                </button>
              )}

              <button
                onClick={handleManualRefresh}
                className="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>手動刷新</span>
              </button>

              {streamMode !== 'hls' && (
                <div className="flex items-center space-x-1 text-xs text-slate-400">
                  <span>自動更新:</span>
                  <select
                    value={refreshInterval}
                    onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-slate-200 focus:outline-none"
                  >
                    <option value={2}>每 2 秒</option>
                    <option value={3}>每 3 秒</option>
                    <option value={5}>每 5 秒</option>
                    <option value={10}>每 10 秒</option>
                    <option value={0}>關閉自動更新</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setImgLoadError(false);
                  setStreamMode(streamMode === 'hls' ? 'mjpg' : 'hls');
                }}
                className="px-2.5 py-1 rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-medium hover:bg-blue-600/40 transition flex items-center gap-1"
              >
                {streamMode === 'hls' ? <ImageIcon className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                <span>{streamMode === 'hls' ? '切換 MJPEG/快照' : '切換 HLS 串流'}</span>
              </button>

              <button
                onClick={handleFullscreen}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
                title="全螢幕播放"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>

        {/* Modal Footer Metadata & Technical Info */}
        <div className="p-6 bg-slate-900 space-y-4 border-t border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Left Column: Location Details */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-2 text-xs">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  地理座標與路段資訊
                </span>
                <button
                  onClick={handleCopyCoords}
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono transition"
                >
                  {copiedCoords ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCoords ? '已複製' : `${cctv.latitude.toFixed(4)}, ${cctv.longitude.toFixed(4)}`}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] text-slate-500">道路分類</p>
                  <p className="text-xs font-bold text-slate-200">{layerLabel} • {cctv.roadName}</p>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] text-slate-500">所屬縣市</p>
                  <p className="text-xs font-bold text-slate-200">{cctv.city || '跨區路網'}</p>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] text-slate-500">行車方向</p>
                  <p className="text-xs font-bold text-slate-200">{cctv.direction || '雙向'}</p>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] text-slate-500">轄區區域</p>
                  <p className="text-xs font-bold text-slate-200">{cctv.region}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Diagnostics */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-3 text-xs">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  網路測速與串流源資訊
                </span>
                <button
                  onClick={handleCopyUrl}
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono transition"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? '已複製' : '複製目前串流網址'}</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">目前訊號源</span>
                  <span className="text-blue-400 font-bold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    {currentSource?.name || '主串流'} ({streamMode.toUpperCase()})
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">Ping 延遲時間</span>
                  <span className={`font-bold ${
                    cctv.responseTimeMs == null ? 'text-slate-500' :
                    cctv.responseTimeMs < 200 ? 'text-emerald-400' :
                    cctv.responseTimeMs < 500 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {cctv.responseTimeMs != null ? `${cctv.responseTimeMs}ms` : '尚未測速'}
                  </span>
                </div>
                {cctv.responseTimeMs != null && (
                  <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        cctv.responseTimeMs < 200 ? 'bg-emerald-500' :
                        cctv.responseTimeMs < 500 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.min(100, 100 - (cctv.responseTimeMs / 15))}%` }}
                    ></div>
                  </div>
                )}
              </div>

              <div className="pt-1">
                <p className="font-mono text-[10px] text-slate-400 bg-slate-900/80 p-2 rounded-xl truncate border border-slate-800">
                  {currentUrl}
                </p>
              </div>
            </div>

          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-[10px] text-slate-500 font-mono">
              DATA SOURCE: MOTC & CITY TRAFFIC OPEN DATA • DUAL/MULTI-SOURCE ENABLED
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleManualRefresh}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>重新測速</span>
              </button>

              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-900/30"
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
