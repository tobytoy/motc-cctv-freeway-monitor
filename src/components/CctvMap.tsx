import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { CCTVItem } from '../types/cctv';
import { Compass, MapPin } from 'lucide-react';

interface CctvMapProps {
  cctvs: CCTVItem[];
  onSelectCctv: (cctv: CCTVItem) => void;
  onCheckStatus: (cctvId: string) => void;
  selectedCctvId?: string;
  roadFilter: string;
  setRoadFilter: (road: string) => void;
  regionFilter: string;
  setRegionFilter: (region: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

export const CctvMap: React.FC<CctvMapProps> = ({
  cctvs,
  onSelectCctv,
  onCheckStatus,
  roadFilter,
  setRoadFilter,
  regionFilter,
  setRegionFilter,
  statusFilter,
  setStatusFilter,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  // Filtered list
  const filteredCctvs = cctvs.filter(c => {
    if (roadFilter !== 'all' && c.roadName !== roadFilter && c.roadId !== roadFilter) return false;
    if (regionFilter !== 'all' && c.region !== regionFilter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default Taiwan bounds
    const map = L.map(mapContainerRef.current, {
      center: [23.8, 120.9],
      zoom: 8,
      minZoom: 7,
      maxZoom: 18,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Dark styled basemap (CartoDB Dark Matter / Voyager)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    mapInstanceRef.current = map;
    setMapLoaded(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    filteredCctvs.forEach(cctv => {
      let iconBg = 'bg-emerald-500';
      let borderClass = 'border-emerald-300';

      if (cctv.status === 'offline') {
        iconBg = 'bg-rose-500';
        borderClass = 'border-rose-300';
      } else if (cctv.status === 'unstable') {
        iconBg = 'bg-amber-500';
        borderClass = 'border-amber-300';
      }

      // Create custom DivIcon
      const customIcon = L.divIcon({
        className: 'custom-cctv-icon',
        html: `
          <div class="relative group cursor-pointer">
            <div class="w-7 h-7 rounded-full ${iconBg} ${borderClass} border-2 shadow-lg flex items-center justify-center text-white transform hover:scale-125 transition-transform duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>
            </div>
            ${cctv.status === 'online' ? '<span class="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping"></span>' : ''}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

      const marker = L.marker([cctv.latitude, cctv.longitude], { icon: customIcon });

      const defaultSnapshot = 'https://images.unsplash.com/photo-1542224566-6e85f2e6772f?w=600&auto=format&fit=crop&q=80';
      const previewImgSrc = cctv.snapshotUrl || defaultSnapshot;

      // Popup HTML content
      const popupHtml = `
        <div class="p-3 w-64 text-slate-100 font-sans">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              ${cctv.roadName} ${cctv.mileage ? cctv.mileage : ''}
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${
              cctv.status === 'online' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              cctv.status === 'offline' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }">
              ${cctv.status === 'online' ? '● 運作正常' : cctv.status === 'offline' ? '✖ 斷線/異常' : '▲ 訊號不穩定'}
            </span>
          </div>

          <h3 class="font-bold text-sm text-white mb-1 leading-snug">${cctv.locationName}</h3>
          
          <div class="text-[11px] text-slate-400 mb-2 flex items-center space-x-1">
            <span>經緯度: ${cctv.latitude.toFixed(4)}, ${cctv.longitude.toFixed(4)}</span>
            <span>• ${cctv.region}</span>
          </div>

          <div class="aspect-video bg-slate-950 rounded-lg overflow-hidden relative mb-3 border border-slate-800 flex items-center justify-center">
            <img 
              src="${previewImgSrc}" 
              alt="${cctv.locationName}"
              class="w-full h-full object-cover"
              onerror="this.src='${defaultSnapshot}'"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
            <span class="absolute bottom-1.5 left-2 text-[10px] text-slate-300 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-800">
              即時快照畫面
            </span>
          </div>

          <div class="grid grid-cols-2 gap-1.5">
            <button 
              id="btn-play-${cctv.cctvId}" 
              class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-1.5 px-2 rounded-md text-xs flex items-center justify-center gap-1 transition shadow-md shadow-blue-900/30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
              觀看影像
            </button>
            <button 
              id="btn-check-${cctv.cctvId}" 
              class="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-1.5 px-2 rounded-md text-xs flex items-center justify-center gap-1 border border-slate-700 transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              測試連線
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('popupopen', () => {
        const btnPlay = document.getElementById(`btn-play-${cctv.cctvId}`);
        const btnCheck = document.getElementById(`btn-check-${cctv.cctvId}`);

        if (btnPlay) {
          btnPlay.onclick = () => onSelectCctv(cctv);
        }
        if (btnCheck) {
          btnCheck.onclick = () => onCheckStatus(cctv.cctvId);
        }
      });

      marker.addTo(map);
      markersRef.current.set(cctv.cctvId, marker);
    });

  }, [filteredCctvs, mapLoaded, onSelectCctv, onCheckStatus]);

  const handleFlyTo = (lat: number, lng: number, zoom: number) => {
    mapInstanceRef.current?.flyTo([lat, lng], zoom, {
      duration: 1.2
    });
  };

  return (
    <div className="relative w-full h-[calc(100vh-160px)] min-h-[520px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl flex flex-col">
      
      {/* Top Map Control Toolbar */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 max-w-[calc(100%-60px)]">
        
        {/* Preset Region Selector */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl overflow-x-auto text-xs">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold px-2 flex items-center gap-1 shrink-0">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            區域定位:
          </span>
          <button
            onClick={() => handleFlyTo(23.8, 120.9, 8)}
            className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-medium whitespace-nowrap transition border border-slate-700/50"
          >
            🇹🇼 全台
          </button>
          <button
            onClick={() => {
              setRegionFilter('北部');
              handleFlyTo(25.0, 121.5, 10);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
              regionFilter === '北部' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            北區
          </button>
          <button
            onClick={() => {
              setRegionFilter('中部');
              handleFlyTo(24.1, 120.6, 10);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
              regionFilter === '中部' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            中區
          </button>
          <button
            onClick={() => {
              setRegionFilter('南部');
              handleFlyTo(22.8, 120.3, 10);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
              regionFilter === '南部' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            南區
          </button>
          <button
            onClick={() => {
              setRegionFilter('東部');
              handleFlyTo(24.3, 121.7, 9);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
              regionFilter === '東部' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            東區
          </button>
        </div>

        {/* Highway Preset Selectors */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl overflow-x-auto text-xs">
          <button
            onClick={() => {
              setRoadFilter('國道1號');
              handleFlyTo(24.2, 120.7, 9);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
              roadFilter === '國道1號' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
            }`}
          >
            國1 中山高
          </button>
          <button
            onClick={() => {
              setRoadFilter('國道3號');
              handleFlyTo(24.1, 120.8, 9);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
              roadFilter === '國道3號' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
            }`}
          >
            國3 福爾摩沙
          </button>
          <button
            onClick={() => {
              setRoadFilter('國道5號');
              handleFlyTo(24.9, 121.7, 11);
            }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
              roadFilter === '國道5號' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
            }`}
          >
            國5 雪隧
          </button>
          {(roadFilter !== 'all' || regionFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setRoadFilter('all');
                setRegionFilter('all');
                setStatusFilter('all');
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 text-xs transition font-semibold"
            >
              重置條件
            </button>
          )}
        </div>

      </div>

      {/* Map Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full z-1" />

      {/* Map Bottom Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-3.5 py-2 shadow-2xl flex items-center space-x-4 text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">顯示站點:</span>
          <strong className="text-white font-mono ml-1 text-sm">{filteredCctvs.length}</strong>
        </span>
        <div className="h-3 w-px bg-slate-800"></div>
        <div className="flex items-center space-x-3 text-[11px] font-medium">
          <span className="flex items-center space-x-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>正常</span>
          </span>
          <span className="flex items-center space-x-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            <span>延遲</span>
          </span>
          <span className="flex items-center space-x-1.5 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
            <span>離線/異常</span>
          </span>
        </div>
      </div>

    </div>
  );
};
