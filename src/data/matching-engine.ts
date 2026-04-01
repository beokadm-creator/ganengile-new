export {
  getTopMatches,
  matchGillersToRequest,
  type SharedDeliveryRequest as DeliveryRequest,
  type SharedGillerRoute as GillerRoute,
  type SharedMatch as Match,
} from '../../shared/matching-engine';

export interface MatchingResult {
  gillerId: string;
  gillerName: string;
  totalScore: number;
  routeMatchScore: number;
  timeMatchScore: number;
  ratingScore: number;
  completionRateScore: number;
  scores: {
    pickupMatchScore: number;
    deliveryMatchScore: number;
    departureTimeMatchScore: number;
    scheduleFlexibilityScore: number;
    ratingRawScore: number;
    completionRateRawScore: number;
  };
  routeDetails: {
    travelTime: number;
    isExpressAvailable: boolean;
    transferCount: number;
    congestionLevel: 'low' | 'medium' | 'high';
  };
  reasons: string[];
}
