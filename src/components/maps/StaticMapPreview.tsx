import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getStaticMapProxyUrl, isMapEnabled } from '../../config/map-config';
import { Image } from 'expo-image';
import { Typography } from '../../theme';

export type StaticMapMarker = {
  latitude: number;
  longitude: number;
  label?: string;
};

interface StaticMapPreviewProps {
  center: { latitude: number; longitude: number };
  markers?: StaticMapMarker[];
  path?: StaticMapMarker[];
  width?: number;
  height?: number;
  zoom?: number;
  title?: string;
  subtitle?: string;
}

function buildMarkerParam(markers: StaticMapMarker[]): string {
  return markers
    .map((marker, index) => {
      const normalized =
        (marker.label ?? `${index + 1}`)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 1) || `${(index + 1) % 10}`;
      return `type:d|size:mid|color:Default|label:${normalized}|pos:${marker.longitude} ${marker.latitude}`;
    })
    .join('|');
}

function buildPathString(path: StaticMapMarker[]): string {
  if (!path || path.length < 2) return '';
  const coords = path.map((p) => `${p.longitude} ${p.latitude}`).join(',');
  return `color:0x0F766E|weight:5|opacity:0.85|path:${coords}`;
}

export default function StaticMapPreview({
  center,
  markers = [],
  path = [],
  width = 640,
  height = 320,
  zoom = 14,
  title = '배송 구간 지도',
  subtitle = '출발역과 도착역 위치를 기준으로 구간을 요약해서 보여줍니다.',
}: StaticMapPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const uri = useMemo(() => {
    if (!isMapEnabled()) {
      return '';
    }

    const baseUrl = getStaticMapProxyUrl();
    if (!baseUrl) {
      return '';
    }

    const query = new URLSearchParams({
      center: `${center.longitude},${center.latitude}`,
      level: String(zoom),
      w: String(width),
      h: String(height),
      scale: '2',
    });

    if (markers.length > 0) {
      query.set('markers', buildMarkerParam(markers));
    }

    if (path.length > 1) {
      const pathParam = path.map((p) => `${p.longitude} ${p.latitude}`).join('|');
      query.set('path', `color:0x0F766Eff|weight:5|path:${pathParam}`);
    }

    return `${baseUrl}?${query.toString()}`;
  }, [center.latitude, center.longitude, height, markers, path, width, zoom]);

  useEffect(() => {
    if (!uri) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadFailed(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setLoadFailed(true);
    }, 12000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [uri]);

  if (!uri || loadFailed) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>
          {!uri
            ? '지도 기능 또는 프록시 URL이 아직 설정되지 않았습니다.'
            : '지도를 불러오지 못했습니다. 지도 프록시 설정과 네트워크 상태를 확인해 주세요.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <Image
        key={uri}
        source={{ uri }}
        style={[styles.image, height ? { height } : undefined]}
        resizeMode="cover"
        accessibilityLabel={title}
        onLoadStart={() => {
          setLoading(true);
          setLoadFailed(false);
        }}
        onLoadEnd={() => {
          setLoading(false);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        }}
        onError={() => {
          setLoading(false);
          setLoadFailed(true);
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        }}
      />
      <View style={styles.badge}>
        {loading ? <ActivityIndicator size="small" color="#0F766E" /> : null}
        <Text style={styles.badgeText}>{loading ? '지도를 불러오는 중' : 'Naver Static Map'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  copy: {
    gap: 4,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    color: '#0F172A',
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
  },
  subtitle: {
    color: '#64748B',
    fontSize: Typography.fontSize.sm,
    lineHeight: 18,
  },
  image: {
    backgroundColor: '#E2E8F0',
    height: 220,
    marginTop: 12,
    width: '100%',
  },
  badge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  badgeText: {
    color: '#0F766E',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 8,
    padding: 20,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.extrabold,
  },
  emptyBody: {
    color: '#64748B',
    fontSize: Typography.fontSize.base,
    lineHeight: 20,
  },
});
