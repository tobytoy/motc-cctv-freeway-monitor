#!/usr/bin/env python3
"""
TDX MOTC & Urban City CCTV Data Pipeline
Fetches all active Freeway (高公局), Highway (公路局), and City (雙北/六都/各縣市) CCTVs,
builds multi-source streaming fallback options (HLS / MJPEG / ATIS snapshot),
parses accurate road names, coordinates, and health status,
and outputs to public/data/taiwan_cctv.json.
"""

import os
import sys
import json
import time
import re
from pathlib import Path
import requests

def load_env():
    env_vars = {}
    env_file = Path(__file__).parent.parent / ".env"
    if env_file.exists():
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip("'\"")
    for key in ["ClientId", "ClientSecret", "TDX_CLIENT_ID", "TDX_CLIENT_SECRET"]:
        if key in os.environ:
            env_vars[key] = os.environ[key]
    if "TDX_CLIENT_ID" in env_vars and "ClientId" not in env_vars:
        env_vars["ClientId"] = env_vars["TDX_CLIENT_ID"]
    if "TDX_CLIENT_SECRET" in env_vars and "ClientSecret" not in env_vars:
        env_vars["ClientSecret"] = env_vars["TDX_CLIENT_SECRET"]
    return env_vars

def get_tdx_token(client_id, client_secret):
    url = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret
    }
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    try:
        res = requests.post(url, data=payload, headers=headers, timeout=15)
        res.raise_for_status()
        return res.json().get("access_token")
    except Exception as e:
        print(f"Warning: Failed to obtain TDX token ({e}).")
        return None

def parse_region_from_coord(lat, lng):
    if lng > 121.5 and lat < 24.9 and lat > 23.5:
        if lat < 24.3:
            return "東部"
    if lat >= 24.6:
        return "北部"
    elif lat >= 23.5:
        if lng > 121.2:
            return "東部"
        return "中部"
    elif lat >= 22.0:
        if lng > 120.8:
            return "東部"
        return "南部"
    else:
        return "南部"

def parse_city_from_cctv(raw, road_name, cctv_name, cctv_type, default_city=None):
    if default_city:
        return default_city
    text = f"{road_name} {cctv_name} {raw.get('SurveillanceDescription', '')} {raw.get('LocationDescription', '')}"
    cities = [
        "臺北市", "台北市", "新北市", "桃園市", "臺中市", "台中市", "臺南市", "台南市", "高雄市",
        "基隆市", "新竹市", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣",
        "屏東縣", "宜蘭縣", "花蓮縣", "臺東縣", "台東縣", "澎湖縣", "金門縣", "連江縣"
    ]
    for c in cities:
        if c in text:
            return c.replace("台北市", "臺北市").replace("台中市", "臺中市").replace("台南市", "臺南市").replace("台東縣", "臺東縣")
    return "跨區/國道" if cctv_type == "freeway" else "公路局省道"

def format_road_name(cctv_id, cctv_name, road_id, raw_road_name, cctv_type):
    name_str = f"{cctv_name} {raw_road_name} {cctv_id} {road_id}"
    
    # 1. Check Freeway patterns
    m_freeway = re.search(r"國道\s*(\d+[甲乙]?)\s*號?", name_str)
    if m_freeway:
        num = m_freeway.group(1)
        return f"國道{num}號" if not num.endswith("甲") and not num.endswith("乙") else f"國道{num}"
    
    m_n = re.search(r"CCTV-N(\d+[A-Z]?)-", cctv_id)
    if m_n:
        n = m_n.group(1)
        if n == "3A": return "國道3甲"
        return f"國道{n}號"

    freeway_id_map = {
        "000010": "國道1號", "000011": "國道1號高架", "000020": "國道2號",
        "000030": "國道3號", "000031": "國道3甲", "000040": "國道4號",
        "000050": "國道5號", "000060": "國道6號", "000080": "國道8號",
        "000100": "國道10號", "00001A": "國道1甲", "000070": "國道7號",
        "000090": "國道9號"
    }
    if str(road_id) in freeway_id_map:
        return freeway_id_map[str(road_id)]
    
    # 2. Check Highway patterns (省道/快速公路)
    m_hw = re.search(r"台\s*(\d+[甲乙丙丁]?)\s*線?", name_str)
    if m_hw:
        return f"台{m_hw.group(1)}線"

    m_t = re.search(r"CCTV-T(\d+[A-Z]?)-", cctv_id)
    if m_t:
        return f"台{m_t.group(1)}線"

    if str(road_id).startswith("6") and len(str(road_id)) == 4:
        return f"台{str(road_id)[:2]}線"
    
    if raw_road_name and raw_road_name not in ["其它道路", "其它", "一般道路", "市區道路"]:
        return raw_road_name
        
    m_street = re.search(r"([\u4e00-\u9fa5]+(?:路|街|大道|段|橋|高架|隧道|快速道路))", cctv_name)
    if m_street:
        return m_street.group(1)

    if cctv_type == "freeway":
        return "國道高速公路"
    elif cctv_type == "highway":
        return "省道快速公路"
    return "市區道路"

