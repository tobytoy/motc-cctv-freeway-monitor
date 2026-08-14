import { XMLParser } from 'fast-xml-parser';
import { CCTVItem, CCTVStatus, TaiwanRegion, DirectionType } from '../types/cctv';
import { FALLBACK_CCTVS } from '../data/fallbackCCTV';

export function formatRoadName(roadId: string, locationStr: string = ''): string {
  if (!roadId) {
    if (locationStr.includes('國1') || locationStr.includes('國道1')) return '國道1號';
    if (locationStr.includes('國3') || locationStr.includes('國道3')) return '國道3號';
    if (locationStr.includes('國5') || locationStr.includes('國道5')) return '國道5號';
    if (locationStr.includes('國2') || locationStr.includes('國道2')) return '國道2號';
    if (locationStr.includes('國4') || locationStr.includes('國道4')) return '國道4號';
    if (locationStr.includes('國6') || locationStr.includes('國道6')) return '國道6號';
    if (locationStr.includes('國8') || locationStr.includes('國道8')) return '國道8號';
    if (locationStr.includes('國10') || locationStr.includes('國道10')) return '國道10號';
    if (locationStr.includes('台61')) return '台61線';
    if (locationStr.includes('台64')) return '台64線';
    if (locationStr.includes('台65')) return '台65線';
    return '一般公路';
  }

  const clean = roadId.toUpperCase().trim();
  switch (clean) {
    case 'N1':
    case '1': return '國道1號';
    case 'N2':
    case '2': return '國道2號';
    case 'N3':
    case '3': return '國道3號';
    case 'N4':
    case '4': return '國道4號';
    case 'N5':
    case '5': return '國道5號';
    case 'N6':
    case '6': return '國道6號';
    case 'N8':
    case '8': return '國道8號';
    case 'N10':
    case '10': return '國道10號';
    case 'N3A': return '國道3甲';
    case 'T61': return '台61線';
    case 'T64': return '台64線';
    case 'T65': return '台65線';
    case 'T68': return '台68線';
    case 'T88': return '台88線';
    default:
      if (clean.startsWith('N')) return `國道${clean.substring(1)}號`;
      if (clean.startsWith('T')) return `台${clean.substring(1)}線`;
      return roadId;
  }
}

export function determineRegion(lat: number, lng: number): TaiwanRegion {
  if (lng > 121.5 && lat < 24.9 && lat > 23.5) {
    if (lat < 24.3) return '東部';
  }
  if (lat >= 24.6) return '北部';
  if (lat >= 23.5) return '中部';
  if (lat >= 22.0) return '南部';
  return '東部';
}

export function parseDirection(location: string): DirectionType {
  if (location.includes('北上') || location.includes('北向')) return '北向';
  if (location.includes('南下') || location.includes('南向')) return '南向';
  if (location.includes('東向') || location.includes('東行')) return '東向';
  if (location.includes('西向') || location.includes('西行')) return '西向';
  if (location.includes('雙向')) return '雙向';
  return '未知';
}

export function extractMileage(location: string): string | undefined {
  const match = location.match(/(\d+(\.\d+)?)\s*K/i);
  if (match) return `${match[1]}K`;
  return undefined;
}

/**
 * Parses XML text into CCTVItem list
 */
