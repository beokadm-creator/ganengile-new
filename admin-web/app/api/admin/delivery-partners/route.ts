import { NextRequest, NextResponse } from 'next/server';
import type { Firestore } from 'firebase-admin/firestore';
import { db } from '@/lib/firebase-admin';
import { isAdmin } from '@/lib/auth';

type UnknownRecord = Record<string, unknown>;

const PARTNERS_COLLECTION = 'delivery_partners';
const PRIVATE_COLLECTION = 'admin_delivery_partner_integrations';

function getDb(): Firestore {
  return db as unknown as Firestore;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function buildPublicPayload(body: UnknownRecord) {
  return {
    partnerName: asString(body.partnerName).trim(),
    partnerType: asString(body.partnerType, 'custom').trim(),
    status: asString(body.status, 'testing').trim(),
    capabilities: asStringArray(body.capabilities),
    coverage: Array.isArray(body.coverage) ? body.coverage : [],
    settlementConfig:
      typeof body.settlementConfig === 'object' && body.settlementConfig !== null
        ? {
            commissionRate: asNumber((body.settlementConfig as UnknownRecord).commissionRate, 0.15),
            taxRate: asNumber((body.settlementConfig as UnknownRecord).taxRate, 0.1),
            settlementCycle: asString((body.settlementConfig as UnknownRecord).settlementCycle, 'monthly'),
            bankAccount:
              typeof (body.settlementConfig as UnknownRecord).bankAccount === 'object' &&
              (body.settlementConfig as UnknownRecord).bankAccount !== null
                ? {
                    bank: asString(((body.settlementConfig as UnknownRecord).bankAccount as UnknownRecord).bank),
                    accountNumber: asString(((body.settlementConfig as UnknownRecord).bankAccount as UnknownRecord).accountNumber),
                    accountHolder: asString(((body.settlementConfig as UnknownRecord).bankAccount as UnknownRecord).accountHolder),
                  }
                : undefined,
          }
        : {
            commissionRate: 0.15,
            taxRate: 0.1,
            settlementCycle: 'monthly',
          },
    integrationMode: asString(body.integrationMode, 'manual_ops').trim(),
    pricingPolicy:
      typeof body.pricingPolicy === 'object' && body.pricingPolicy !== null
        ? body.pricingPolicy
        : undefined,
    sla: typeof body.sla === 'object' && body.sla !== null ? body.sla : undefined,
    contact: typeof body.contact === 'object' && body.contact !== null ? body.contact : undefined,
    orchestration: {
      actorType: 'external_partner',
      enabled: asBoolean((body.orchestration as UnknownRecord | undefined)?.enabled, true),
      priorityScore: asNumber((body.orchestration as UnknownRecord | undefined)?.priorityScore, 50),
      supportsFullDelivery: asBoolean(
        (body.orchestration as UnknownRecord | undefined)?.supportsFullDelivery,
        true
      ),
      supportsPartialLegs: asBoolean(
        (body.orchestration as UnknownRecord | undefined)?.supportsPartialLegs,
        true
      ),
      supportedMissionTypes: asStringArray(
        (body.orchestration as UnknownRecord | undefined)?.supportedMissionTypes
      ),
      fallbackOnly: asBoolean((body.orchestration as UnknownRecord | undefined)?.fallbackOnly, false),
    },
    connectionStatus: asString(body.connectionStatus, 'unknown').trim(),
    lastConnectionMessage: asString(body.lastConnectionMessage).trim(),
    updatedAt: new Date(),
  };
}

function buildPrivatePayload(body: UnknownRecord) {
  return {
    baseUrl: asString(body.baseUrl).trim(),
    apiKey: asString(body.apiKey).trim(),
    apiSecret: asString(body.apiSecret).trim(),
    webhookUrl: asString(body.webhookUrl).trim(),
    healthcheckPath: asString(body.healthcheckPath).trim(),
    authScheme: asString(body.authScheme, 'bearer').trim(),
    statusMessage: asString(body.statusMessage).trim(),
    lastTestedAt: new Date(),
    updatedAt: new Date(),
  };
}

function mergePartnerItem(
  id: string,
  publicDoc: UnknownRecord | null,
  privateDoc: UnknownRecord | null
) {
  const orchestration =
    typeof publicDoc?.orchestration === 'object' && publicDoc.orchestration !== null
      ? (publicDoc.orchestration as UnknownRecord)
      : {};

  return {
    id,
    partnerName: asString(publicDoc?.partnerName),
    partnerType: asString(publicDoc?.partnerType, 'custom'),
    status: asString(publicDoc?.status, 'testing'),
    capabilities: asStringArray(publicDoc?.capabilities),
    coverage: Array.isArray(publicDoc?.coverage) ? publicDoc?.coverage : [],
    settlementConfig:
      typeof publicDoc?.settlementConfig === 'object' && publicDoc.settlementConfig !== null
        ? publicDoc.settlementConfig
        : {
            commissionRate: 0.15,
            taxRate: 0.1,
            settlementCycle: 'monthly',
          },
    integrationMode: asString(publicDoc?.integrationMode, 'manual_ops'),
    orchestration: {
      actorType: 'external_partner',
      enabled: asBoolean(orchestration.enabled, true),
      priorityScore: asNumber(orchestration.priorityScore, 50),
      supportsFullDelivery: asBoolean(orchestration.supportsFullDelivery, true),
      supportsPartialLegs: asBoolean(orchestration.supportsPartialLegs, true),
      supportedMissionTypes: asStringArray(orchestration.supportedMissionTypes),
      fallbackOnly: asBoolean(orchestration.fallbackOnly, false),
    },
    connectionStatus: asString(publicDoc?.connectionStatus, 'unknown'),
    lastConnectionMessage: asString(publicDoc?.lastConnectionMessage),
    baseUrl: asString(privateDoc?.baseUrl),
    apiKey: asString(privateDoc?.apiKey),
    apiSecret: asString(privateDoc?.apiSecret),
    webhookUrl: asString(privateDoc?.webhookUrl),
    healthcheckPath: asString(privateDoc?.healthcheckPath),
    authScheme: asString(privateDoc?.authScheme, 'bearer'),
    statusMessage: asString(privateDoc?.statusMessage),
    createdAt: publicDoc?.createdAt ?? null,
    updatedAt: publicDoc?.updatedAt ?? privateDoc?.updatedAt ?? null,
    lastTestedAt: privateDoc?.lastTestedAt ?? null,
  };
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const [publicSnap, privateSnap] = await Promise.all([
    db.collection(PARTNERS_COLLECTION).orderBy('updatedAt', 'desc').get(),
    db.collection(PRIVATE_COLLECTION).get(),
  ]);

  const privateMap = new Map(
    privateSnap.docs.map((snapshot) => [snapshot.id, ((snapshot.data() as UnknownRecord) ?? {})] as const)
  );

  const items = publicSnap.docs.map((snapshot) =>
    mergePartnerItem(
      snapshot.id,
      ((snapshot.data() as UnknownRecord) ?? {}),
      privateMap.get(snapshot.id) ?? null
    )
  );

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as UnknownRecord;
  const db = getDb();
  const publicPayload = {
    ...buildPublicPayload(body),
    createdAt: new Date(),
  };
  const privatePayload = {
    ...buildPrivatePayload(body),
    createdAt: new Date(),
  };

  const publicRef = await db.collection(PARTNERS_COLLECTION).add(publicPayload);
  await db.collection(PRIVATE_COLLECTION).doc(publicRef.id).set(privatePayload, { merge: true });

  return NextResponse.json({ ok: true, id: publicRef.id });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as UnknownRecord;
  const partnerId = asString(body.partnerId).trim();
  if (!partnerId) {
    return NextResponse.json({ error: 'partnerId is required' }, { status: 400 });
  }

  const db = getDb();
  await db.collection(PARTNERS_COLLECTION).doc(partnerId).set(buildPublicPayload(body), { merge: true });
  await db.collection(PRIVATE_COLLECTION).doc(partnerId).set(buildPrivatePayload(body), { merge: true });

  return NextResponse.json({ ok: true });
}
