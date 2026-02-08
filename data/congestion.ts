/**
 * Seoul Subway Congestion Data
 * By line and time slot
 */

export interface CongestionData {
  lineId: string;
  lineName: string;
  dataSource?: string;

  // Congestion level by time slot
  // Scale: 1-10 (1 = very empty, 10 = extremely crowded)
  timeSlots: {
    earlyMorning: number; // 05:00-07:00
    rushHourMorning: number; // 07:00-09:00
    morning: number; // 09:00-12:00
    lunch: number; // 12:00-14:00
    afternoon: number; // 14:00-18:00
    rushHourEvening: number; // 18:00-20:00
    evening: number; // 20:00-23:00
  };

  // Congestion by section (for major transfer stations)
  sections: {
    stationId: string;
    stationName: string;
    congestionLevel: number; // 1-10
  }[];
}

export const CONGESTION_DATA: CongestionData[] = [
  // 1호선 - Very crowded
  {
    lineId: '1',
    lineName: '1호선',
    timeSlots: {
      earlyMorning: 3,
      rushHourMorning: 9, // Very crowded
      morning: 6,
      lunch: 5,
      afternoon: 7,
      rushHourEvening: 9, // Very crowded
      evening: 4,
    },
    sections: [
      { stationId: '150', stationName: '서울역', congestionLevel: 9 },
      { stationId: '152', stationName: '시청', congestionLevel: 8 },
      { stationId: '155', stationName: '종각', congestionLevel: 9 },
      { stationId: '156', stationName: '종로3가', congestionLevel: 9 },
    ],
  },

  // 2호선 - Most crowded
  {
    lineId: '2',
    lineName: '2호선',
    timeSlots: {
      earlyMorning: 3,
      rushHourMorning: 10, // Extremely crowded
      morning: 7,
      lunch: 6,
      afternoon: 8,
      rushHourEvening: 10, // Extremely crowded
      evening: 5,
    },
    sections: [
      { stationId: '201', stationName: '을지로입구', congestionLevel: 9 },
      { stationId: '211', stationName: '을지로3가', congestionLevel: 10 },
      { stationId: '222', stationName: '강남역', congestionLevel: 10 },
      { stationId: '223', stationName: '역삼역', congestionLevel: 9 },
      { stationId: '224', stationName: '선릉역', congestionLevel: 9 },
      { stationId: '234', stationName: '교대역', congestionLevel: 9 },
      { stationId: '810', stationName: '잠실역', congestionLevel: 10 },
    ],
  },

  // 3호선 - Moderately crowded
  {
    lineId: '3',
    lineName: '3호선',
    timeSlots: {
      earlyMorning: 2,
      rushHourMorning: 7,
      morning: 5,
      lunch: 4,
      afternoon: 6,
      rushHourEvening: 7,
      evening: 3,
    },
    sections: [
      { stationId: '324', stationName: '충무로', congestionLevel: 7 },
      { stationId: '334', stationName: '양재역', congestionLevel: 6 },
      { stationId: '339', stationName: '고속터미널', congestionLevel: 7 },
    ],
  },

  // 4호선 - Moderately crowded
  {
    lineId: '4',
    lineName: '4호선',
    timeSlots: {
      earlyMorning: 2,
      rushHourMorning: 7,
      morning: 5,
      lunch: 4,
      afternoon: 5,
      rushHourEvening: 7,
      evening: 3,
    },
    sections: [
      { stationId: '150', stationName: '서울역', congestionLevel: 7 },
      { stationId: '426', stationName: '이촌', congestionLevel: 5 },
      { stationId: '430', stationName: '사당', congestionLevel: 7 },
    ],
  },

  // 5호선 - Lightly crowded
  {
    lineId: '5',
    lineName: '5호선',
    timeSlots: {
      earlyMorning: 2,
      rushHourMorning: 5,
      morning: 4,
      lunch: 3,
      afternoon: 4,
      rushHourEvening: 5,
      evening: 2,
    },
    sections: [
      { stationId: '535', stationName: '광화문', congestionLevel: 5 },
      { stationId: '540', stationName: '여의도', congestionLevel: 6 },
    ],
  },

  // 6호선 - Lightly crowded
  {
    lineId: '6',
    lineName: '6호선',
    timeSlots: {
      earlyMorning: 2,
      rushHourMorning: 4,
      morning: 3,
      lunch: 3,
      afternoon: 3,
      rushHourEvening: 4,
      evening: 2,
    },
    sections: [
      { stationId: '640', stationName: '공덕', congestionLevel: 4 },
    ],
  },

  // 7호선 - Moderately crowded
  {
    lineId: '7',
    lineName: '7호선',
    timeSlots: {
      earlyMorning: 2,
      rushHourMorning: 6,
      morning: 4,
      lunch: 4,
      afternoon: 5,
      rushHourEvening: 6,
      evening: 3,
    },
    sections: [
      { stationId: '750', stationName: '도봉산', congestionLevel: 5 },
      { stationId: '751', stationName: '수락산', congestionLevel: 5 },
      { stationId: '339', stationName: '고속터미널', congestionLevel: 7 },
    ],
  },

  // 8호선 - Moderately crowded
  {
    lineId: '8',
    lineName: '8호선',
    timeSlots: {
      earlyMorning: 2,
      rushHourMorning: 6,
      morning: 4,
      lunch: 4,
      afternoon: 5,
      rushHourEvening: 6,
      evening: 3,
    },
    sections: [
      { stationId: '810', stationName: '잠실', congestionLevel: 8 },
      { stationId: '814', stationName: '석촌', congestionLevel: 5 },
    ],
  },

  // 9호선 - Lightly crowded (more expensive)
  {
    lineId: '9',
    lineName: '9호선',
    timeSlots: {
      earlyMorning: 1,
      rushHourMorning: 4,
      morning: 3,
      lunch: 2,
      afternoon: 3,
      rushHourEvening: 4,
      evening: 2,
    },
    sections: [
      { stationId: '915', stationName: '여의도', congestionLevel: 4 },
      { stationId: '922', stationName: '강남', congestionLevel: 5 },
      { stationId: '928', stationName: '교대', congestionLevel: 5 },
    ],
  },

  // 신분당선 - Lightly crowded (expensive)
  {
    lineId: 'sinbundang',
    lineName: '신분당선',
    timeSlots: {
      earlyMorning: 1,
      rushHourMorning: 5,
      morning: 3,
      lunch: 2,
      afternoon: 4,
      rushHourEvening: 5,
      evening: 2,
    },
    sections: [
      { stationId: 'D08', stationName: '강남', congestionLevel: 6 },
      { stationId: 'D09', stationName: '역삼', congestionLevel: 5 },
      { stationId: 'D10', stationName: '선릉', congestionLevel: 5 },
    ],
  },

  // 공항철도 - Very light
  {
    lineId: 'airport',
    lineName: '공항철도',
    timeSlots: {
      earlyMorning: 1,
      rushHourMorning: 3,
      morning: 2,
      lunch: 2,
      afternoon: 2,
      rushHourEvening: 3,
      evening: 1,
    },
    sections: [
      { stationId: '150', stationName: '서울역', congestionLevel: 3 },
      { stationId: '640', stationName: '공덕', congestionLevel: 2 },
    ],
  },

  // 경의중앙선 - Lightly crowded
  {
    lineId: 'G410',
    lineName: '경의중앙선',
    timeSlots: {
      earlyMorning: 1,
      rushHourMorning: 4,
      morning: 3,
      lunch: 2,
      afternoon: 3,
      rushHourEvening: 4,
      evening: 2,
    },
    sections: [
      { stationId: '426', stationName: '이촌', congestionLevel: 3 },
      { stationId: '640', stationName: '공덕', congestionLevel: 4 },
    ],
  },
];

