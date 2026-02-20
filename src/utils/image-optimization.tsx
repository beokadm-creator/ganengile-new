/**
 * Image Optimization Utilities
 * 이미지 최적화를 위한 유틸리티 함수
 */

import { Image } from 'react-native';

interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number; // 0-100
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * 이미지 최적화 옵션 생성
 */
export const createImageOptions = (
  source: any,
  options: ImageOptimizationOptions = {}
): any => {
  const {
    width = 300,
    height = 300,
    quality = 80,
    format = 'webp'
  } = options;

  return {
    uri: source,
    width,
    height,
    // React Native의 cache 설정
    cache: 'force-cache',
    // WebP 형식 지원 시 사용
    ...(format === 'webp' && { mimeType: 'image/webp' })
  };
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

  // WebP 형식 지원 시 우선 사용
  if (supportsWebP()) {
    return baseUri.replace(/\.(jpg|png)$/i, `${sizeSuffix}.webp`);
  }

  return baseUri.replace(/\.\w+$/i, `${sizeSuffix}.jpg`);
};

/**
 * WebP 지원 여부 확인
 */
const supportsWebP = (): boolean => {
  // React Native Web 환경에서만 작동
  if (typeof document === 'undefined') return false;

  const canvas = document.createElement('canvas');
  if (canvas?.getContext?.('2d')) {
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
};

/**
 * 블러 이미지 생성 (로딩 중 플레이스홀더)
 */
export const createBlurImage = (uri: string, blurAmount: number = 10): any => {
  return {
    uri,
    // React Native에서는 블러 효과 적용 필요
    // iOS: CIFilter
    // Android: RenderScript blur
  };
};

/**
 * 이미지 프리로딩
 */
export const preloadImages = (imageUris: string[]): void => {
  if (typeof Image === 'undefined') return;

  imageUris.forEach(uri => {
    Image.prefetch(uri);
  });
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
 * Lazy loading 이미지 컴포넌트
 */
export const LazyImage: React.FC<{
  source: any;
  style?: any;
  onLoad?: () => void;
}> = ({ source, style, onLoad }) => {
  const [isLoaded, setIsLoaded] = React.useState(false);

  React.useEffect(() => {
    // 이미지 미리 로딩
    if (source?.uri) {
      Image.prefetch(source.uri);
    }
  }, [source]);

  return (
    <Image
      source={createImageOptions(source)}
      style={[style, !isLoaded && { opacity: 0 }]}
      onLoad={() => {
        setIsLoaded(true);
        onLoad?.();
      }}
    />
  );
};
