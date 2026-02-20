/**
 * Utilities Index
 * Centralized export for all utility modules
 */

// Error Handling
export {
  showErrorAlert,
  getUserFriendlyMessage,
  categorizeError,
  isNetworkError,
  isPermissionError,
  isTimeoutError,
  isFirebaseError,
  assessSeverity,
  createNetworkError,
  createPermissionError,
  logError,
  type AppError,
  type ErrorCategory,
  type ErrorSeverity,
} from './error-handler';

// Retry with Backoff
export {
  retryWithBackoff,
  retryWithBackoffSafe,
  retryFirebaseQuery,
  retryTransaction,
  retryAll,
  deduplicatedRetry,
  getBackoffSchedule,
  estimateTotalRetryTime,
  type RetryOptions,
  type RetryResult,
} from './retry-with-backoff';

// Permission Handler
export {
  checkCameraPermission,
  checkLocationPermission,
  checkPhotosPermission,
  requestCameraPermission,
  requestLocationPermission,
  requestPhotosPermission,
  requestMultiplePermissions,
  ensurePermission,
  showOpenSettingsAlert,
  openAppSettings,
  getCurrentLocation,
  getPermissionStatusText,
  getPermissionDescription,
  type PermissionResult,
  type PermissionOptions,
} from './permission-handler';

// Network Detector
export {
  isNetworkAvailable,
  getConnectionType,
  addNetworkListener,
  addOnlineListener,
  addOfflineListener,
  getNetworkState,
  isConnectionExpensive,
  checkNetworkWithAlert,
  getNetworkStatusText,
  getNetworkQuality,
  createNetworkHook,
  networkDetector,
  type NetworkStatus,
  type ConnectionType,
  type NetworkState,
} from './network-detector';

// Draft Storage
export {
  saveDraft,
  loadDraft,
  deleteDraft,
  getAllDraftKeys,
  cleanupOldDrafts,
  saveFormProgress,
  loadFormProgress,
  deleteFormProgress,
  saveRatingDraft,
  loadRatingDraft,
  deleteRatingDraft,
  saveCreateRequestProgress,
  loadCreateRequestProgress,
  deleteCreateRequestProgress,
  hasDraft,
  getDraftAge,
  clearAllDrafts,
  type DraftData,
  type RatingDraft,
  type CreateRequestDraft,
} from './draft-storage';

// Success Animation
export {
  SuccessAnimation,
  Confetti,
  SuccessOverlay,
  type SuccessAnimationProps,
  type ConfettiProps,
  type SuccessOverlayProps,
} from './success-animation';

// Existing utilities (re-export for convenience)
export { formatTimeKR } from './date';
export { isNetworkAvailable as legacyIsNetworkAvailable } from './network';
