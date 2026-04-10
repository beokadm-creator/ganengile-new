/**
 * Verification Service Unit Tests
 */

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
  Timestamp: {
    now: jest.fn(() => 'mock-timestamp'),
    fromDate: jest.fn((date: Date) => ({
      toDate: () => date,
      toMillis: () => date.getTime(),
    })),
  },
}));

// Mock Firebase Storage
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(),
}));

// Mock firebase module
jest.mock('../firebase', () => ({
  db: {},
  storage: {},
}));

// Mock profile-service
jest.mock('../profile-service', () => ({
  updateVerificationStatus: jest.fn(),
}));

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateVerificationStatus } from '../profile-service';
import {
  getUserVerification,
  uploadIdCardImage,
  submitVerification,
  updateVerificationRecordStatus,
  startCiVerification,
  completeCiVerification,
  getVerificationStatusDisplay,
} from '../verification-service';

describe('getUserVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('userId가 없으면 null을 반환해야 한다', async () => {
    const result = await getUserVerification('');
    expect(result).toBeNull();
  });

  it('인증 문서가 존재하면 반환해야 한다', async () => {
    const mockData = {
      userId: 'user-1',
      status: 'approved',
      name: '홍길동',
      birthDate: '1990-01-01',
      personalId: '123456',
    };
    const mockDocSnap = {
      exists: () => true,
      data: () => mockData,
    };

    (doc as jest.Mock).mockReturnValue({});
    (getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

    const result = await getUserVerification('user-1');

    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-1');
    expect(result!.status).toBe('approved');
    expect(result!.name).toBe('홍길동');
  });

  it('인증 문서가 없으면 null을 반환해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });

    const result = await getUserVerification('user-1');

    expect(result).toBeNull();
  });

  it('데이터가 null이면 null을 반환해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (getDoc as jest.Mock).mockResolvedValue({
      exists: () => true,
      data: () => null,
    });

    const result = await getUserVerification('user-1');

    expect(result).toBeNull();
  });

  it('기본값을 적용해야 한다', async () => {
    const mockData = {
      userId: 'user-1',
    };
    const mockDocSnap = {
      exists: () => true,
      data: () => mockData,
    };

    (doc as jest.Mock).mockReturnValue({});
    (getDoc as jest.Mock).mockResolvedValue(mockDocSnap);

    const result = await getUserVerification('user-1');

    expect(result!.status).toBe('pending');
  });

  it('Firestore 에러를 던져야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (getDoc as jest.Mock).mockRejectedValue(new Error('Firestore error'));

    await expect(getUserVerification('user-1')).rejects.toThrow('Firestore error');
  });
});

describe('uploadIdCardImage', () => {
  it('이미지를 업로드하고 다운로드 URL을 반환해야 한다', async () => {
    const mockBlob = new Blob(['image-data']);
    global.fetch = jest.fn().mockResolvedValue({
      blob: jest.fn().mockResolvedValue(mockBlob),
    }) as jest.Mock;

    (ref as jest.Mock).mockReturnValue('storage-ref');
    (uploadBytes as jest.Mock).mockResolvedValue(undefined);
    (getDownloadURL as jest.Mock).mockResolvedValue('https://storage.example.com/image.jpg');

    const result = await uploadIdCardImage('user-1', 'file://image.jpg', 'front');

    expect(result).toBe('https://storage.example.com/image.jpg');
    expect(ref).toHaveBeenCalledWith({}, expect.stringContaining('verifications/user-1/front-'));
    expect(uploadBytes).toHaveBeenCalledWith('storage-ref', mockBlob);
  });

  it('업로드 에러 시 에러를 던져야 한다', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as jest.Mock;

    await expect(uploadIdCardImage('user-1', 'file://image.jpg', 'front'))
      .rejects.toThrow('Network error');
  });
});

describe('submitVerification', () => {
  it('인증을 제출하고 UserVerification을 반환해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    const result = await submitVerification('user-1', {
      idCardType: 'resident',
      frontImageUrl: 'https://front.jpg',
      backImageUrl: 'https://back.jpg',
      name: '홍길동',
      birthDate: '1990-01-01',
      personalId: '123456',
    });

    expect(result.userId).toBe('user-1');
    expect(result.status).toBe('pending');
    expect(result.name).toBe('홍길동');
    expect(result.idCard.type).toBe('resident');
    expect(result.idCard.frontImageUrl).toBe('https://front.jpg');
    expect(setDoc).toHaveBeenCalledWith({}, expect.objectContaining({
      userId: 'user-1',
      status: 'pending',
      name: '홍길동',
    }));
  });

  it('제출 에러 시 에러를 던져야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (setDoc as jest.Mock).mockRejectedValue(new Error('Write error'));

    await expect(submitVerification('user-1', {
      idCardType: 'resident',
      frontImageUrl: 'https://front.jpg',
      backImageUrl: 'https://back.jpg',
      name: '홍길동',
      birthDate: '1990-01-01',
      personalId: '123456',
    })).rejects.toThrow('Write error');
  });
});

