import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Button, Card, Input } from '../components/common';
import { mediaService } from '../services/media-service';

interface DeliveryCompletionScreenProps {
  navigation: any;
  route: any;
}

export const DeliveryCompletionScreen: React.FC<DeliveryCompletionScreenProps> = ({
  navigation,
  route,
}) => {
  const [deliveryCompleted, setDeliveryCompleted] = useState(false);
  const [recipientName, setRecipientName] = useState<string>('');
  const [pickupPhoto, setPickupPhoto] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const handlePhotoUpload = async () => {
    setIsUploading(true);
    try {
      const result = await mediaService.pickFromGallery();
      if (result) {
        setPickupPhoto(result.url);
        Alert.alert('알림', '사진 업로드 완료');
      }
    } catch (error) {
      Alert.alert('에러', '사진 업로드 실패');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCameraCapture = async () => {
    setIsUploading(true);
    try {
      const result = await mediaService.takePhoto();
      if (result) {
        setPickupPhoto(result.url);
        Alert.alert('알림', '사진 촬영 완료');
      }
    } catch (error) {
      Alert.alert('에러', '사진 촬영 실패');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCompletionSubmit = () => {
    if (!recipientName) {
      Alert.alert('알림', '수신자 성함을 입력해주세요.');
      return;
    }

    if (!pickupPhoto) {
      Alert.alert('알림', '픽업 완료 사진을 업로드해주세요.');
      return;
    }

    setIsUploading(true);

    // 배송 완료 제출 로직 (Firestore에 저장)
    setTimeout(() => {
      setIsUploading(false);
      setDeliveryCompleted(true);

      Alert.alert(
        '배송 완료',
        '배송이 완료되었습니다. 수신자 확인 후 평가해주세요.',
        [
          {
            text: '평가하기',
            onPress: () => {
              navigation.navigate('Rating', { deliveryId: route?.id });
            },
          },
          {
            text: '홈으로',
            onPress: () => {
              navigation.navigate('Home');
            },
          },
        ],
      );
    }, 2000);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>배송 완료</Text>

      {/* 배송 완료 확인 */}
      <Card style={styles.card}>
        <Text style={styles.label}>배송 완료 확인</Text>
        <View style={styles.completionContainer}>
          <TouchableOpacity
            style={[styles.completionButton, deliveryCompleted && styles.completedButton]}
            onPress={() => setDeliveryCompleted(!deliveryCompleted)}>
            <Text style={styles.completionButtonText}>
              {deliveryCompleted ? '✅ 완료' : '⏳ 미완료'}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* 픽업 사진 촬영/업로드 */}
      <Card style={styles.card}>
        <Text style={styles.label}>픽업 완료 사진</Text>
        <View style={styles.photoUploadContainer}>
          <TouchableOpacity style={styles.photoButton} onPress={handlePhotoUpload}>
            <Text style={styles.photoButtonText}>📷 갤러리</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.photoButton} onPress={handleCameraCapture}>
            <Text style={styles.photoButtonText}>📷 카메라</Text>
          </TouchableOpacity>
        </View>

        {pickupPhoto ? (
          <View style={styles.photoPreviewContainer}>
            <Text style={styles.photoPreviewText}>✅ 사진 선택됨</Text>
          </View>
        ) : (
          <View style={styles.photoPlaceholderContainer}>
            <Text style={styles.photoPlaceholder}>사진을 선택해주세요</Text>
          </View>
        )}
      </Card>

      {/* 수신자 서명 요청 */}
      <Card style={styles.card}>
        <Text style={styles.label}>수신자 성함</Text>
        <Input
          placeholder="수신자 성함 입력"
          value={recipientName}
          onChangeText={setRecipientName}
          style={styles.input}
        />
      </Card>

      {/* 배송 완료 제출 버튼 */}
      <View style={styles.buttonContainer}>
        {isUploading ? (
          <View style={styles.uploadingContainer}>
            <ActivityIndicator size="large" color="#00BCD4" />
            <Text style={styles.uploadingText}>업로드 중...</Text>
          </View>
        ) : (
          <Button
            title="배송 완료"
            onPress={handleCompletionSubmit}
            disabled={!deliveryCompleted || !pickupPhoto || !recipientName}
          />
        )}
      </View>

      {/* 기러 평가 버튼 (배송 완료 후) */}
      {deliveryCompleted && pickupPhoto && recipientName && (
        <View style={styles.ratingButtonContainer}>
          <Button
            title="기러 평가"
            onPress={() => navigation.navigate('Rating', { deliveryId: route?.id })}
            style={styles.ratingButton}
          />
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginVertical: 20,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  completionContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  completionButton: {
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  completedButton: {
    backgroundColor: '#4CAF50',
  },
  completionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  photoUploadContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  photoButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
  },
  photoButtonText: {
    fontSize: 20,
  },
  photoPreviewContainer: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoPreviewText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  photoPlaceholderContainer: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  photoPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  input: {
    marginBottom: 0,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  uploadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#666',
  },
  ratingButtonContainer: {
    paddingHorizontal: 16,
    marginTop: 10,
  },
  ratingButton: {
    backgroundColor: '#FF9800',
  },
});
