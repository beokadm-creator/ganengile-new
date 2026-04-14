import { Colors , Typography } from '../../theme';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { MainStackNavigationProp, MainStackParamList } from '../../types/navigation';
import { requireUserId } from '../../services/firebase';
import { verifyPickup, type PickupVerificationData } from '../../services/delivery-service';
import { buildMissionExecutionGuideFromRequest } from '../../services/giller-mission-execution-service';
import { getRequestById } from '../../services/request-service';
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import { getCurrentLocation } from '../../utils/permission-handler';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { SwipeButton } from '../../components/common/SwipeButton';

type PickupRoute = RouteProp<MainStackParamList, 'PickupVerification'>;
type VerificationMethod = 'qr' | 'code';

export default function PickupVerificationScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<PickupRoute>();
  const { deliveryId, requestId } = route.params;

  const [method, setMethod] = useState<VerificationMethod>('code');
  const [verificationCode, setVerificationCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [guide, setGuide] = useState(() => buildMissionExecutionGuideFromRequest(null));
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  React.useEffect(() => {
    let mounted = true;

    const run = async () => {
      const request = await getRequestById(requestId).catch(() => null);
      if (!mounted) {
        return;
      }
      setGuide(buildMissionExecutionGuideFromRequest(request));
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [requestId]);

  const handleCapturePhoto = async (): Promise<void> => {
    try {
      setPhotoLoading(true);
      const userId = requireUserId();
      const capturedUri = await takePhoto();
      if (!capturedUri) {
        return;
      }

      const uploaded = await uploadPhotoWithThumbnail(capturedUri, userId, 'pickup_verification');
      setPhotoUri(uploaded.url);
    } catch (error) {
      console.error('Failed to capture pickup verification photo:', error);
      Alert.alert('사진 업로드 실패', '인수 증빙 사진을 다시 촬영해 주세요.');
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleVerifyPickup = async (): Promise<void> => {
    if (method === 'code' && verificationCode.trim().length !== 4) {
      Alert.alert('코드 확인', '4자리 인수 코드를 입력해 주세요.');
      return;
    }

    if (!photoUri) {
      Alert.alert('증빙 확인', '인수 증빙 사진을 먼저 촬영해 주세요.');
      return;
    }

    try {
      setLoading(true);
      const gillerId = requireUserId();
      const locationResult = await getCurrentLocation({
        showSettingsAlert: true,
        accuracy: Location.Accuracy.Balanced,
      });

      if (!locationResult) {
        Alert.alert('위치 확인', '현재 위치를 확인하지 못했습니다. 다시 시도해 주세요.');
        return;
      }

      const payload: PickupVerificationData = {
        deliveryId,
        gillerId,
        qrCodeData: method === 'qr' ? verificationCode.trim() : undefined,
        verificationCode: method === 'code' ? verificationCode.trim() : '',
        photoUri,
        location: {
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude,
        },
      };

      const result = await verifyPickup(payload);
      if (!result.success) {
        Alert.alert('인수 확인 실패', result.message);
        return;
      }

      Alert.alert('인수 완료', '물품 인수가 확인되었습니다.', [
        {
          text: '배송 추적으로 이동',
          onPress: () => navigation.replace('DeliveryTracking', { requestId }),
        },
      ]);
    } catch (error) {
      console.error('Failed to verify pickup:', error);
      Alert.alert('인수 확인 실패', '잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>인수 확인</Text>
        <Text style={styles.subtitle}>코드와 사진만 확인하면 바로 출발할 수 있습니다.</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <SummaryChip label={verificationCode.trim().length === 4 ? '코드 준비' : '코드 입력'} active={verificationCode.trim().length === 4} />
          <SummaryChip label={photoUri ? '사진 준비' : '사진 촬영'} active={Boolean(photoUri)} />
          <SummaryChip label="위치 확인" active />
        </View>
        <Text style={styles.summaryText}>지금 필요한 것만 빠르게 끝내면 됩니다.</Text>
      </View>

      {guide.pickupGuide || guide.lockerGuide || guide.specialInstructions || guide.recipientSummary ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>인수 안내</Text>
          {guide.pickupGuide ? <Text style={styles.helperText}>픽업 위치: {guide.pickupGuide}</Text> : null}
          {guide.lockerGuide ? <Text style={styles.helperText}>사물함: {guide.lockerGuide}</Text> : null}
          {guide.recipientSummary ? <Text style={styles.helperText}>수령인: {guide.recipientSummary}</Text> : null}
          {guide.specialInstructions ? <Text style={styles.helperText}>요청: {guide.specialInstructions}</Text> : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>확인 방식</Text>
        <View style={styles.toggleRow}>
          <MethodButton active={method === 'code'} title="4자리 코드" onPress={() => setMethod('code')} />
          <MethodButton active={method === 'qr'} title="QR 값 입력" onPress={() => setMethod('qr')} />
        </View>

        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>{method === 'code' ? '인수 코드' : 'QR 원문'}</Text>
          <TextInput
            style={[styles.input, method === 'qr' ? styles.inputMultiline : undefined]}
            placeholder={method === 'code' ? '4자리 인수 코드 입력' : 'QR 원문을 붙여넣어 주세요'}
            value={verificationCode}
            onChangeText={(text) =>
              setVerificationCode(method === 'code' ? text.replace(/\D/g, '').slice(0, 4) : text)
            }
            keyboardType={method === 'code' ? 'number-pad' : 'default'}
            maxLength={method === 'code' ? 4 : undefined}
            multiline={method === 'qr'}
            autoCapitalize="none"
          />
          {method === 'code' ? (
            <View style={styles.codeRow}>
              {Array.from({ length: 4 }).map((_, index) => (
                <View key={`code-${index}`} style={styles.codeChip}>
                  <Text style={styles.codeChipText}>{verificationCode[index] ?? '-'}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.qrBox}>
              <Text style={styles.qrText}>{verificationCode || 'QR 값을 아직 입력하지 않았습니다.'}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>인수 증빙 사진</Text>
        <Text style={styles.helperText}>물품이 보이게 한 장만 남기면 됩니다.</Text>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.previewImage} /> : null}
        <TouchableOpacity style={styles.photoButton} onPress={() => void handleCapturePhoto()} disabled={photoLoading}>
          {photoLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.photoButtonText}>{photoUri ? '사진 다시 촬영하기' : '사진 촬영하기'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <SwipeButton 
        onComplete={handleVerifyPickup} 
        title="밀어서 인수 확인" 
        disabled={loading || photoLoading || (method === 'code' && verificationCode.trim().length !== 4) || !photoUri}
      />
    </ScrollView>
  );
}

function SummaryChip({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={[styles.summaryChip, active ? styles.summaryChipActive : undefined]}>
      <Text style={[styles.summaryChipText, active ? styles.summaryChipTextActive : undefined]}>{label}</Text>
    </View>
  );
}

function MethodButton({ active, title, onPress }: { active: boolean; title: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.methodButton, active ? styles.methodButtonActive : undefined]} onPress={onPress}>
      <Text style={[styles.methodButtonText, active ? styles.methodButtonTextActive : undefined]}>{title}</Text>
    </TouchableOpacity>
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
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 22,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: Colors.border,
  },
  summaryChipActive: {
    backgroundColor: Colors.primaryMint,
  },
  summaryChipText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
  },
  summaryChipTextActive: {
    color: Colors.primary,
  },
  summaryText: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: Colors.textPrimary,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.textPrimary,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.border,
  },
  methodButtonActive: {
    backgroundColor: Colors.primaryMint,
  },
  methodButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textSecondary,
  },
  methodButtonTextActive: {
    color: Colors.primary,
  },
  codeBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    backgroundColor: Colors.surface,
  },
  codeLabel: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  codeChip: {
    flex: 1,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.primaryMint,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  codeChipText: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.extrabold,
    color: Colors.primary,
  },
  qrBox: {
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: Colors.primaryMint,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    justifyContent: 'center',
  },
  qrText: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
    color: Colors.primary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: Typography.fontSize.base,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
  },
  inputMultiline: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.textPrimary,
  },
  helperText: {
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    backgroundColor: Colors.border,
  },
  photoButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: Colors.primaryMint,
  },
  photoButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.primary,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    marginBottom: 8,
  },
  primaryButtonText: {
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.surface,
  },
});
