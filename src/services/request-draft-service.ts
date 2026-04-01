import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  AIAnalysis,
  HandoverEvent,
  PricingQuote,
  RequestDraft,
} from '../types/beta1';
import {
  AIAnalysisStatus,
  PricingQuoteStatus,
  RequestDraftStatus,
} from '../types/beta1';

type CreateRequestDraftInput = Omit<RequestDraft, 'requestDraftId' | 'createdAt' | 'updatedAt' | 'status'> & {
  status?: RequestDraftStatus;
};

type CreateAIAnalysisInput = Omit<AIAnalysis, 'aiAnalysisId' | 'createdAt' | 'updatedAt' | 'status'> & {
  status?: AIAnalysisStatus;
};

type CreatePricingQuoteInput = Omit<PricingQuote, 'pricingQuoteId' | 'createdAt' | 'updatedAt' | 'status'> & {
  status?: PricingQuoteStatus;
};

export async function createRequestDraft(
  input: CreateRequestDraftInput
): Promise<RequestDraft> {
  const payload = {
    ...input,
    status: input.status ?? RequestDraftStatus.DRAFT,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'request_drafts'), payload);
  return {
    requestDraftId: ref.id,
    ...input,
    status: input.status ?? RequestDraftStatus.DRAFT,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function getRequestDraftById(
  requestDraftId: string
): Promise<RequestDraft | null> {
  const snap = await getDoc(doc(db, 'request_drafts', requestDraftId));
  if (!snap.exists()) return null;
  return {
    requestDraftId: snap.id,
    ...(snap.data() as Omit<RequestDraft, 'requestDraftId'>),
  };
}

export async function updateRequestDraft(
  requestDraftId: string,
  patch: Partial<Omit<RequestDraft, 'requestDraftId' | 'createdAt'>>
): Promise<void> {
  await updateDoc(doc(db, 'request_drafts', requestDraftId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function createAIAnalysis(
  input: CreateAIAnalysisInput
): Promise<AIAnalysis> {
  const payload = {
    ...input,
    status: input.status ?? AIAnalysisStatus.QUEUED,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'ai_analyses'), payload);
  return {
    aiAnalysisId: ref.id,
    ...input,
    status: input.status ?? AIAnalysisStatus.QUEUED,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function createPricingQuote(
  input: CreatePricingQuoteInput
): Promise<PricingQuote> {
  const payload = {
    ...input,
    status: input.status ?? PricingQuoteStatus.DRAFT,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'pricing_quotes'), payload);
  return {
    pricingQuoteId: ref.id,
    ...input,
    status: input.status ?? PricingQuoteStatus.DRAFT,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function markPricingQuoteSelected(
  pricingQuoteId: string,
  requestDraftId: string
): Promise<void> {
  await updateDoc(doc(db, 'pricing_quotes', pricingQuoteId), {
    status: PricingQuoteStatus.SELECTED,
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'request_drafts', requestDraftId), {
    selectedPricingQuoteId: pricingQuoteId,
    status: RequestDraftStatus.PRICING_READY,
    updatedAt: serverTimestamp(),
  });
}

export async function upsertHandoverEvent(event: HandoverEvent): Promise<void> {
  await setDoc(doc(db, 'handover_events', event.handoverEventId), {
    ...event,
    updatedAt: serverTimestamp(),
  });
}
