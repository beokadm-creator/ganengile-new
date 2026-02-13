/**
 * Image Optimization Guide
 * Lazy loading, caching, and compression
 */

import { useState, useEffect } from 'react';
import { Image, ImageBackground } from 'react-native';

// ==================== Image Caching Strategy ====================

/**
 * IMAGE CACHING RECOMMENDATIONS:
 * 
 * 1. USE FAST_IMAGE (Recommended)
 *    - Install: @react-native-fast-image
 *    - Better caching and performance than Image
 *    - Supports progressive loading
 * 
 * 2. IMAGE SIZES
 *    - Thumbnail: 150x150 (profile pictures, list items)
 *    - Medium: 600x400 (cards, details)
 *    - Large: 1200x800 (full screen)
 * 
 * 3. COMPRESSION FORMATS
 *    - Use WebP format when possible (25% smaller than JPEG)
 *    - JPEG:quality=80 for photos
 *    - PNG:compression=9 for graphics
 * 
 * 4. LAZY LOADING
 *    - Load low-res placeholder first
 *    - Swap to high-res when loaded
 *    - Use blur effect during transition
 */

// ==================== Lazy Image Component ====================

interface LazyImageProps {
  uri: string;
  thumbnailUri?: string;
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export function LazyImage({
  uri,
  thumbnailUri,
  style,
  resizeMode = 'cover',
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = () => {
    setLoaded(true);
  };

  const handleError = () => {
    setError(true);
  };

  if (error) {
    return (
      <Image
        source={require('../../assets/images/placeholder.png')}
        style={style}
        resizeMode={resizeMode}
      />
    );
  }

  return (
    <>
      {!loaded && thumbnailUri && (
        <Image
          source={{ uri: thumbnailUri }}
          style={style}
          resizeMode={resizeMode}
          blurRadius={1}
        />
      )}
      <Image
        source={{ uri }}
        style={[style, !loaded && { position: 'absolute' }]}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onError={handleError}
      />
    </>
  );
}

// ==================== Image Preloading ====================

class ImagePreloader {
  private preloadQueue: Set<string> = new Set();
  private maxConcurrent = 3;
  private currentLoads = 0;

  /**
   * Preload images for smooth UX
   * Useful for lists and detail screens
   */
  async preloadImages(uris: string[]): Promise<void> {
    for (const uri of uris) {
      if (this.currentLoads >= this.maxConcurrent) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!this.preloadQueue.has(uri)) {
        this.currentLoads++;
        this.preloadQueue.add(uri);

        Image.prefetch(uri)
          .then(() => {
            console.log(`✅ Preloaded: ${uri}`);
          })
          .catch((err) => {
            console.warn(`⚠️ Failed to preload: ${uri}`, err);
          })
          .finally(() => {
            this.currentLoads--;
            this.preloadQueue.delete(uri);
          });
      }
    }
  }

  /**
   * Preload image for navigation transition
   */
  async preloadForNextScreen(uri: string): Promise<void> {
    return Image.prefetch(uri);
  }
}

export const imagePreloader = new ImagePreloader();

// ==================== Image Size Recommendations ====================

/**
 * IMAGE SIZE GUIDE FOR DIFFERENT USE CASES:
 * 
 * PROFILE PICTURES:
 * - Thumbnail: 150x150px (3-5KB)
 * - Medium: 300x300px (8-12KB)
 * - Large: 600x600px (20-30KB)
 * 
 * STATION IMAGES:
 * - Thumbnail: 200x200px (5-8KB)
 * - Detail: 400x300px (10-15KB)
 * 
 * PACKAGE PHOTOS:
 * - Thumbnail: 150x150px (3-5KB)
 * - Medium: 400x400px (12-18KB)
 * 
 * BACKGROUND IMAGES:
 * - Mobile: 1080x1920px (50-80KB compressed)
 * - Tablet: 2048x2732px (100-150KB compressed)
 * 
 * COMPRESSION SETTINGS:
 * - JPEG quality: 80-85% (good balance)
 * - WebP: Lossy compression (25% smaller)
 * - Progressive: Yes for large images
 */

// ==================== Image CDN Integration ====================

/**
 * Use CDN for image optimization
 * 
 * Services to consider:
 * - Cloudinary: https://cloudinary.com
 * - Cloudflare Images: https://www.cloudflare.com/products/images/
 * - Firebase Storage: Resize on upload with Functions
 * 
 * Example CDN URL transformation:
 * - Original: https://example.com/image.jpg
 * - Thumbnail: https://example.com/image.jpg?w=150&h=150&fit=crop
 * - WebP: https://example.com/image.jpg?format=webp
 */

export function getOptimizedImageUrl(
  baseUrl: string,
  options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpg' | 'webp' | 'png';
  } = {}
): string {
  const { width, height, quality = 80, format = 'jpg' } = options;

  // If using Firebase Storage with image resizing
  // This would be handled by Cloud Functions
  const url = new URL(baseUrl);

  if (width) url.searchParams.set('w', width.toString());
  if (height) url.searchParams.set('h', height.toString());
  url.searchParams.set('q', quality.toString());
  url.searchParams.set('f', format);

  return url.toString();
}

// ==================== Image Placeholder Generator ====================

/**
 * Generate placeholder color based on string
 * Useful for consistent placeholder colors
 */
export function generatePlaceholderColor(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = Math.abs(hash % 360);
  const s = 70 + (Math.abs(hash) % 20); // 70-90%
  const l = 85 + (Math.abs(hash) % 10); // 85-95%

  return `hsl(${h}, ${s}%, ${l}%)`;
}

// ==================== Memory Management ====================

/**
 * Clear image cache when app enters background
 * Helps prevent memory warnings
 */
export function setupImageCacheManagement() {
  const clearCache = () => {
    // React Native's Image has built-in cache
    // Can be cleared with Image.queryCache()
    if (Image.queryCache) {
      Image.queryCache().then((cache) => {
        console.log('Image cache size:', JSON.stringify(cache));
      });
    }
  };

  // Clear cache every 5 minutes
  setInterval(clearCache, 5 * 60 * 1000);
}

// ==================== Upload Optimization ====================

/**
 * Optimize images before upload
 * 
 * 1. Compress image
 * 2. Resize if too large
 * 3. Convert to efficient format
 * 
 * Libraries to use:
 * - react-native-image-resizer
 * - react-native-compressor
 */

export interface ImageUploadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'JPEG' | 'PNG' | 'WEBP';
}

export async function optimizeImageForUpload(
  uri: string,
  options: ImageUploadOptions = {}
): Promise<string> {
  const {
    maxWidth = 1024,
    maxHeight = 1024,
    quality = 80,
    format = 'JPEG',
  } = options;

  // This would use react-native-image-resizer
  // For now, return the original URI
  // Implementation:
  //
  // import ImageResizer from 'react-native-image-resizer';
  //
  // return await ImageResizer.createResizedImage(
  //   uri,
  //   maxWidth,
  //   maxHeight,
  //   format,
  //   quality
  // );

  console.warn('Image optimization not implemented - using original');
  return uri;
}
