import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { TextInput, Button, Card } from '../components/common';
import { Station, Route, TravelTimeService } from '../services';
import { OptimizedStationSelectModal } from '../components/modals/OptimizedStationSelectModal';
import { createRequest } from '../services/request-service';
import { processMatchingForRequest } from '../services/matching-service';
import { auth } from '../firebase';

interface CreateRequestScreenProps {
  navigation: any;
  route: Route;
}

export const CreateRequestScreen: React.FC<CreateRequestScreenProps> = ({
  navigation,
  route,
}) => {
  const [departureStation, setDepartureStation] = useState<Station | null>(null);
  const [arrivalStation, setArrivalStation] = useState<Station | null>(null);
  const [packageSize, setPackageSize] = useState<string>('');
  const [packageWeight, setPackageWeight] = useState<string>('');
  const [pickupTime, setPickupTime] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
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

    // 간단 배송비 계산 (예시)
    let baseFee = 3000;
    const sizeMultiplier = packageSize === 'small' ? 1 : packageSize === 'medium' ? 1.5 : 2;
    const weightMultiplier = packageWeight === 'light' ? 1 : packageWeight === 'medium' ? 1.3 : 1.6;
    const calculatedFee = baseFee * sizeMultiplier * weightMultiplier;

    setDeliveryFee(Math.floor(calculatedFee));
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
      // Firestore에 배송 요청 저장
      const request = await createRequest(
        currentUser.uid,
        {
          name: departureStation.name,
          line: departureStation.line,
          stationId: departureStation.id,
        },
        {
          name: arrivalStation.name,
          line: arrivalStation.line,
          stationId: arrivalStation.id,
        },
        'medium',
        {
          size: packageSize,
          weight: packageWeight,
        },
        {
          totalFee: deliveryFee,
        },
        recipientName.trim(), // 수령인 이름
        recipientPhone.replace(/-/g, ''), // 수령인 전화번호 (하이픈 제거)
        new Date(), // preferredTime
        new Date(Date.now() + 86400000) // deadline (1일 후)
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
            {departureStation ? departureStation.name : '출발역 선택'}
          </Text>
        </TouchableOpacity>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>도착역</Text>
        <TouchableOpacity
          style={styles.stationButton}
          onPress={() => handleStationSelect('arrival')}>
          <Text style={styles.stationText}>
            {arrivalStation ? arrivalStation.name : '도착역 선택'}
          </Text>
        </TouchableOpacity>
      </Card>

      {/* 패키지 크기/무게 선택 */}
      <Card style={styles.card}>
        <Text style={styles.label}>패키지 크기</Text>
        <View style={styles.optionContainer}>
          {['small', 'medium', 'large'].map((size) => (
            <TouchableOpacity
              key={size}
              style={[
                styles.optionButton,
                packageSize === size && styles.selectedOption,
              ]}
              onPress={() => setPackageSize(size)}>
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
});