export function parseCctvXml(xmlText: string): CCTVItem[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: true,
  });

  const jsonObj = parser.parse(xmlText);
  let rawList: any[] = [];

  if (jsonObj?.XML_Head?.CCTVs?.CCTV) {
    rawList = Array.isArray(jsonObj.XML_Head.CCTVs.CCTV) ? jsonObj.XML_Head.CCTVs.CCTV : [jsonObj.XML_Head.CCTVs.CCTV];
  } else if (jsonObj?.CCTVList?.CCTV) {
    rawList = Array.isArray(jsonObj.CCTVList.CCTV) ? jsonObj.CCTVList.CCTV : [jsonObj.CCTVList.CCTV];
  } else if (jsonObj?.CCTVs?.CCTV) {
    rawList = Array.isArray(jsonObj.CCTVs.CCTV) ? jsonObj.CCTVs.CCTV : [jsonObj.CCTVs.CCTV];
  } else {
    const findCctvs = (obj: any): any[] | null => {
      if (!obj || typeof obj !== 'object') return null;
      if (Array.isArray(obj.CCTV)) return obj.CCTV;
      for (const key in obj) {
        const res = findCctvs(obj[key]);
        if (res) return res;
      }
      return null;
    };
    rawList = findCctvs(jsonObj) || [];
  }

  const parsedItems: CCTVItem[] = [];

  for (const item of rawList) {
    const cctvId = item.CCTVID || item.CctvID || item.ID || `CCTV-${Math.random().toString(36).substring(2, 8)}`;
    const roadId = item.RoadID || item.RoadId || item.FreewayID || '';
    const locationName = item.Location || item.CCTVName || item.LocationName || '未知路段';
    
    const lonStr = item.PositionLon ?? item.Px ?? item.Longitude;
    const latStr = item.PositionLat ?? item.Py ?? item.Latitude;

    const lon = parseFloat(lonStr);
    const lat = parseFloat(latStr);

    if (isNaN(lon) || isNaN(lat) || lon < 119.0 || lon > 123.0 || lat < 21.0 || lat > 26.0) {
      continue;
    }

    const videoUrl = item.VideoStreamURL || item.URL || item.VideoURL || item.StreamURL || '';
    const roadName = formatRoadName(roadId, locationName);
    const region = determineRegion(lat, lon);
    const direction = parseDirection(locationName);
    const mileage = extractMileage(locationName);

    // B4: Status from XML; responseTimeMs left as undefined until real probe
    const status: CCTVStatus = item.SurveillanceType === '0' || item.Status === '0' ? 'offline' : 'unknown';

    parsedItems.push({
      cctvId,
      roadId,
      roadName,
      locationName,
      longitude: lon,
      latitude: lat,
      videoUrl: videoUrl || `https://cctv.freeway.gov.tw/live/${cctvId}.m3u8`,
      snapshotUrl: videoUrl.includes('.jpg') || videoUrl.includes('.png') ? videoUrl : undefined,
      // B5: surveillanceType removed (unused)
      status,
      region,
      direction,
      mileage,
      lastChecked: new Date().toISOString(),
      responseTimeMs: undefined, // B4: will be set only after real probeSingleCctvStatus
    });
  }

  return parsedItems;
}

/**
 * Client-side browser fetch with failover chain
 */
