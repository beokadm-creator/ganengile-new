/**
 * Identity Verification Screen
 * 신원 인증 화면 - 신분증 업로드 및 정보 제출
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StackNavigationProp } from '@react-navigation/stack';
import { useUser } from '../../contexts/UserContext';
import {
  uploadIdCardImage,
  submitVerification,
} from '../../services/verification-service';
import { VerificationSubmitData } from '../../types/profile';

type NavigationProp = StackNavigationProp<any>;

interface Props {
  navigation: NavigationProp;
}

type IdCardType = 'resident' | 'driver' | 'passport';

export default function IdentityVerificationScreen({ navigation }: Props) {
  const { user } = useUser();
  const [idCardType, setIdCardType] = useState<IdCardType>('resident');
  const [frontImageUrl, setFrontImageUrl] = useState<string>('');
  const [backImageUrl, setBackImageUrl] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [birthDate, setBirthDate] = useState<string>('');
  const [personalId, setPersonalId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>로그인이 필요합니다.</Text>
      </View>
    );
  }

  const handlePickImage = async (type: 'front' | 'back') => {
    if (!user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      setLoading(true);
      const imageUrl = await uploadIdCardImage(user.uid, result.assets[0].uri, type);

      if (type === 'front') {
        setFrontImageUrl(imageUrl);
      } else {
        setBackImageUrl(imageUrl);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('오류', '이미지 업로드에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('알림', '로그인이 필요합니다.');
      return;
    }

    if (!frontImageUrl) {
      Alert.alert('알림', '신분증 앞면 사진을 업로드해주세요.');
      return;
    }

    if (idCardType !== 'passport' && !backImageUrl) {
      Alert.alert('알림', '신분증 뒷면 사진을 업로드해주세요.');
      return;
    }

    if (!name || !birthDate) {
      Alert.alert('알림', '모든 필수 정보를 입력해주세요.');
      return;
    }

    try {
      setLoading(true);

      const submitData: VerificationSubmitData = {
        idCardType,
        frontImageUrl,
        backImageUrl: idCardType !== 'passport' ? backImageUrl : undefined,
        name,
        birthDate,
        personalId: personalId || undefined,
      };

      await submitVerification(user.uid, submitData);

      Alert.alert(
        '제출 완료',
        '신원 인증이 제출되었습니다. 심사는 영업일 기준으로 1~3일 소요됩니다.',
        [{ text: '확인', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error submitting verification:', error);
      Alert.alert('오류', '인증 제출에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>신원 인증</Text>
          <Text style={styles.headerSubtitle}>
            길러로 활동하기 위해 신분증을 제출해주세요
          </Text>
        </View>

        {/* ID Card Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>신분증 종류</Text>
          <View style={styles.cardTypeContainer}>
            <TouchableOpacity
              style={[styles.cardTypeButton, idCardType === 'resident' && styles.cardTypeButtonActive]}
              onPress={() => setIdCardType('resident')}
            >
              <Text style={styles.cardTypeIcon}>🪪</Text>
              <Text style={styles.cardTypeName}>주민등록증</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardTypeButton, idCardType === 'driver' && styles.cardTypeButtonActive]}
              onPress={() => setIdCardType('driver')}
            >
              <Text style={styles.cardTypeIcon}>🚗</Text>
              <Text style={styles.cardTypeName}>운전면허증</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardTypeButton, idCardType === 'passport' && styles.cardTypeButtonActive]}
              onPress={() => setIdCardType('passport')}
            >
              <Text style={styles.cardTypeIcon}>🛂</Text>
              <Text style={styles.cardTypeName}>여권</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Photo Upload */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>신분증 사진</Text>

          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => handlePickImage('front')}
            disabled={loading}
          >
            <View style={styles.uploadContent}>
              <Text style={styles.uploadIcon}>📷</Text>
              <View style={styles.uploadTextContainer}>
                <Text style={styles.uploadTitle}>
                  앞면 {idCardType === 'passport' ? '사진' : '사진 (또는 얼굴이 나온 곳)'}
                </Text>
                {frontImageUrl ? (
                  <Text style={styles.uploadStatus}>✅ 업로드됨</Text>
                ) : (
                  <Text style={styles.uploadStatusPlaceholder}>업로드 필요</Text>
                )}
              </View>
              {!loading && <Text style={styles.uploadArrow}>›</Text>}
            </View>
            {loading && <ActivityIndicator color="#9C27B0" />}
          </TouchableOpacity>

          {idCardType !== 'passport' && (
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => handlePickImage('back')}
              disabled={loading}
            >
              <View style={styles.uploadContent}>
                <Text style={styles.uploadIcon}>📷</Text>
                <View style={styles.uploadTextContainer}>
                  <Text style={styles.uploadTitle}>뒷면 사진</Text>
                  {backImageUrl ? (
                    <Text style={styles.uploadStatus}>✅ 업로드됨</Text>
                  ) : (
                    <Text style={styles.uploadStatusPlaceholder}>업로드 필요</Text>
                  )}
                </View>
                {!loading && <Text style={styles.uploadArrow}>›</Text>}
              </View>
              {loading && <ActivityIndicator color="#9C27B0" />}
            </TouchableOpacity>
          )}

          <View style={styles.photoNoteContainer}>
            <Text style={styles.photoNoteIcon}>ℹ️</Text>
            <Text style={styles.photoNoteText}>
              사진은 선명하게 촬영된본만 가능하며, 확장자는 .jpg 형식만
              지원합니다.
            </Text>
          </View>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>신분증 정보</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>이름 *</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputPrefix}>이름</Text>
              <TextInput
                style={styles.input}
                placeholder="신분증상 실명"
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>생년월일 *</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputPrefix}>YYYYMMDD</Text>
              <TextInput
                style={styles.input}
                placeholder="예: 19900101"
                value={birthDate}
                onChangeText={setBirthDate}
                maxLength={8}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>주민등록번호 뒤 7자리</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.inputPrefix}>•••••••••</Text>
              <TextInput
                style={styles.input}
                placeholder="선택사항 (신원 확인용)"
                value={personalId}
                onChangeText={setPersonalId}
                maxLength={7}
                keyboardType="number-pad"
                secureTextEntry
              />
            </View>
          </View>

          <View style={styles.noteContainer}>
            <Text style={styles.noteIcon}>ℹ️</Text>
            <Text style={styles.noteText}>
              제출된 정보는 심사용으로만 사용되며, 마이페이지에서 언제든지 삭제할 수
              있습니다.
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, (!frontImageUrl || (idCardType !== 'passport' && !backImageUrl)) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading || !frontImageUrl || (idCardType !== 'passport' && !backImageUrl)}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>인증 제출하기</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTypeButton: {
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardTypeButtonActive: {
    backgroundColor: '#9C27B0',
    borderColor: '#9C27B0',
  },
  cardTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cardTypeIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  cardTypeName: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  content: {
    flex: 1,
  },
  errorText: {
    color: '#f44336',
    fontSize: 16,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  headerSubtitle: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  headerTitle: {
    color: '#333',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputPrefix: {
    color: '#999',
    fontSize: 14,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  noteContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  noteIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  noteText: {
    color: '#333',
    fontSize: 12,
    flex: 1,
  },
  photoNoteContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff8dc',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  photoNoteIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  photoNoteText: {
    color: '#333',
    fontSize: 12,
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#333',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#9C27B0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadArrow: {
    color: '#9C27B0',
    fontSize: 18,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  uploadContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  uploadIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  uploadStatus: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  uploadStatusPlaceholder: {
    color: '#999',
    fontSize: 12,
  },
  uploadTextContainer: {
    flex: 1,
  },
  uploadTitle: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
});
