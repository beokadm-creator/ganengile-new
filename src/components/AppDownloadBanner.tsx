/**
 * App Download Banner
 * 웹 사용자에게 앱 다운로드를 유도하는 배너
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  Platform,
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppDownloadBannerProps {
  visible?: boolean;
  onDismiss?: () => void;
}

const BANNER_STORAGE_KEY = '@app_download_banner_dismissed';

export function AppDownloadBanner({ visible = true, onDismiss }: AppDownloadBannerProps) {
  const [showBanner, setShowBanner] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    checkBannerStatus();
  }, []);

  const checkBannerStatus = async () => {
    if (Platform.OS === 'web') {
      try {
        const dismissed = await AsyncStorage.getItem(BANNER_STORAGE_KEY);
        const dismissTime = dismissed ? parseInt(dismissed, 10) : 0;
        const daysSinceDismiss = (Date.now() - dismissTime) / (1000 * 60 * 60 * 24);

        // 7일이 지났거나 한번도 안 보여줬으면 보여주기
        if (!dismissed || daysSinceDismiss >= 7) {
          setShowBanner(true);
        }
      } catch (error) {
        console.error('Error checking banner status:', error);
        setShowBanner(true); // 에러 시 보여주기
      }
    }
  };

  const handleDismiss = async () => {
    try {
      await AsyncStorage.setItem(BANNER_STORAGE_KEY, Date.now().toString());
      setShowBanner(false);
      onDismiss?.();
    } catch (error) {
      console.error('Error dismissing banner:', error);
    }
  };

  const handleDontShowAgain = async () => {
    try {
      await AsyncStorage.setItem(BANNER_STORAGE_KEY, '9999999999999'); // 먼 미래로 설정
      setShowBanner(false);
      onDismiss?.();
    } catch (error) {
      console.error('Error setting dont show again:', error);
    }
  };

  const openAppStore = (platform: 'ios' | 'android') => {
    // 앱 배포 후 실제 앱 스토어 링크로 교체 필요
    if (platform === 'ios') {
      // App Store 링크 (배포 후 idXXXXXXXXX를 실제 App ID로 교체)
      Linking.openURL('https://apps.apple.com/app/idXXXXXXXXX');
    } else {
      // Play Store 링크 (배포 후 패키지명 확인)
      Linking.openURL('https://play.google.com/store/apps/details?id=com.ganengile');
    }
  };

  if (!showBanner || !visible) {
    return null;
  }

  return (
    <>
      <View style={styles.banner}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerEmoji}>📱</Text>

          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>더 나은 경험을 위해 앱을 설치하세요!</Text>
            <Text style={styles.bannerSubtitle}>
              • 실시간 알림  • 위치 기반 서비스  • 빠른 성능
            </Text>
          </View>

          <View style={styles.bannerButtons}>
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={() => setShowModal(true)}
            >
              <Text style={styles.downloadButtonText}>설치하기</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
              <Text style={styles.dismissButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>앱 다운로드</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={styles.modalCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.featureContainer}>
                <Text style={styles.featureEmoji}>🔔</Text>
                <Text style={styles.featureTitle}>실시간 알림</Text>
                <Text style={styles.featureDescription}>
                  매칭, 픽업, 배송 완료 등 중요 알림을 놓치지 마세요
                </Text>
              </View>

              <View style={styles.featureContainer}>
                <Text style={styles.featureEmoji}>📍</Text>
                <Text style={styles.featureTitle}>위치 기반 서비스</Text>
                <Text style={styles.featureDescription}>
                  현재 위치에서 가까운 역을 자동으로 추천해드려요
                </Text>
              </View>

              <View style={styles.featureContainer}>
                <Text style={styles.featureEmoji}>⚡</Text>
                <Text style={styles.featureTitle}>빠른 성능</Text>
                <Text style={styles.featureDescription}>
                  네이티브 앱으로 더 빠르고 부드러운 경험을 누리세요
                </Text>
              </View>

              <View style={styles.downloadButtonsContainer}>
                <TouchableOpacity
                  style={[styles.storeButton, styles.iosButton]}
                  onPress={() => openAppStore('ios')}
                >
                  <Text style={styles.storeButtonText}>iOS 다운로드</Text>
                  <Text style={styles.storeButtonSubtext}>App Store</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.storeButton, styles.androidButton]}
                  onPress={() => openAppStore('android')}
                >
                  <Text style={styles.storeButtonText}>Android 다운로드</Text>
                  <Text style={styles.storeButtonSubtext}>Google Play</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.continueWebButton} onPress={() => setShowModal(false)}>
                <Text style={styles.continueWebButtonText}>웹으로 계속하기</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.dontShowAgainButton} onPress={handleDontShowAgain}>
                <Text style={styles.dontShowAgainText}>다시 보지 않기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#E3F2FD',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#1976D2',
    opacity: 0.8,
    lineHeight: 16,
  },
  bannerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadButton: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  downloadButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
  },
  dismissButtonText: {
    fontSize: 16,
    color: '#1976D2',
    opacity: 0.6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    fontSize: 24,
    color: '#999',
  },
  modalBody: {
    padding: 20,
  },
  featureContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  featureEmoji: {
    fontSize: 32,
    marginRight: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    flex: 1,
  },
  downloadButtonsContainer: {
    gap: 12,
    marginTop: 20,
    marginBottom: 20,
  },
  storeButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  iosButton: {
    backgroundColor: '#000',
  },
  androidButton: {
    backgroundColor: '#4CAF50',
  },
  storeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  storeButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  continueWebButton: {
    backgroundColor: '#f5f5f5',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  continueWebButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  dontShowAgainButton: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  dontShowAgainText: {
    fontSize: 12,
    color: '#999',
  },
});
