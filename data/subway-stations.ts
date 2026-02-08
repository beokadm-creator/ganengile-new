/**
 * Seoul Subway Station Database
 * Hardcoded data for matching algorithm (30 major stations)
 */

export interface Station {
  stationId: string;
  stationName: string;
  stationNameEnglish: string;
  lines: Line[];
  location: {
    latitude: number;
    longitude: number;
  };
  isTransferStation: boolean;
  isExpressStop: boolean;
  isTerminus: boolean;
  facilities: {
    hasElevator: boolean;
    hasEscalator: boolean;
    wheelchairAccessible?: boolean;
  };
  region?: string;
  priority?: number;
}

export interface Line {
  lineId: string;
  lineName: string;
  lineCode: string;
  lineColor: string;
  lineType: 'general' | 'express' | 'special';
}

export interface StationConnection {
  fromStationId: string;
  toStationId: string;
  lineId: string;
  distance: number; // meters
  travelTime: number; // seconds (actual travel time)
  isExpressRoute: boolean;
  direction: 'inbound' | 'outbound' | 'up' | 'down';
}

export interface TravelTimeInfo {
  normalTime: number; // seconds (general train)
  expressTime?: number; // seconds (express train, if available)
  transferCount: number;
  transferStations: string[];
  hasExpress: boolean;
  walkingDistance: number; // meters
}

/**
 * 30 Major Seoul Subway Stations
 */
