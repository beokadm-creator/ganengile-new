/**
 * Photo Types
 * 사진 인증 및 분쟁 증빙 타입
 */

export enum PhotoType {
  PICKUP = 'pickup',
  DROPOFF = 'dropoff',
  DAMAGED = 'damaged',
  EVIDENCE = 'evidence',
}

export enum PhotoStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  DISPUTED = 'disputed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface Photo {
  photoId: string;
  type: PhotoType;
  userId: string;
  requestId: string;
  deliveryId?: string;
  url: string;
  thumbnailUrl: string;
  location?: {
    lat: number;
    lng: number;
  };
  takenAt: Date;
  uploadedAt: Date;
  status: PhotoStatus;
  verifiedBy?: string;
  verifiedAt?: Date;
  metadata?: {
    deviceInfo?: string;
    appVersion?: string;
    fileSize?: number;
    mimeType?: string;
  };
}

export interface Dispute {
  disputeId: string;
  type: 'damage' | 'loss' | 'quality' | 'delay' | 'other';
  reporterId: string;
  reporterType: 'requester' | 'giller';
  requestId: string;
  deliveryId?: string;
  matchId?: string;
  description: string;
  photoUrls: string[];
  evidenceUrls: string[];
  urgency?: 'normal' | 'urgent' | 'critical';
  status: 'pending' | 'investigating' | 'resolved' | 'rejected';
  resolution?: {
    responsibility: 'requester' | 'giller' | 'system';
    compensation: number;
    note?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface PhotoVerification {
  photoId: string;
  isValid: boolean;
  confidence: number;
  issues?: string[];
  verifiedAt: Date;
}
