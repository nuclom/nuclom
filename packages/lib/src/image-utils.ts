/**
 * Image Optimization Utilities
 *
 * Provides utilities for optimizing images including:
 * - Blur placeholder generation
 * - Responsive image sizes configuration
 * - Common image configurations
 */

/**
 * Default blur data URL for placeholder images
 * A tiny 1x1 transparent pixel encoded as base64
 */
export const PLACEHOLDER_BLUR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88PDxfwYAB3YD/k9mfQQAAAAASUVORK5CYII=';

/**
 * Default blur data URL for video thumbnails
 * A subtle gray placeholder that works well for video content
 */
export const VIDEO_THUMBNAIL_BLUR_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAYAAAD68A/GAAAAN0lEQVQYV2N0cXH5z8DAwMBILmBiIE5DsmYGRkZGBoZWYGEGBlQZRkYGBgZGBgYGRmJsQrcGAGdeCkfMpPdmAAAAAElFTkSuQmCC';

/**
 * Responsive sizes configuration for different image contexts
 */
export const IMAGE_SIZES = {
  /**
   * Video card thumbnails in grid layouts
   * Optimized for 1-4 columns responsive grid
   */
  videoCard: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw',

  /**
   * Collection card thumbnails in grid layouts
   */
  collectionCard: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',

  /**
   * Small thumbnails in lists (e.g., video picker, sortable list)
   */
  thumbnail: '(max-width: 640px) 80px, 112px',

  /**
   * Avatar images
   */
  avatar: '36px',

  /**
   * Hero/featured images
   */
  hero: '100vw',
} as const;

/**
 * Props interface for optimized thumbnail images
 */
export interface OptimizedImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
  className?: string;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
}

/**
 * Default props for video thumbnails
 */
export const getVideoThumbnailProps = (
  src: string | null | undefined,
  alt: string,
  options?: {
    priority?: boolean;
    sizes?: string;
  },
): OptimizedImageProps => ({
  src: src || '/placeholder.svg',
  alt,
  fill: true,
  sizes: options?.sizes || IMAGE_SIZES.videoCard,
  priority: options?.priority || false,
  placeholder: 'blur' as const,
  blurDataURL: VIDEO_THUMBNAIL_BLUR_DATA_URL,
});

/**
 * Default props for collection thumbnails
 */
export const getCollectionThumbnailProps = (
  src: string | null | undefined,
  alt: string,
  options?: {
    priority?: boolean;
    sizes?: string;
  },
): OptimizedImageProps => ({
  src: src || '/placeholder.svg',
  alt,
  fill: true,
  sizes: options?.sizes || IMAGE_SIZES.collectionCard,
  priority: options?.priority || false,
  placeholder: 'blur' as const,
  blurDataURL: VIDEO_THUMBNAIL_BLUR_DATA_URL,
});