export const MAJOR_STATIONS: Station[] = [
  // 1호선
  {
    stationId: '150',
    stationName: '서울역',
    stationNameEnglish: 'Seoul Station',
    lines: [
      { lineId: '1', lineName: '1호선', lineCode: '150', lineColor: '#0052A4', lineType: 'general' },
      { lineId: '4', lineName: '4호선', lineCode: '426', lineColor: '#00A5DE', lineType: 'general' },
      { lineId: 'K4501', lineName: '경춘선', lineCode: '', lineColor: '#0C8E72', lineType: 'general' },
      { lineId: 'airport', lineName: '공항철도', lineCode: 'A01', lineColor: '#0090D2', lineType: 'express' },
    ],
    location: { latitude: 37.5547, longitude: 126.9707 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '152',
    stationName: '시청',
    stationNameEnglish: 'City Hall',
    lines: [
      { lineId: '1', lineName: '1호선', lineCode: '132', lineColor: '#0052A4', lineType: 'general' },
      { lineId: '2', lineName: '2호선', lineCode: '201', lineColor: '#009900', lineType: 'general' },
    ],
    location: { latitude: 37.5661, longitude: 126.9795 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '155',
    stationName: '종각',
    stationNameEnglish: 'Jonggak',
    lines: [
      { lineId: '1', lineName: '1호선', lineCode: '131', lineColor: '#0052A4', lineType: 'general' },
    ],
    location: { latitude: 37.5704, longitude: 126.9831 },
    isTransferStation: false,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '156',
    stationName: '종로3가',
    stationNameEnglish: 'Jongno 3-ga',
    lines: [
      { lineId: '1', lineName: '1호선', lineCode: '130', lineColor: '#0052A4', lineType: 'general' },
      { lineId: '3', lineName: '3호선', lineCode: '329', lineColor: '#FF9500', lineType: 'general' },
      { lineId: '5', lineName: '5호선', lineCode: '535', lineColor: '#9B51E0', lineType: 'general' },
    ],
    location: { latitude: 37.5716, longitude: 126.9865 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },

  // 2호선
  {
    stationId: '201',
    stationName: '을지로입구',
    stationNameEnglish: 'Euljiro 1-ga',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '202', lineColor: '#009900', lineType: 'general' },
    ],
    location: { latitude: 37.5677, longitude: 126.9858 },
    isTransferStation: false,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '211',
    stationName: '을지로3가',
    stationNameEnglish: 'Euljiro 3-ga',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '203', lineColor: '#009900', lineType: 'general' },
      { lineId: '3', lineName: '3호선', lineCode: '330', lineColor: '#FF9500', lineType: 'general' },
    ],
    location: { latitude: 37.5705, longitude: 126.9904 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '222',
    stationName: '강남역',
    stationNameEnglish: 'Gangnam',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '222', lineColor: '#009900', lineType: 'general' },
      { lineId: 'sinbundang', lineName: '신분당선', lineCode: 'D08', lineColor: '#D4003A', lineType: 'express' },
      { lineId: '9', lineName: '9호선', lineCode: '922', lineColor: '#BDB092', lineType: 'general' },
    ],
    location: { latitude: 37.5112, longitude: 127.0981 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '223',
    stationName: '역삼역',
    stationNameEnglish: 'Yeoksam',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '223', lineColor: '#009900', lineType: 'general' },
      { lineId: 'sinbundang', lineName: '신분당선', lineCode: 'D09', lineColor: '#D4003A', lineType: 'express' },
    ],
    location: { latitude: 37.5009, longitude: 127.0364 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '224',
    stationName: '선릉역',
    stationNameEnglish: 'Seolleung',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '224', lineColor: '#009900', lineType: 'general' },
      { lineId: 'sinbundang', lineName: '신분당선', lineCode: 'D10', lineColor: '#D4003A', lineType: 'express' },
      { lineId: 'suin', lineName: '수인분당선', lineCode: 'K224', lineColor: '#F5A200', lineType: 'general' },
    ],
    location: { latitude: 37.5037, longitude: 127.0479 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '234',
    stationName: '교대역',
    stationNameEnglish: 'Gangnam-gu Office',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '234', lineColor: '#009900', lineType: 'general' },
      { lineId: '3', lineName: '3호선', lineCode: '339', lineColor: '#FF9500', lineType: 'general' },
      { lineId: '9', lineName: '9호선', lineCode: '928', lineColor: '#BDB092', lineType: 'general' },
    ],
    location: { latitude: 37.4935, longitude: 127.0127 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },

  // 3호선
  {
    stationId: '324',
    stationName: '충무로',
    stationNameEnglish: 'Chungmuro',
    lines: [
      { lineId: '3', lineName: '3호선', lineCode: '329', lineColor: '#FF9500', lineType: 'general' },
      { lineId: '4', lineName: '4호선', lineCode: '424', lineColor: '#00A5DE', lineType: 'general' },
    ],
    location: { latitude: 37.5598, longitude: 126.9941 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '334',
    stationName: '양재역',
    stationNameEnglish: 'Yangjae',
    lines: [
      { lineId: '3', lineName: '3호선', lineCode: '341', lineColor: '#FF9500', lineType: 'general' },
      { lineId: 'sinbundang', lineName: '신분당선', lineCode: 'D05', lineColor: '#D4003A', lineType: 'express' },
    ],
    location: { latitude: 37.4821, longitude: 127.0339 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '339',
    stationName: '고속터미널역',
    stationNameEnglish: 'Express Bus Terminal',
    lines: [
      { lineId: '3', lineName: '3호선', lineCode: '341', lineColor: '#FF9500', lineType: 'general' },
      { lineId: '7', lineName: '7호선', lineCode: '740', lineColor: '#667428', lineType: 'general' },
      { lineId: '9', lineName: '9호선', lineCode: '934', lineColor: '#BDB092', lineType: 'general' },
    ],
    location: { latitude: 37.5049, longitude: 127.0050 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },

  // 4호선
  {
    stationId: '426',
    stationName: '이촌역',
    stationNameEnglish: 'Ichon',
    lines: [
      { lineId: '4', lineName: '4호선', lineCode: '429', lineColor: '#00A5DE', lineType: 'general' },
      { lineId: 'G410', lineName: '경의중앙선', lineCode: 'K311', lineColor: '#77C4A3', lineType: 'general' },
    ],
    location: { latitude: 37.5183, longitude: 126.9638 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '430',
    stationName: '사당역',
    stationNameEnglish: 'Sadang',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '226', lineColor: '#009900', lineType: 'general' },
      { lineId: '4', lineName: '4호선', lineCode: '433', lineColor: '#00A5DE', lineType: 'general' },
    ],
    location: { latitude: 37.4763, longitude: 126.9816 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },

  // 5호선
  {
    stationId: '535',
    stationName: '광화문역',
    stationNameEnglish: 'Gwanghwamun',
    lines: [
      { lineId: '5', lineName: '5호선', lineCode: '533', lineColor: '#9B51E0', lineType: 'general' },
    ],
    location: { latitude: 37.5746, longitude: 126.9755 },
    isTransferStation: false,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '540',
    stationName: '여의도역',
    stationNameEnglish: 'Yeouido',
    lines: [
      { lineId: '5', lineName: '5호선', lineCode: '538', lineColor: '#9B51E0', lineType: 'general' },
      { lineId: '9', lineName: '9호선', lineCode: '915', lineColor: '#BDB092', lineType: 'general' },
    ],
    location: { latitude: 37.5188, longitude: 126.9299 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },

  // 6호선
  {
    stationId: '640',
    stationName: '공덕역',
    stationNameEnglish: 'Gongdeok',
    lines: [
      { lineId: '6', lineName: '6호선', lineCode: '632', lineColor: '#CD7C2F', lineType: 'general' },
      { lineId: 'G410', lineName: '경의중앙선', lineCode: 'K313', lineColor: '#77C4A3', lineType: 'general' },
      { lineId: 'airport', lineName: '공항철도', lineCode: 'A05', lineColor: '#0090D2', lineType: 'express' },
    ],
    location: { latitude: 37.5433, longitude: 126.9636 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },

  // 7호선
  {
    stationId: '750',
    stationName: '도봉산역',
    stationNameEnglish: 'Dobongsan',
    lines: [
      { lineId: '7', lineName: '7호선', lineCode: '710', lineColor: '#667428', lineType: 'general' },
    ],
    location: { latitude: 37.6676, longitude: 127.0452 },
    isTransferStation: false,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '751',
    stationName: '수락산역',
    stationNameEnglish: 'Suraksan',
    lines: [
      { lineId: '7', lineName: '7호선', lineCode: '711', lineColor: '#667428', lineType: 'general' },
    ],
    location: { latitude: 37.6575, longitude: 127.0570 },
    isTransferStation: false,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },

  // 8호선
  {
    stationId: '810',
    stationName: '잠실역',
    stationNameEnglish: 'Jamsil',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '216', lineColor: '#009900', lineType: 'general' },
      { lineId: '8', lineName: '8호선', lineCode: '814', lineColor: '#EC5C37', lineType: 'general' },
    ],
    location: { latitude: 37.5130, longitude: 127.0996 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '814',
    stationName: '석촌역',
    stationNameEnglish: 'Seokchon',
    lines: [
      { lineId: '8', lineName: '8호선', lineCode: '815', lineColor: '#EC5C37', lineType: 'general' },
    ],
    location: { latitude: 37.5035, longitude: 127.1052 },
    isTransferStation: false,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },

  // 9호선
  {
    stationId: '915',
    stationName: '여의도역',
    stationNameEnglish: 'Yeouido',
    lines: [
      { lineId: '5', lineName: '5호선', lineCode: '538', lineColor: '#9B51E0', lineType: 'general' },
      { lineId: '9', lineName: '9호선', lineCode: '915', lineColor: '#BDB092', lineType: 'express' },
    ],
    location: { latitude: 37.5188, longitude: 126.9299 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '922',
    stationName: '강남역',
    stationNameEnglish: 'Gangnam',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '222', lineColor: '#009900', lineType: 'general' },
      { lineId: 'sinbundang', lineName: '신분당선', lineCode: 'D08', lineColor: '#D4003A', lineType: 'express' },
      { lineId: '9', lineName: '9호선', lineCode: '922', lineColor: '#BDB092', lineType: 'express' },
    ],
    location: { latitude: 37.5112, longitude: 127.0981 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: '928',
    stationName: '교대역',
    stationNameEnglish: 'Gangnam-gu Office',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '234', lineColor: '#009900', lineType: 'general' },
      { lineId: '3', lineName: '3호선', lineCode: '339', lineColor: '#FF9500', lineType: 'general' },
      { lineId: '9', lineName: '9호선', lineCode: '928', lineColor: '#BDB092', lineType: 'express' },
    ],
    location: { latitude: 37.4935, longitude: 127.0127 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },

  // 신분당선
  {
    stationId: 'D05',
    stationName: '양재역',
    stationNameEnglish: 'Yangjae',
    lines: [
      { lineId: '3', lineName: '3호선', lineCode: '341', lineColor: '#FF9500', lineType: 'general' },
      { lineId: 'sinbundang', lineName: '신분당선', lineCode: 'D05', lineColor: '#D4003A', lineType: 'express' },
    ],
    location: { latitude: 37.4821, longitude: 127.0339 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: 'D08',
    stationName: '강남역',
    stationNameEnglish: 'Gangnam',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '222', lineColor: '#009900', lineType: 'general' },
      { lineId: 'sinbundang', lineName: '신분당선', lineCode: 'D08', lineColor: '#D4003A', lineType: 'express' },
      { lineId: '9', lineName: '9호선', lineCode: '922', lineColor: '#BDB092', lineType: 'express' },
    ],
    location: { latitude: 37.5112, longitude: 127.0981 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: 'D09',
    stationName: '역삼역',
    stationNameEnglish: 'Yeoksam',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '223', lineColor: '#009900', lineType: 'general' },
      { lineId: 'sinbundang', lineName: '신분당선', lineCode: 'D09', lineColor: '#D4003A', lineType: 'express' },
    ],
    location: { latitude: 37.5009, longitude: 127.0364 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
  {
    stationId: 'D10',
    stationName: '선릉역',
    stationNameEnglish: 'Seolleung',
    lines: [
      { lineId: '2', lineName: '2호선', lineCode: '224', lineColor: '#009900', lineType: 'general' },
      { lineId: 'sinbundang', lineName: '신분당선', lineCode: 'D10', lineColor: '#D4003A', lineType: 'express' },
      { lineId: 'suin', lineName: '수인분당선', lineCode: 'K224', lineColor: '#F5A200', lineType: 'general' },
    ],
    location: { latitude: 37.5037, longitude: 127.0479 },
    isTransferStation: true,
    isExpressStop: false,
    isTerminus: false,
    facilities: { hasElevator: true, hasEscalator: true },
  },
];

/**
 * Get station by ID
 */
export function getStationById(stationId: string): Station | undefined {
  return MAJOR_STATIONS.find(s => s.stationId === stationId);
}

/**
 * Get station by name
 */
export function getStationByName(stationName: string): Station | undefined {
  return MAJOR_STATIONS.find(s => s.stationName === stationName);
}

/**
 * Get stations by line
 */
export function getStationsByLine(lineId: string): Station[] {
  return MAJOR_STATIONS.filter(s =>
    s.lines.some(l => l.lineId === lineId)
  );
}

/**
 * Get all transfer stations
 */
export function getTransferStations(): Station[] {
  return MAJOR_STATIONS.filter(s => s.isTransferStation);
}

/**
 * Search stations by name (partial match)
 */
export function searchStations(query: string): Station[] {
  const lowerQuery = query.toLowerCase();
  return MAJOR_STATIONS.filter(s =>
    s.stationName.toLowerCase().includes(lowerQuery) ||
    s.stationNameEnglish.toLowerCase().includes(lowerQuery)
  );
}
