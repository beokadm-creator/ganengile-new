/**
 * Config Service Unit Tests
 */

import { getAllStations, getStationById, getTravelTime } from '../../services/config-service';

// Mock Firestore
jest.mock('../../services/firebase', () => ({
  db: {
    collection: jest.fn(() => ({
      getDocs: jest.fn(),
    })),
  },
}));

describe('Config Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllStations', () => {
    it('모든 역을 반환해야 한다', async () => {
      // Given
      const mockStations = [
        { stationId: '1', stationName: '서울역', lines: [{ lineId: '1' }] },
        { stationId: '2', stationName: '강남역', lines: [{ lineId: '2' }] },
      ];

      // Mock implementation
      const mockCollection = {
        getDocs: jest.fn().mockResolvedValue({
          docs: mockStations.map(s => ({ data: () => s })),
        }),
      };

      // When
      const result = await getAllStations();

      // Then
      expect(result).toHaveLength(2);
      expect(result[0].stationName).toBe('서울역');
    });

    it('데이터가 없으면 빈 배열을 반환해야 한다', async () => {
      // Given
      const mockCollection = {
        getDocs: jest.fn().mockResolvedValue({ docs: [] }),
      };

      // When
      const result = await getAllStations();

      // Then
      expect(result).toEqual([]);
    });
  });

  describe('getStationById', () => {
    it('ID로 역을 조회해야 한다', async () => {
      // Given
      const mockStation = {
        stationId: '1',
        stationName: '서울역',
        lines: [{ lineId: '1' }],
      };

      // When
      const result = await getStationById('1');

      // Then
      expect(result?.stationId).toBe('1');
      expect(result?.stationName).toBe('서울역');
    });

    it('존재하지 않는 ID면 null을 반환해야 한다', async () => {
      // When
      const result = await getStationById('999');

      // Then
      expect(result).toBeNull();
    });
  });

  describe('getTravelTime', () => {
    it('두 역 사이 이동 시간을 반환해야 한다', async () => {
      // Given
      const mockTravelTime = {
        fromStationId: '1',
        toStationId: '2',
        minutes: 25,
      };

      // When
      const result = await getTravelTime('1', '2');

      // Then
      expect(result).toBeDefined();
      expect(result?.minutes).toBe(25);
    });

    it('같은 역이면 0분을 반환해야 한다', async () => {
      // When
      const result = await getTravelTime('1', '1');

      // Then
      expect(result?.minutes).toBe(0);
    });
  });
});
