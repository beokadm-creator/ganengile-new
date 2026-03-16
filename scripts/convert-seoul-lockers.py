#!/usr/bin/env python3
"""
Convert Seoul Metro locker CSVs (cp949) into JSON for import.

Usage:
  python3 scripts/convert-seoul-lockers.py \\
    --counts /Users/aaron/Downloads/서울교통공사_물품보관함 설치수량_20241231.csv \\
    --locations /Users/aaron/Downloads/서울교통공사_물품보관함 위치정보_20240930.csv \\
    --out /Users/aaron/ganengile-new/data/seoul-lockers-2024-12.json
"""

import argparse
import csv
import json
import re

def read_csv(path: str):
  with open(path, "r", encoding="cp949") as f:
    reader = csv.DictReader(f)
    return list(reader)

def parse_station_name(locker_name: str) -> str:
  if not locker_name:
    return ""
  name = locker_name.strip()
  # Remove parentheses content (e.g., 충정로(1~15))
  name = re.sub(r"\(.*?\)", "", name)
  # Remove trailing single uppercase letter (e.g., 충정로B)
  name = re.sub(r"[A-Z]$", "", name)
  # Capture station name with digits + '가' (e.g., 종로3가, 을지로4가)
  m = re.match(r"^([가-힣]+\d+가)", name)
  if m:
    return m.group(1)
  # Otherwise strip trailing digits/ranges (e.g., 가락시장14~22 -> 가락시장)
  name = re.sub(r"\d+.*$", "", name)
  return name

def main():
  parser = argparse.ArgumentParser()
  parser.add_argument("--counts", required=True)
  parser.add_argument("--locations", required=True)
  parser.add_argument("--out", required=True)
  args = parser.parse_args()

  counts = read_csv(args.counts)
  locations = read_csv(args.locations)

  # Build location map by line + locker name
  loc_map = {}
  for row in locations:
    key = f"{row.get('호선','')}/{row.get('보관함명','')}"
    loc_map[key] = row.get("상세위치", "")

  merged = []
  for row in counts:
    line = row.get("호선", "").strip()
    locker_name = row.get("보관함명", "").strip()
    if not line or not locker_name:
      continue

    key = f"{line}/{locker_name}"
    detail = loc_map.get(key, "")
    station_name = parse_station_name(locker_name)

    def to_int(val):
      try:
        return int(val)
      except:
        return 0

    merged.append({
      "line": line,
      "lockerName": locker_name,
      "stationName": station_name,
      "detailLocation": detail,
      "counts": {
        "small": to_int(row.get("소형", 0)),
        "medium": to_int(row.get("중형", 0)),
        "large": to_int(row.get("대형", 0)),
      },
    })

  with open(args.out, "w", encoding="utf-8") as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

  print(f"✅ Converted {len(merged)} rows -> {args.out}")

if __name__ == "__main__":
  main()