def build_stream_sources(cctv_id, stream_url, image_url, cctv_type, city=""):
    sources = []
    
    # 1. New Taipei City logic
    if "ntpc.gov.tw" in stream_url or city == "新北市" or cctv_id.startswith("C000"):
        hls_url = stream_url
        if "cctvatis" in stream_url and "flv" in stream_url:
            hls_url = stream_url.replace("flv/", "hls/") + "/live.m3u8"
        elif "atis.ntpc.gov.tw" in stream_url and "/C" in stream_url:
            dev_id = stream_url.split("/")[-1]
            hls_url = f"https://cctvatis6.ntpc.gov.tw/hls/{dev_id}/live.m3u8"
        elif not stream_url.endswith(".m3u8"):
            hls_url = f"https://cctvatis6.ntpc.gov.tw/hls/{cctv_id}/live.m3u8"
        
        sources.append({
            "id": "src-hls",
            "name": "新北市 ATIS 高清串流 (HLS)",
            "type": "hls",
            "url": hls_url,
            "quality": "720p",
            "isPrimary": True
        })
        
        alt_url = stream_url if stream_url != hls_url else image_url or f"https://atis.ntpc.gov.tw/ATIS/ShowFrame4CCTV/{cctv_id}"
        sources.append({
            "id": "src-atis",
            "name": "新北市交通局備用源 (ATIS)",
            "type": "mjpg" if "mjpg" in alt_url else "snapshot",
            "url": alt_url,
            "quality": "480p",
            "isPrimary": False
        })

    # 2. Taipei City logic
    elif "gov.taipei" in stream_url or city == "臺北市" or cctv_id.startswith("T000"):
        hls_url = stream_url
        if "hls.bote.gov.taipei" in stream_url and "index.html?id=" in stream_url:
            cam_num = stream_url.split("id=")[-1]
            hls_url = f"https://hls.bote.gov.taipei/live/{cam_num}.m3u8"
        
        sources.append({
            "id": "src-tpe-hls",
            "name": "台北市交工處高清串流 (HLS)",
            "type": "hls",
            "url": hls_url,
            "quality": "1080p" if "jtmc" in hls_url else "720p",
            "isPrimary": True
        })
        sources.append({
            "id": "src-tpe-snap",
            "name": "台北市備用快照源",
            "type": "snapshot",
            "url": image_url or stream_url,
            "quality": "480p",
            "isPrimary": False
        })

    # 3. Freeway logic (高公局)
    elif cctv_type == "freeway":
        is_hls = stream_url.endswith(".m3u8") or ".m3u8" in stream_url
        hls_candidate = stream_url if is_hls else f"https://cctv.freeway.gov.tw/live/{cctv_id}.m3u8"
        mjpg_candidate = stream_url if ("bmjpg" in stream_url or "mjpg" in stream_url) else image_url or f"https://cctvn.freeway.gov.tw/abs2mjpg/bmjpg?camera={cctv_id}"
        
        sources.append({
            "id": "src-freeway-hls",
            "name": "國道高速公路 HLS 串流",
            "type": "hls",
            "url": hls_candidate,
            "quality": "720p",
            "isPrimary": is_hls
        })
        sources.append({
            "id": "src-freeway-mjpg",
            "name": "高公局即時 MJPEG 輪播",
            "type": "mjpg",
            "url": mjpg_candidate,
            "quality": "480p",
            "isPrimary": not is_hls
        })

    # 4. Highway logic (公路局)
    elif cctv_type == "highway":
        sources.append({
            "id": "src-thb-primary",
            "name": "公路局省道主訊號",
            "type": "hls" if ".m3u8" in stream_url else "mjpg" if "mjpg" in stream_url else "snapshot",
            "url": stream_url or image_url,
            "quality": "720p" if ".m3u8" in stream_url else "480p",
            "isPrimary": True
        })
        if image_url and image_url != stream_url:
            sources.append({
                "id": "src-thb-backup",
                "name": "公路局備援快照",
                "type": "snapshot",
                "url": image_url,
                "quality": "SD",
                "isPrimary": False
            })
        else:
            sec_url = stream_url.replace("cctv-ss01", "cctv-ss02") if "cctv-ss01" in stream_url else stream_url
            sources.append({
                "id": "src-thb-node2",
                "name": "公路局備用節點",
                "type": "snapshot",
                "url": sec_url,
                "quality": "SD",
                "isPrimary": False
            })

    # 5. Default City / Other Roads
    else:
        sources.append({
            "id": "src-city-primary",
            "name": f"{city or '市區'} 即時路況串流",
            "type": "hls" if ".m3u8" in stream_url else "mjpg" if "mjpg" in stream_url else "snapshot",
            "url": stream_url or image_url,
            "quality": "720p" if ".m3u8" in stream_url else "480p",
            "isPrimary": True
        })
        if image_url and image_url != stream_url:
            sources.append({
                "id": "src-city-backup",
                "name": f"{city or '市區'} 備用影像源",
                "type": "snapshot",
                "url": image_url,
                "quality": "SD",
                "isPrimary": False
            })

    return sources

