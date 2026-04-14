import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { mapConfig } from '../../config/map-config';
import { Typography } from '../../theme/typography';

export type InteractiveMapMarker = {
  latitude: number;
  longitude: number;
  label?: string;
};

interface InteractiveNaverMapProps {
  center: InteractiveMapMarker;
  markers?: InteractiveMapMarker[];
  path?: InteractiveMapMarker[];
  height?: number;
  zoom?: number;
}

export function InteractiveNaverMap({
  center,
  markers = [],
  path = [],
  height = 320,
  zoom = 14,
}: InteractiveNaverMapProps) {
  const webViewRef = useRef<WebView>(null);
  const clientId = mapConfig.webClientId || mapConfig.publicClientId; // Use web ID if available, fallback to public

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
        #map { width: 100%; height: 100%; }
        .custom-marker {
          background-color: #0F766E;
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-weight: bold;
          font-size: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          border: 2px solid white;
        }
      </style>
      <script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}"></script>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map;
        var mapMarkers = [];
        var polyline;

        function initMap() {
          if (!window.naver || !window.naver.maps) return;
          
          map = new naver.maps.Map('map', {
            center: new naver.maps.LatLng(${center.latitude}, ${center.longitude}),
            zoom: ${zoom},
            scaleControl: false,
            logoControl: false,
            mapDataControl: false,
            zoomControl: true,
            minZoom: 6,
          });

          updateMapData(${JSON.stringify({ center, markers, path, zoom })});
        }

        function updateMapData(data) {
          if (!map) return;

          // Update center and zoom
          map.morph(new naver.maps.LatLng(data.center.latitude, data.center.longitude), data.zoom);

          // Clear existing markers
          for (var i = 0; i < mapMarkers.length; i++) {
            mapMarkers[i].setMap(null);
          }
          mapMarkers = [];

          // Add new markers
          if (data.markers && data.markers.length > 0) {
            data.markers.forEach(function(m) {
              var marker = new naver.maps.Marker({
                position: new naver.maps.LatLng(m.latitude, m.longitude),
                map: map,
                icon: {
                  content: '<div class="custom-marker">' + (m.label || '') + '</div>',
                  anchor: new naver.maps.Point(12, 12)
                }
              });
              mapMarkers.push(marker);
            });
          }

          // Update polyline
          if (polyline) {
            polyline.setMap(null);
          }

          if (data.path && data.path.length > 1) {
            var pathCoords = data.path.map(function(p) {
              return new naver.maps.LatLng(p.latitude, p.longitude);
            });
            
            polyline = new naver.maps.Polyline({
              map: map,
              path: pathCoords,
              strokeColor: '#3182F6', // Toss Blue
              strokeWeight: 5,
              strokeOpacity: 0.8,
              strokeLineJoin: 'round'
            });
          }
        }

        // Listen for messages from React Native
        document.addEventListener('message', function(e) {
          try {
            var data = JSON.parse(e.data);
            updateMapData(data);
          } catch(err) {}
        });
        window.addEventListener('message', function(e) {
          try {
            var data = JSON.parse(e.data);
            updateMapData(data);
          } catch(err) {}
        });

        window.onload = initMap;
      </script>
    </body>
    </html>
  `;

  // Inject new data when props change without reloading WebView
  useEffect(() => {
    if (webViewRef.current) {
      const data = JSON.stringify({ center, markers, path, zoom });
      webViewRef.current.injectJavaScript(`
        try {
          updateMapData(${data});
        } catch(e) {}
        true;
      `);
    }
  }, [center.latitude, center.longitude, markers, path, zoom]);

  if (!clientId) {
    return (
      <View style={[styles.fallbackContainer, { height }]}>
        <Text style={styles.fallbackText}>지도 API 키가 설정되지 않았습니다.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent, baseUrl: 'https://oapi.map.naver.com' }}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#3182F6" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  fallbackContainer: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fallbackText: {
    color: '#64748B',
    fontSize: Typography.fontSize.base,
  }
});