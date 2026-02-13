import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  BackHandler,
  Animated,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { GillerProfileCard } from '../../components/giller/GillerProfileCard';
import { matchingService } from '../../services/matching-service';

type MatchingResultRouteParams = {
  MatchingResult: {
    requestId: string;
  };
};

const MATCHING_TIMEOUT = 30000; // 30 seconds

export const MatchingResultScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<MatchingResultRouteParams, 'MatchingResult'>>();
  const { requestId } = route.params;

  const [giller, setGiller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        '매칭 취소',
        '매칭을 취소하고 이전 화면으로 돌아가시겠습니까?',
        [
          { text: '아니오', style: 'cancel' },
          {
            text: '예',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]);

  // Find giller for the request
  const findGiller = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setTimeoutReached(false);

      const result = await matchingService.findGiller(requestId);

      if (result.success && result.data) {
        setGiller(result.data.giller);
        fadeIn();
      } else {
        setError(result.error || '일시적인 오류가 발생했습니다.');
      }
    } catch (err: any) {
      setError(err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  // Initial search
  useEffect(() => {
    findGiller();
  }, [findGiller]);

  // Timeout handling
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        if (!giller) {
          setTimeoutReached(true);
          setError('매칭 시간이 초과되었습니다. 다시 시도해주세요.');
          setLoading(false);
        }
      }, MATCHING_TIMEOUT);

      return () => clearTimeout(timer);
    }
  }, [loading, giller]);

  // Fade in animation
  const fadeIn = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Handle accept
  const handleAccept = async () => {
    try {
      setIsAccepting(true);

      const result = await matchingService.acceptMatch(requestId, giller.id);

      if (result.success) {
        Alert.alert(
          '매칭 성공',
          '기일러와 매칭되었습니다. 배송을 시작합니다.',
          [
            {
              text: '확인',
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'DeliveryTracking' as never }],
                });
              },
            },
          ]
        );
      } else {
        Alert.alert('오류', result.error || '매칭 수락에 실패했습니다.');
      }
    } catch (err: any) {
      Alert.alert('오류', err.message || '네트워크 오류가 발생했습니다.');
    } finally {
      setIsAccepting(false);
    }
  };

  // Handle reject
  const handleReject = () => {
    Alert.alert(
      '거절 확인',
      '이 기일러를 거절하시겠습니까? 다른 기일러를 찾게 됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '거절',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRejecting(true);
              const result = await matchingService.rejectMatch(requestId, giller.id);

              if (result.success) {
                // Find another giller
                setRetryCount((prev) => prev + 1);
                await findGiller();
              } else {
                Alert.alert('오류', result.error || '거절 처리에 실패했습니다.');
              }
            } catch (err: any) {
              Alert.alert('오류', err.message || '네트워크 오류가 발생했습니다.');
            } finally {
              setIsRejecting(false);
            }
          },
        },
      ]
    );
  };

  // Retry matching
  const handleRetry = () => {
    setGiller(null);
    setError(null);
    setRetryCount(0);
    findGiller();
  };

  // Cancel matching
  const handleCancel = () => {
    Alert.alert(
      '매칭 취소',
      '매칭을 취소하고 이전 화면으로 돌아가시겠습니까?',
      [
        { text: '아니오', style: 'cancel' },
        {
          text: '예',
          style: 'destructive',
          onPress: () => navigation.goBack(),
        },
      ]
    );
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color="#FF5252" />
          <Text style={styles.errorTitle}>매칭 실패</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <View style={styles.errorButtonContainer}>
            <Text style={styles.retryButton} onPress={handleRetry}>
              다시 시도
            </Text>
            <Text style={styles.cancelButton} onPress={handleCancel}>
              취소
            </Text>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00BCD4" />
          <Text style={styles.loadingText}>기일러를 찾고 있습니다...</Text>
          <Text style={styles.loadingSubtext}>
            잠시만 기다려주세요 ({Math.floor(MATCHING_TIMEOUT / 1000)}초 내)
          </Text>
          {retryCount > 0 && (
            <Text style={styles.retryCount}>재시도 횟수: {retryCount}</Text>
          )}
        </View>
        <Text style={styles.cancelText} onPress={handleCancel}>
          취소
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>매칭 완료!</Text>
        <Text style={styles.headerSubtitle}>
          기일러를 찾았습니다. 수락 또는 거절해주세요.
        </Text>
      </View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <GillerProfileCard
          giller={giller}
          onAccept={handleAccept}
          onReject={handleReject}
          isAccepting={isAccepting}
          isRejecting={isRejecting}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00BCD4',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  retryCount: {
    fontSize: 12,
    color: '#FF9800',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    padding: 16,
    textDecorationLine: 'underline',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  errorButtonContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  retryButton: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#00BCD4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  cancelButton: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
});
