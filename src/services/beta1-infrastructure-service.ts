import { getAllCongestionConfigs, getAllExpressTrains, getAllStations, getAllTravelTimes } from './config-service';
import { getAIIntegrationConfig } from './integration-config-service';

export interface Beta1InfrastructureSnapshot {
  stationCatalog: {
    totalStations: number;
    activeRegions: string[];
    transferStations: number;
    stationsWithCoordinates: number;
  };
  routing: {
    travelTimeEdges: number;
    expressLines: number;
    congestionLines: number;
  };
  ai: {
    enabled: boolean;
    provider: string;
    baseUrl: string;
    analysisModel: string;
    pricingModel: string;
    missionModel: string;
    disableThinking: boolean;
  };
  mapUx: {
    hasStationCoordinates: boolean;
    supportsMiniMap: boolean;
    supportsRealtimeEta: boolean;
    recommendedStrategy: 'decision_map_first' | 'full_realtime_map';
  };
}

export async function getBeta1InfrastructureSnapshot(): Promise<Beta1InfrastructureSnapshot> {
  const [stations, travelTimes, expressTrains, congestionConfigs, aiConfig] = await Promise.all([
    getAllStations(),
    getAllTravelTimes(),
    getAllExpressTrains(),
    getAllCongestionConfigs(),
    getAIIntegrationConfig(),
  ]);

  const activeRegions = Array.from(new Set(stations.map((station) => station.region).filter(Boolean))).sort();
  const transferStations = stations.filter((station) => station.isTransferStation).length;
  const stationsWithCoordinates = stations.filter(
    (station) => typeof station.location?.latitude === 'number' && typeof station.location?.longitude === 'number'
  ).length;

  const supportsMiniMap = stationsWithCoordinates > 0 && travelTimes.length > 0;
  const supportsRealtimeEta = congestionConfigs.length > 0 || expressTrains.length > 0;

  return {
    stationCatalog: {
      totalStations: stations.length,
      activeRegions,
      transferStations,
      stationsWithCoordinates,
    },
    routing: {
      travelTimeEdges: travelTimes.length,
      expressLines: expressTrains.length,
      congestionLines: congestionConfigs.length,
    },
    ai: {
      enabled: aiConfig.enabled,
      provider: aiConfig.provider,
      baseUrl: aiConfig.baseUrl,
      analysisModel: aiConfig.analysisModel,
      pricingModel: aiConfig.pricingModel,
      missionModel: aiConfig.missionModel,
      disableThinking: aiConfig.disableThinking,
    },
    mapUx: {
      hasStationCoordinates: stationsWithCoordinates > 0,
      supportsMiniMap,
      supportsRealtimeEta,
      recommendedStrategy: 'decision_map_first',
    },
  };
}
