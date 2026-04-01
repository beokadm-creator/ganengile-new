export interface StationInfo {
  id: string;
  stationId: string;
  stationName: string;
  line: string;
  lineCode: string;
  lat: number;
  lng: number;
}

export interface DetailedAddress {
  roadAddress: string;
  detailAddress: string;
  fullAddress: string;
}

export type RouteStatus = 'active' | 'inactive' | 'deleted';

export interface Route {
  routeId: string;
  userId: string;
  startStation: StationInfo;
  endStation: StationInfo;
  startAddress?: DetailedAddress;
  endAddress?: DetailedAddress;
  departureTime: string;
  daysOfWeek: number[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateRouteParams {
  userId: string;
  startStation: StationInfo;
  endStation: StationInfo;
  startAddress?: DetailedAddress;
  endAddress?: DetailedAddress;
  departureTime: string;
  daysOfWeek: number[];
}

export interface UpdateRouteParams {
  startStation?: StationInfo;
  endStation?: StationInfo;
  startAddress?: DetailedAddress;
  endAddress?: DetailedAddress;
  departureTime?: string;
  daysOfWeek?: number[];
  isActive?: boolean;
}

export interface RouteValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RouteSummary {
  routeId: string;
  startStationName: string;
  endStationName: string;
  departureTime: string;
  daysOfWeek: number[];
  isActive: boolean;
}

export interface RoutesByDay {
  dayOfWeek: number;
  routes: Route[];
}

export interface StationRoutesResult {
  stationId: string;
  stationName: string;
  routes: Route[];
}
