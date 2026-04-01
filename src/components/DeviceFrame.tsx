import React from 'react';
import { Platform } from 'react-native';

interface DeviceFrameProps {
  children: React.ReactNode;
}

const DEVICE_WIDTH = 414;
const DEVICE_HEIGHT = 896;
const FRAME_WIDTH = DEVICE_WIDTH + 60;
const FRAME_HEIGHT = DEVICE_HEIGHT + 60;

const featureCards = [
  {
    icon: '요청',
    title: '바로 요청',
    description: '출발역과 도착역을 고르고 바로 요청을 시작합니다.',
  },
  {
    icon: '상태',
    title: '진행 확인',
    description: '채팅과 배송 상태를 같은 흐름에서 확인합니다.',
  },
  {
    icon: '정산',
    title: '깔끔한 마감',
    description: '보증금, 정산, 운영 확인까지 한 흐름으로 이어집니다.',
  },
];

const summaryCards = [
  {
    title: '요청',
    body: '필요한 배송을 빠르게 접수합니다.',
  },
  {
    title: '미션',
    body: '이동 가능한 구간만 선택해 참여합니다.',
  },
  {
    title: '운영',
    body: '진행 상태와 필요한 조치만 확인합니다.',
  },
];

export const DeviceFrame: React.FC<DeviceFrameProps> = ({ children }) => {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  if (!isDesktop) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '52px',
        minHeight: '100vh',
        padding: '40px',
        background:
          'radial-gradient(circle at top, rgba(26, 111, 90, 0.35), transparent 32%), linear-gradient(135deg, #08120F 0%, #0E1B17 45%, #132722 100%)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
      }}
    >
      <div style={{ width: '320px', flexShrink: 0 }}>
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              borderRadius: '999px',
              backgroundColor: 'rgba(134, 239, 172, 0.12)',
              border: '1px solid rgba(134, 239, 172, 0.25)',
              padding: '8px 14px',
              color: '#BBF7D0',
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            가는길에
          </div>
          <h1
            style={{
              margin: '16px 0 8px 0',
              fontSize: '46px',
              lineHeight: 1.05,
              color: '#F8FAFC',
              fontWeight: 800,
            }}
          >
            가는길에
          </h1>
          <p style={{ margin: 0, fontSize: '20px', lineHeight: 1.6, color: '#D1FAE5' }}>
            필요한 배송을 빠르게 요청하고, 진행 상태를 한눈에 확인하세요.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {featureCards.map((card) => (
            <div
              key={card.title}
              style={{
                borderRadius: '22px',
                border: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: 'rgba(255,255,255,0.04)',
                padding: '18px',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ color: '#86EFAC', fontSize: '12px', fontWeight: 800, marginBottom: '10px' }}>
                {card.icon}
              </div>
              <div style={{ color: '#FFFFFF', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                {card.title}
              </div>
              <div style={{ color: '#CBD5E1', fontSize: '14px', lineHeight: 1.6 }}>{card.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          width: `${FRAME_WIDTH}px`,
          height: `${FRAME_HEIGHT}px`,
          backgroundColor: '#050505',
          borderRadius: '55px',
          border: '14px solid #2C2C2C',
          boxShadow: '0 28px 70px rgba(15, 23, 42, 0.55), 0 0 0 1px rgba(255,255,255,0.05)',
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '130px',
            height: '38px',
            backgroundColor: '#000000',
            borderRadius: '22px',
            zIndex: 10,
          }}
        />

        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#FFFFFF',
            marginTop: '14px',
            marginBottom: '14px',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-start',
          }}
        >
          {children}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '150px',
            height: '6px',
            backgroundColor: '#FFFFFF',
            borderRadius: '4px',
            zIndex: 10,
          }}
        />
      </div>

      <div style={{ width: '340px', flexShrink: 0 }}>
        <h2 style={{ margin: '0 0 20px 0', fontSize: '30px', color: '#F8FAFC', fontWeight: 800 }}>가는길에</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {summaryCards.map((card) => (
            <div
              key={card.title}
              style={{
                borderRadius: '22px',
                border: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                padding: '20px',
              }}
            >
              <div style={{ marginBottom: '10px', color: '#A7F3D0', fontSize: '18px', fontWeight: 700 }}>
                {card.title}
              </div>
              <div style={{ color: '#CBD5E1', fontSize: '14px', lineHeight: 1.7 }}>{card.body}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
