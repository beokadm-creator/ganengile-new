/**
 * Pathfinding Service
 * 지하철 경로 탐색 서비스 (Dijkstra 알고리즘)
 */

import { getAllStations, getAllTravelTimes } from './config-service';

interface Station {
  stationId: string;
  stationName: string;
  location: {
    latitude: number;
    longitude: number;
  };
  lines: Array<{
    lineId: string;
    lineName: string;
  }>;
}

interface TravelTime {
  fromStationId: string;
  toStationId: string;
  normalTime: number;
  expressTime?: number;
  transferCount: number;
  lineIds: string[];
}

export class PathfindingService {
  private stations: Map<string, Station> = new Map();
  private adjacencyList: Map<string, Array<{ to: string; time: number; line: string }>> = new Map();

  async initialize() {
    const stations = await getAllStations();
    stations.forEach(s => this.stations.set(s.stationId, s));

    const travelTimes = await getAllTravelTimes();
    travelTimes.forEach(tt => {
      if (!this.adjacencyList.has(tt.fromStationId)) {
        this.adjacencyList.set(tt.fromStationId, []);
      }
      this.adjacencyList.get(tt.fromStationId)!.push({
        to: tt.toStationId,
        time: tt.normalTime,
        line: tt.lineIds[0] || 'unknown'
      });
    });
  }

  /**
   * 최단 경로 탐색 (Dijkstra 알고리즘)
   */
  findShortestPath(fromStationId: string, toStationId: string): {
    totalTime: number;
    path: string[];
    transfers: number;
  } | null {
    if (!this.stations.has(fromStationId) || !this.stations.has(toStationId)) {
      return null;
    }

    // Dijkstra 초기화
    const distances = new Map<string, number>();
    const previous = new Map<string, string | null>();
    const unvisited = new Set<string>(this.stations.keys());

    distances.set(fromStationId, 0);
    previous.set(fromStationId, null);

    while (unvisited.size > 0) {
      // 방문하지 않은 노드 중 가장 거리가 짧은 노드 선택
      let current: string | null = null;
      let minDistance = Infinity;

      for (const stationId of unvisited) {
        const dist = distances.get(stationId) ?? Infinity;
        if (dist < minDistance) {
          minDistance = dist;
          current = stationId;
        }
      }

      if (current === null || minDistance === Infinity) break;
      if (current === toStationId) break;

      unvisited.delete(current);

      // 인접 노드 탐색
      const neighbors = this.adjacencyList.get(current) || [];
      for (const neighbor of neighbors) {
        if (!unvisited.has(neighbor.to)) continue;

        const alt = (distances.get(current) ?? 0) + neighbor.time;
        const currentDist = distances.get(neighbor.to) ?? Infinity;

        if (alt < currentDist) {
          distances.set(neighbor.to, alt);
          previous.set(neighbor.to, current);
        }
      }
    }

    // 경로 재구성
    if (distances.get(toStationId) === Infinity) {
      return null; // 경로 없음
    }

    const path: string[] = [];
    let current: string | null = toStationId;

    while (current !== null) {
      path.unshift(current);
      current = previous.get(current) ?? null;
    }

    // 환승 횟수 계산
    const transfers = this.calculateTransfers(path);

    return {
      totalTime: distances.get(toStationId) ?? 0,
      path,
      transfers
    };
  }

  /**
   * 환승 횟수 계산
   */
  private calculateTransfers(path: string[]): number {
    if (path.length < 2) return 0;

    let transfers = 0;
    let currentLine: string | null = null;

    for (let i = 0; i < path.length - 1; i++) {
      const fromStation = this.stations.get(path[i]);
      const toStation = this.stations.get(path[i + 1]);

      if (!fromStation || !toStation) continue;

      // 두 역 모두 포함하는 노선 찾기
      const commonLines = fromStation.lines.filter(l =>
        toStation.lines.some(t => t.lineId === l.lineId)
      );

      if (commonLines.length > 0) {
        if (currentLine !== null && !commonLines.some(l => l.lineId === currentLine)) {
          transfers++;
        }
        currentLine = commonLines[0].lineId;
      }
    }

    return transfers;
  }

  /**
   * 예상 도착 시간 계산
   */
  calculateETA(fromStationId: string, toStationId: string): {
    minutes: number;
    path: string[];
  } | null {
    const result = this.findShortestPath(fromStationId, toStationId);
    
    if (!result) return null;

    return {
      minutes: result.totalTime,
      path: result.path.map(id => this.stations.get(id)?.stationName || id)
    };
  }
}

// 싱글톤 인스턴스
export const pathfindingService = new PathfindingService();
