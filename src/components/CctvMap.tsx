import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { CCTVItem } from '../types/cctv';
import { getCctvPlaceholderSvg } from '../utils/cctvPlaceholder';
import { Compass, MapPin, Layers, Train, Globe, Moon, Sun, Activity, Zap } from 'lucide-react';

interface CctvMapProps {
  cctvs: CCTVItem[];
  onSelectCctv: (cctv: CCTVItem) => void;
  onCheckStatus: (cctvId: string) => void;
  onMarkOffline?: (cctvId: string) => void;
  selectedCctvId?: string;
  roadFilter: string;
  setRoadFilter: (road: string) => void;
  regionFilter: string;
  setRegionFilter: (region: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
}

function haversineDistanceKm(p1: [number, number], p2: [number, number]): number {
  const R = 6371;
  const toR = Math.PI / 180;
  const dLat = (p2[0] - p1[0]) * toR;
  const dLon = (p2[1] - p1[1]) * toR;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1[0] * toR) * Math.cos(p2[0] * toR) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function computeTrackCumulativeKm(shape: [number, number][]): number[] {
  const cum = [0];
  for (let i = 1; i < shape.length; i++) {
    cum[i] = cum[i - 1] + haversineDistanceKm(shape[i - 1], shape[i]);
  }
  return cum;
}

function interpolatePosAlongTrack(
  shape: [number, number][],
  cum: number[],
  distKm: number
): { pos: [number, number] } {
  const totalKm = cum[cum.length - 1];
  if (distKm <= 0) return { pos: shape[0] };
  if (distKm >= totalKm) return { pos: shape[shape.length - 1] };

  let lo = 0, hi = shape.length - 1;
  while (lo + 1 < hi) {
    const m = (lo + hi) >> 1;
    if (cum[m] <= distKm) lo = m;
    else hi = m;
  }
  const segKm = cum[hi] - cum[lo];
  const f = segKm > 0 ? (distKm - cum[lo]) / segKm : 0;
  const lat = shape[lo][0] + (shape[hi][0] - shape[lo][0]) * f;
  const lng = shape[lo][1] + (shape[hi][1] - shape[lo][1]) * f;
  return { pos: [lat, lng] };
}

interface ActiveVehicle {
  marker: L.Marker;
  name: string;
  systemName: string;
  path: Array<[number, number]>;
  cum: number[];
  totalKm: number;
  curDistKm: number;
  direction: number;
  speedKmH: number;
  type: 'thsr' | 'tra_express' | 'tra_local' | 'metro' | 'lrt';
}

export const CctvMap: React.FC<CctvMapProps> = ({
  cctvs,
  onSelectCctv,
  onCheckStatus,
  onMarkOffline,
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
  const metroGroupRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [mapLoaded, setMapLoaded] = useState(false);

  const [basemap, setBasemap] = useState<'voyager' | 'dark' | 'satellite' | 'osm'>('dark');
  const [showRailLayer, setShowRailLayer] = useState<boolean>(true);
  const [showMetroLayer, setShowMetroLayer] = useState<boolean>(true);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const speedMultiplierRef = useRef<number>(1);

  useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  const filteredCctvs = cctvs.filter(c => {
    if (roadFilter !== 'all' && c.roadName !== roadFilter && c.roadId !== roadFilter) return false;
    if (regionFilter !== 'all' && c.region !== regionFilter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  // Map Initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.8, 120.9],
      zoom: 8,
      minZoom: 7,
      maxZoom: 18,
      zoomControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    const initialBase = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    baseTileRef.current = initialBase;

    const rawBase = (import.meta as any).env?.BASE_URL || './';
    const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    const iconUrl = (name: string) => `${baseUrl}icons/${name}`;

    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 50,
      disableClusteringAtZoom: 14,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      chunkedLoading: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        let clusterImg = 'cluster-sm.webp';
        let size = 40;
        if (count >= 50) { clusterImg = 'cluster-lg.webp'; size = 56; }
        else if (count >= 10) { clusterImg = 'cluster-md.webp'; size = 48; }

        return L.divIcon({
          html: `
            <div class="relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110">
              <img src="${iconUrl(clusterImg)}" alt="Cluster" class="w-full h-full drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
              <span class="absolute text-white font-mono font-bold text-xs pointer-events-none drop-shadow-md">
                ${count}
              </span>
            </div>
          `,
          className: 'custom-cluster-icon',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
      }
    });

    const railGroup = L.layerGroup();
    railGroup.addTo(map);
    railGroupRef.current = railGroup;

    const metroGroup = L.layerGroup();
    metroGroup.addTo(map);
    metroGroupRef.current = metroGroup;

    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;
    mapInstanceRef.current = map;
    setMapLoaded(true);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Basemap Switcher
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileRef.current) map.removeLayer(baseTileRef.current);
    if (overlayTileRef.current) { map.removeLayer(overlayTileRef.current); overlayTileRef.current = null; }

    const tileUrl = basemap === 'satellite' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' :
                    basemap === 'dark' ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' :
                    basemap === 'voyager' ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' :
                    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tile = L.tileLayer(tileUrl, { maxZoom: 20 }).addTo(map);
    baseTileRef.current = tile;
    if (basemap === 'satellite') {
      overlayTileRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', { opacity: 0.8 }).addTo(map);
    }
  }, [basemap]);

  // Rail & Metro Dynamic Simulation Engine (Realistic Physics & Motion)
  useEffect(() => {
    const railGroup = railGroupRef.current;
    const metroGroup = metroGroupRef.current;
    if (!railGroup || !metroGroup || !mapLoaded) return;

    railGroup.clearLayers();
    metroGroup.clearLayers();

    if (!showRailLayer && !showMetroLayer) return;

    let animReq: number;

    const loadTransitData = async () => {
      try {
        const rawBase = (import.meta as any).env?.BASE_URL || './';
        const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
        const activeVehicles: ActiveVehicle[] = [];

        // 1. High Speed Rail & Taiwan Railway
        if (showRailLayer) {
          const [thsrRes, traRes] = await Promise.all([
            fetch(`${baseUrl}data/thsr_track.json`).catch(() => null),
            fetch(`${baseUrl}data/tra_track.json`).catch(() => null)
          ]);

          if (thsrRes && thsrRes.ok) {
            const thsrData = await thsrRes.json();
            if (thsrData.lines && Array.isArray(thsrData.lines)) {
              thsrData.lines.forEach((line: any) => {
                if (line.shape && Array.isArray(line.shape) && line.shape.length > 5) {
                  const latlngs: [number, number][] = line.shape;
                  const cum = computeTrackCumulativeKm(latlngs);
                  const totalKm = cum[cum.length - 1];
                  L.polyline(latlngs, {
                    color: '#f97316',
                    weight: 3.5,
                    opacity: 0.9,
                    dashArray: '8, 6'
                  }).bindTooltip('🚄 台灣高鐵 (THSR 全線 350km)', { sticky: true }).addTo(railGroup);

                  const thsrTrainConfigs = [
                    { name: '🚄 高鐵 0609次', dir: 1, speed: 285, startKm: totalKm * 0.15 },
                    { name: '🚄 高鐵 0118次', dir: -1, speed: 280, startKm: totalKm * 0.80 },
                    { name: '🚄 高鐵 0203次', dir: 1, speed: 290, startKm: totalKm * 0.45 },
                    { name: '🚄 高鐵 0814次', dir: -1, speed: 275, startKm: totalKm * 0.60 },
                    { name: '🚄 高鐵 0663次', dir: 1, speed: 282, startKm: totalKm * 0.72 },
                    { name: '🚄 高鐵 0134次', dir: -1, speed: 278, startKm: totalKm * 0.28 },
                  ];

                  thsrTrainConfigs.forEach(cfg => {
                    const thsrIcon = L.divIcon({
                      className: 'custom-train-thsr',
                      html: `<div class="w-6 h-6 rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 border-2 border-white shadow-[0_0_14px_#f97316] flex items-center justify-center text-[10px] text-white font-bold animate-pulse">🚄</div>`,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    });
                    const { pos } = interpolatePosAlongTrack(latlngs, cum, cfg.startKm);
                    const marker = L.marker(pos, { icon: thsrIcon })
                      .bindTooltip(`<div class="p-1 font-sans text-xs font-bold text-orange-400">${cfg.name} (時速 ${cfg.speed} km/h)</div>`)
                      .addTo(railGroup);

                    activeVehicles.push({
                      marker,
                      name: cfg.name,
                      systemName: '台灣高鐵',
                      path: latlngs,
                      cum,
                      totalKm,
                      curDistKm: cfg.startKm,
                      direction: cfg.dir,
                      speedKmH: cfg.speed,
                      type: 'thsr'
                    });
                  });
                }
              });
            }
          }

          if (traRes && traRes.ok) {
            const traData = await traRes.json();
            if (traData.lines && Array.isArray(traData.lines)) {
              const traTrainNames = [
                { name: '🚆 台鐵 EMU3000 新自強', speed: 125, isExpress: true },
                { name: '🚆 台鐵 普悠瑪號', speed: 128, isExpress: true },
                { name: '🚆 台鐵 太魯閣號', speed: 130, isExpress: true },
                { name: '🚆 台鐵 區間快車', speed: 96, isExpress: false },
              ];

              let trainCount = 0;
              traData.lines.forEach((line: any) => {
                if (line.shape && Array.isArray(line.shape) && line.shape.length > 10) {
                  const latlngs: [number, number][] = line.shape;
                  const cum = computeTrackCumulativeKm(latlngs);
                  const totalKm = cum[cum.length - 1];

                  L.polyline(latlngs, {
                    color: line.color || '#06b6d4',
                    weight: 2.5,
                    opacity: 0.75
                  }).bindTooltip(`台鐵 ${line.name}`, { sticky: true }).addTo(railGroup);

                  if (totalKm > 15 && trainCount < traTrainNames.length) {
                    const cfg = traTrainNames[trainCount % traTrainNames.length];
                    trainCount++;
                    const startKm = Math.random() * (totalKm * 0.8) + (totalKm * 0.1);
                    const traIcon = L.divIcon({
                      className: 'custom-train-tra',
                      html: `<div class="w-6 h-6 rounded-full ${cfg.isExpress ? 'bg-cyan-600' : 'bg-teal-600'} border-2 border-white flex items-center justify-center text-[10px] text-white shadow-[0_0_10px_#06b6d4] animate-pulse">🚆</div>`,
                      iconSize: [24, 24],
                      iconAnchor: [12, 12]
                    });
                    const { pos } = interpolatePosAlongTrack(latlngs, cum, startKm);
                    const marker = L.marker(pos, { icon: traIcon })
                      .bindTooltip(`<div class="p-1 font-sans text-xs font-bold text-cyan-400">${cfg.name} (時速 ${cfg.speed} km/h)</div>`)
                      .addTo(railGroup);

                    activeVehicles.push({
                      marker,
                      name: cfg.name,
                      systemName: '台鐵公司',
                      path: latlngs,
                      cum,
                      totalKm,
                      curDistKm: startKm,
                      direction: trainCount % 2 === 0 ? 1 : -1,
                      speedKmH: cfg.speed,
                      type: cfg.isExpress ? 'tra_express' : 'tra_local'
                    });
                  }
                }
              });
            }
          }
        }

        // 2. All Taiwan Metro Systems (Taipei, Taoyuan, Taichung, Kaohsiung & LRT)
        if (showMetroLayer) {
          const metroRes = await fetch(`${baseUrl}data/metro_track.json`).catch(() => null);
          if (metroRes && metroRes.ok) {
            const metroData = await metroRes.json();
            if (metroData.systems && Array.isArray(metroData.systems)) {
              metroData.systems.forEach((sys: any) => {
                if (sys.lines && Array.isArray(sys.lines)) {
                  sys.lines.forEach((line: any) => {
                    if (line.shape && Array.isArray(line.shape) && line.shape.length > 5) {
                      const latlngs: [number, number][] = line.shape;
                      const cum = computeTrackCumulativeKm(latlngs);
                      const totalKm = cum[cum.length - 1];
                      const lineColor = line.color || '#3b82f6';
                      const isLrt = sys.id.includes('LRT') || line.id === 'C';

                      // Draw MRT Track Polyline
                      L.polyline(latlngs, {
                        color: lineColor,
                        weight: isLrt ? 3 : 3.5,
                        opacity: 0.85,
                        lineCap: 'round',
                        lineJoin: 'round'
                      }).bindTooltip(`🚇 ${sys.name} ${line.name}`, { sticky: true }).addTo(metroGroup);

                      // Determine speed & active trains per line
                      let cruisingSpeed = isLrt ? 38 : (sys.id === 'TYMC' ? 85 : (line.id === 'BR' || line.id === 'Y' ? 55 : 70));
                      let trainInstances = totalKm > 18 ? 2 : (totalKm > 5 ? 1 : 0);

                      for (let i = 0; i < trainInstances; i++) {
                        const dir = i % 2 === 0 ? 1 : -1;
                        const startRatio = i === 0 ? 0.25 : 0.75;
                        const startKm = totalKm * startRatio;
                        const glyph = isLrt ? '🚊' : '🚇';
                        const trainName = `${glyph} ${sys.name} ${line.name} (${dir > 0 ? '順行' : '逆行'})`;

                        const metroIcon = L.divIcon({
                          className: 'custom-metro-train',
                          html: `
                            <div class="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[9px] text-white shadow-lg animate-pulse"
                                 style="background-color: ${lineColor}; box-shadow: 0 0 10px ${lineColor};">
                              ${glyph}
                            </div>
                          `,
                          iconSize: [20, 20],
                          iconAnchor: [10, 10]
                        });

                        const { pos } = interpolatePosAlongTrack(latlngs, cum, startKm);
                        const marker = L.marker(pos, { icon: metroIcon })
                          .bindTooltip(`<div class="p-1 font-sans text-xs font-bold" style="color: ${lineColor}">${trainName} (巡航 ${cruisingSpeed} km/h)</div>`)
                          .addTo(metroGroup);

                        activeVehicles.push({
                          marker,
                          name: trainName,
                          systemName: sys.name,
                          path: latlngs,
                          cum,
                          totalKm,
                          curDistKm: startKm,
                          direction: dir,
                          speedKmH: cruisingSpeed,
                          type: isLrt ? 'lrt' : 'metro'
                        });
                      }
                    }
                  });
                }
              });
            }
          }
        }

        // Animation Loop using physical speed and time delta
        let lastTimestamp = performance.now();
        const animate = (now: number) => {
          const dtSec = Math.min((now - lastTimestamp) / 1000, 0.1);
          lastTimestamp = now;
          const multiplier = speedMultiplierRef.current;

          activeVehicles.forEach(t => {
            const deltaKm = (t.speedKmH / 3600) * dtSec * multiplier;
            t.curDistKm += t.direction * deltaKm;

            if (t.curDistKm >= t.totalKm) {
              t.curDistKm = t.totalKm;
              t.direction = -1;
            } else if (t.curDistKm <= 0) {
              t.curDistKm = 0;
              t.direction = 1;
            }

            const { pos } = interpolatePosAlongTrack(t.path, t.cum, t.curDistKm);
            t.marker.setLatLng(pos);
          });

          animReq = requestAnimationFrame(animate);
        };

        animReq = requestAnimationFrame(animate);
      } catch (err) {
        console.warn('Transit animation error:', err);
      }
    };

    loadTransitData();

    return () => {
      if (animReq) cancelAnimationFrame(animReq);
    };
  }, [showRailLayer, showMetroLayer, mapLoaded]);

  // CCTV Marker Layer Rendering
  useEffect(() => {
    const map = mapInstanceRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup || !mapLoaded) return;

    map.invalidateSize();
    const rawBase = (import.meta as any).env?.BASE_URL || './';
    const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    const iconUrl = (name: string) => `${baseUrl}icons/${name}`;

    const filteredIds = new Set(filteredCctvs.map(c => c.cctvId));

    // Remove deleted markers
    for (const [id, marker] of markersRef.current) {
      if (!filteredIds.has(id)) {
        clusterGroup.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    // Add new markers
    filteredCctvs.forEach(cctv => {
      if (markersRef.current.has(cctv.cctvId)) return;

      const isHighway = cctv.roadName.includes('台') || cctv.roadId.startsWith('T') || cctv.roadId.startsWith('台');
      let iconFile = cctv.status === 'offline' ? (isHighway ? 'marker-highway-offline.webp' : 'marker-freeway-offline.webp') :
                     cctv.status === 'unstable' ? (isHighway ? 'marker-highway-unstable.webp' : 'marker-freeway-unstable.webp') :
                     cctv.status === 'unknown' ? 'marker-unknown.webp' : (isHighway ? 'marker-highway-online.webp' : 'marker-freeway-online.webp');

      const marker = L.marker([cctv.latitude, cctv.longitude], {
        icon: L.icon({
          iconUrl: iconUrl(iconFile),
          iconSize: [32, 32],
          iconAnchor: [16, 32]
        })
      });

      const placeholderSvg = getCctvPlaceholderSvg(cctv.locationName, cctv.roadName, '即時連線中');
      const popupHtml = `
        <div class="p-3 w-64 text-slate-100 font-sans">
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">${cctv.roadName}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${
              cctv.status === 'online' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              cctv.status === 'unstable' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }">
              ${cctv.status === 'online' ? '● 正常' : cctv.status === 'unstable' ? '▲ 不穩' : '✖ 離線'}
            </span>
          </div>
          <h3 class="font-bold text-sm mb-2">${cctv.locationName}</h3>
          <div class="aspect-video bg-slate-950 rounded border border-slate-800 mb-3 overflow-hidden">
            <img id="popup-img-${cctv.cctvId}" src="${cctv.snapshotUrl || cctv.videoUrl || placeholderSvg}" class="w-full h-full object-cover" onerror="this.src='${placeholderSvg}'" />
          </div>
          <div class="grid grid-cols-2 gap-1.5">
            <button id="btn-play-${cctv.cctvId}" class="bg-blue-600 hover:bg-blue-500 text-white font-medium py-1.5 rounded text-xs transition">觀看影像</button>
            <button id="btn-check-${cctv.cctvId}" class="bg-slate-700 hover:bg-slate-600 text-white font-medium py-1.5 rounded text-xs transition">測速檢查</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml).on('popupopen', () => {
        const btnPlay = document.getElementById(`btn-play-${cctv.cctvId}`);
        const btnCheck = document.getElementById(`btn-check-${cctv.cctvId}`);
        const popupImg = document.getElementById(`popup-img-${cctv.cctvId}`) as HTMLImageElement | null;
        if (popupImg) {
          popupImg.onerror = () => {
            popupImg.src = placeholderSvg;
            onMarkOffline?.(cctv.cctvId);
          };
        }
        if (btnPlay) btnPlay.onclick = () => onSelectCctv(cctv);
        if (btnCheck) btnCheck.onclick = () => onCheckStatus(cctv.cctvId);
      });

      clusterGroup.addLayer(marker);
      markersRef.current.set(cctv.cctvId, marker);
    });
  }, [filteredCctvs, mapLoaded, onSelectCctv, onCheckStatus, onMarkOffline]);

  const handleFlyTo = (lat: number, lng: number, zoom: number = 10) => {
    mapInstanceRef.current?.flyTo([lat, lng], zoom, { duration: 1.2, easeLinearity: 0.25 });
  };

  return (
    <div className="relative w-full h-[calc(100vh-160px)] min-h-[520px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800/80 shadow-2xl flex flex-col">
      
      {/* Top Map Control Toolbar */}
      <div className="absolute top-3 left-3 z-[1000] flex flex-wrap items-center gap-2 max-w-[calc(100%-60px)]">
        
        {/* Preset Region Selector */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl overflow-x-auto text-xs">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold px-2 flex items-center gap-1 shrink-0">
            <Compass className="w-3.5 h-3.5 text-blue-400" />
            區域:
          </span>
          <button
            onClick={() => { setRegionFilter('all'); handleFlyTo(23.8, 120.9, 8); }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
              regionFilter === 'all' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            🇹🇼 全台
          </button>
          <button
            onClick={() => { setRegionFilter('北部'); handleFlyTo(25.0, 121.5, 10); }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
              regionFilter === '北部' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            北區
          </button>
          <button
            onClick={() => { setRegionFilter('中部'); handleFlyTo(24.1, 120.6, 10); }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
              regionFilter === '中部' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            中區
          </button>
          <button
            onClick={() => { setRegionFilter('南部'); handleFlyTo(22.8, 120.3, 10); }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
              regionFilter === '南部' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            南區
          </button>
          <button
            onClick={() => { setRegionFilter('東部'); handleFlyTo(24.3, 121.7, 9); }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
              regionFilter === '東部' ? 'bg-blue-600 text-white border-blue-500' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            東區
          </button>
        </div>

        {/* Status Health Filter Pills (Green / Yellow / Red) */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl overflow-x-auto text-xs">
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold px-2 flex items-center gap-1 shrink-0">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            健康度:
          </span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2 py-1 rounded-lg font-medium whitespace-nowrap transition border ${
              statusFilter === 'all' ? 'bg-slate-700 text-white border-slate-500' : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            全部
          </button>
          <button
            onClick={() => setStatusFilter('online')}
            className={`px-2 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 border ${
              statusFilter === 'online' ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-900/30' : 'bg-slate-800/80 text-emerald-400 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            正常
          </button>
          <button
            onClick={() => setStatusFilter('unstable')}
            className={`px-2 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 border ${
              statusFilter === 'unstable' ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-900/30' : 'bg-slate-800/80 text-amber-400 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            連線不穩
          </button>
          <button
            onClick={() => setStatusFilter('offline')}
            className={`px-2 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1 border ${
              statusFilter === 'offline' ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-900/30' : 'bg-slate-800/80 text-rose-400 hover:bg-slate-700 border-slate-700/50'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            離線
          </button>
        </div>

        {/* Highway Preset Selectors */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl overflow-x-auto text-xs">
          <button
            onClick={() => { setRoadFilter('國道1號'); handleFlyTo(24.2, 120.7, 9); }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
              roadFilter === '國道1號' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
            }`}
          >
            國1 中山高
          </button>
          <button
            onClick={() => { setRoadFilter('國道3號'); handleFlyTo(24.1, 120.8, 9); }}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition ${
              roadFilter === '國道3號' ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 border border-slate-700/50'
            }`}
          >
            國3 福爾摩沙
          </button>
          <button
            onClick={() => { setRoadFilter('國道5號'); handleFlyTo(24.9, 121.7, 11); }}
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

        {/* Rail & Metro Layer Toggles + Multiplier */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-1.5 flex items-center gap-1.5 shadow-2xl text-xs">
          
          {/* Rail Toggle */}
          <button
            onClick={() => setShowRailLayer(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1.5 border ${
              showRailLayer ? 'bg-orange-600/90 text-white border-orange-400 shadow-md shadow-orange-900/40' : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 border-slate-700/50'
            }`}
            title="開啟/關閉 台灣高鐵與台鐵動態列車軌跡"
          >
            <Train className="w-3.5 h-3.5" />
            <span>🚆 鐵道動態 {showRailLayer ? '開' : '關'}</span>
          </button>

          {/* Metro Toggle */}
          <button
            onClick={() => setShowMetroLayer(prev => !prev)}
            className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-1.5 border ${
              showMetroLayer ? 'bg-purple-600/90 text-white border-purple-400 shadow-md shadow-purple-900/40' : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 border-slate-700/50'
            }`}
            title="開啟/關閉 台北/桃園/台中/高雄捷運與輕軌路網"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>🚇 捷運路網 {showMetroLayer ? '開' : '關'}</span>
          </button>

          {(showRailLayer || showMetroLayer) && (
            <div className="flex items-center gap-1 bg-slate-950/90 px-1.5 py-0.5 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 font-mono">倍率:</span>
              {[1, 3, 5].map(m => (
                <button
                  key={m}
                  onClick={() => setSpeedMultiplier(m)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                    speedMultiplier === m ? 'bg-blue-500 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {m}x
                </button>
              ))}
            </div>
          )}

        </div>

      </div>

      {/* Map Leaflet Container */}
      <div ref={mapContainerRef} className="w-full h-full z-1" />

      {/* Map Bottom Legend Overlay (Three-tier Health + Transit indicators) */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl px-3.5 py-2 shadow-2xl flex flex-wrap items-center gap-4 text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">顯示站點:</span>
          <strong className="text-white font-mono ml-1 text-sm">{filteredCctvs.length}</strong>
        </span>
        <div className="h-3 w-px bg-slate-800 hidden sm:block"></div>
        <div className="flex items-center space-x-3 text-[11px] font-medium">
          <button 
            onClick={() => setStatusFilter(statusFilter === 'online' ? 'all' : 'online')} 
            className="flex items-center space-x-1.5 text-emerald-400 hover:opacity-80 transition"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_6px_#10b981]"></span>
            <span>🟢 正常</span>
          </button>
          <button 
            onClick={() => setStatusFilter(statusFilter === 'unstable' ? 'all' : 'unstable')} 
            className="flex items-center space-x-1.5 text-amber-400 hover:opacity-80 transition"
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shadow-[0_0_6px_#f59e0b]"></span>
            <span>🟡 連線不穩</span>
          </button>
          <button 
            onClick={() => setStatusFilter(statusFilter === 'offline' ? 'all' : 'offline')} 
            className="flex items-center space-x-1.5 text-rose-400 hover:opacity-80 transition"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block shadow-[0_0_6px_#ef4444]"></span>
            <span>🔴 斷線/異常</span>
          </button>
        </div>
      </div>

    </div>
  );
};
