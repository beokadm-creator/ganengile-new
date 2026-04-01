import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { getStaticMapProxyUrl, isMapEnabled } from '../../config/map-config';

export type StaticMapMarker = {
  latitude: number;
  longitude: number;
  label?: string;
};

interface StaticMapPreviewProps {
  center: { latitude: number; longitude: number };
  markers?: StaticMapMarker[];
  width?: number;
  height?: number;
  zoom?: number;
  title?: string;
  subtitle?: string;
}

function buildMarkerParam(markers: StaticMapMarker[]): string {
  return markers
    .map((marker, index) => {
      const normalized = (marker.label ?? `${index + 1}`).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1) || `${(index + 1) % 10}`;
      return `type:d|size:mid|color:Default|label:${normalized}|pos:${marker.longitude} ${marker.latitude}`;
    })
    .join('|');
}

export default function StaticMapPreview({
  center,
  markers = [],
  width = 640,
  height = 320,
  zoom = 14,
  title = '?? ????',
  subtitle = '??? ?? ??? ???? ????.',
}: StaticMapPreviewProps) {
  const [loadFailed, setLoadFailed] = useState(false);
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

    return `${baseUrl}?${query.toString()}`;
  }, [center.latitude, center.longitude, height, markers, width, zoom]);

  if (!uri || loadFailed) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyBody}>
          {!uri
            ? '지도 기능 또는 프록시 URL이 아직 설정되지 않았습니다.'
            : '지도 이미지를 불러오지 못했습니다. 지도 인증 정보 또는 프록시 설정을 확인해 주세요.'}
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
        source={{ uri }}
        style={styles.image}
        resizeMode="cover"
        accessibilityLabel={title}
        onError={() => setLoadFailed(true)}
      />
      <View style={styles.badge}>
        <ActivityIndicator size="small" color="#0F766E" />
        <Text style={styles.badgeText}>Naver Static Map</Text>
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
    fontSize: 17,
    fontWeight: '800',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
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
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    gap: 8,
    padding: 20,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 17,
    fontWeight: '800',
  },
  emptyBody: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
});
