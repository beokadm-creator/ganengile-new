/**
 * Image Optimization Utilities
 * 이미지 최적화를 위한 유틸리티 함수
 */

import React from 'react';
import { Image } from 'expo-image';

interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number; // 0-100
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * 이미지 최적화 옵션 생성 (expo-image 호환)
 */
export const createImageOptions = (
  source: any,
  options: ImageOptimizationOptions = {}
): any => {
  // expo-image는 uri를 그대로 받으면 자동으로 최적화 캐싱 처리합니다.
  if (typeof source === 'string') {
    return { uri: source };
  }
  return source;
};

/**
 * 반응형 이미지 소스 반환
 */
export const getResponsiveImageSource = (
  baseUri: string,
  screenSize: 'small' | 'medium' | 'large'
): string => {
  const sizeMap = {
    small: '_300x300',
    medium: '_600x600',
    large: '_1200x1200'
  };

  const sizeSuffix = sizeMap[screenSize] || sizeMap.medium;

  // expo-image는 대부분 webp를 기본 지원하므로 안심하고 사용
  return baseUri.replace(/\.(jpg|png|jpeg)$/i, `${sizeSuffix}.webp`);
};

/**
 * 블러 이미지 생성 (로딩 중 플레이스홀더)
 */
export const createBlurImage = (uri: string): any => {
  return { uri };
};

/**
 * 이미지 프리로딩
 */
export const preloadImages = (imageUris: string[]): void => {
  Image.prefetch(imageUris);
};

/**
 * CDN 최적화 URL 생성
 */
export const createOptimizedImageUrl = (
  baseUrl: string,
  options: {
    width?: number;
    quality?: number;
    format?: string;
  } = {}
): string => {
  const { width = 600, quality = 80, format = 'webp' } = options;

  // Firebase Storage 최적화 파라미터
  const params = new URLSearchParams({
    alt: 'media',
    width: width.toString(),
    quality: quality.toString(),
    ...(format && { fmt: format })
  });

  return `${baseUrl}?${params.toString()}`;
};

/**
 * 로고 이미지 최적화 상수
 */
export const LOGO_SIZES = {
  small: 32,
  medium: 64,
  large: 128,
  xlarge: 256
} as const;

/**
 * 아이콘 이미지 최적화 상수
 */
export const ICON_SIZES = {
  xsmall: 16,
  small: 24,
  medium: 32,
  large: 48,
  xlarge: 64
} as const;

/**
 * Lazy loading 이미지 컴포넌트 (expo-image로 교체)
 */
export const LazyImage: React.FC<{
  source: { uri: string } | string;
  style?: any;
  onLoad?: () => void;
  contentFit?: 'cover' | 'contain' | 'fill';
}> = ({ source, style, onLoad, contentFit = 'cover' }) => {
  return (
    <Image
      source={createImageOptions(source)}
      style={style}
      contentFit={contentFit}
      transition={200}
      onLoad={() => onLoad?.()}
      cachePolicy="disk"
    />
  );
};
