/**
 * Locker Service Unit Tests
 */

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => {
  const mockTimestamp = function (seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  };
  mockTimestamp.now = jest.fn(() => new mockTimestamp(Date.now() / 1000, 0));
  mockTimestamp.fromDate = jest.fn((date: Date) => new mockTimestamp(date.getTime() / 1000, 0));
  mockTimestamp.prototype.toDate = jest.fn(function () { return new Date(this.seconds * 1000); });
  return {
    addDoc: jest.fn(),
    collection: jest.fn(),
    doc: jest.fn(),
    getDoc: jest.fn(),
    getDocs: jest.fn(),
    query: jest.fn(),
    serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
    updateDoc: jest.fn(),
    where: jest.fn(),
    Timestamp: mockTimestamp,
  };
});

// Mock firebase module
jest.mock('../firebase', () => ({
  db: {},
}));

// Mock config-service
jest.mock('../config-service', () => ({
  getStationConfig: jest.fn(),
}));

// Mock qrcode-service
jest.mock('../qrcode-service', () => ({
  QRCodeService: {
    generateLockerAccessQRCode: jest.fn(),
  },
  verifyQRCode: jest.fn(),
}));

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { LockerService, createLockerService } from '../locker-service';
import {
  getLockerReservation,
  updateReservationStatus,
  addReservationPhotos,
  getDeliveryReservations,
  getLocker,
  createLockerReservation,
  unlockLocker,
  getAvailableLockers,
  getLockersByStation,
  getNonSubwayLockers,
  createLockerLocation,
  getReservationByQRCode,
  openLocker,
} from '../locker-service';
import { verifyQRCode } from '../qrcode-service';
import { LockerStatus } from '../../types/locker';

describe('LockerService', () => {
  let service: LockerService;

  beforeEach(() => {
    service = createLockerService();
    jest.clearAllMocks();
  });

  describe('getReservation', () => {
    it('예약이 존재하면 반환해야 한다', async () => {
      const mockData = {
        lockerId: 'locker-1',
        userId: 'user-1',
        requestId: 'req-1',
        status: 'pending',
      };
      const mockDocSnap = {
        exists: () => true,
        id: 'res-1',
        data: () => mockData,
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

      const result = await service.getReservation('res-1');

      expect(result).not.toBeNull();
      expect(result!.reservationId).toBe('res-1');
      expect(result!.lockerId).toBe('locker-1');
    });

    it('예약이 없으면 null을 반환해야 한다', async () => {
      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      const result = await service.getReservation('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('completeReservation', () => {
    it('예약을 완료 처리하고 사물함을 AVAILABLE로 변경해야 한다', async () => {
      const mockData = {
        lockerId: 'locker-1',
        userId: 'user-1',
        status: 'pending',
      };
      const mockDocSnap = {
        exists: () => true,
        id: 'res-1',
        data: () => mockData,
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue(mockDocSnap);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await service.completeReservation('res-1');

      expect(updateDoc).toHaveBeenCalledTimes(2);
      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ status: 'completed' })
      );
      expect(updateDoc).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ status: LockerStatus.AVAILABLE })
      );
    });

    it('예약이 없으면 에러를 던져야 한다', async () => {
      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

      await expect(service.completeReservation('nonexistent'))
        .rejects.toThrow('Reservation not found');
    });
  });

  describe('createReservation', () => {
    it('사물함을 찾을 수 없으면 에러를 던져야 한다', async () => {
      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      await expect(service.createReservation('nonexistent', 'user-1', 'req-1', 'medium', 240))
        .rejects.toThrow('Locker not found');
    });

    it('사물함이 사용 불가능하면 에러를 던져야 한다', async () => {
      const mockLockerDoc = {
        exists: () => true,
        id: 'locker-1',
        data: () => ({ status: LockerStatus.OCCUPIED }),
      };

      (doc as jest.Mock).mockReturnValue({});
      (getDoc as jest.Mock)
        .mockResolvedValueOnce(mockLockerDoc)
        .mockResolvedValue({ exists: () => false });
      (getDocs as jest.Mock).mockResolvedValue({ docs: [] });

      await expect(service.createReservation('locker-1', 'user-1', 'req-1', 'medium', 240))
        .rejects.toThrow('Locker is not available');
    });
  });

  describe('recommendLockers', () => {
    it('pickupStationId와 일치하는 사물함을 추천해야 한다', async () => {
      const mockLocker = {
        id: 'locker-1',
        data: () => ({
          status: LockerStatus.AVAILABLE,
          location: { stationId: 'station-1', stationName: '서울역' },
          isSubway: true,
        }),
      };

      (collection as jest.Mock).mockReturnValue({});
      (getDocs as jest.Mock).mockResolvedValue({
        docs: [mockLocker],
      });

      const result = await service.recommendLockers('station-1', 'station-2');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});

describe('getLockerReservation (exported)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('예약을 조회해야 한다', async () => {
    const mockData = { lockerId: 'l1', status: 'active' };
    (doc as jest.Mock).mockReturnValue({});
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      id: 'res-1',
      data: () => mockData,
    });

    const result = await getLockerReservation('res-1');
    expect(result!.reservationId).toBe('res-1');
  });
});