def clean_cctv_item(raw, cctv_type, default_city=None):
    cctv_id = raw.get("CCTVID") or raw.get("cctvId") or f"{cctv_type.upper()}-{raw.get('RoadName', '')}-{raw.get('PositionLat', 0)}"
    cctv_name = raw.get("CCTVName") or raw.get("SurveillanceDescription") or raw.get("LocationDescription") or raw.get("RoadName") or cctv_id
    raw_road_name = raw.get("RoadName") or raw.get("RoadSection", {}).get("RoadName") or ""
    road_id = raw.get("RoadID") or raw.get("RoadClass") or raw_road_name or ""
    
    if isinstance(raw.get("Position"), dict):
        lat = float(raw["Position"].get("PositionLat", 0.0))
        lng = float(raw["Position"].get("PositionLon", 0.0))
    else:
        lat = float(raw.get("PositionLat") or 0.0)
        lng = float(raw.get("PositionLon") or 0.0)
        
    stream_url = raw.get("VideoStreamURL") or raw.get("StreamURL") or ""
    image_url = raw.get("VideoImageURL") or raw.get("ImageURL") or ""
    
    region = parse_region_from_coord(lat, lng)
    direction = raw.get("Direction") or raw.get("RoadDirection") or "雙向"
    if direction in ["N", "北"]: direction = "北向"
    elif direction in ["S", "南"]: direction = "南向"
    elif direction in ["E", "東"]: direction = "東向"
    elif direction in ["W", "西"]: direction = "西向"
    
    km_match = re.search(r"(\d+(?:\.\d+)?)\s*K", str(cctv_name), re.IGNORECASE)
    km = float(km_match.group(1)) if km_match else 0.0

    raw_status = str(raw.get("SurveillanceType") if raw.get("SurveillanceType") is not None else raw.get("Status") if raw.get("Status") is not None else "1").strip()
    if not stream_url and not image_url:
        status = "offline"
    elif raw_status in ["0", "false", "offline", "error", "0.0"]:
        status = "offline"
    else:
        status = "online"

    road_name = format_road_name(cctv_id, cctv_name, road_id, raw_road_name, cctv_type)
    city = parse_city_from_cctv(raw, road_name, cctv_name, cctv_type, default_city)
    layer_type = "freeway" if cctv_type == "freeway" else "highway" if cctv_type == "highway" else "city"
    sources = build_stream_sources(cctv_id, stream_url, image_url, cctv_type, city)

    primary_source = next((s for s in sources if s.get("isPrimary")), sources[0] if sources else None)
    backup_source = next((s for s in sources if not s.get("isPrimary")), None)

    return {
        "cctvId": str(cctv_id),
        "type": cctv_type,
        "layerType": layer_type,
        "city": city,
        "cctvName": str(cctv_name),
        "locationName": str(cctv_name),
        "roadId": str(road_id),
        "roadName": str(road_name),
        "region": region,
        "direction": str(direction),
        "km": km,
        "mileage": f"{km}K" if km > 0 else None,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "sources": sources,
        "activeSourceIndex": 0,
        "videoStreamURL": primary_source["url"] if primary_source else (stream_url or image_url),
        "videoUrl": primary_source["url"] if primary_source else (stream_url or image_url),
        "videoImageURL": backup_source["url"] if backup_source else (image_url or stream_url),
        "snapshotUrl": backup_source["url"] if backup_source else (image_url or stream_url),
        "status": status,
        "lastChecked": raw.get("UpdateTime") or raw.get("SrcUpdateTime") or ""
    }

