import {
  addDoc,
  collection,
  doc,
  type FirestoreError,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  CreateDeliveryPartnerData,
  CreateDeliveryPartnerDispatchData,
  DeliveryPartner,
  DeliveryPartnerDispatch,
  DeliveryPartnerDispatchStatusType,
  DeliveryPartnerStatus,
} from '../types/delivery-partner';

const DELIVERY_PARTNERS_COLLECTION = 'delivery_partners';
const PARTNER_DISPATCHES_COLLECTION = 'partner_dispatches';

type TimestampLike = Date | Timestamp | null | undefined;

type DeliveryPartnerDoc = DocumentData & {
  partnerName?: string;
  partnerType?: DeliveryPartner['partnerType'];
  status?: DeliveryPartnerStatus;
  capabilities?: DeliveryPartner['capabilities'];
  coverage?: DeliveryPartner['coverage'];
  integrationMode?: DeliveryPartner['integrationMode'];
  pricingPolicy?: DeliveryPartner['pricingPolicy'];
  sla?: DeliveryPartner['sla'];
  contact?: DeliveryPartner['contact'];
  orchestration?: DeliveryPartner['orchestration'];
  connectionStatus?: DeliveryPartner['connectionStatus'];
  lastConnectionCheckedAt?: TimestampLike;
  lastConnectionMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
};

type DeliveryPartnerDispatchDoc = DocumentData & {
  partnerId?: string;
  missionId?: string;
  requestId?: string;
  deliveryId?: string;
  deliveryLegId?: string;
  partnerCapability?: DeliveryPartnerDispatch['partnerCapability'];
  dispatchMethod?: DeliveryPartnerDispatch['dispatchMethod'];
  status?: DeliveryPartnerDispatchStatusType;
  originRef?: unknown;
  destinationRef?: unknown;
  payload?: Record<string, unknown>;
  requestedAt?: TimestampLike;
  acceptedAt?: TimestampLike;
  completedAt?: TimestampLike;
  rawResponse?: Record<string, unknown>;
  opsMemo?: string;
  createdAt?: TimestampLike;
  updatedAt?: TimestampLike;
};

function toDate(value: TimestampLike, fallback: Date): Date {
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return fallback;
}

function mapDeliveryPartner(snapshot: { id: string; data(): DocumentData }): DeliveryPartner {
  const raw = snapshot.data() as DeliveryPartnerDoc;
  const now = new Date();

  return {
    partnerId: snapshot.id,
    partnerName: raw.partnerName ?? '',
    partnerType: raw.partnerType ?? 'custom',
    status: raw.status ?? 'testing',
    capabilities: Array.isArray(raw.capabilities) ? raw.capabilities : [],
    coverage: Array.isArray(raw.coverage) ? raw.coverage : [],
    integrationMode: raw.integrationMode ?? 'manual_ops',
    pricingPolicy: raw.pricingPolicy,
    sla: raw.sla,
    contact: raw.contact,
    orchestration: raw.orchestration,
    connectionStatus: raw.connectionStatus,
    lastConnectionCheckedAt: raw.lastConnectionCheckedAt
      ? toDate(raw.lastConnectionCheckedAt, now)
      : undefined,
    lastConnectionMessage: raw.lastConnectionMessage,
    metadata: raw.metadata,
    createdAt: toDate(raw.createdAt, now),
    updatedAt: toDate(raw.updatedAt, now),
  };
}

function mapDispatch(snapshot: { id: string; data(): DocumentData }): DeliveryPartnerDispatch {
  const raw = snapshot.data() as DeliveryPartnerDispatchDoc;
  const now = new Date();

  return {
    dispatchId: snapshot.id,
    partnerId: raw.partnerId ?? '',
    missionId: raw.missionId ?? '',
    requestId: raw.requestId ?? '',
    deliveryId: raw.deliveryId,
    deliveryLegId: raw.deliveryLegId,
    partnerCapability: raw.partnerCapability,
    dispatchMethod: raw.dispatchMethod ?? 'manual_dashboard',
    status: raw.status ?? 'queued',
    originRef: raw.originRef,
    destinationRef: raw.destinationRef,
    payload: raw.payload,
    requestedAt: raw.requestedAt ? toDate(raw.requestedAt, now) : undefined,
    acceptedAt: raw.acceptedAt ? toDate(raw.acceptedAt, now) : undefined,
    completedAt: raw.completedAt ? toDate(raw.completedAt, now) : undefined,
    rawResponse: raw.rawResponse,
    opsMemo: raw.opsMemo,
    createdAt: toDate(raw.createdAt, now),
    updatedAt: toDate(raw.updatedAt, now),
  };
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as FirestoreError).code === 'permission-denied'
  );
}

