/**
 * Delivery Completion Screen
 * 길러가 배송 완료 시 수신자 인증 (6자리 코드)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { requireUserId } from '../../services/firebase';
import {
  completeDelivery,
  markAsArrived,
  type DeliveryCompletionData,
} from '../../services/delivery-service';
import { getDeliveryById } from '../../services/delivery-service';
import QRScanner from '../../components/delivery/QRScanner';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
  route: {
    params: {
      deliveryId: string;
    };
  };
}

export default function DeliveryCompletionScreen({ navigation, route }: Props) {
  const { deliveryId } = route.params;
  const [delivery, setDelivery] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);

  useEffect(() => {
    loadDelivery();
    getLocation();
  }, [deliveryId]);

  const loadDelivery = async () => {
    try {
      const data = await getDeliveryById(deliveryId);
      setDelivery(data);
    } catch (error) {
      console.error('Error loading delivery:', error);
    }
  };

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('권한 필요', '위치 권한이 필요합니다.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('오류', '사진 촬영에 실패했습니다.');
    }
  };

  const handleMarkArrived = async () => {
    setLoading(true);
    try {
      const result = await markAsArrived(deliveryId);
      if (result.success) {
        Alert.alert('알림', result.message);
        await loadDelivery();
      } else {
        Alert.alert('오류', result.message);
      }
    } catch (error) {
      console.error('Error marking as arrived:', error);
      Alert.alert('오류', '도착 처리에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!location) {
      Alert.alert('위치 필요', '위치 정보를 가져올 수 없습니다.');
      return;
    }

    if (verificationCode?.length !== 6) {
      Alert.alert('코드 오류', '6자리 인증 코드를 입력해주세요.');
      return;
    }

    setLoading(true);

    try {
      const gillerId = requireUserId();
      const data: DeliveryCompletionData = {
        deliveryId,
        gillerId,
        verificationCode,
        photoUri: photoUri || '',
        location,
        notes,
      };

      const result = await completeDelivery(data);

      if (result.success) {
        Alert.alert('성공', result.message, [
          {
            text: '확인',
            onPress: () => {
              navigation.navigate('Rating', {
                deliveryId,
                gillerId,
                gllerId: delivery?.gllerId,
              });
            },
          },
        ]);
      } else {
        Alert.alert('실패', result.message);
      }
    } catch (error) {
      console.error('Error completing delivery:', error);
      Alert.alert('오류', '배송 완료에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = (data: string) => {
    setShowQRScanner(false);

    // QR 데이터 형식: "GANENGILE:{verificationCode}"
    // 예: "GANENGILE:123456"
    if (data.startsWith('GANENGILE:')) {
      const code = data.split(':')[1];
      if (code && code.length === 6) {
        setVerificationCode(code);
        Alert.alert('QR 스캔 성공', `인증 코드 ${code}가 입력되었습니다.`);
      } else {
        Alert.alert('QR 오류', '잘못된 QR 코드 형식입니다.');
      }
    } else {
      Alert.alert('QR 오류', '가는길에 QR 코드가 아닙니다.');
    }
  };

  const handleQRError = (error: string) => {
    setShowQRScanner(false);
    Alert.alert('카메라 오류', error);
  };

  if (!delivery) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  const isArrived = delivery.status === 'arrived';
  const canComplete = delivery.status === 'arrived' || delivery.status === 'in_transit';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>배송 완료</Text>
          <Text style={styles.subtitle}>
            {isArrived ? '수신자 인증 후 완료하세요' : '목적지에 도착했나요?'}
          </Text>
        </View>

        {/* Delivery Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📦 배송 정보</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>수신자</Text>
            <Text style={styles.infoValue}>{delivery.recipientInfo?.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>연락처</Text>
            <Text style={styles.infoValue}>{delivery.recipientInfo?.phone}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>배송지</Text>
            <Text style={styles.infoValue}>
              {delivery.deliveryStation?.stationName}
            </Text>
          </View>
        </View>

        {/* Mark Arrived Button */}
        {!isArrived && canComplete && (
          <TouchableOpacity
            style={styles.arrivedButton}
            onPress={handleMarkArrived}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.arrivedButtonText}>목적지 도착 완료</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Verification Section */}
        {isArrived && (
          <View style={styles.verificationSection}>
            <Text style={styles.sectionTitle}>수신자 인증</Text>
            <Text style={styles.sectionDesc}>
              수신자에게 6자리 코드를 받아 입력하세요
            </Text>

            <TouchableOpacity
              style={styles.qrButton}
              onPress={() => setShowQRScanner(true)}
            >
              <Text style={styles.qrButtonText}>📷 QR 코드 스캔</Text>
            </TouchableOpacity>

            {verificationCode && (
              <View style={styles.scannedCodeContainer}>
                <Text style={styles.scannedCodeLabel}>스캔된 코드:</Text>
                <Text style={styles.scannedCode}>{verificationCode}</Text>
              </View>
            )}

            <View style={styles.codeInputContainer}>
              <TextInput
                style={styles.codeInput}
                value={verificationCode}
                onChangeText={setVerificationCode}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                textAlign="center"
              />
            </View>

            {/* Photo (Optional) */}
            <View style={styles.photoSection}>
              <Text style={styles.photoTitle}>배송 사진 (선택)</Text>
              {photoUri ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: photoUri }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.retakeButton}
                    onPress={takePhoto}
                  >
                    <Text style={styles.retakeButtonText}>다시 찍기</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.photoButton} onPress={takePhoto}>
                  <Text style={styles.photoButtonIcon}>📷</Text>
                  <Text style={styles.photoButtonText}>사진 촬영</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Notes (Optional) */}
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>특이사항 (선택)</Text>
              <TextInput
                style={styles.notesInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="배송 관련 특이사항을 입력하세요"
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        )}

        {/* Location Status */}
        {location && (
          <View style={styles.locationSection}>
            <Text style={styles.locationTitle}>📍 현재 위치</Text>
            <Text style={styles.locationText}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </View>
        )}

        {/* Complete Button */}
        {isArrived && (
          <TouchableOpacity
            style={[styles.completeButton, !verificationCode && styles.completeButtonDisabled]}
            onPress={handleCompleteDelivery}
            disabled={!verificationCode || loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.completeButtonText}>배송 완료</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* QR Scanner Modal */}
      <Modal
        visible={showQRScanner}
        animationType="slide"
        onRequestClose={() => setShowQRScanner(false)}
      >
        <QRScanner
          onScan={handleQRScan}
          onError={handleQRError}
          onClose={() => setShowQRScanner(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  arrivedButton: {
    alignItems: 'center',
    backgroundColor: '#FF9800',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 16,
  },
  arrivedButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    margin: 16,
    padding: 16,
  },
  cardTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  codeInput: {
    color: '#333',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  codeInputContainer: {
    backgroundColor: '#fff',
    borderColor: '#4CAF50',
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 16,
    padding: 16,
  },
  completeButton: {
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    margin: 16,
    paddingVertical: 16,
  },
  completeButtonDisabled: {
    backgroundColor: '#ccc',
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  header: {
    backgroundColor: '#4CAF50',
    padding: 20,
    paddingBottom: 24,
    paddingTop: 60,
  },
  infoLabel: {
    color: '#666',
    fontSize: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  locationSection: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    margin: 16,
    padding: 16,
  },
  locationText: {
    color: '#666',
    fontSize: 12,
  },
  locationTitle: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  notesInput: {
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderWidth: 1,
    color: '#333',
    fontSize: 14,
    minHeight: 80,
    padding: 12,
  },
  notesSection: {
    marginBottom: 16,
  },
  notesTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  photo: {
    borderRadius: 12,
    height: 200,
    marginBottom: 8,
    width: '100%',
  },
  photoButton: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#e0e0e0',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 2,
    padding: 24,
  },
  photoButtonIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  photoButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  photoPreview: {
    alignItems: 'center',
  },
  photoSection: {
    marginBottom: 16,
  },
  photoTitle: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  qrButton: {
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
    marginBottom: 16,
    padding: 20,
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scannedCode: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
    borderRadius: 8,
    borderWidth: 2,
    color: '#333',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    marginBottom: 16,
    padding: 16,
    textAlign: 'center',
  },
  scannedCodeContainer: {
    alignItems: 'center',
  },
  scannedCodeLabel: {
    color: '#666',
    fontSize: 14,
    marginBottom: 4,
  },
  retakeButton: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionDesc: {
    color: '#666',
    fontSize: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  verificationSection: {
    padding: 16,
  },
});