describe('updateReservationStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('예약 상태를 업데이트해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    await updateReservationStatus('res-1', 'active');

    expect(updateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ status: 'active' })
    );
  });
});

describe('addReservationPhotos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('인수 사진을 추가해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    await addReservationPhotos('res-1', 'https://pickup.jpg', 'https://delivery.jpg');

    expect(updateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        pickupPhotoUrl: 'https://pickup.jpg',
        dropoffPhotoUrl: 'https://delivery.jpg',
      })
    );
  });

  it('사진 URL이 없으면 해당 필드를 제외해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    await addReservationPhotos('res-1');

    const callArgs = (updateDoc as jest.Mock).mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('pickupPhotoUrl');
    expect(callArgs).not.toHaveProperty('dropoffPhotoUrl');
  });
});

describe('unlockLocker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('유효한 QR 코드로 사물함을 열어야 한다', async () => {
    (verifyQRCode as jest.Mock).mockReturnValue({
      isValid: true,
      data: { metadata: { lockerId: 'locker-1' } },
    });
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    const result = await unlockLocker('locker-1', 'valid-qr');

    expect(result.success).toBe(true);
    expect(updateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ status: LockerStatus.OCCUPIED })
    );
  });

  it('유효하지 않은 QR 코드면 실패해야 한다', async () => {
    (verifyQRCode as jest.Mock).mockReturnValue({
      isValid: false,
      error: '유효하지 않은 QR 코드입니다.',
    });

    const result = await unlockLocker('locker-1', 'invalid-qr');

    expect(result.success).toBe(false);
    expect(result.message).toBe('유효하지 않은 QR 코드입니다.');
    expect(updateDoc).not.toHaveBeenCalled();
  });

  it('다른 사물함의 QR 코드면 실패해야 한다', async () => {
    (verifyQRCode as jest.Mock).mockReturnValue({
      isValid: true,
      data: { metadata: { lockerId: 'locker-2' } },
    });

    const result = await unlockLocker('locker-1', 'different-locker-qr');

    expect(result.success).toBe(false);
    expect(result.message).toContain('다른 사물함용');
  });
});

describe('createLockerLocation', () => {
  it('사물함 위치 정보를 올바르게 생성해야 한다', () => {
    const locker = {
      lockerId: 'locker-1',
      location: {
        stationId: 'st-1',
        stationName: '서울역',
        line: '1호선',
        floor: 2,
        section: 'A구역',
        contactPhone: '02-1234-5678',
        nearby: false,
      },
      pricing: { base: 1000, baseDuration: 240, extension: 500 },
      status: LockerStatus.AVAILABLE,
    } as any;

    const result = createLockerLocation(locker);

    expect(result.lockerId).toBe('locker-1');
    expect(result.name).toBe('A구역');
    expect(result.stationName).toBe('서울역');
    expect(result.line).toBe('1호선');
    expect(result.floor).toBe(2);
    expect(result.pricePer4Hours).toBe(1000);
    expect(result.telNo).toBe('02-1234-5678');
    expect(result.isAvailable).toBe(true);
  });

  it('사용 불가능한 사물함은 isAvailable이 false여야 한다', () => {
    const locker = {
      lockerId: 'locker-2',
      location: { stationId: 'st-1', stationName: '서울역', line: '1호선', floor: 1, section: 'locker-2' },
      pricing: { base: 500, baseDuration: 240, extension: 200 },
      status: LockerStatus.OCCUPIED,
    } as any;

    const result = createLockerLocation(locker);

    expect(result.isAvailable).toBe(false);
    expect(result.status).toBe(LockerStatus.OCCUPIED);
  });
});

describe('openLocker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('예약 ID로 사물함을 열어야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    const result = await openLocker('locker-1', 'res-1');

    expect(result.success).toBe(true);
    expect(updateDoc).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ status: 'active' })
    );
  });

  it('에러 발생 시 실패해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockRejectedValue(new Error('Update failed'));

    const result = await openLocker('locker-1', 'res-1');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Update failed');
  });
});

describe('getDeliveryReservations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('배송 ID로 예약 목록을 조회해야 한다', async () => {
    const mockQuery = {};
    const mockDoc = { id: 'res-1', data: () => ({ deliveryId: 'del-1', status: 'active' }) };

    (collection as jest.Mock).mockReturnValue({});
    (where as jest.Mock).mockReturnValue(mockQuery);
    (getDocs as jest.Mock).mockResolvedValue({ docs: [mockDoc] });

    const result = await getDeliveryReservations('del-1');

    expect(result).toHaveLength(1);
  });
});