/**
 * Get congestion data for a line
 */
export function getCongestionData(lineId: string): CongestionData | undefined {
  return CONGESTION_DATA.find(c => c.lineId === lineId);
}

/**
 * Get congestion level at a specific time
 * @param lineId Line ID
 * @param time Time in HH:mm format
 * @returns Congestion level (1-10)
 */
export function getCongestionLevel(lineId: string, time: string): number {
  const data = getCongestionData(lineId);
  if (!data) return 5; // Default: moderate

  const [hour] = time.split(':').map(Number);

  let timeSlot: keyof CongestionData['timeSlots'];

  if (hour >= 5 && hour < 7) {
    timeSlot = 'earlyMorning';
  } else if (hour >= 7 && hour < 9) {
    timeSlot = 'rushHourMorning';
  } else if (hour >= 9 && hour < 12) {
    timeSlot = 'morning';
  } else if (hour >= 12 && hour < 14) {
    timeSlot = 'lunch';
  } else if (hour >= 14 && hour < 18) {
    timeSlot = 'afternoon';
  } else if (hour >= 18 && hour < 20) {
    timeSlot = 'rushHourEvening';
  } else {
    timeSlot = 'evening';
  }

  return data.timeSlots[timeSlot];
}

/**
 * Get congestion score for matching
 * Higher score = less crowded = better
 * Scale: 0-10
 */
export function getCongestionScore(lineId: string, time: string): number {
  const congestionLevel = getCongestionLevel(lineId, time);

  // Invert: higher congestion = lower score
  // Congestion 1 (empty) → Score 10
  // Congestion 10 (crowded) → Score 0
  return Math.max(0, 10 - congestionLevel);
}

/**
 * Check if time is in rush hour
 */
export function isRushHour(time: string): boolean {
  const [hour, minute] = time.split(':').map(Number);
  const totalMinutes = hour * 60 + minute;

  // Morning rush: 07:00-09:00
  const morningRushStart = 7 * 60;
  const morningRushEnd = 9 * 60;

  // Evening rush: 18:00-20:00
  const eveningRushStart = 18 * 60;
  const eveningRushEnd = 20 * 60;

  return (
    (totalMinutes >= morningRushStart && totalMinutes < morningRushEnd) ||
    (totalMinutes >= eveningRushStart && totalMinutes < eveningRushEnd)
  );
}

/**
 * Get rush hour penalty
 * Used in matching score calculation
 */
export function getRushHourPenalty(time: string): number {
  return isRushHour(time) ? -3 : 0;
}
