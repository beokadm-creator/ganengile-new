/**
 * Create Request Screen
 * Create a new delivery request
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Colors } from '../../src/theme';
import type { RequestsScreenProps } from '../../src/types/navigation';
import { db, auth } from '../../src/services/firebase';

export default function CreateRequestScreen({
  navigation,
}: RequestsScreenProps) {
  const [pickupStation, setPickupStation] = useState('');
  const [deliveryStation, setDeliveryStation] = useState('');
  const [packageSize, setPackageSize] = useState('');
  const [packageWeight, setPackageWeight] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const packageSizes = [
    { label: '소형 (가로x세로x높이 30cm 이하)', value: 'small' },
    { label: '중형 (가로x세로x높이 50cm 이하)', value: 'medium' },
    { label: '대형 (가로x세로x높이 100cm 이하)', value: 'large' },
  ];

  const packageWeights = [
    { label: '1kg 이하', value: 'light' },
    { label: '1kg ~ 5kg', value: 'medium' },
    { label: '5kg ~ 10kg', value: 'heavy' },
  ];

  const validateForm = (): boolean => {
    if (!pickupStation.trim()) {
      Alert.alert('오류', '수령역을 입력해주세요.');
      return false;
    }

    if (!deliveryStation.trim()) {
      Alert.alert('오류', '배송역을 입력해주세요.');
      return false;
    }

    if (pickupStation.trim() === deliveryStation.trim()) {
      Alert.alert('오류', '수령역과 배송역이 같습니다.');
      return false;
    }

    if (!packageSize) {
      Alert.alert('오류', '물건 크기를 선택해주세요.');
      return false;
    }

    if (!packageWeight) {
      Alert.alert('오류', '물건 무게를 선택해주세요.');
      return false;
    }

    if (!description.trim()) {
      Alert.alert('오류', '물건 설명을 입력해주세요.');
      return false;
    }

    return true;
  };

  const calculateFee = (): number => {
    // 기본 요금 계산 (나중에 더 복잡한 로직으로 대체)
    let baseFee = 5000; // 기본 5,000원

    if (packageSize === 'medium') baseFee += 2000;
    if (packageSize === 'large') baseFee += 5000;

    if (packageWeight === 'medium') baseFee += 1000;
    if (packageWeight === 'heavy') baseFee += 3000;

    return baseFee;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('사용자 인증 정보가 없습니다.');
      }

      const fee = calculateFee();

      await addDoc(collection(db, 'requests'), {
        requesterId: user.uid,
        pickupStation: {
          name: pickupStation.trim(),
          line: '',
          code: '',
        },
        deliveryStation: {
          name: deliveryStation.trim(),
          line: '',
          code: '',
        },
        packageInfo: {
          size: packageSize,
          weight: packageWeight,
          description: description.trim(),
        },
        fee: fee,
        status: 'pending',
        createdAt: serverTimestamp(),
        deadline: null, // 나중에 추가
      });

      Alert.alert(
        '성공',
        `배송 요청이 생성되었습니다.\n예상 배송비: ${fee.toLocaleString()}원`,
        [
          {
            text: '확인',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Request creation error:', error);
      Alert.alert('오류', '배송 요청 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📦 배송 요청하기</Text>
        <Text style={styles.subtitle}>
          빠르고 저렴하게 배송하세요
        </Text>
      </View>

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>수령역 (물건을 맡길 역)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 서울역"
            value={pickupStation}
            onChangeText={setPickupStation}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>배송역 (물건을 받을 역)</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 강남역"
            value={deliveryStation}
            onChangeText={setDeliveryStation}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>물건 크기</Text>
          {packageSizes.map((size) => (
            <TouchableOpacity
              key={size.value}
              style={[
                styles.optionButton,
                packageSize === size.value && styles.optionButtonSelected,
              ]}
              onPress={() => setPackageSize(size.value)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  packageSize === size.value && styles.optionButtonTextSelected,
                ]}
              >
                {size.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>물건 무게</Text>
          {packageWeights.map((weight) => (
            <TouchableOpacity
              key={weight.value}
              style={[
                styles.optionButton,
                packageWeight === weight.value && styles.optionButtonSelected,
              ]}
              onPress={() => setPackageWeight(weight.value)}
            >
              <Text
                style={[
                  styles.optionButtonText,
                  packageWeight === weight.value && styles.optionButtonTextSelected,
                ]}
              >
                {weight.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>물건 설명</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="예: 서류 봉투, 깨지기 쉬운 물건 등"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.feeCard}>
          <Text style={styles.feeLabel}>예상 배송비</Text>
          <Text style={styles.feeValue}>
            {calculateFee().toLocaleString()}원
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>요청하기</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>취소</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 8,
    marginBottom: 10,
    padding: 16,
  },
  buttonDisabled: {
    backgroundColor: Colors.gray400,
  },
  buttonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    alignItems: 'center',
    padding: 16,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    backgroundColor: Colors.gray100,
    flex: 1,
  },
  feeCard: {
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 8,
    elevation: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
    padding: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  feeLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  feeValue: {
    color: Colors.accent,
    fontSize: 24,
    fontWeight: 'bold',
  },
  form: {
    padding: 20,
  },
  header: {
    backgroundColor: Colors.accent,
    padding: 30,
    paddingTop: 60,
  },
  input: {
    backgroundColor: Colors.gray50,
    borderColor: Colors.gray300,
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 16,
    padding: 12,
  },
  inputGroup: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    elevation: 2,
    marginBottom: 15,
    padding: 15,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  optionButton: {
    backgroundColor: Colors.gray50,
    borderColor: Colors.gray300,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  optionButtonSelected: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  optionButtonText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  optionButtonTextSelected: {
    color: Colors.white,
    fontWeight: '600',
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});
