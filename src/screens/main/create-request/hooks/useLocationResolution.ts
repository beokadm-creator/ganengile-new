import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { locationService } from '../../../../services/location-service';
import { geocodeRoadAddress } from '../../../../services/address-geocode-service';
import type { Station } from '../../../../types/config';
import type { PickerType, NearbyPickerState, NearbyStationRecommendation } from '../types';

export function useLocationResolution(stations: Station[]) {
  const [resolvingLocation, setResolvingLocation] = useState<PickerType | null>(null);
  const [resolvingAddressStation, setResolvingAddressStation] = useState<PickerType | null>(null);
  const [nearbyPicker, setNearbyPicker] = useState<NearbyPickerState | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState<PickerType>('pickup');

  const buildNearbyRecommendations = useCallback((latitude: number, longitude: number): NearbyStationRecommendation[] => {
    // 1. 역(Station) 단위로 거리 계산 및 정렬 (환승역 중복 방지)
    const candidates = stations.map((s) => ({
      station: s,
      name: s.stationName,
      line: s.lines[0]?.lineId ?? '', // Required by StationLocation
      latitude: s.location.latitude,
      longitude: s.location.longitude,
    }));

    return locationService
      .findNearestStations(
        {
          latitude,
          longitude,
          accuracy: 0,
          altitude: null,
          speed: null,
          heading: null,
        },
        candidates,
        4
      )
      .map((item) => ({
        station: item.station.station,
        distanceMeters: item.distanceMeters,
      }));
  }, [stations]);

  const handleUseCurrentLocation = async (target: PickerType) => {
    try {
      setResolvingLocation(target);
      const currentLocation = await locationService.getCurrentLocation();
      if (!currentLocation) {
        Alert.alert('위치 권한이 필요합니다', '기기의 위치 권한을 허용한 뒤 다시 시도해 주세요.');
        return;
      }

      const recommendations = buildNearbyRecommendations(
        currentLocation.latitude,
        currentLocation.longitude
      );

      if (recommendations.length === 0) {
        Alert.alert('가까운 역을 찾지 못했습니다', '잠시 후 다시 시도해 주세요.');
        return;
      }

      setNearbyPicker({
        target,
        title: target === 'pickup' ? '출발역을 선택해 주세요' : '도착역을 선택해 주세요',
        description: '현재 위치 기준으로 가까운 역 4곳을 추천해 드립니다.',
        recommendations,
      });
    } catch (error) {
      console.error('Failed to resolve nearest station', error);
      Alert.alert('위치 기반 추천 실패', '현재 위치를 확인한 뒤 다시 시도해 주세요.');
    } finally {
      setResolvingLocation(null);
    }
  };

  const handleRecommendStationFromAddress = async (target: PickerType, roadAddress: string) => {
    const trimmedAddress = roadAddress.trim();
    if (!trimmedAddress) {
      Alert.alert('도로명 주소가 필요합니다', '주소를 먼저 선택한 뒤 다시 시도해 주세요.');
      return;
    }

    try {
      setResolvingAddressStation(target);
      const geocoded = await geocodeRoadAddress(trimmedAddress);
      if (!geocoded) {
        Alert.alert(
          '주소 좌표를 찾지 못했습니다',
          '이 주소 주변 역을 바로 찾지 못했어요. 다른 주소를 선택하거나 직접 노선을 골라 주세요.'
        );

        setPickerType(target);
        setPickerVisible(true);
        return;
      }

      const recommendations = buildNearbyRecommendations(geocoded.latitude, geocoded.longitude);
      if (recommendations.length === 0) {
        Alert.alert(
          '주변 역 추천이 없습니다',
          '직접 노선을 선택할 수 있도록 역 선택 화면을 열어 드릴게요.'
        );

        setPickerType(target);
        setPickerVisible(true);
        return;
      }

      setNearbyPicker({
        target,
        title: target === 'pickup' ? '출발역을 선택해 주세요' : '도착역을 선택해 주세요',
        description: '입력한 도로명 주소 기준으로 가까운 역을 추천해 드립니다.',
        recommendations,
      });
    } catch (error) {
      console.error('Failed to resolve nearest station from address', error);
      Alert.alert(
        '주소 기반 역 추천 실패',
        error instanceof Error ? error.message : '잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setResolvingAddressStation(null);
    }
  };

  return {
    resolvingLocation,
    resolvingAddressStation,
    nearbyPicker,
    setNearbyPicker,
    pickerVisible,
    setPickerVisible,
    pickerType,
    setPickerType,
    handleUseCurrentLocation,
    handleRecommendStationFromAddress,
  };
}
