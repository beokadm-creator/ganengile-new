/**
 * Delivery Service (Legacy Interface)
 * This file acts as a facade, re-exporting the newly modularized delivery services
 * to maintain backward compatibility with the rest of the codebase.
 */

import { deliveryLifecycleService } from './delivery/delivery-lifecycle-service';
import { deliveryRepository } from './delivery/delivery-repository';
import { deliverySettlementService } from './delivery/delivery-settlement-service';

export type { PickupVerificationData, DeliveryCompletionData } from './delivery/delivery-lifecycle-service';
export type { RequesterConfirmationData } from './delivery/delivery-settlement-service';

// Lifecycle exports
export const gillerAcceptRequest = deliveryLifecycleService.gillerAcceptRequest;
export const gillerCancelAcceptance = deliveryLifecycleService.gillerCancelAcceptance;
export const cancelDeliveryFlow = deliveryLifecycleService.cancelDeliveryFlow;
export const verifyPickup = deliveryLifecycleService.verifyPickup;
export const updateGillerLocation = deliveryLifecycleService.updateGillerLocation;
export const completeDelivery = deliveryLifecycleService.completeDelivery;
export const markAsArrived = deliveryLifecycleService.markAsArrived;
export const markAsDroppedAtLocker = deliveryLifecycleService.markAsDroppedAtLocker;

// Repository exports
export const getDeliveryById = deliveryRepository.getDeliveryById;
export const getDeliveryByRequestId = deliveryRepository.getDeliveryByRequestId;
export const getGillerDeliveries = deliveryRepository.getGillerDeliveries;
export const getGllerDeliveries = deliveryRepository.getRequesterDeliveries; // Keeping legacy name for backward compatibility
export const subscribeToDeliveryByRequestId = deliveryRepository.subscribeToDeliveryByRequestId;

// Settlement exports
export const confirmDeliveryByRequester = deliverySettlementService.confirmDeliveryByRequester;
