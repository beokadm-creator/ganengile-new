/**
 * Seoul Subway Express Train Information
 */

export interface ExpressTrainSchedule {
  lineId: string;
  lineName?: string;
  type: 'special' | 'express' | 'itx' | 'ktx' | 'srt' | 'airport';
  typeName: string;

  // Operating days
  operatingDays: number[]; // [1,2,3,4,5] for weekdays, [1,2,3,4,5,6,7] for all days

  // First and last train
  firstTrain: string; // HH:mm format
  lastTrain: string; // HH:mm format

  // Interval during different times
  intervals: {
    rushHourMorning: number; // seconds (07:00-09:00)
    rushHourEvening: number; // seconds (18:00-20:00)
    daytime: number; // seconds (09:00-18:00)
    night: number; // seconds (20:00-23:00)
  };

  // Stop stations (station IDs)
  stops: string[];

  // Time savings compared to general train
  timeSavings: Record<string, number>; // key: "from-to", value: seconds saved
}

export const EXPRESS_TRAIN_SCHEDULES: ExpressTrainSchedule[] = [
  // 1호선 특급/급행
  {
    lineId: '1',
    type: 'special',
    typeName: '특급',
    operatingDays: [1, 2, 3, 4, 5, 6, 7],
    firstTrain: '05:30',
    lastTrain: '23:40',
    intervals: {
      rushHourMorning: 20 * 60, // 20 minutes
      rushHourEvening: 30 * 60,
      daytime: 40 * 60,
      night: 60 * 60,
    },
    stops: ['150', '201', '202', '203', '204', '205', '206', '207'], // Seoul → Cheonan
    timeSavings: {
      '150-206': 15 * 60, // Save 15 minutes to Suwon
      '150-207': 25 * 60, // Save 25 minutes to Cheonan
    },
  },
  {
    lineId: '1',
    type: 'express',
    typeName: '급행',
    operatingDays: [1, 2, 3, 4, 5, 6, 7],
    firstTrain: '06:00',
    lastTrain: '23:00',
    intervals: {
      rushHourMorning: 15 * 60,
      rushHourEvening: 20 * 60,
      daytime: 30 * 60,
      night: 40 * 60,
    },
    stops: ['150', '152', '155', '156', '201'], // Seoul → Guro
    timeSavings: {
      '150-201': 8 * 60, // Save 8 minutes
    },
  },

  // 신분당선 급행
  {
    lineId: 'sinbundang',
    type: 'express',
    typeName: '급행',
    operatingDays: [1, 2, 3, 4, 5, 6, 7],
    firstTrain: '05:30',
    lastTrain: '23:50',
    intervals: {
      rushHourMorning: 3 * 60, // 3 minutes - very frequent!
      rushHourEvening: 5 * 60,
      daytime: 8 * 60,
      night: 10 * 60,
    },
    stops: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'D11'],
    timeSavings: {
      'D05-D10': 6 * 60, // Yangjae → Seolleung: save 6 minutes
      'D08-D10': 3 * 60, // Gangnam → Seolleung: save 3 minutes
    },
  },

  // 9호선 급행
  {
    lineId: '9',
    type: 'express',
    typeName: '급행',
    operatingDays: [1, 2, 3, 4, 5, 6, 7],
    firstTrain: '05:40',
    lastTrain: '23:50',
    intervals: {
      rushHourMorning: 6 * 60,
      rushHourEvening: 8 * 60,
      daytime: 12 * 60,
      night: 15 * 60,
    },
    stops: ['910', '914', '915', '920', '922', '924', '928', '930'],
    timeSavings: {
      '915-922': 5 * 60, // Yeouido → Gangnam: save 5 minutes
      '922-928': 3 * 60, // Gangnam → Gyodae: save 3 minutes
    },
  },

  // 3호선 급행
  {
    lineId: '3',
    type: 'express',
    typeName: '급행',
    operatingDays: [1, 2, 3, 4, 5, 6, 7],
    firstTrain: '06:00',
    lastTrain: '23:30',
    intervals: {
      rushHourMorning: 8 * 60,
      rushHourEvening: 10 * 60,
      daytime: 15 * 60,
      night: 20 * 60,
    },
    stops: ['320', '322', '324', '329', '334', '339', '343'], // Daehwa → Ogeum
    timeSavings: {
      '324-334': 7 * 60, // Chungmuro → Yangjae: save 7 minutes
      '334-339': 4 * 60, // Yangjae → Express Bus Terminal: save 4 minutes
    },
  },

  // 공항철도
  {
    lineId: 'airport',
    type: 'express',
    typeName: '직행',
    operatingDays: [1, 2, 3, 4, 5, 6, 7],
    firstTrain: '05:20',
    lastTrain: '23:50',
    intervals: {
      rushHourMorning: 10 * 60,
      rushHourEvening: 15 * 60,
      daytime: 20 * 60,
      night: 30 * 60,
    },
    stops: ['A01', 'A02', 'A03', 'A04', 'A05', 'A06'], // Seoul → Incheon Airport
    timeSavings: {
      'A01-A06': 25 * 60, // Save 25 minutes to Incheon Airport
    },
  },
];

