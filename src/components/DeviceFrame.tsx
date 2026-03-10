/**
 * Device Frame Component
 * PC에서 접속 시 모바일 앱처럼 보이기 위한 iPhone 프레임
 * Web 전용으로 분리하여 React Native Web 호환성 개선
 */

import React from 'react';
import { View, StyleSheet, Dimensions, Platform } from 'react-native';

interface DeviceFrameProps {
  children: React.ReactNode;
}

// 모바일 기기 크기 상수 (더 크게)
const DEVICE_WIDTH = 414;
const DEVICE_HEIGHT = 896;
const FRAME_WIDTH = DEVICE_WIDTH + 60;
const FRAME_HEIGHT = DEVICE_HEIGHT + 60;

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ children }) => {
  // 네이티브에서는 프레임 없이 바로 렌더링
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  // 웹에서는 브라우저 화면 너비로 데스크톱 여부 확인
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

  if (!isDesktop) {
    // 모바일 웹에서는 프레임 없이 렌더링
    return <>{children}</>;
  }

  // PC 웹 - iPhone 프레임과 함께 렌더링
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px',
      gap: '60px',
      minHeight: '100vh',
      backgroundColor: '#0f0f23',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    }}>
      {/* 왼쪽 소개 영역 */}
      <div style={{ width: '300px', textAlign: 'left', flexShrink: 0 }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: '#FFFFFF', margin: '0 0 8px 0' }}>
          가는길에
        </h1>
        <p style={{ fontSize: '20px', color: '#00BCD4', margin: '0 0 32px 0' }}>
          지하철 크라우드 배송 플랫폼
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '32px' }}>
          <div>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🚇</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#FFFFFF', marginBottom: '4px' }}>
              지하철 출퇴근길에
            </div>
            <div style={{ fontSize: '14px', color: '#B0BEC5' }}>추가 수익 창출</div>
          </div>

          <div>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>📦</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#FFFFFF', marginBottom: '4px' }}>
              같이 가는 길에
            </div>
            <div style={{ fontSize: '14px', color: '#B0BEC5' }}>배송 의뢰</div>
          </div>

          <div>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
            <div style={{ fontSize: '18px', fontWeight: '600', color: '#FFFFFF', marginBottom: '4px' }}>
              오늘 받아볼 수 있는
            </div>
            <div style={{ fontSize: '14px', color: '#B0BEC5' }}>빠른 배송</div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(0, 188, 212, 0.1)',
          border: '2px solid #00BCD4',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <div style={{ fontSize: '16px', color: '#00BCD4', marginBottom: '8px', fontWeight: '600' }}>
            💰 배송비
          </div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#FFFFFF', marginBottom: '4px' }}>
            5,300원부터
          </div>
          <div style={{ fontSize: '12px', color: '#B0BEC5' }}>소형, 1kg, 5개역 기준</div>
        </div>
      </div>

      {/* iPhone 프레임 */}
      <div style={{
        width: `${FRAME_WIDTH}px`,
        height: `${FRAME_HEIGHT}px`,
        backgroundColor: '#000000',
        borderRadius: '55px',
        border: '14px solid #2c2c2c',
        boxShadow: '0 25px 40px rgba(0, 188, 212, 0.6)',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute',
          top: '14px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '130px',
          height: '38px',
          backgroundColor: '#000000',
          borderRadius: '22px',
          zIndex: 10,
        }} />

        {/* Screen content */}
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#FFFFFF',
          marginTop: '14px',
          marginBottom: '14px',
          overflow: 'auto',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
        }}>
          {children}
        </div>

        {/* Home indicator */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '150px',
          height: '6px',
          backgroundColor: '#FFFFFF',
          borderRadius: '4px',
          zIndex: 10,
        }} />
      </div>

      {/* 오른쪽 설명 영역 */}
      <div style={{ width: '350px', display: 'flex', flexDirection: 'column', gap: '24px', flexShrink: 0 }}>
        <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#FFFFFF', margin: '0 0 24px 0' }}>
          서비스 특징
        </h2>

        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#00BCD4', margin: '0 0 12px 0' }}>
            🎯 누구나 길러가 될 수 있습니다
          </h3>
          <div style={{ fontSize: '14px', color: '#E0E0E0', lineHeight: '22px', whiteSpace: 'pre-line' }}>
            {'• 출퇴근길에 배송하며 추가 수익 창출\n• 1회 왕복: 4,500원 × 20일 = 90,000원/월\n• 자유로운 시간에 참여 가능'}
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#00BCD4', margin: '0 0 12px 0' }}>
            ⏰ 오늘 받아보세요
          </h3>
          <div style={{ fontSize: '14px', color: '#E0E0E0', lineHeight: '22px', whiteSpace: 'pre-line' }}>
            {'• 지하철 to 지하철 배송 (1단계)\n• 긴급: 1-2시간, 일반: 2-3시간\n• 실시간 경매 시스템'}
          </div>
        </div>

        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          padding: '20px'
        }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#00BCD4', margin: '0 0 12px 0' }}>
            💸 합리적인 가격
          </h3>
          <div style={{ fontSize: '14px', color: '#E0E0E0', lineHeight: '22px', whiteSpace: 'pre-line' }}>
            {'• 기본요금: 3,500원\n• 역 개수 기반 거리료\n• 서비스 수수료 15% 포함'}
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = StyleSheet.create({
  // Styles are only used on native
});
