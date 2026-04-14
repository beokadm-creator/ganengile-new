import { useState, useRef, useEffect, useMemo } from 'react';
import { useCreateRequestStore } from '../store/useCreateRequestStore';
import { useUser } from '../../../../contexts/UserContext';
import { getPricingPolicyConfig } from '../../../../services/pricing-policy-config-service';
import { getRoutePricingOverrideByStations } from '../../../../services/route-pricing-override-service';
import {
  generatePricingQuotesForBeta1Input,
  type Beta1AIQuoteResponse,
} from '../../../../services/beta1-ai-service';
import {
  buildBeta1BasePricing,
  buildBeta1QuoteCards,
  applyAIQuoteResponseToCards,
} from '../../../../services/beta1-orchestration-service';
import { resolvePricingContextForRequest } from '../../../../services/pricing-context-service';
import type { SharedPricingPolicyConfig } from '../../../../../shared/pricing-policy';
import type { RequestPricingContext, StationInfo } from '../../../../types/request';
import { combineReservationSchedule } from '../../../../utils/format';

export function usePricingQuotes() {
  const { user } = useUser();
  const store = useCreateRequestStore();

  const [pricingPolicy, setPricingPolicy] = useState<SharedPricingPolicyConfig | null>(null);
  const [routeOverride, setRouteOverride] = useState<Awaited<ReturnType<typeof getRoutePricingOverrideByStations>>>(null);
  const [pricingContext, setPricingContext] = useState<RequestPricingContext | null>(null);
  const [aiQuoteResponse, setAiQuoteResponse] = useState<Beta1AIQuoteResponse | null>(null);

  const aiQuoteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiQuoteRequestIdRef = useRef(0);
  const quoteSelectionTouchedRef = useRef(false);

  const desiredArrivalSchedule =
    store.requestMode === 'reservation'
      ? combineReservationSchedule(store.preferredPickupDate, store.preferredPickupTime)
      : store.preferredArrivalTime;

  const resolvedPreferredPickupTime =
    store.requestMode === 'reservation'
      ? combineReservationSchedule(store.preferredPickupDate, store.preferredPickupTime)
      : store.preferredPickupTime || 'now';

  // Fetch Pricing Policy
  useEffect(() => {
    void getPricingPolicyConfig().then(setPricingPolicy).catch((error) => {
      console.error('Failed to load pricing policy config', error);
    });
  }, []);

  // Fetch Route Override
  useEffect(() => {
    if (!store.pickupStation?.stationId || !store.deliveryStation?.stationId) {
      setRouteOverride(null);
      return;
    }

    void getRoutePricingOverrideByStations({
      pickupStationId: store.pickupStation.stationId,
      deliveryStationId: store.deliveryStation.stationId,
      requestMode: store.requestMode,
    }).then(setRouteOverride).catch((error) => {
      console.error('Failed to load route pricing override', error);
      setRouteOverride(null);
    });
  }, [store.deliveryStation?.stationId, store.pickupStation?.stationId, store.requestMode]);

  // Fetch Pricing Context
  useEffect(() => {
    if (!store.pickupStation || !store.deliveryStation) {
      setPricingContext(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const nextContext = await resolvePricingContextForRequest({
          pickupStationName: store.pickupStation!.stationName,
          deliveryStationName: store.deliveryStation!.stationName,
          pickupLat: store.pickupStation!.lat,
          pickupLng: store.pickupStation!.lng,
          deliveryLat: store.deliveryStation!.lat,
          deliveryLng: store.deliveryStation!.lng,
          preferredPickupTime: resolvedPreferredPickupTime,
          requestMode: store.requestMode,
          urgency: store.requestMode === 'reservation' ? 'normal' : store.urgency,
        });

        if (!cancelled) {
          setPricingContext(nextContext);
        }
      } catch (error) {
        console.error('Failed to resolve pricing context', error);
        if (!cancelled) {
          setPricingContext(null);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    store.pickupStation,
    store.deliveryStation,
    resolvedPreferredPickupTime,
    store.requestMode,
    store.urgency,
  ]);

  // Calculate Deterministic Quotes
  const deterministicQuotes = useMemo(() => {
    if (!pricingPolicy || !store.pickupStation || !store.deliveryStation) return [];

    const baseInput = {
      requesterUserId: user?.uid ?? 'unknown',
      requestMode: store.requestMode,
      originType: store.pickupMode,
      destinationType: store.deliveryMode,
      pickupStation: store.pickupStation,
      deliveryStation: store.deliveryStation,
      pickupRoadAddress: store.pickupRoadAddress || undefined,
      pickupDetailAddress: store.pickupDetailAddress || undefined,
      deliveryRoadAddress: store.deliveryRoadAddress || undefined,
      deliveryDetailAddress: store.deliveryDetailAddress || undefined,
      selectedPhotoIds: store.photoRefs,
      packageItemName: store.packageItemName || undefined,
      packageCategory: store.packageCategory || undefined,
      packageDescription: store.packageDescription || '물품 설명',
      packageSize: store.packageSize,
      weightKg: Math.max(0.1, Number(store.weightKg || 0)),
      itemValue: Number(store.itemValue || 0),
      recipientName: store.recipientName || '수령인',
      recipientPhone: store.recipientPhone || '010-0000-0000',
      pickupLocationDetail: store.pickupLocationDetail || undefined,
      pickupLockerId: store.pickupLockerId ?? undefined,
      dropoffLockerId: store.dropoffLockerId ?? undefined,
      pickupStorageLocation: store.pickupStorageLocation ?? undefined,
      dropoffStorageLocation: store.dropoffStorageLocation ?? undefined,
      pickupLockerFee: store.pickupLockerFee ?? undefined,
      dropoffLockerFee: store.dropoffLockerFee ?? undefined,
      specialInstructions: store.specialInstructions || undefined,
      urgency: store.requestMode === 'reservation' ? 'normal' : store.urgency,
      selectedQuoteType: 'balanced' as const,
      directParticipationMode: store.directMode,
      preferredPickupTime: resolvedPreferredPickupTime,
      preferredArrivalTime: desiredArrivalSchedule,
      pricingContextOverride: pricingContext ?? undefined,
    };

    return buildBeta1QuoteCards(baseInput, pricingPolicy, routeOverride ?? undefined);
  }, [
    user?.uid,
    store.pickupStation,
    store.deliveryStation,
    store.photoRefs,
    store.packageItemName,
    store.packageCategory,
    store.packageDescription,
    store.packageSize,
    store.weightKg,
    store.itemValue,
    store.recipientName,
    store.recipientPhone,
    store.pickupLocationDetail,
    store.pickupStorageLocation,
    store.dropoffStorageLocation,
    store.specialInstructions,
    store.urgency,
    store.directMode,
    resolvedPreferredPickupTime,
    desiredArrivalSchedule,
    pricingContext,
    pricingPolicy,
    routeOverride,
    store.requestMode,
    store.pickupMode,
    store.deliveryMode,
    store.pickupRoadAddress,
    store.pickupDetailAddress,
    store.deliveryRoadAddress,
    store.deliveryDetailAddress,
    store.pickupLockerId,
    store.dropoffLockerId,
    store.pickupLockerFee,
    store.dropoffLockerFee,
  ]);

  // Apply AI Quote Response to deterministic quotes
  const quotes = useMemo(() => {
    if (!aiQuoteResponse) {
      return deterministicQuotes;
    }
    return applyAIQuoteResponseToCards(deterministicQuotes, aiQuoteResponse).quoteCards;
  }, [aiQuoteResponse, deterministicQuotes]);

  // Trigger AI Pricing API on form change
  useEffect(() => {
    if (!user?.uid || !pricingPolicy || !store.pickupStation || !store.deliveryStation) {
      setAiQuoteResponse(null);
      store.setAiQuotesLoading(false);
      return;
    }

    if (aiQuoteTimerRef.current) {
      clearTimeout(aiQuoteTimerRef.current);
    }

    aiQuoteTimerRef.current = setTimeout(() => {
      const requestId = aiQuoteRequestIdRef.current + 1;
      aiQuoteRequestIdRef.current = requestId;

      const run = async () => {
        try {
          store.setAiQuotesLoading(true);
          
          const basePricingInput = {
            requesterUserId: user.uid,
            requestMode: store.requestMode,
            originType: store.pickupMode,
            destinationType: store.deliveryMode,
            pickupStation: store.pickupStation as StationInfo,
            deliveryStation: store.deliveryStation as StationInfo,
            pickupRoadAddress: store.pickupRoadAddress || undefined,
            pickupDetailAddress: store.pickupDetailAddress || undefined,
            deliveryRoadAddress: store.deliveryRoadAddress || undefined,
            deliveryDetailAddress: store.deliveryDetailAddress || undefined,
            selectedPhotoIds: store.photoRefs,
            packageItemName: store.packageItemName || undefined,
            packageCategory: store.packageCategory || undefined,
            packageDescription: store.packageDescription || '물품 설명',
            packageSize: store.packageSize,
            weightKg: Math.max(0.1, Number(store.weightKg || 0)),
            itemValue: Number(store.itemValue || 0),
            recipientName: store.recipientName || '수령인',
            recipientPhone: store.recipientPhone || '010-0000-0000',
            pickupLocationDetail: store.pickupLocationDetail || undefined,
            storageLocation: store.storageLocation || undefined,
            lockerId: store.lockerId || undefined,
            specialInstructions: store.specialInstructions || undefined,
            urgency: store.requestMode === 'reservation' ? 'normal' : store.urgency,
            selectedQuoteType: 'balanced' as const,
            directParticipationMode: store.directMode,
            preferredPickupTime: resolvedPreferredPickupTime,
            preferredArrivalTime: desiredArrivalSchedule,
            pricingContextOverride: pricingContext ?? undefined,
          };

          const response = await generatePricingQuotesForBeta1Input({
            requesterUserId: user.uid,
            pickupStation: store.pickupStation as StationInfo,
            deliveryStation: store.deliveryStation as StationInfo,
            packageDescription: store.packageDescription || '물품 설명',
            itemValue: Number(store.itemValue || 0),
            weightKg: Math.max(0.1, Number(store.weightKg || 0)),
            packageSize: store.packageSize,
            requestMode: store.requestMode,
            preferredPickupTime: resolvedPreferredPickupTime,
            preferredArrivalTime: desiredArrivalSchedule,
            urgency: store.requestMode === 'reservation' ? 'normal' : store.urgency,
            directParticipationMode: store.directMode,
            basePricing: buildBeta1BasePricing(basePricingInput, pricingPolicy),
          });

          if (aiQuoteRequestIdRef.current !== requestId) {
            return;
          }

          setAiQuoteResponse(response);

          if (!quoteSelectionTouchedRef.current) {
            const applied = applyAIQuoteResponseToCards(deterministicQuotes, response);
            store.setSelectedQuoteType(applied.recommendedQuoteType);
          }
        } catch (error) {
          console.error('Failed to generate AI pricing quotes', error);
          if (aiQuoteRequestIdRef.current === requestId) {
            setAiQuoteResponse(null);
          }
        } finally {
          if (aiQuoteRequestIdRef.current === requestId) {
            store.setAiQuotesLoading(false);
          }
        }
      };

      void run();
    }, 500);

    return () => {
      aiQuoteRequestIdRef.current += 1;
      if (aiQuoteTimerRef.current) {
        clearTimeout(aiQuoteTimerRef.current);
      }
    };
  }, [
    user?.uid,
    pricingPolicy,
    store.pickupStation,
    store.deliveryStation,
    store.packageDescription,
    store.itemValue,
    store.weightKg,
    store.packageSize,
    store.requestMode,
    resolvedPreferredPickupTime,
    desiredArrivalSchedule,
    store.urgency,
    store.directMode,
    pricingContext,
    store.pickupMode,
    store.deliveryMode,
    store.pickupRoadAddress,
    store.pickupDetailAddress,
    store.deliveryRoadAddress,
    store.deliveryDetailAddress,
    store.photoRefs,
    store.packageItemName,
    store.packageCategory,
    store.recipientName,
    store.recipientPhone,
    store.pickupLocationDetail,
    store.storageLocation,
    store.specialInstructions,
    routeOverride,
  ]);

  return {
    pricingPolicy,
    pricingContext,
    aiQuoteResponse,
    quotes,
    deterministicQuotes,
    resolvedPreferredPickupTime,
    desiredArrivalSchedule,
    quoteSelectionTouchedRef,
  };
}
