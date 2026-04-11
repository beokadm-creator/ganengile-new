import type { Beta1HomeSnapshot } from '../../services/beta1-orchestration-service';

export type MissionCard = Beta1HomeSnapshot['missionCards'][number];

export type MissionGroup = {
  id: string;
  title: string;
  routeLabel: string;
  status: string;
  windowLabel: string;
  strategyTitle: string;
  strategyBody: string;
  selectionState: 'available' | 'accepted' | 'fallback';
  rewardAmount: number;
  options: MissionCard[];
  originPoint?: MissionCard['originPoint'];
  destinationPoint?: MissionCard['destinationPoint'];
  fallbackLabel?: string;
  candidateCount: number;
  requiresExternalPartner: boolean;
  ageMinutes: number;
};
