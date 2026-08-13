import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { CCTVItem } from '../types/cctv';
import { getCctvPlaceholderSvg } from '../utils/cctvPlaceholder';
import { Compass, MapPin, Layers, Train, Globe, Moon, Sun } from 'lucide-react';

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
  const baseTileRef = useRef<L.TileLayer | null>(null);
  const overlayTileRef = useRef<L.TileLayer | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const railGroupRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  // Basemap & Rail Layer Options
  const [basemap, setBasemap] = useState<'voyager' | 'dark' | 'satellite' | 'osm'>('dark');
  const [showRailLayer, setShowRailLayer] = useState<boolean>(true);

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

    // Initialize default dark basemap
    const initialBase = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    baseTileRef.current = initialBase;

    // Base path helper for icon assets
    const rawBase = (import.meta as any).env?.BASE_URL || './';
    const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    const iconUrl = (name: string) => `${baseUrl}icons/${name}`;

    // Initialize MarkerClusterGroup with chunked async loading
    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 14,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 50,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let clusterImg = 'cluster-sm.webp';
        let size = 40;
        if (count >= 50) {
          clusterImg = 'cluster-lg.webp';
          size = 56;
        } else if (count >= 10) {
          clusterImg = 'cluster-md.webp';
          size = 48;
        }

        return L.divIcon({
          html: `<div style="
            width:${size}px; height:${size}px;
            background-image: url('${iconUrl(clusterImg)}');
            background-size: contain;
            background-repeat: no-repeat;
            background-position: center;
            display: flex; align-items: center; justify-content: center;
            font-family: monospace; font-size: ${count < 100 ? 13 : 11}px;
            font-weight: 800; color: #ffffff;
            text-shadow: 0 1px 4px rgba(0,0,0,0.9);
            filter: drop-shadow(0 0 6px rgba(15,23,42,0.8));
          ">${count}</div>`,
          className: 'custom-cluster-icon',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      }
    });

    clusterGroup.addTo(map);
    clusterGroupRef.current = clusterGroup;

    // Initialize Rail Group
    const railGroup = L.layerGroup().addTo(map);
    railGroupRef.current = railGroup;

    mapInstanceRef.current = map;
    setMapLoaded(true);

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      clusterGroupRef.current = null;
      railGroupRef.current = null;
      baseTileRef.current = null;
      overlayTileRef.current = null;
    };
  }, []);

  // Effect: Handle Basemap Tile Switcher
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileRef.current) {
      map.removeLayer(baseTileRef.current);
    }
    if (overlayTileRef.current) {
      map.removeLayer(overlayTileRef.current);
      overlayTileRef.current = null;
    }

    if (basemap === 'satellite') {
      const satTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19
      }).addTo(map);
      baseTileRef.current = satTile;

      const overlayTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        opacity: 0.8
      }).addTo(map);
      overlayTileRef.current = overlayTile;
    } else if (basemap === 'dark') {
      const darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);
      baseTileRef.current = darkTile;
    } else if (basemap === 'voyager') {
      const voyagerTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);
      baseTileRef.current = voyagerTile;
    } else if (basemap === 'osm') {
      const osmTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);
      baseTileRef.current = osmTile;
    }
  }, [basemap]);

  // Effect: Handle Rail Lines & Animated Train Motion Overlay
  useEffect(() => {
    const railGroup = railGroupRef.current;
    if (!railGroup || !mapLoaded) return;

    railGroup.clearLayers();
    if (!showRailLayer) return;

    let animReq: number;

    const loadRailData = async () => {
      try {
        const rawBase = (import.meta as any).env?.BASE_URL || './';
        const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

        const [thsrRes, traRes] = await Promise.all([
          fetch(`${baseUrl}data/thsr_track.json`).catch(() => null),
          fetch(`${baseUrl}data/tra_track.json`).catch(() => null)
        ]);

        const animatedTrains: Array<{
          marker: L.Marker;
          path: Array<[number, number]>;
          currentIndex: number;
          step: number;
          speed: number;
        }> = [];

        // 1. Load THSR (高鐵 - 橙色)
        if (thsrRes && thsrRes.ok) {
          const thsrData = await thsrRes.json();
          if (thsrData.lines && Array.isArray(thsrData.lines)) {
            thsrData.lines.forEach((line: any) => {
              if (line.shape && Array.isArray(line.shape)) {
                const latlngs: [number, number][] = line.shape;
                L.polyline(latlngs, {
                  color: '#f97316',
                  weight: 4,
                  opacity: 0.85,
                  dashArray: '8, 6'
                }).bindTooltip('台灣高鐵 (THSR)', { sticky: true }).addTo(railGroup);

                // Add 6 active THSR trains along track
                for (let i = 0; i < 6; i++) {
                  const startIdx = Math.floor((i / 6) * latlngs.length);
                  const thsrIcon = L.divIcon({
                    className: 'custom-train-thsr',
                    html: `<div class="w-6 h-6 rounded-full bg-orange-600 border-2 border-white shadow-[0_0_12px_#f97316] flex items-center justify-center text-[10px] text-white animate-pulse">🚆</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                  });

                  const marker = L.marker(latlngs[startIdx], { icon: thsrIcon })
                    .bindTooltip(`🚄 高鐵列車 (即時行查連動)`, { direction: 'top' })
                    .addTo(railGroup);

                  animatedTrains.push({
                    marker,
                    path: latlngs,
                    currentIndex: startIdx,
                    step: i % 2 === 0 ? 1 : -1,
                    speed: 0.8 + Math.random() * 0.4
                  });
                }
              }
            });
          }
        }

        // 2. Load TRA (台鐵 - 青藍色)
        if (traRes && traRes.ok) {
          const traData = await traRes.json();
          if (traData.lines && Array.isArray(traData.lines)) {
            traData.lines.forEach((line: any, lIdx: number) => {
              if (line.shape && Array.isArray(line.shape) && line.shape.length > 5) {
                const latlngs: [number, number][] = line.shape;
                L.polyline(latlngs, {
                  color: line.color || '#06b6d4',
                  weight: 2.5,
                  opacity: 0.75,
                }).bindTooltip(`台鐵 ${line.name}`, { sticky: true }).addTo(railGroup);

                // Add active TRA train
                if (lIdx % 2 === 0 && latlngs.length > 20) {
                  const startIdx = Math.floor(Math.random() * (latlngs.length - 10));
                  const traIcon = L.divIcon({
                    className: 'custom-train-tra',
                    html: `<div class="w-6 h-6 rounded-full bg-cyan-600 border-2 border-white shadow-[0_0_12px_#06b6d4] flex items-center justify-center text-[10px] text-white animate-pulse">🚆</div>`,
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                  });

                  const marker = L.marker(latlngs[startIdx], { icon: traIcon })
                    .bindTooltip(`🚆 台鐵 ${line.name} (即時行查)`, { direction: 'top' })
                    .addTo(railGroup);

                  animatedTrains.push({
                    marker,
                    path: latlngs,
                    currentIndex: startIdx,
                    step: Math.random() > 0.5 ? 1 : -1,
                    speed: 0.4 + Math.random() * 0.4
                  });
                }
              }
            });
          }
        }

        // Animation Loop for moving trains smoothly
        const animate = () => {
          animatedTrains.forEach(t => {
            t.currentIndex += t.step * t.speed;
            if (t.currentIndex >= t.path.length - 1) {
              t.currentIndex = t.path.length - 1;
              t.step = -1;
            } else if (t.currentIndex <= 0) {
              t.currentIndex = 0;
              t.step = 1;
            }

            const idx = Math.floor(t.currentIndex);
            const nextIdx = Math.min(idx + 1, t.path.length - 1);
            const frac = t.currentIndex - idx;

            const p1 = t.path[idx];
            const p2 = t.path[nextIdx];
            if (p1 && p2) {
              const lat = p1[0] + (p2[0] - p1[0]) * frac;
              const lng = p1[1] + (p2[1] - p1[1]) * frac;
              t.marker.setLatLng([lat, lng]);
            }
          });

          animReq = requestAnimationFrame(animate);
        };

        animReq = requestAnimationFrame(animate);

      } catch (err) {
        console.warn('Failed to render animated rail layer:', err);
      }
    };

    loadRailData();

    return () => {
      if (animReq) cancelAnimationFrame(animReq);
    };
  }, [showRailLayer, mapLoaded]);

  // P2: Diff-based marker update — only add/remove markers that changed
  useEffect(() => {
    const map = mapInstanceRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup || !mapLoaded) return;

    map.invalidateSize();

    const rawBase = (import.meta as any).env?.BASE_URL || './';
    const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    const iconUrl = (name: string) => `${baseUrl}icons/${name}`;

    const filteredIds = new Set(filteredCctvs.map(c => c.cctvId));
    const existingIds = new Set(markersRef.current.keys());

    // Remove markers no longer in filteredCctvs
    existingIds.forEach(id => {
      if (!filteredIds.has(id)) {
        const marker = markersRef.current.get(id);
        if (marker) {
          clusterGroup.removeLayer(marker);
          markersRef.current.delete(id);
        }
      }
    });

    // Add markers that are new in filteredCctvs
    filteredCctvs.forEach(cctv => {
      if (existingIds.has(cctv.cctvId)) return; // already exists

      const isHighway = cctv.roadName.includes('台') || cctv.roadId.startsWith('T') || cctv.roadId.startsWith('台');
      let iconFile = 'marker-freeway-online.webp';

      if (cctv.status === 'offline') {
        iconFile = isHighway ? 'marker-highway-offline.webp' : 'marker-freeway-offline.webp';
      } else if (cctv.status === 'unknown' || cctv.status === 'checking') {
        iconFile = 'marker-unknown.webp';
      } else {
        iconFile = isHighway ? 'marker-highway-online.webp' : 'marker-freeway-online.webp';
      }

      const customIcon = L.icon({
        iconUrl: iconUrl(iconFile),
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -30],
      });

      const marker = L.marker([cctv.latitude, cctv.longitude], { icon: customIcon });

      const placeholderSvg = getCctvPlaceholderSvg(cctv.locationName, cctv.roadName, '即時連線中');
      const previewImgSrc = cctv.snapshotUrl || cctv.videoUrl || placeholderSvg;

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
              onerror="this.src='${placeholderSvg}'"
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

      clusterGroup.addLayer(marker);
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

        {/* Basemap Switcher */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl overflow-x-auto text-xs">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold px-2 flex items-center gap-1 shrink-0">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            底圖:
          </span>
          <button
            onClick={() => setBasemap('dark')}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 border ${
              basemap === 'dark' ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-900/30' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            <Moon className="w-3 h-3" />
            深色
          </button>
          <button
            onClick={() => setBasemap('satellite')}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 border ${
              basemap === 'satellite' ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-900/30' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            <Globe className="w-3 h-3 text-emerald-400" />
            🛰️ 衛星
          </button>
          <button
            onClick={() => setBasemap('voyager')}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 border ${
              basemap === 'voyager' ? 'bg-cyan-600 text-white border-cyan-500 shadow-md shadow-cyan-900/30' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            <Sun className="w-3 h-3 text-amber-400" />
            彩色
          </button>
        </div>

        {/* Rail & Animated Train Layer Toggle */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl text-xs">
          <button
            onClick={() => setShowRailLayer(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1.5 border ${
              showRailLayer ? 'bg-orange-600/90 text-white border-orange-400 shadow-md shadow-orange-900/40 animate-pulse' : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 border-slate-700/50'
            }`}
            title="開啟/關閉 台灣高鐵與台鐵動態列車軌跡"
          >
            <Train className="w-3.5 h-3.5" />
            <span>🚆 鐵道動畫 {showRailLayer ? '開啟' : '關閉'}</span>
          </button>
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