/**
 * Get express train schedules for a line
 */
export function getExpressSchedules(lineId: string): ExpressTrainSchedule[] {
  return EXPRESS_TRAIN_SCHEDULES.filter(s => s.lineId === lineId);
}

/**
 * Check if express train is available between two stations
 */
export function hasExpressBetween(
  fromStationId: string,
  toStationId: string,
  lineId: string
): boolean {
  const schedules = getExpressSchedules(lineId);

  for (const schedule of schedules) {
    const fromIndex = schedule.stops.indexOf(fromStationId);
    const toIndex = schedule.stops.indexOf(toStationId);

    // Both stations must be in the stops list
    if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
      return true;
    }
  }

  return false;
}

/**
 * Get next express train time from a station
 * @param stationId Station ID
 * @param lineId Line ID
 * @param currentTime Current time in HH:mm format
 * @returns Next express train time in HH:mm format, or null if no express available
 */
export function getNextExpressTime(
  stationId: string,
  lineId: string,
  currentTime: string
): string | null {
  const schedules = getExpressSchedules(lineId);

  for (const schedule of schedules) {
    if (!schedule.stops.includes(stationId)) {
      continue;
    }

    // Parse current time
    const [currentHour, currentMinute] = currentTime.split(':').map(Number);
    const currentMinutes = currentHour * 60 + currentMinute;

    // Calculate next train time based on interval
    let interval: number;
    const hour = currentHour;

    if (hour >= 7 && hour < 9) {
      interval = schedule.intervals.rushHourMorning;
    } else if (hour >= 18 && hour < 20) {
      interval = schedule.intervals.rushHourEvening;
    } else if (hour >= 9 && hour < 18) {
      interval = schedule.intervals.daytime;
    } else {
      interval = schedule.intervals.night;
    }

    // Calculate next train
    const nextTrainMinutes = Math.ceil(currentMinutes / interval) * interval;
    const nextHour = Math.floor(nextTrainMinutes / 60);
    const nextMinute = nextTrainMinutes % 60;

    return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Get train frequency score for matching
 * Higher score = more frequent trains = better
 */
export function getTrainFrequencyScore(
  lineId: string,
  time: string
): number {
  const [hour] = time.split(':').map(Number);
  const schedules = getExpressSchedules(lineId);

  if (schedules.length === 0) {
    // General train frequency (no express)
    if (hour >= 7 && hour < 9) {
      return 6; // 3-5 minutes
    } else if (hour >= 18 && hour < 20) {
      return 6;
    } else {
      return 3; // 5-10 minutes
    }
  }

  // Has express - better score
  if (hour >= 7 && hour < 9) {
    return 10; // Express: 2-3 minutes during rush hour
  } else if (hour >= 18 && hour < 20) {
    return 9;
  } else {
    return 7; // Express: 5-8 minutes during daytime
  }
}
