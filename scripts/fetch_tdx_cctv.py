import os
import sys
import json
import re
from pathlib import Path
import requests

# Find .env file
ENV_PATHS = [
    Path(__file__).parent.parent / "TMP" / ".env",
    Path("/home/toby/projects/work-tools/tdx_tools/.env"),
]

def load_env():
    env_vars = {}
    for path in ENV_PATHS:
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and "=" in line and not line.startswith("#"):
                        k, v = line.split("=", 1)
                        env_vars[k.strip()] = v.strip()
            print(f"Loaded credentials from {path}")
            break
    return env_vars

def get_tdx_token(client_id, client_secret):
    url = "https://tdx.transportdata.tw/auth/realms/TDXConnect/protocol/openid-connect/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret
    }
    headers = {"content-type": "application/x-www-form-urlencoded"}
    res = requests.post(url, data=payload, headers=headers, timeout=15)
    res.raise_for_status()
    data = res.json()
    return data.get("access_token")

def parse_region_from_road(road_name, lat, lng):
    if lat > 24.5:
        return "北部"
    elif lat > 23.5:
        if lng > 121.2:
            return "東部"
        return "中部"
    elif lat > 22.0:
        if lng > 120.8:
            return "東部"
        return "南部"
    else:
        return "南部"

def clean_cctv_item(raw, cctv_type):
    # Field extraction with fallbacks across TDX versions
    cctv_id = raw.get("CCTVID") or raw.get("cctvId") or f"{cctv_type.upper()}-{raw.get('RoadName', '')}-{raw.get('PositionLat', 0)}"
    cctv_name = raw.get("CCTVName") or raw.get("LocationDescription") or raw.get("RoadName") or cctv_id
    road_name = raw.get("RoadName") or raw.get("RoadSection", {}).get("RoadName") or "其它道路"
    road_id = raw.get("RoadID") or raw.get("RoadClass") or road_name
    
    pos = raw.get("PositionLon") or raw.get("PositionLat")
    if isinstance(raw.get("Position"), dict):
        lat = raw["Position"].get("PositionLat", 0.0)
        lng = raw["Position"].get("PositionLon", 0.0)
    else:
        lat = float(raw.get("PositionLat") or 0.0)
        lng = float(raw.get("PositionLon") or 0.0)
        
    stream_url = raw.get("VideoStreamURL") or raw.get("StreamURL") or ""
    image_url = raw.get("VideoImageURL") or raw.get("ImageURL") or ""
    
    region = parse_region_from_road(road_name, lat, lng)
    direction = raw.get("Direction") or "雙向"
    
    km_match = re.search(r"(\d+(?:\.\d+)?)\s*K", str(cctv_name), re.IGNORECASE)
    km = float(km_match.group(1)) if km_match else 0.0

    return {
        "cctvId": cctv_id,
        "type": cctv_type,
        "cctvName": cctv_name,
        "roadId": str(road_id),
        "roadName": str(road_name),
        "region": region,
        "direction": str(direction),
        "km": km,
        "lat": round(lat, 6),
        "lng": round(lng, 6),
        "videoStreamURL": stream_url,
        "videoImageURL": image_url,
        "status": "online" if (stream_url or image_url) else "unknown",
        "lastChecked": raw.get("UpdateTime") or raw.get("SrcUpdateTime") or ""
    }

def main():
    env = load_env()
    client_id = env.get("ClientId")
    client_secret = env.get("ClientSecret")

    if not client_id or not client_secret:
        print("Error: ClientId or ClientSecret missing!")
        sys.exit(1)

    print("Requesting OAuth2 Token from TDX...")
    token = get_tdx_token(client_id, client_secret)
    print("Token received successfully.")

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }

    endpoints = [
        ("https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/CCTV/Freeway?%24format=JSON", "freeway"),
        ("https://tdx.transportdata.tw/api/basic/v2/Road/Traffic/CCTV/Highway?%24format=JSON", "highway"),
    ]

    all_cctvs = []

    for url, cctv_type in endpoints:
        print(f"Fetching {cctv_type} CCTV from {url}...")
        try:
            res = requests.get(url, headers=headers, timeout=30)
            res.raise_for_status()
            data = res.json()
            # TDX response can be list or dict wrapping CCTVs list
            items = data if isinstance(data, list) else data.get("CCTVs", []) or data.get("CCTVList", [])
            print(f"  Got {len(items)} raw {cctv_type} CCTV records.")
            
            for raw in items:
                cleaned = clean_cctv_item(raw, cctv_type)
                # Ensure valid coordinates in Taiwan bounding box
                if 21.5 <= cleaned["lat"] <= 25.5 and 119.0 <= cleaned["lng"] <= 122.5:
                    all_cctvs.append(cleaned)

        except Exception as e:
            print(f"Error fetching {cctv_type} CCTV: {e}")

    print(f"\nTotal valid CCTV records processed: {len(all_cctvs)}")

    output_path = Path(__file__).parent.parent / "public" / "data" / "taiwan_cctv.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_cctvs, f, ensure_ascii=False, indent=2)

    print(f"Successfully saved to {output_path} ({output_path.stat().st_size / 1024:.1f} KB)")

if __name__ == "__main__":
    main()
