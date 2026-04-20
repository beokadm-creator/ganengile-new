jest.mock('../../utils/error-handler', () => ({
  parseError: jest.fn(),
  showErrorAlert: jest.fn(),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  addDoc: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  startAt: jest.fn(),
  Timestamp: {
    now: jest.fn(() => ({ toDate: () => new Date(), toMillis: () => Date.now() })),
    fromDate: jest.fn((d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() })),
  },
  serverTimestamp: jest.fn(),
}));

jest.mock('../../core/firebase', () => ({
  db: {},
}));

import * as configService from '../config-service';
import * as matchingService from '../matching-service';

describe('config-service re-export integrity', () => {
  it('exports getStationConfig as a function', () => {
    expect(typeof configService.getStationConfig).toBe('function');
  });

  it('exports getAllStations as a function', () => {
    expect(typeof configService.getAllStations).toBe('function');
  });

  it('exports getStationsByRegion as a function', () => {
    expect(typeof configService.getStationsByRegion).toBe('function');
  });

  it('exports getStationsByLine as a function', () => {
    expect(typeof configService.getStationsByLine).toBe('function');
  });

  it('exports getTravelTimeConfig as a function', () => {
    expect(typeof configService.getTravelTimeConfig).toBe('function');
  });

  it('exports clearConfigCache as a function', () => {
    expect(typeof configService.clearConfigCache).toBe('function');
  });
});

describe('matching-service re-export integrity', () => {
  it('exports findMatchesForRequest as a function', () => {
    expect(typeof matchingService.findMatchesForRequest).toBe('function');
  });

  it('exports fetchActiveGillerRoutes as a function', () => {
    expect(typeof matchingService.fetchActiveGillerRoutes).toBe('function');
  });

  it('exports findGiller as a function', () => {
    expect(typeof matchingService.findGiller).toBe('function');
  });
});
