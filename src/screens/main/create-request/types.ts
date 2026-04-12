import type { SharedPackageSize } from '../../../../shared/pricing-config';

export type LocationMode = 'station' | 'address';
export type PackageSize = SharedPackageSize;
export type PickerType = 'pickup' | 'delivery';
export type AddressTarget = 'pickup' | 'delivery' | null;

import type { Station } from '../../../types/config';

export type StationCandidate = {
  station: Station;
  name: string;
  line: string;
  latitude: number;
  longitude: number;
};

export type NearbyStationRecommendation = {
  station: Station;
  distanceMeters: number;
};

export type NearbyPickerState = {
  target: PickerType;
  title: string;
  description: string;
  recommendations: NearbyStationRecommendation[];
};
