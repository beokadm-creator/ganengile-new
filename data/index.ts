/**
 * Seoul Subway Data Package
 * Hardcoded subway data for matching algorithm
 *
 * This package provides:
 * - 30 major stations in Seoul
 * - Travel times between stations
 * - Express train schedules
 * - Congestion data by line and time
 * - Matching engine for delivery requests
 *
 * @module data
 */

// Re-export all modules
export * from './subway-stations';
export * from './travel-times';
export * from './express-trains';
export * from './congestion';
export * from './matching-engine';

/**
 * Quick start example:
 *
 * ```typescript
 * import { getStationByName, matchGillersToRequest } from './data';
 *
 * // Get station info
 * const gangnam = getStationByName('강남역');
 * console.log(gangnam.lines); // Line 2, Sinbundang, Line 9
 *
 * // Match gillers to request
 * const gillers = [
 *   {
 *     gillerId: 'giller1',
 *     gillerName: '김길러',
 *     startStation: getStationByName('서울역')!,
 *     endStation: getStationByName('강남역')!,
 *     departureTime: '08:00',
 *     daysOfWeek: [1, 2, 3, 4, 5],
 *     rating: 4.5,
 *   },
 * ];
 *
 * const request = {
 *   requestId: 'req1',
 *   pickupStationName: '서울역',
 *   deliveryStationName: '강남역',
 *   pickupStartTime: '08:00',
 *   pickupEndTime: '08:20',
 *   deliveryDeadline: '09:00',
 *   preferredDays: [1, 2, 3, 4, 5],
 *   packageSize: 'small',
 *   packageWeight: 2,
 * };
 *
 * const matches = matchGillersToRequest(gillers, request);
 * console.log(matches[0].totalScore); // e.g., 72
 * ```
 */
