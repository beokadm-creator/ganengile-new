import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { Button, Card } from '../components/common';
import { createRequest } from '../services/request-service';
import { processMatchingForRequest } from '../services/matching-service';
import { calculatePhase1DeliveryFee } from '../services/pricing-service';
import { PackageSize } from '../types/delivery';
import { StationInfo } from '../types/route';
import { auth } from '../services/firebase';

interface CreateRequestScreenProps {
  navigation: any;
}

export const CreateRequestScreen: React.FC<CreateRequestScreenProps> = ({
  navigation,
}) => {
  const [departureStation] = useState<StationInfo | null>(null);
  const [arrivalStation] = useState<StationInfo | null>(null);
  const [stationCount, setStationCount] = useState<number>(5);
  const [packageSize, setPackageSize] = useState<PackageSize>(PackageSize.SMALL);
  const [packageWeight, setPackageWeight] = useState<string>('light');
  const [urgency, setUrgency] = useState<'normal' | 'fast' | 'urgent'>('normal');
  const [pickupTime, setPickupTime] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [feeBreakdown, setFeeBreakdown] = useState<any>(null);
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');

  const handleStationSelect = (type: 'departure' | 'arrival') => {
    Alert.alert(
      '역 선택',
      type === 'departure' ? '출발역을 선택하세요' : '도착역을 선택하세요',
    );
  };

  const calculateDeliveryFee = () => {
    if (!departureStation || !arrivalStation || !packageSize || !packageWeight) {
      Alert.alert('알림', '모든 필수 항목을 입력해주세요.');
      return;
    }

    if (stationCount < 2 || stationCount > 30) {
      Alert.alert('알림', '역 개수는 2~30개 사이여야 합니다.');
      return;
    }

    const weightValue = packageWeight === 'light' ? 1 : packageWeight === 'medium' ? 3 : 7;
    const result = calculatePhase1DeliveryFee({
      stationCount,
      weight: weightValue,
      packageSize,
      urgency,
    });

    setDeliveryFee(result.totalFee);
    setFeeBreakdown(result);
  };

  const handleSubmit = async () => {
    // 필수 항목 검증
    if (!departureStation || !arrivalStation || !packageSize || !packageWeight || !pickupTime) {
      Alert.alert('알림', '모든 필수 항목을 입력해주세요.');
      return;
    }

    // 수령인 정보 검증
    if (!recipientName.trim()) {
      Alert.alert('알림', '수령인 이름을 입력해주세요.');
      return;
    }

    if (!recipientPhone.trim()) {
      Alert.alert('알림', '수령인 전화번호를 입력해주세요.');
      return;
    }

    // 전화번호 형식 검증 (숫자만)
    const phoneRegex = /^[0-9]{10,11}$/;
    if (!phoneRegex.test(recipientPhone.replace(/-/g, ''))) {
      Alert.alert('알림', '올바른 전화번호를 입력해주세요. (숫자 10~11자)');
      return;
    }

    // 현재 사용자 확인
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('에러', '로그인이 필요합니다.');
      return;
    }

    try {
      const feeData = feeBreakdown || {
        baseFee: 0,
        distanceFee: 0,
        weightFee: 0,
        sizeFee: 0,
        serviceFee: 0,
        totalFee: deliveryFee,
        vat: 0,
        breakdown: {
          gillerFee: 0,
          platformFee: 0,
        },
      };

      const request = await createRequest(
        currentUser.uid,
        departureStation,
        arrivalStation,
        'standard',
        {
          size: packageSize,
          weight: packageWeight === 'light' ? 1 : packageWeight === 'medium' ? 3 : 7,
          description: '',
          isFragile: false,
          isPerishable: false,
        },
        feeData,
        recipientName.trim(),
        recipientPhone.replace(/-/g, ''),
        new Date(),
        new Date(Date.now() + 86400000)
      );

      // 매칭 시작
      await processMatchingForRequest(request.requestId);

      Alert.alert(
        '배송 요청 완료',
        `배송비: ${deliveryFee.toLocaleString()}원\n\n매칭을 시작합니다.`,
        [
          {
            text: '확인',
            onPress: () => {
              navigation.navigate('MatchingResult' as never, {
                requestId: request.requestId,
              } as never);
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error creating request:', error);
      Alert.alert('에러', '배송 요청 생성 실패');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>배송 요청</Text>

      {/* 출발지/도착지 선택 */}
      <Card style={styles.card}>
        <Text style={styles.label}>출발역</Text>
        <TouchableOpacity
          style={styles.stationButton}
          onPress={() => handleStationSelect('departure')}>
          <Text style={styles.stationText}>
            {departureStation ? departureStation.stationName : '출발역 선택'}
          </Text>
        </TouchableOpacity>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>도착역</Text>
        <TouchableOpacity
          style={styles.stationButton}
          onPress={() => handleStationSelect('arrival')}>
          <Text style={styles.stationText}>
            {arrivalStation ? arrivalStation.stationName : '도착역 선택'}
          </Text>
        </TouchableOpacity>
      </Card>

      {/* 패키지 크기/무게 선택 */}
      <Card style={styles.card}>
        <Text style={styles.label}>패키지 크기</Text>
        <View style={styles.optionContainer}>
          {(['small', 'medium', 'large'] as const).map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.optionButton,
                packageSize === size && styles.selectedOption,
              ]}
              onPress={() => setPackageSize(size as PackageSize)}>
              <Text
                style={[
                  styles.optionText,
                  packageSize === size && styles.selectedOptionText,
                ]}>
                {size === 'small' ? '소형' : size === 'medium' ? '중형' : '대형'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>지하철 역 개수 *</Text>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="5"
            value={stationCount.toString()}
            onChangeText={(text) => {
              const count = parseInt(text) || 5;
              setStationCount(Math.min(30, Math.max(2, count)));
            }}
            keyboardType="number-pad"
            maxLength={2}
          />
          <Text style={styles.inputHint}>출발역부터 도착역까지의 역 개수 (2-30)</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>긴급도</Text>
        <View style={styles.optionContainer}>
          {(['normal', 'fast', 'urgent'] as const).map((level) => (
            <TouchableOpacity
              key={level}
              style={[
                styles.optionButton,
                urgency === level && styles.selectedOption,
              ]}
              onPress={() => setUrgency(level)}>
              <Text
                style={[
                  styles.optionText,
                  urgency === level && styles.selectedOptionText,
                ]}>
                {level === 'normal' ? '보통' : level === 'fast' ? '빠름' : '긴급'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>패키지 무게</Text>
        <View style={styles.optionContainer}>
          {['light', 'medium', 'heavy'].map((weight) => (
            <TouchableOpacity
              key={weight}
              style={[
                styles.optionButton,
                packageWeight === weight && styles.selectedOption,
              ]}
              onPress={() => setPackageWeight(weight)}>
              <Text
                style={[
                  styles.optionText,
                  packageWeight === weight && styles.selectedOptionText,
                ]}>
                {weight === 'light' ? '가벼움' : weight === 'medium' ? '중간' : '무거움'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* 픽업 시간대 선택 */}
      <Card style={styles.card}>
        <Text style={styles.label}>픽업 시간대</Text>
        <View style={styles.optionContainer}>
          {['morning', 'afternoon', 'evening'].map((time) => (
            <TouchableOpacity
              key={time}
              style={[
                styles.optionButton,
                pickupTime === time && styles.selectedOption,
              ]}
              onPress={() => setPickupTime(time)}>
              <Text
                style={[
                  styles.optionText,
                  pickupTime === time && styles.selectedOptionText,
                ]}>
                {time === 'morning' ? '오전' : time === 'afternoon' ? '오후' : '저녁'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* 수령인 정보 입력 */}
      <Card style={styles.card}>
        <Text style={styles.label}>수령인 정보</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>수령인 이름</Text>
          <TextInput
            style={styles.input}
            placeholder="홍길동"
            value={recipientName}
            onChangeText={setRecipientName}
            maxLength={20}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>전화번호</Text>
          <TextInput
            style={styles.input}
            placeholder="01012345678"
            value={recipientPhone}
            onChangeText={(text) => {
              // 숫자만 입력 허용
              const numericText = text.replace(/[^0-9]/g, '');
              setRecipientPhone(numericText);
            }}
            keyboardType="phone-pad"
            maxLength={11}
          />
        </View>
      </Card>

      {/* 배송비 표시 */}
      <Card style={styles.feeCard}>
        <Text style={styles.feeLabel}>예상 배송비</Text>
        <Text style={styles.feeAmount}>
          {deliveryFee > 0 ? `${deliveryFee.toLocaleString()}원` : '-'}
        </Text>
      </Card>

      {/* 요청 제출 버튼 */}
      <View style={styles.buttonContainer}>
        <Button
          title="요청 제출"
          onPress={handleSubmit}
          disabled={
            !departureStation ||
            !arrivalStation ||
            !packageSize ||
            !packageWeight ||
            !pickupTime ||
            !recipientName.trim() ||
            !recipientPhone.trim()
          }
        />
      </View>
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
  stationButton: {
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    alignItems: 'center',
  },
  stationText: {
    fontSize: 16,
    color: '#00BCD4',
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
  feeCard: {
    backgroundColor: '#E8F5E9',
    padding: 20,
    alignItems: 'center',
  },
  feeLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  feeAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00BCD4',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inputHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