describe('updateVerificationRecordStatus', () => {
  it('상태를 업데이트해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    await updateVerificationRecordStatus('user-1', 'under_review', 'admin-1');

    expect(updateDoc).toHaveBeenCalledWith({}, expect.objectContaining({
      status: 'under_review',
      reviewedBy: 'admin-1',
      reviewedAt: 'mock-server-timestamp',
    }));
  });

  it('승인 시 프로필 인증 상태를 업데이트해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    await updateVerificationRecordStatus('user-1', 'approved', 'admin-1');

    expect(updateVerificationStatus).toHaveBeenCalledWith('user-1', true);
  });

  it('반려 시 사유를 저장해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    await updateVerificationRecordStatus('user-1', 'rejected', 'admin-1', '서류 불일치');

    expect(updateDoc).toHaveBeenCalledWith({}, expect.objectContaining({
      status: 'rejected',
      rejectionReason: '서류 불일치',
    }));
  });

  it('pending 상태에서는 reviewedBy를 설정하지 않아야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (updateDoc as jest.Mock).mockResolvedValue(undefined);

    await updateVerificationRecordStatus('user-1', 'pending');

    const callArgs = (updateDoc as jest.Mock).mock.calls[(updateDoc as jest.Mock).mock.calls.length - 1][1];
    expect(callArgs).not.toHaveProperty('reviewedBy');
  });
});

describe('startCiVerification', () => {
  it('CI 인증을 시작하고 provider를 반환해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    const result = await startCiVerification('user-1', 'pass');

    expect(result.provider).toBe('pass');
  });

  it(' Firestore에 CI 인증 시작 기록을 저장해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (setDoc as jest.Mock).mockResolvedValue(undefined);

    await startCiVerification('user-1', 'kakao');

    expect(setDoc).toHaveBeenCalledWith({}, expect.objectContaining({
      userId: 'user-1',
      status: 'pending',
      verificationMethod: 'ci',
      externalAuth: expect.objectContaining({
        provider: 'kakao',
        status: 'started',
      }),
    }), { merge: true });
  });
});

describe('completeCiVerification', () => {
  it('CI 인증 완료 처리를 해야 한다', async () => {
    (doc as jest.Mock).mockReturnValue({});
    (setDoc as jest.Mock).mockResolvedValue(undefined);
    (updateVerificationStatus as jest.Mock).mockResolvedValue(undefined);

    await completeCiVerification('user-1', 'pass', 'ci-hash-abc');

    expect(setDoc).toHaveBeenCalledWith({}, expect.objectContaining({
      userId: 'user-1',
      status: 'approved',
      ciHash: 'ci-hash-abc',
      verificationMethod: 'ci',
      externalAuth: expect.objectContaining({
        provider: 'pass',
        status: 'verified',
      }),
    }), { merge: true });
    expect(updateVerificationStatus).toHaveBeenCalledWith('user-1', true);
  });
});

describe('getVerificationStatusDisplay', () => {
  it('인증 정보가 없으면 미제출 상태를 반환해야 한다', () => {
    const result = getVerificationStatusDisplay(null);
    expect(result.status).toBe('not_submitted');
    expect(result.statusKo).toBe('미제출');
    expect(result.icon).toBe('❓');
    expect(result.color).toBe('#9E9E9E');
  });

  it('pending 상태를 올바르게 표시해야 한다', () => {
    const result = getVerificationStatusDisplay({ status: 'pending' } as any);
    expect(result.status).toBe('pending');
    expect(result.statusKo).toBe('대기중');
    expect(result.icon).toBe('⏳');
  });

  it('under_review 상태를 올바르게 표시해야 한다', () => {
    const result = getVerificationStatusDisplay({ status: 'under_review' } as any);
    expect(result.status).toBe('under_review');
    expect(result.statusKo).toBe('심사중');
  });

  it('approved 상태를 올바르게 표시해야 한다', () => {
    const result = getVerificationStatusDisplay({ status: 'approved' } as any);
    expect(result.status).toBe('approved');
    expect(result.statusKo).toBe('인증 완료');
    expect(result.icon).toBe('✅');
  });

  it('rejected 상태를 올바르게 표시하고 반려 사유를 포함해야 한다', () => {
    const result = getVerificationStatusDisplay({
      status: 'rejected',
      rejectionReason: '서류 불일치',
    } as any);
    expect(result.status).toBe('rejected');
    expect(result.statusKo).toBe('반려');
    expect(result.description).toBe('서류 불일치');
  });

  it('rejected 상태에서 사유가 없으면 기본 메시지를 표시해야 한다', () => {
    const result = getVerificationStatusDisplay({ status: 'rejected' } as any);
    expect(result.description).toBe('인증이 반려되었습니다');
  });

  it('CI 방식 approved 상태에서 다른 설명을 표시해야 한다', () => {
    const result = getVerificationStatusDisplay({
      status: 'approved',
      verificationMethod: 'ci',
    } as any);
    expect(result.description).toContain('PASS/Kakao');
  });

  it('CI 방식 pending 상태에서 다른 설명을 표시해야 한다', () => {
    const result = getVerificationStatusDisplay({
      status: 'pending',
      verificationMethod: 'ci',
    } as any);
    expect(result.description).toContain('본인인증');
  });
});