def fetch_with_retry(url, headers, max_retries=3, delay=1.5):
    for attempt in range(max_retries):
        try:
            res = requests.get(url, headers=headers, timeout=25)
            if res.status_code == 429:
                wait_time = delay * (attempt + 1) * 1.5
                print(f"    [Rate limit 429] waiting {wait_time:.1f}s before retry {attempt + 1}...")
                time.sleep(wait_time)
                continue
            res.raise_for_status()
            return res.json()
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                print(f"    Failed after {max_retries} attempts: {e}")
                return None
            time.sleep(delay)
    return None

def main():
    env = load_env()
    client_id = env.get("ClientId")
    client_secret = env.get("ClientSecret")

    output_path = Path(__file__).parent.parent / "public" / "data" / "taiwan_cctv.json"

    if not client_id or not client_secret:
        if output_path.exists():
            print("No TDX credentials found in environment. Using existing pre-built public/data/taiwan_cctv.json")
            return
        else:
            print("Error: ClientId or ClientSecret missing and no cached taiwan_cctv.json found!")
            sys.exit(1)

    print("Requesting OAuth2 Token from TDX...")
    token = get_tdx_token(client_id, client_secret)
    if not token:
        if output_path.exists():
            print("Warning: Failed to obtain TDX token. Safely falling back to existing public/data/taiwan_cctv.json.")
            return
        else:
            print("Error: Failed to obtain TDX token and no cached taiwan_cctv.json found!")
            sys.exit(1)
    print("Token received successfully.")

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }

    endpoints = [
        ("https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/CCTV/Freeway?%24format=JSON", "freeway", "跨區/國道"),
        ("https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/CCTV/Highway?%24format=JSON", "highway", "公路局省道"),
    ]

    city_endpoints = [
        ("Taipei", "臺北市"),
        ("NewTaipei", "新北市"),
        ("Taoyuan", "桃園市"),
        ("Taichung", "臺中市"),
        ("Tainan", "臺南市"),
        ("Kaohsiung", "高雄市"),
        ("Keelung", "基隆市"),
        ("Hsinchu", "新竹市"),
        ("HsinchuCounty", "新竹縣"),
        ("MiaoliCounty", "苗栗縣"),
        ("ChanghuaCounty", "彰化縣"),
        ("NantouCounty", "南投縣"),
        ("YunlinCounty", "雲林縣"),
        ("Chiayi", "嘉義市"),
        ("PingtungCounty", "屏東縣"),
        ("YilanCounty", "宜蘭縣"),
        ("TaitungCounty", "臺東縣"),
    ]

    for city_code, city_name in city_endpoints:
        url = f"https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/CCTV/City/{city_code}?%24format=JSON"
        endpoints.append((url, "city", city_name))

    all_cctvs = []
    seen_ids = set()

    for url, cctv_type, city_name in endpoints:
        print(f"Fetching {cctv_type} CCTV for {city_name} from {url[:90]}...")
        data = fetch_with_retry(url, headers)
        
        # Pacing to avoid hitting TDX 429 rate limit
        time.sleep(0.8)

        if not data:
            continue

        raw_items = []
        if isinstance(data, list):
            raw_items = data
        elif isinstance(data, dict):
            raw_items = data.get("CCTVs") or data.get("CCTVList") or data.get("value") or []

        print(f"  Got {len(raw_items)} raw {cctv_type} CCTV records.")
        added_count = 0

        for raw in raw_items:
            item = clean_cctv_item(raw, cctv_type, default_city=city_name if cctv_type == "city" else None)
            
            # Coordinate bounding box validation for Taiwan territory
            if not (21.0 <= item["lat"] <= 26.5 and 119.0 <= item["lng"] <= 123.0):
                continue
                
            if item["cctvId"] in seen_ids:
                continue

            seen_ids.add(item["cctvId"])
            all_cctvs.append(item)
            added_count += 1

        print(f"  Added {added_count} unique valid CCTV items.")

    print("==========================================")
    print(f"Total valid CCTV records processed: {len(all_cctvs)}")
    layers = {}
    cities = {}
    for c in all_cctvs:
        layers[c["layerType"]] = layers.get(c["layerType"], 0) + 1
        cities[c["city"]] = cities.get(c["city"], 0) + 1
    print(f"Layer breakdown: {layers}")
    print(f"Top 5 Cities: {sorted(cities.items(), key=lambda x: x[1], reverse=True)[:5]}")
    print("==========================================")

    if len(all_cctvs) < 1000 and output_path.exists():
        print(f"Warning: Fetched count ({len(all_cctvs)}) is too low. Keeping existing pre-built dataset {output_path}.")
        return

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_cctvs, f, ensure_ascii=False, indent=2)

    print(f"Successfully saved to {output_path} ({output_path.stat().st_size / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
