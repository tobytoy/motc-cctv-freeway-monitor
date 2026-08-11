import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { CCTVItem } from '../types/cctv';
import { getCctvPlaceholderSvg } from '../utils/cctvPlaceholder';
import { X, Play, Pause, RefreshCw, Copy, Check, Maximize2, Radio, Wifi, MapPin, Video, Image as ImageIcon } from 'lucide-react';

interface CctvPlayerModalProps {
  cctv: CCTVItem | null;
  onClose: () => void;
  onCheckStatus: (cctvId: string) => void;
}

export const CctvPlayerModal: React.FC<CctvPlayerModalProps> = ({
  cctv,
  onClose,
  onCheckStatus
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

  // Compute stream mode based on URL — stable value per cctv
  const isMjpgStream = cctv?.videoUrl?.includes('bmjpg') || cctv?.snapshotUrl?.includes('bmjpg');
  const isHlsStream = !isMjpgStream && cctv?.videoUrl?.includes('.m3u8');
  const [streamMode, setStreamMode] = useState<'mjpg' | 'hls'>(() =>
    isHlsStream ? 'hls' : 'mjpg'
  );

  // B1 FIX: Reset per-cctv states when cctv changes, AFTER all hooks are declared
  useEffect(() => {
    if (!cctv) return;
    setImgLoadError(false);
    setSnapshotKey(Date.now());
    setLastUpdatedTime(new Date().toLocaleTimeString());
    const isMjpg = cctv.videoUrl?.includes('bmjpg') || cctv.snapshotUrl?.includes('bmjpg');
    const isHls = !isMjpg && cctv.videoUrl?.includes('.m3u8');
    setStreamMode(isHls ? 'hls' : 'mjpg');
  }, [cctv?.cctvId]);

  // Setup HLS Player if mode is HLS
  useEffect(() => {
    if (streamMode !== 'hls' || !videoRef.current || !cctv?.videoUrl) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      hls.loadSource(cctv.videoUrl);
      hls.attachMedia(videoRef.current);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch(() => setIsPlaying(false));
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStreamMode('mjpg'); // Fallback to MJPEG
        }
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = cctv.videoUrl;
      videoRef.current.play().catch(() => setIsPlaying(false));
    } else {
      setStreamMode('mjpg');
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [cctv?.videoUrl, streamMode]);

  // Snapshot / MJPEG Auto-Refresh Timer
  useEffect(() => {
    if (streamMode === 'hls' || refreshInterval <= 0) return;

    const timer = setInterval(() => {
      setSnapshotKey(Date.now());
      setLastUpdatedTime(new Date().toLocaleTimeString());
    }, refreshInterval * 1000);

    return () => clearInterval(timer);
  }, [refreshInterval, streamMode]);

  // B1 FIX: early return AFTER all hooks
  if (!cctv) return null;

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${cctv.latitude}, ${cctv.longitude}`);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(cctv.videoUrl);
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

  const placeholderSvg = getCctvPlaceholderSvg(cctv.locationName, cctv.roadName, '即時影像傳輸中 / 防跨域保護');

  // B2 FIX: Correctly determine which URL to use and whether it already has '?'
  const baseStreamUrl = cctv.snapshotUrl || cctv.videoUrl;
  const activeStreamSrc = imgLoadError
    ? placeholderSvg
    : baseStreamUrl
      ? `${baseStreamUrl}${baseStreamUrl.includes('?') ? '&' : '?'}t=${snapshotKey}`
      : placeholderSvg;

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-950/85 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col my-auto border-slate-800/80">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <span className="bg-blue-600 text-white font-bold text-xs px-2.5 py-1 rounded-lg shadow-md shadow-blue-900/30">
              {cctv.roadName} {cctv.mileage || ''}
            </span>
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
                // Auto-reconnect after 3 seconds to bypass server-side disconnects
                setTimeout(() => {
                  setImgLoadError(false);
                  setSnapshotKey(Date.now());
                  setLastUpdatedTime(new Date().toLocaleTimeString());
                }, 3000);
              }}
            />
          )}

          {/* Live Watermark / Status Badge Overlay */}
          <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-2">
            <Radio className="w-4 h-4 text-rose-500 animate-pulse" />
            <span className="text-xs font-semibold text-white">LIVE 即時畫面</span>
            <span className="text-[10px] text-slate-400 font-mono">({lastUpdatedTime})</span>
          </div>

          <div className="absolute top-4 right-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl flex items-center space-x-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${
              cctv.status === 'online' ? 'bg-emerald-400' : cctv.status === 'offline' ? 'bg-rose-500' : 'bg-amber-400'
            }`}></span>
            <span className="font-semibold text-slate-200">
              {cctv.status === 'online' ? '連線正常' : cctv.status === 'offline' ? '連線中斷' : '延遲稍高'}
            </span>
            {cctv.responseTimeMs != null && (
              <span className="text-slate-400 font-mono text-[11px]">
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
                <span>{streamMode === 'hls' ? '切換 MJPEG 模式' : '切換 HLS 串流'}</span>
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
                  地理座標與路線資訊
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
                  <p className="text-[10px] text-slate-500">公路代號</p>
                  <p className="text-xs font-bold text-slate-200">{cctv.roadName}</p>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] text-slate-500">里程數</p>
                  <p className="text-xs font-bold text-slate-200">{cctv.mileage || '未標註'}</p>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] text-slate-500">行車方向</p>
                  <p className="text-xs font-bold text-slate-200">{cctv.direction || '雙向'}</p>
                </div>
                <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80">
                  <p className="text-[10px] text-slate-500">所屬轄區</p>
                  <p className="text-xs font-bold text-slate-200">{cctv.region}</p>
                </div>
              </div>
            </div>

            {/* Right Column: Diagnostics */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-3 text-xs">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  網路測速與串流診斷
                </span>
                <button
                  onClick={handleCopyUrl}
                  className="text-blue-400 hover:text-blue-300 flex items-center gap-1 font-mono transition"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? '已複製' : '複製串流網址'}</span>
                </button>
              </div>

              <div className="space-y-2">
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
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400">串流來源</span>
                  <span className="text-slate-200 font-bold">{streamMode === 'hls' ? 'HLS m3u8' : 'MJPEG 串流'}</span>
                </div>
              </div>

              <div className="pt-1">
                <p className="font-mono text-[10px] text-slate-400 bg-slate-900/80 p-2 rounded-xl truncate border border-slate-800">
                  {cctv.videoUrl}
                </p>
              </div>
            </div>

          </div>

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <div className="text-[10px] text-slate-500 font-mono">
              DATA SOURCE: MOTC CCTV XML v2.0 • LAST CHECK: {lastUpdatedTime}
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
