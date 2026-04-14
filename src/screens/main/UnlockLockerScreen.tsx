import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { requireUserId } from '../../services/firebase';
import {
  addReservationPhotos,
  getDeliveryReservations,
  updateReservationStatus,
  completeLockerReservation,
} from '../../services/locker-service';
import { confirmDeliveryByRequester } from '../../services/delivery-service';
import { getQRCodeRemainingTime, verifyQRCode } from '../../services/qrcode-service';
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import type { LockerReservation } from '../../types/locker';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { BorderRadius, Colors, Spacing, Typography } from '../../theme';

type UnlockLockerRoute = RouteProp<MainStackParamList, 'UnlockLocker'>;
type Step = 'verify' | 'collect' | 'photo' | 'complete';

export default function UnlockLockerScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<UnlockLockerRoute>();
  const { deliveryId } = route.params;

  const [step, setStep] = useState<Step>('verify');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reservation, setReservation] = useState<LockerReservation | null>(null);
  const [collectPhotoUrl, setCollectPhotoUrl] = useState<string | null>(null);
  const [remainingMinutes, setRemainingMinutes] = useState(0);

  const loadReservation = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const reservations = await getDeliveryReservations(deliveryId);
      const pickupReservation =
        reservations.find((item) => item.type === 'requester_pickup') ?? reservations[0] ?? null;

      if (!pickupReservation) {
        Alert.alert('No locker reservation found', 'Try again after the locker handoff is complete.', [
          { text: 'Close', onPress: () => navigation.goBack() },
        ]);
        return;
      }

      setReservation(pickupReservation);
      setRemainingMinutes(getQRCodeRemainingTime(pickupReservation.qrCode));
    } catch (error) {
      console.error('Failed to load locker reservation:', error);
      Alert.alert('Failed to load locker info', 'Please try again in a moment.', [
        { text: 'Close', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [deliveryId, navigation]);

  useEffect(() => {
    void loadReservation();
  }, [loadReservation]);

  const handleVerifyQr = (): void => {
    if (!reservation) {
      return;
    }

    const verification = verifyQRCode(reservation.qrCode);
    if (!verification.isValid) {
      Alert.alert('QR verification failed', verification.error ?? 'This QR code is not valid.');
      return;
    }

    void updateReservationStatus(reservation.reservationId, 'in_use');
    setStep('collect');
  };

  const handleCollect = (): void => {
    setStep('photo');
  };

  const handleTakePhoto = async (): Promise<void> => {
    try {
      setWorking(true);
      const photoUri = await takePhoto();
      if (!photoUri) {
        return;
      }

      const userId = requireUserId();
      const uploaded = await uploadPhotoWithThumbnail(photoUri, userId, 'locker-collect');
      setCollectPhotoUrl(uploaded.url);
      setStep('complete');
    } catch (error) {
      console.error('Failed to capture pickup photo:', error);
      Alert.alert('Photo upload failed', 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const handleComplete = async (): Promise<void> => {
    if (!reservation) {
      return;
    }

    try {
      setWorking(true);

      if (collectPhotoUrl) {
        await addReservationPhotos(reservation.reservationId, undefined, collectPhotoUrl);
      }

      await completeLockerReservation(reservation.reservationId);

      const requesterId = requireUserId();
      const result = await confirmDeliveryByRequester({
        deliveryId,
        requesterId,
        requestId: reservation.requestId,
      });

      if (!result.success) {
        Alert.alert('Completion failed', result.message);
        return;
      }

      Alert.alert('Locker pickup complete', 'The pickup was confirmed. Continue to the rating step.', [
        {
          text: 'Rate delivery',
          onPress: () =>
            navigation.navigate('Rating', {
              deliveryId,
              gillerId: reservation.userId,
              requesterId: reservation.userId,
              gllerId: reservation.userId,
            }),
        },
      ]);
    } catch (error) {
      console.error('Failed to complete locker pickup:', error);
      Alert.alert('Completion failed', 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Checking locker reservation…</Text>
      </View>
    );
  }

  if (!reservation) {
    return null;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Unlock Locker</Text>
        <Text style={styles.subtitle}>Verify the reservation QR, collect the item, add a pickup photo, then finish.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reservation</Text>
        <Text style={styles.infoText}>Locker: {reservation.lockerId}</Text>
        <Text style={styles.infoText}>Status: {reservation.status}</Text>
        <Text style={styles.infoText}>
          QR remaining: {remainingMinutes > 0 ? `${remainingMinutes} min` : 'expired or unavailable'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Current step</Text>
        <StepRow active={step === 'verify'} done={step !== 'verify'} label="Verify QR" />
        <StepRow active={step === 'collect'} done={step === 'photo' || step === 'complete'} label="Collect item" />
        <StepRow active={step === 'photo'} done={step === 'complete'} label="Pickup photo" />
        <StepRow active={step === 'complete'} done={false} label="Complete" />
      </View>

      {step === 'verify' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyQr}>
          <Text style={styles.primaryButtonText}>Verify reservation QR</Text>
        </TouchableOpacity>
      ) : null}

      {step === 'collect' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={handleCollect}>
          <Text style={styles.primaryButtonText}>Item collected</Text>
        </TouchableOpacity>
      ) : null}

      {step === 'photo' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleTakePhoto()} disabled={working}>
          {working ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Capture pickup photo</Text>
          )}
        </TouchableOpacity>
      ) : null}

      {step === 'complete' ? (
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleComplete()} disabled={working}>
          {working ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.primaryButtonText}>Finish pickup</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );
}

function StepRow({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <View style={styles.stepRow}>
      <View
        style={[
          styles.stepDot,
          done ? styles.stepDotDone : active ? styles.stepDotActive : styles.stepDotIdle,
        ]}
      >
        {done ? <Ionicons name="checkmark" size={14} color={Colors.white} /> : null}
      </View>
      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: Typography.fontSize.base,
    color: Colors.textSecondary,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: Typography.fontSize['4xl'],
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: 12,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  infoText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotDone: {
    backgroundColor: Colors.success,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepDotIdle: {
    backgroundColor: Colors.border,
  },
  stepLabel: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeight.bold,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: Colors.primary,
  },
  primaryButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
  },
});