export async function fetchCctvListClient(): Promise<{ data: CCTVItem[]; source: 'live' | 'json' | 'fallback' }> {
  // Option 1: Try public static JSON in app with proper Base URL resolution
  try {
    const rawBase = (import.meta as any).env?.BASE_URL || './';
    const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;
    const jsonUrl = new URL(`${baseUrl}data/taiwan_cctv.json`, window.location.origin + window.location.pathname).href;
    
    const res = await fetch(jsonUrl);
    const contentType = res.headers.get('content-type');
    if (res.ok && (contentType?.includes('json') || jsonUrl.endsWith('.json'))) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const normalized: CCTVItem[] = data.map((item: any) => {
          const streamUrl = item.videoUrl || item.videoStreamURL || item.stream || '';
          const imageUrl = item.snapshotUrl || item.videoImageURL || item.image || streamUrl || '';
          const initialStatus = item.status === 'offline' ? 'offline' :
                                item.status === 'unstable' ? 'unstable' :
                                item.status === 'online' ? 'online' : 'online';

          return {
            cctvId: item.cctvId || item.cctv_id || item.id || `CCTV-${Math.random().toString(36).substring(2, 8)}`,
            roadId: item.roadId || item.road_id || item.roadName || '',
            roadName: item.roadName || item.road_name || '一般道路',
            locationName: item.locationName || item.cctvName || item.name || '即時影像點位',
            longitude: Number(item.longitude ?? item.lng ?? item.PositionLon ?? 121.5),
            latitude: Number(item.latitude ?? item.lat ?? item.PositionLat ?? 25.0),
            videoUrl: streamUrl || imageUrl,
            snapshotUrl: imageUrl || streamUrl || undefined,
            status: initialStatus as CCTVStatus,
            region: (item.region as TaiwanRegion) || determineRegion(Number(item.latitude ?? item.lat ?? 25.0), Number(item.longitude ?? item.lng ?? 121.5)),
            direction: (item.direction as DirectionType) || '雙向',
            mileage: item.mileage || (item.km !== undefined && item.km !== null ? `${item.km}K` : undefined),
            lastChecked: item.lastChecked || item.fetchedAt || new Date().toISOString(),
            responseTimeMs: item.responseTimeMs,
          };
        });
        return { data: normalized, source: 'json' };
      }
    }
  } catch (e) {
    console.warn('JSON fetch failed, trying CORS proxy:', e);
  }

  // Option 2: Try CORS proxy to MOTC Freeway XML
  try {
    const targetXmlUrl = 'https://tisvcloud.freeway.gov.tw/history/motc20/CCTV.xml';
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetXmlUrl)}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    
    const res = await fetch(proxyUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const xmlText = await res.text();
      // Ensure response is actually XML and not JSON error or HTML error
      if (xmlText.includes('<CCTV') || xmlText.includes('<XML_Head>')) {
        const items = parseCctvXml(xmlText);
        if (items.length > 0) {
          return { data: items, source: 'live' };
        }
      }
    }
  } catch (e) {
    console.warn('CORS proxy XML fetch failed:', e);
  }

  return { data: FALLBACK_CCTVS, source: 'fallback' };
}

/**
 * Client-side browser network latency and availability probe for a CCTV item
 */
export async function probeSingleCctvStatus(item: CCTVItem): Promise<{ status: CCTVStatus; responseTimeMs: number }> {
  const startTime = performance.now();
  
  if (!item.videoUrl && !item.snapshotUrl) {
    return { status: 'offline', responseTimeMs: 0 };
  }

  const targetUrl = item.snapshotUrl || item.videoUrl;
  const isImageTarget = Boolean(
    item.snapshotUrl ||
    targetUrl.includes('.jpg') ||
    targetUrl.includes('.jpeg') ||
    targetUrl.includes('.png') ||
    targetUrl.includes('.bmjpg') ||
    targetUrl.includes('mjpg') ||
    targetUrl.includes('snapshot')
  );

  if (isImageTarget) {
    return new Promise((resolve) => {
      let finished = false;
      const timeout = setTimeout(() => {
        if (!finished) {
          finished = true;
          resolve({ status: 'unstable', responseTimeMs: Math.round(performance.now() - startTime) });
        }
      }, 3000);

      const img = new Image();
      img.onload = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          const duration = Math.round(performance.now() - startTime);
          const status: CCTVStatus = duration > 1000 ? 'unstable' : 'online';
          resolve({ status, responseTimeMs: duration });
        }
      };

      img.onerror = () => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          const duration = Math.round(performance.now() - startTime);
          resolve({ status: 'offline', responseTimeMs: duration });
        }
      };

      img.src = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}t=${Date.now()}`;
    });
  } else {
    // Stream (.m3u8) probe via fetch
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      await fetch(targetUrl, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Math.round(performance.now() - startTime);
      const status: CCTVStatus = duration > 1000 ? 'unstable' : 'online';
      return { status, responseTimeMs: duration };
    } catch {
      const duration = Math.round(performance.now() - startTime);
      return { status: 'offline', responseTimeMs: duration };
    }
  }
}
