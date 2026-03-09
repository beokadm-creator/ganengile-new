import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Button, Card } from '../components/common';
import { locationService, LocationData } from '../services/location-service';
import { mediaService } from '../services/media-service';
import QRCodeService from '../services/qrcode-service';
import { pickupVerificationService, PickupVerificationData } from '../services/pickup-verification-service';

interface PickupVerificationScreenProps {
  navigation: any;
  route: any;
}

export const PickupVerificationScreen: React.FC<PickupVerificationScreenProps> = ({
  navigation,
  route,
}) => {
  const [verificationMethod, setVerificationMethod] = useState<'qr' | 'photo'>('qr');
  const [isScanning] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string>('');
  const [isVerified, setIsVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [photoUri, setPhotoUri] = useState<string>('');
  const [locationData, setLocationData] = useState<LocationData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedData, setScannedData] = useState<string>('');

  const deliveryId = route?.params?.deliveryId;

  // 카메라 권한 요청
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const handleQRCodeScan = () => {
    // 카메라 권한 확인
    if (hasPermission === null) {
      Alert.alert('알림', '카메라 권한을 확인하는 중...');
      return;
    }

    if (hasPermission === false) {
      Alert.alert(
        '권한 필요',
        'QR 코드 스캔을 위해 카메라 권한이 필요합니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '설정',
            onPress: () => {
              // iOS 설정으로 이동 (Expo Constants 사용 가능)
              Alert.alert('알림', '설정에서 카메라 권한을 허용해주세요.');
            },
          },
        ]
      );
      return;
    }

    // 카메라 화면 표시
    setShowCamera(true);
    setScannedData('');
  };

  // QR 코드 스캔 핸들러
  const handleBarCodeScanned = ({ type: _type, data }: { type: string; data: string }) => {
    if (scannedData) return; // 이미 스캔됨

    setScannedData(data);

    try {
      // QR 코드 데이터 검증
      const qrData = JSON.parse(data);
      const isValid = QRCodeService.validateQRCodeData(qrData, 'pickup');

      if (isValid) {
        setVerificationCode(data);
        setShowCamera(false);
        Alert.alert('성공', 'QR 코드 스캔 완료');
      } else {
        Alert.alert(
          '실패',
          '유효하지 않은 QR 코드입니다.\n다시 시도해주세요.',
          [
            { text: '확인', onPress: () => setScannedData('') },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        '실패',
        'QR 코드 형식이 올바르지 않습니다.\n다시 시도해주세요.',
        [
          { text: '확인', onPress: () => setScannedData('') },
        ]
      );
    }
  };

  const handlePhotoCapture = async () => {
    setIsLoading(true);
    try {
      const result = await mediaService.takePhoto();
      if (result) {
        setPhotoUri(result.url);
        Alert.alert('알림', '사진 촬영 완료');
      }
    } catch (error) {
      Alert.alert('에러', '사진 촬영 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLocationCheck = async () => {
    setIsLoading(true);
    try {
      const location = await locationService.getCurrentLocation();
      if (location) {
        setLocationData(location);
        
        // 주소로 변환 (역 geocoding)
        const address = await locationService.reverseGeocode(
          location.latitude,
          location.longitude
        );
        setCurrentLocation(address);
        Alert.alert('알림', '현재 위치 확인 완료');
      } else {
        Alert.alert('에러', '위치를 가져올 수 없습니다');
      }
    } catch (error) {
      Alert.alert('에러', '위치 확인 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationSubmit = async () => {
    if (verificationMethod === 'qr' && !verificationCode) {
      Alert.alert('알림', 'QR 코드 스캔을 완료해주세요.');
      return;
    }

    if (verificationMethod === 'photo' && !photoUri) {
      Alert.alert('알림', '사진 촬영을 완료해주세요.');
      return;
    }

    if (!currentLocation || !locationData) {
      Alert.alert('알림', '현재 위치를 확인해주세요.');
      return;
    }

    setIsLoading(true);

    try {
      // QR 코드 데이터 검증
      if (verificationMethod === 'qr' && verificationCode) {
        const qrData = JSON.parse(verificationCode);
        const isValid = QRCodeService.validateQRCodeData(qrData, 'pickup');

        if (!isValid) {
          Alert.alert('에러', 'QR 코드가 유효하지 않습니다');
          setIsLoading(false);
          return;
        }
      }

      // Firestore에 픽업 인증 데이터 저장
      const verificationData: PickupVerificationData = {
        deliveryId: deliveryId || '',
        verificationMethod,
        verificationCode,
        photoUri,
        locationData,
        verifiedAt: new Date(),
      };

      const success = await pickupVerificationService.savePickupVerification(verificationData);

      if (success) {
        // 픽업 인증 완료
        setIsVerified(true);
        Alert.alert(
          '픽업 인증',
          '픽업 인증이 완료되었습니다.',
          [
            { text: '확인', onPress: () => navigation.goBack() },
          ],
        );
      } else {
        Alert.alert('에러', '픽업 인증 저장 실패');
      }
    } catch (error) {
      console.error('Error submitting pickup verification:', error);
      Alert.alert('에러', '픽업 인증 실패');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>픽업 인증</Text>

      {/* 인증 방법 선택 */}
      <Card style={styles.card}>
        <Text style={styles.label}>인증 방법</Text>
        <View style={styles.optionContainer}>
          <TouchableOpacity
            style={[
              styles.optionButton,
              verificationMethod === 'qr' && styles.selectedOption,
            ]}
            onPress={() => setVerificationMethod('qr')}>
            <Text
              style={[
                styles.optionText,
                verificationMethod === 'qr' && styles.selectedOptionText,
              ]}>
              QR 코드
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.optionButton,
              verificationMethod === 'photo' && styles.selectedOption,
            ]}
            onPress={() => setVerificationMethod('photo')}>
            <Text
              style={[
                styles.optionText,
                verificationMethod === 'photo' && styles.selectedOptionText,
              ]}>
              사진
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* QR 코드 스캔 / 사진 촬영 */}
      {verificationMethod === 'qr' ? (
        <Card style={styles.card}>
          <Text style={styles.label}>QR 코드 스캔</Text>
          {isScanning || isLoading ? (
            <View style={styles.scanningContainer}>
              <ActivityIndicator size="large" color="#00BCD4" />
              <Text style={styles.scanningText}>
                {isScanning ? 'QR 코드 스캔 중...' : '처리 중...'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handleQRCodeScan}>
              <Text style={styles.scanButtonText}>QR 코드 스캔</Text>
            </TouchableOpacity>
          )}
          {verificationCode && (
            <Text style={styles.verifiedCode}>✅ QR 코드 스캔 완료</Text>
          )}
        </Card>
      ) : (
        <Card style={styles.card}>
          <Text style={styles.label}>사진 촬영</Text>
          {isLoading ? (
            <View style={styles.scanningContainer}>
              <ActivityIndicator size="large" color="#00BCD4" />
              <Text style={styles.scanningText}>처리 중...</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.scanButton}
              onPress={handlePhotoCapture}>
              <Text style={styles.scanButtonText}>📷 사진 촬영</Text>
            </TouchableOpacity>
          )}
          {photoUri ? (
            <Text style={styles.verifiedCode}>✅ 사진 촬영 완료</Text>
          ) : null}
        </Card>
      )}

      {/* 현재 위치 확인 */}
      <Card style={styles.card}>
        <Text style={styles.label}>현재 위치</Text>
        <View style={styles.locationContainer}>
          <Text style={styles.locationText}>
            {currentLocation || '위치 미확인'}
          </Text>
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleLocationCheck}>
            <Text style={styles.locationButtonText}>위치 확인</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* 인증 제출 버튼 */}
      <View style={styles.buttonContainer}>
        <Button
          title="인증 제출"
          onPress={handleVerificationSubmit}
          disabled={!verificationCode || !currentLocation || isVerified}
        />
        {isVerified && (
          <Text style={styles.verifiedText}>✅ 인증 완료</Text>
        )}
      </View>

      {/* 에러 핸들링 예시 */}
      {verificationCode && currentLocation && !isVerified && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            ⚠️ 인증 제출 버튼을 눌러주세요
          </Text>
        </View>
      )}

      {/* 카메라 모달 (QR 코드 스캔) */}
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}>
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={scannedData ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />

          {/* 카메라 오버레이 */}
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowCamera(false);
                  setScannedData('');
                }}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.cameraTitle}>QR 코드 스캔</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* 스캔 가이드 */}
            <View style={styles.scanGuide}>
              <View style={styles.scanGuideBorder} />
            </View>

            {/* 안내 문구 */}
            <View style={styles.cameraFooter}>
              <Text style={styles.cameraGuideText}>
                QR 코드를 프레임 안에 맞춰주세요
              </Text>
            </View>
          </View>

          {/* 스캔 완료 시 표시 */}
          {scannedData && (
            <View style={styles.scanCompleteOverlay}>
              <Text style={styles.scanCompleteText}>✅ 스캔 완료</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: 20,
  },
  card: {
    marginBottom: 16,
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  optionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  optionButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  selectedOption: {
    backgroundColor: '#00BCD4',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  selectedOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  scanningContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  scanningText: {
    marginTop: 10,
    fontSize: 14,
    color: '#666',
  },
  scanButton: {
    backgroundColor: '#00BCD4',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verifiedCode: {
    marginTop: 12,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  locationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
  },
  locationButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 20,
  },
  verifiedText: {
    marginTop: 10,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
  },
  errorContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#FFCDD2',
    borderRadius: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  // 카메라 관련 스타일
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#333',
    fontWeight: '600',
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scanGuide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanGuideBorder: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cameraFooter: {
    paddingBottom: 80,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
  },
  cameraGuideText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  scanCompleteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanCompleteText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#4CAF50',
    backgroundColor: '#fff',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
  },
});
