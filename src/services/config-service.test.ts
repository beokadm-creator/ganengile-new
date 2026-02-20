/**
 * Config Service Unit Tests
 */

import {
  getStationByName,
  getTravelTime,
  getAllStations,
  clearCache,
} from '../config-service';
import { doc, getDoc, getDocs, collection, query } from 'firebase/firestore';
import { db } from '../firebase';

// Mock Firebase
jest.mock('firebase/firestore');
jest.mock('./firebase');

describe('ConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearCache();
  });

  describe('getStationByName', () => {
    it('should return station data when station exists', async () => {
      const mockStation = {
        stationId: 'S001',
        stationName: '서울역',
        stationNameEnglish: 'Seoul Station',
        lines: ['1호선', '4호선'],
        location: { lat: 37.5547, lng: 126.9707 },
        isTransferStation: true,
        isExpressStop: true,
        isTerminus: false,
        facilities: ['엘리베이터', '에스컬레이터'],
        isActive: true,
        region: 'seoul',
        priority: 1,
      };

      const mockDoc = {
        exists: true,
        data: () => mockStation,
        id: 'S001',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await getStationByName('서울역');

      expect(result).toEqual(mockStation);
      expect(getDoc).toHaveBeenCalledTimes(1);
    });

    it('should return null when station does not exist', async () => {
      const mockDoc = {
        exists: false,
        data: () => null,
        id: 'S001',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await getStationByName('존재하지않는역');

      expect(result).toBeNull();
    });

    it('should use cache for subsequent calls', async () => {
      const mockStation = {
        stationId: 'S001',
        stationName: '서울역',
        stationNameEnglish: 'Seoul Station',
        lines: ['1호선', '4호선'],
        location: { lat: 37.5547, lng: 126.9707 },
        isTransferStation: true,
        isExpressStop: true,
        isTerminus: false,
        facilities: ['엘리베이터', '에스컬레이터'],
        isActive: true,
        region: 'seoul',
        priority: 1,
      };

      const mockDoc = {
        exists: true,
        data: () => mockStation,
        id: 'S001',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      // First call
      await getStationByName('서울역');
      // Second call (should use cache)
      await getStationByName('서울역');

      expect(getDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTravelTime', () => {
    it('should return travel time when route exists', async () => {
      const mockTravelTime = {
        startStation: '서울역',
        endStation: '강남역',
        directTime: 25,
        viaExpress: false,
        expressTime: null,
        transferRequired: false,
        transferStation: null,
        distance: 15.5,
      };

      const mockDoc = {
        exists: true,
        data: () => mockTravelTime,
        id: 'TT001',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await getTravelTime('서울역', '강남역');

      expect(result).toEqual(mockTravelTime);
    });

    it('should return null when travel time does not exist', async () => {
      const mockDoc = {
        exists: false,
        data: () => null,
        id: 'TT001',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await getTravelTime('서울역', '존재하지않는역');

      expect(result).toBeNull();
    });

    it('should handle express train information', async () => {
      const mockTravelTime = {
        startStation: '서울역',
        endStation: '강남역',
        directTime: 25,
        viaExpress: true,
        expressTime: 18,
        transferRequired: false,
        transferStation: null,
        distance: 15.5,
      };

      const mockDoc = {
        exists: true,
        data: () => mockTravelTime,
        id: 'TT001',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      const result = await getTravelTime('서울역', '강남역');

      expect(result?.viaExpress).toBe(true);
      expect(result?.expressTime).toBe(18);
    });
  });

  describe('getAllStations', () => {
    it('should return all active stations', async () => {
      const mockStations = [
        {
          stationId: 'S001',
          stationName: '서울역',
          stationNameEnglish: 'Seoul Station',
          lines: ['1호선'],
          location: { lat: 37.5547, lng: 126.9707 },
          isTransferStation: false,
          isExpressStop: false,
          isTerminus: false,
          facilities: [],
          isActive: true,
          region: 'seoul',
          priority: 1,
        },
        {
          stationId: 'S002',
          stationName: '강남역',
          stationNameEnglish: 'Gangnam Station',
          lines: ['2호선'],
          location: { lat: 37.5172, lng: 127.0473 },
          isTransferStation: false,
          isExpressStop: false,
          isTerminus: false,
          facilities: [],
          isActive: true,
          region: 'seoul',
          priority: 2,
        },
      ];

      const mockQuerySnapshot = {
        docs: mockStations.map((station) => ({
          id: station.stationId,
          data: () => station,
        })),
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

      const result = await getAllStations();

      expect(result).toHaveLength(2);
      expect(result[0].stationName).toBe('서울역');
      expect(result[1].stationName).toBe('강남역');
    });

    it('should filter out inactive stations', async () => {
      const mockStations = [
        {
          stationId: 'S001',
          stationName: '서울역',
          isActive: true,
        },
        {
          stationId: 'S002',
          stationName: '폐역',
          isActive: false,
        },
      ];

      const mockQuerySnapshot = {
        docs: mockStations.map((station) => ({
          id: station.stationId,
          data: () => station,
        })),
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

      const result = await getAllStations();

      expect(result).toHaveLength(1);
      expect(result[0].stationName).toBe('서울역');
    });

    it('should use cache for subsequent calls', async () => {
      const mockStations = [
        {
          stationId: 'S001',
          stationName: '서울역',
          isActive: true,
        },
      ];

      const mockQuerySnapshot = {
        docs: mockStations.map((station) => ({
          id: station.stationId,
          data: () => station,
        })),
      };

      (getDocs as jest.Mock).mockResolvedValue(mockQuerySnapshot);

      // First call
      await getAllStations();
      // Second call (should use cache)
      await getAllStations();

      expect(getDocs).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached data', async () => {
      const mockStation = {
        stationId: 'S001',
        stationName: '서울역',
        isActive: true,
      };

      const mockDoc = {
        exists: true,
        data: () => mockStation,
        id: 'S001',
      };

      (getDoc as jest.Mock).mockResolvedValue(mockDoc);

      // First call to cache data
      await getStationByName('서울역');

      // Clear cache
      clearCache();

      // Second call should fetch from Firestore again
      await getStationByName('서울역');

      expect(getDoc).toHaveBeenCalledTimes(2);
    });
  });
});
