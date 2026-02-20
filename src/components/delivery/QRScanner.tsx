/**
 * QR Code Scanner Component
 * QR 코드 스캔 기능 제공
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, TouchableOpacity } from 'react-native';
import { CameraView, Camera } from 'expo-camera';

interface Props {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

export default function QRScanner({ onScan, onError, onClose }: Props) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status !== 'granted' && onError) {
        onError('카메라 권한이 필요합니다.');
      }
    })();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!scanned) {
      setScanned(true);
      onScan(data);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.message}>카메라 권한 확인 중...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>카메라 접근 권한이 없습니다.</Text>
        <Text style={styles.subText}>
          {`설정 > 개인정보 보호 > 카메라에서 권한을 허용해주세요.`}
        </Text>
        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>닫기</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      {/* Scan Frame Overlay */}
      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={styles.cornerTopLeft} />
          <View style={styles.cornerTopRight} />
          <View style={styles.cornerBottomLeft} />
          <View style={styles.cornerBottomRight} />
        </View>

        <Text style={styles.instruction}>
          QR 코드를 스캔해주세요
        </Text>

        {scanned && (
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.rescanButtonText}>다시 스캔</Text>
          </TouchableOpacity>
        )}

        {onClose && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    position: 'absolute',
    right: 20,
    top: 60,
    width: 40,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  container: {
    backgroundColor: '#000',
    flex: 1,
  },
  cornerBottomLeft: {
    borderColor: '#4CAF50',
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderBottomLeftRadius: 8,
    height: 30,
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 30,
  },
  cornerBottomRight: {
    borderColor: '#4CAF50',
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 8,
    height: 30,
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30,
  },
  cornerTopLeft: {
    borderColor: '#4CAF50',
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderTopLeftRadius: 8,
    height: 30,
    position: 'absolute',
    top: 0,
    left: 0,
    width: 30,
  },
  cornerTopRight: {
    borderColor: '#4CAF50',
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderTopRightRadius: 8,
    height: 30,
    position: 'absolute',
    top: 0,
    right: 0,
    width: 30,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  instruction: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  message: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  rescanButton: {
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  rescanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scanArea: {
    height: 250,
    position: 'relative',
    width: 250,
  },
  subText: {
    color: '#999',
    fontSize: 14,
    marginTop: 8,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
});
