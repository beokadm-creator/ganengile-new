import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { takePhoto, uploadPhotoWithThumbnail } from '../../services/photo-service';
import { getCurrentLocation } from '../../utils/permission-handler';
import * as Location from 'expo-location';

type PickupRoute = RouteProp<MainStackParamList, 'PickupVerification'>;
type VerificationMethod = 'qr' | 'code';

export default function PickupVerificationScreen() {
  const navigation = useNavigation<MainStackNavigationProp>();
  const route = useRoute<PickupRoute>();
  const { deliveryId, requestId } = route.params;

  const [method, setMethod] = useState<VerificationMethod>('code');
  const [verificationCode, setVerificationCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

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
        <Text style={styles.subtitle}>
          길러가 물품을 넘겨받았는지 확인하고 배송 추적 단계로 이어집니다.
        </Text>
      </View>

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
        <Text style={styles.helperText}>
          물품과 전달 지점이 함께 보이도록 촬영하면 분쟁 대응과 운영 확인이 쉬워집니다.
        </Text>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.previewImage} /> : null}
        <TouchableOpacity style={styles.photoButton} onPress={() => void handleCapturePhoto()} disabled={photoLoading}>
          {photoLoading ? (
            <ActivityIndicator size="small" color="#1D4ED8" />
          ) : (
            <Text style={styles.photoButtonText}>{photoUri ? '사진 다시 촬영하기' : '사진 촬영하기'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => void handleVerifyPickup()} disabled={loading}>
        {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>인수 확인하기</Text>}
      </TouchableOpacity>
    </ScrollView>
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
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
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
    backgroundColor: '#E2E8F0',
  },
  methodButtonActive: {
    backgroundColor: '#DBEAFE',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  methodButtonTextActive: {
    color: '#1D4ED8',
  },
  codeBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
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
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  codeChipText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  qrBox: {
    minHeight: 72,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    padding: 14,
    justifyContent: 'center',
  },
  qrText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#1D4ED8',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
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
    backgroundColor: '#E2E8F0',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  helperText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    backgroundColor: '#E2E8F0',
  },
  photoButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#DBEAFE',
  },
  photoButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    marginBottom: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
