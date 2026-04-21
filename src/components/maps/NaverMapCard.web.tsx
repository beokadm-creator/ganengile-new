/* eslint-disable @typescript-eslint/no-unsafe-return */
import { createElement, useEffect, useId, useMemo, useState, useRef } from 'react';
import type { CSSProperties, ReactElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { canUseDynamicWebMap, getNaverWebSdkUrl } from '../../config/map-config';
import StaticMapPreview from './StaticMapPreview';
import { Typography } from '../../theme/typography';

type Marker = {
  latitude: number;
  longitude: number;
  label?: string;
};

declare global {
  interface Window {
    naver?: {
      maps?: {
        LatLng: new (lat: number, lng: number) => unknown;
        Map: new (element: HTMLElement, options: { center: unknown; zoom: number }) => { destroy: () => void };
        Marker: new (options: { position: unknown; map: unknown; title?: string }) => unknown;
        Polyline: new (options: { map: unknown; path: unknown[]; strokeColor?: string; strokeWeight?: number; strokeOpacity?: number }) => unknown;
        Event: { addListener: (target: unknown, eventName: string, callback: () => void) => void };
      };
    };
  }
}

interface NaverMapCardProps {
  title?: string;
  subtitle?: string;
  center: Marker;
  markers: Marker[];
  path?: Marker[];
  height?: number;
  onMarkerSelect?: (index: number) => void;
}

function buildWebMapStyle(height: number): CSSProperties {
  return {
    marginTop: 12,
    width: '100%',
    height,
    borderRadius: 20,
    overflow: 'hidden',
    background: '#e2e8f0',
  };
}

function ensureNaverMapScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-naver-map-sdk="true"]');
    if (existing) {
      if (window.naver?.maps) {
        resolve();
        return;
      }

      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('failed to load naver map sdk')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.dataset.naverMapSdk = 'true';
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error('failed to load naver map sdk')), { once: true });
    document.head.appendChild(script);
  });
}

export function NaverMapCard({
  title,
  subtitle,
  center,
  markers,
  path = [],
  height = 240,
  onMarkerSelect,
}: NaverMapCardProps): ReactElement {
  const mapId = useId().replace(/:/g, '_');
  const [dynamicReady, setDynamicReady] = useState(false);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);

  useEffect(() => {
    if (!canUseDynamicWebMap()) {
      return;
    }

    const sdkUrl = getNaverWebSdkUrl();
    if (!sdkUrl) {
      return;
    }

    let cancelled = false;

    void ensureNaverMapScript(sdkUrl)
      .then(() => {
        if (cancelled) return;
        const mapApi = window.naver?.maps;
        const target = document.getElementById(mapId);
        if (!mapApi || !target) return;

        mapInstanceRef.current = new mapApi.Map(target, {
          center: new mapApi.LatLng(center.latitude, center.longitude),
          zoom: 13,
        });

        setDynamicReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setDynamicReady(false);
        }
      });

    return () => {
      cancelled = true;
      try {
        if (mapInstanceRef.current && typeof mapInstanceRef.current.destroy === 'function') {
          mapInstanceRef.current.destroy();
          mapInstanceRef.current = null;
        }
      } catch (e) {
        console.warn('Error during Naver Map cleanup:', e);
      }
    };
  }, [mapId]); // Only create map once

  useEffect(() => {
    if (!dynamicReady || !mapInstanceRef.current) return;
    const mapApi = window.naver?.maps;
    if (!mapApi) return;

    // Update center
    mapInstanceRef.current.setCenter(new mapApi.LatLng(center.latitude, center.longitude));
  }, [center.latitude, center.longitude, dynamicReady]);

  useEffect(() => {
    if (!dynamicReady || !mapInstanceRef.current) return;
    const mapApi = window.naver?.maps;
    if (!mapApi) return;

    // Clear old overlays
    overlaysRef.current.forEach((overlay: any) => {
      if (overlay && typeof overlay.setMap === 'function') {
        overlay.setMap(null);
      }
    });
    overlaysRef.current = [];

    markers.forEach((marker, index) => {
      const m = new mapApi.Marker({
        position: new mapApi.LatLng(marker.latitude, marker.longitude),
        map: mapInstanceRef.current,
        title: marker.label,
      });

      if (onMarkerSelect && window.naver?.maps?.Event?.addListener) {
        window.naver.maps.Event.addListener(m, 'click', () => {
          onMarkerSelect(index);
        });
      }

      overlaysRef.current.push(m);
    });

    if (path.length > 1) {
      const p = new mapApi.Polyline({
        map: mapInstanceRef.current,
        path: path.map((point) => new mapApi.LatLng(point.latitude, point.longitude)),
        strokeColor: '#0F766E',
        strokeWeight: 5,
        strokeOpacity: 0.85,
      });
      overlaysRef.current.push(p);
    }
  }, [markers, path, dynamicReady, onMarkerSelect]);

  const markerSummary = useMemo(
    () =>
      markers.map((marker) => ({
        latitude: marker.latitude,
        longitude: marker.longitude,
        label: marker.label,
      })),
    [markers],
  );

  if (canUseDynamicWebMap()) {
    return (
      <View style={styles.wrapper}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {createElement('div', { id: mapId, style: buildWebMapStyle(height) })}
        {!dynamicReady ? (
          <View style={styles.fallbackWrap}>
            <View style={[styles.loadingPlaceholder, { height }]}>
              <Text style={styles.loadingText}>지도를 불러오는 중</Text>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <StaticMapPreview
      title={title}
      subtitle={subtitle}
      center={center}
      markers={markerSummary}
      path={path}
      height={height}
    />
  );
}

export default NaverMapCard;

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
    color: '#0f172a',
  },
  subtitle: {
    marginTop: 4,
    fontSize: Typography.fontSize.sm,
    color: '#64748b',
  },
  fallbackWrap: {
    marginTop: 12,
  },
  loadingPlaceholder: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  loadingText: {
    color: '#64748b',
    fontSize: Typography.fontSize.sm,
  },
});