export class DeliveryPartnerService {
  static async createPartner(data: CreateDeliveryPartnerData): Promise<string> {
    const partnerRef = await addDoc(collection(db, DELIVERY_PARTNERS_COLLECTION), {
      partnerName: data.partnerName,
      partnerType: data.partnerType,
      status: data.status ?? 'testing',
      capabilities: data.capabilities,
      coverage: data.coverage ?? [],
      integrationMode: data.integrationMode,
      pricingPolicy: data.pricingPolicy,
      sla: data.sla,
      contact: data.contact,
      orchestration: {
        actorType: 'external_partner',
        enabled: Boolean(data.orchestration?.enabled ?? true),
        priorityScore: Number(data.orchestration?.priorityScore ?? 50),
        supportsFullDelivery: Boolean(data.orchestration?.supportsFullDelivery ?? true),
        supportsPartialLegs: Boolean(data.orchestration?.supportsPartialLegs ?? true),
        supportedMissionTypes: data.orchestration?.supportedMissionTypes ?? ['last_mile'],
        fallbackOnly: Boolean(data.orchestration?.fallbackOnly ?? false),
      },
      connectionStatus: 'unknown',
      metadata: data.metadata,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return partnerRef.id;
  }

  static async getPartner(partnerId: string): Promise<DeliveryPartner | null> {
    const snapshot = await getDoc(doc(db, DELIVERY_PARTNERS_COLLECTION, partnerId));
    if (!snapshot.exists()) {
      return null;
    }
    return mapDeliveryPartner(snapshot);
  }

  static async listPartners(filters?: {
    status?: DeliveryPartnerStatus;
    integrationMode?: DeliveryPartner['integrationMode'];
    capability?: DeliveryPartner['capabilities'][number];
  }): Promise<DeliveryPartner[]> {
    const constraints: QueryConstraint[] = [];

    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters?.integrationMode) {
      constraints.push(where('integrationMode', '==', filters.integrationMode));
    }
    if (filters?.capability) {
      constraints.push(where('capabilities', 'array-contains', filters.capability));
    }

    const partnerQuery = constraints.length
      ? query(collection(db, DELIVERY_PARTNERS_COLLECTION), ...constraints)
      : query(collection(db, DELIVERY_PARTNERS_COLLECTION));

    const snapshot = await getDocs(partnerQuery);
    return snapshot.docs.map(mapDeliveryPartner);
  }

  static async getActivePartners(): Promise<DeliveryPartner[]> {
    return this.listPartners({ status: 'active' });
  }

  static async getBridgeSummary(): Promise<{
    activePartnerCount: number;
    connectedPartnerCount: number;
    apiReadyPartnerCount: number;
    fallbackOnlyPartnerCount: number;
    topPartnerNames: string[];
  }> {
    let partners: DeliveryPartner[] = [];
    try {
      partners = await this.getActivePartners();
    } catch (error) {
      if (!isPermissionDenied(error)) {
        throw error;
      }
      return {
        activePartnerCount: 0,
        connectedPartnerCount: 0,
        apiReadyPartnerCount: 0,
        fallbackOnlyPartnerCount: 0,
        topPartnerNames: [],
      };
    }

    return {
      activePartnerCount: partners.length,
      connectedPartnerCount: partners.filter((partner) => partner.connectionStatus === 'connected').length,
      apiReadyPartnerCount: partners.filter(
        (partner) => partner.integrationMode === 'api' && partner.connectionStatus === 'connected'
      ).length,
      fallbackOnlyPartnerCount: partners.filter((partner) => Boolean(partner.orchestration?.fallbackOnly)).length,
      topPartnerNames: partners.slice(0, 3).map((partner) => partner.partnerName).filter(Boolean),
    };
  }

  static async getDispatchSummary(filters: {
    requestId?: string;
    deliveryId?: string;
  }): Promise<
    Array<{
      dispatchId: string;
      partnerId: string;
      partnerName: string;
      status: DeliveryPartnerDispatchStatusType;
      dispatchMethod: DeliveryPartnerDispatch['dispatchMethod'];
      updatedAt: Date;
      opsMemo?: string;
    }>
  > {
    let dispatches: DeliveryPartnerDispatch[] = [];
    let partners: DeliveryPartner[] = [];

    try {
      [dispatches, partners] = await Promise.all([
        this.listDispatches({
          ...(filters.requestId ? { requestId: filters.requestId } : {}),
          ...(filters.deliveryId ? { deliveryId: filters.deliveryId } : {}),
        }),
        this.getActivePartners(),
      ]);
    } catch (error) {
      if (!isPermissionDenied(error)) {
        throw error;
      }
      return [];
    }

    const partnerNameMap = new Map(partners.map((partner) => [partner.partnerId, partner.partnerName] as const));

    return dispatches
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .map((dispatch) => ({
        dispatchId: dispatch.dispatchId,
        partnerId: dispatch.partnerId,
        partnerName: partnerNameMap.get(dispatch.partnerId) ?? dispatch.partnerId,
        status: dispatch.status,
        dispatchMethod: dispatch.dispatchMethod,
        updatedAt: dispatch.updatedAt,
        opsMemo: dispatch.opsMemo,
      }));
  }

  static async updatePartnerStatus(partnerId: string, status: DeliveryPartnerStatus): Promise<void> {
    await updateDoc(doc(db, DELIVERY_PARTNERS_COLLECTION, partnerId), {
      status,
      updatedAt: serverTimestamp(),
    });
  }

  static async queueDispatch(data: CreateDeliveryPartnerDispatchData): Promise<string> {
    const dispatchRef = await addDoc(collection(db, PARTNER_DISPATCHES_COLLECTION), {
      partnerId: data.partnerId,
      missionId: data.missionId,
      requestId: data.requestId,
      deliveryId: data.deliveryId,
      deliveryLegId: data.deliveryLegId,
      partnerCapability: data.partnerCapability,
      dispatchMethod: data.dispatchMethod,
      status: 'queued' as DeliveryPartnerDispatchStatusType,
      originRef: data.originRef,
      destinationRef: data.destinationRef,
      payload: data.payload,
      requestedAt: serverTimestamp(),
      opsMemo: data.opsMemo,
      rawResponse: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return dispatchRef.id;
  }

  static async getDispatch(dispatchId: string): Promise<DeliveryPartnerDispatch | null> {
    const snapshot = await getDoc(doc(db, PARTNER_DISPATCHES_COLLECTION, dispatchId));
    if (!snapshot.exists()) {
      return null;
    }
    return mapDispatch(snapshot);
  }

  static async listDispatches(filters?: {
    partnerId?: string;
    missionId?: string;
    requestId?: string;
    deliveryId?: string;
    status?: DeliveryPartnerDispatchStatusType;
  }): Promise<DeliveryPartnerDispatch[]> {
    const constraints: QueryConstraint[] = [];

    if (filters?.partnerId) constraints.push(where('partnerId', '==', filters.partnerId));
    if (filters?.missionId) constraints.push(where('missionId', '==', filters.missionId));
    if (filters?.requestId) constraints.push(where('requestId', '==', filters.requestId));
    if (filters?.deliveryId) constraints.push(where('deliveryId', '==', filters.deliveryId));
    if (filters?.status) constraints.push(where('status', '==', filters.status));

    const dispatchQuery = constraints.length
      ? query(collection(db, PARTNER_DISPATCHES_COLLECTION), ...constraints)
      : query(collection(db, PARTNER_DISPATCHES_COLLECTION));

    const snapshot = await getDocs(dispatchQuery);
    return snapshot.docs.map(mapDispatch);
  }

  static async updateDispatchStatus(
    dispatchId: string,
    status: DeliveryPartnerDispatchStatusType,
    updates?: {
      acceptedAt?: Date;
      completedAt?: Date;
      rawResponse?: Record<string, unknown>;
      opsMemo?: string;
    }
  ): Promise<void> {
    await updateDoc(doc(db, PARTNER_DISPATCHES_COLLECTION, dispatchId), {
      status,
      ...(updates?.acceptedAt ? { acceptedAt: updates.acceptedAt } : {}),
      ...(updates?.completedAt ? { completedAt: updates.completedAt } : {}),
      ...(updates?.rawResponse ? { rawResponse: updates.rawResponse } : {}),
      ...(typeof updates?.opsMemo === 'string' ? { opsMemo: updates.opsMemo } : {}),
      updatedAt: serverTimestamp(),
    });
  }
}

export const deliveryPartnerService = DeliveryPartnerService;
