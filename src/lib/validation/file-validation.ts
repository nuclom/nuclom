import { Effect } from "effect";
import { ValidationError } from "@/lib/effect/errors";

/**
 * File type magic bytes signatures.
 * These are the first few bytes of different file formats that uniquely identify them.
 */
const FILE_SIGNATURES: Record<string, { signature: number[]; offset?: number; mimeType: string }[]> = {
  // Video formats
  mp4: [
    { signature: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70], mimeType: "video/mp4" },
    { signature: [0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70], mimeType: "video/mp4" },
    { signature: [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], mimeType: "video/mp4" },
    // ftypisom, ftypmp42, etc.
    { signature: [0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], offset: 4, mimeType: "video/mp4" },
    { signature: [0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32], offset: 4, mimeType: "video/mp4" },
    { signature: [0x66, 0x74, 0x79, 0x70, 0x4d, 0x53, 0x4e, 0x56], offset: 4, mimeType: "video/mp4" },
  ],
  mov: [
    { signature: [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74], mimeType: "video/quicktime" },
    { signature: [0x66, 0x74, 0x79, 0x70, 0x71, 0x74], offset: 4, mimeType: "video/quicktime" },
    { signature: [0x6d, 0x6f, 0x6f, 0x76], offset: 4, mimeType: "video/quicktime" },
    { signature: [0x66, 0x72, 0x65, 0x65], offset: 4, mimeType: "video/quicktime" },
    { signature: [0x6d, 0x64, 0x61, 0x74], offset: 4, mimeType: "video/quicktime" },
    { signature: [0x77, 0x69, 0x64, 0x65], offset: 4, mimeType: "video/quicktime" },
  ],
  webm: [{ signature: [0x1a, 0x45, 0xdf, 0xa3], mimeType: "video/webm" }],
  mkv: [{ signature: [0x1a, 0x45, 0xdf, 0xa3], mimeType: "video/x-matroska" }],
  avi: [
    {
      signature: [0x52, 0x49, 0x46, 0x46], // RIFF
      mimeType: "video/x-msvideo",
    },
  ],
  wmv: [{ signature: [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11], mimeType: "video/x-ms-wmv" }],
  flv: [{ signature: [0x46, 0x4c, 0x56, 0x01], mimeType: "video/x-flv" }],
  "3gp": [
    { signature: [0x66, 0x74, 0x79, 0x70, 0x33, 0x67, 0x70], offset: 4, mimeType: "video/3gpp" },
  ],
  m4v: [
    { signature: [0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x56], offset: 4, mimeType: "video/x-m4v" },
  ],

  // Image formats
  jpg: [{ signature: [0xff, 0xd8, 0xff], mimeType: "image/jpeg" }],
  jpeg: [{ signature: [0xff, 0xd8, 0xff], mimeType: "image/jpeg" }],
  png: [{ signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mimeType: "image/png" }],
  gif: [
    { signature: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], mimeType: "image/gif" },
    { signature: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], mimeType: "image/gif" },
  ],
  webp: [{ signature: [0x52, 0x49, 0x46, 0x46], mimeType: "image/webp" }], // Starts with RIFF
  svg: [{ signature: [0x3c, 0x3f, 0x78, 0x6d, 0x6c], mimeType: "image/svg+xml" }], // <?xml
};

/**
 * Supported video formats for upload
 */
export const SUPPORTED_VIDEO_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv", "m4v", "3gp"];

/**
 * Supported image formats for thumbnails
 */
export const SUPPORTED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];

/**
 * Maximum file sizes in bytes
 */
export const MAX_FILE_SIZES = {
  video: 500 * 1024 * 1024, // 500MB
  image: 10 * 1024 * 1024, // 10MB
  thumbnail: 5 * 1024 * 1024, // 5MB
} as const;

/**
 * Gets the file extension from a filename.
 */
export function getFileExtension(filename: string): string {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/**
 * Checks if the file signature matches the expected format.
 * Compares the magic bytes at the beginning of the file.
 */
function checkSignature(buffer: Uint8Array, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Detects the actual file type by examining magic bytes.
 * Returns the detected MIME type or null if unrecognized.
 */
export function detectFileType(buffer: Uint8Array | ArrayBuffer): string | null {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;

  // Check video formats
  for (const [ext, signatures] of Object.entries(FILE_SIGNATURES)) {
    for (const { signature, offset = 0, mimeType } of signatures) {
      if (checkSignature(bytes, signature, offset)) {
        return mimeType;
      }
    }
  }

  return null;
}

/**
 * Validates that a file's actual content matches its claimed extension.
 * This prevents uploading malicious files disguised as videos.
 */
export function validateFileMagicBytes(
  buffer: Uint8Array | ArrayBuffer,
  filename: string,
  allowedExtensions: string[],
): Effect.Effect<string, ValidationError> {
  return Effect.gen(function* () {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
    const extension = getFileExtension(filename);

    // Check if extension is allowed
    if (!allowedExtensions.includes(extension)) {
      return yield* Effect.fail(
        new ValidationError({
          message: `File extension .${extension} is not allowed. Supported: ${allowedExtensions.join(", ")}`,
        }),
      );
    }

    // Get expected signatures for this extension
    const expectedSignatures = FILE_SIGNATURES[extension];
    if (!expectedSignatures) {
      // If we don't have signatures for this extension, just trust the extension
      return extension;
    }

    // Check if any signature matches
    let matched = false;
    for (const { signature, offset = 0 } of expectedSignatures) {
      if (checkSignature(bytes, signature, offset)) {
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Special case for AVI: also check for "AVI " at offset 8
      if (extension === "avi" && bytes.length >= 12) {
        const aviCheck = bytes[8] === 0x41 && bytes[9] === 0x56 && bytes[10] === 0x49 && bytes[11] === 0x20;
        if (checkSignature(bytes, [0x52, 0x49, 0x46, 0x46], 0) && aviCheck) {
          matched = true;
        }
      }

      // Special case for WebP: check for WEBP after RIFF
      if (extension === "webp" && bytes.length >= 12) {
        const webpCheck = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        if (checkSignature(bytes, [0x52, 0x49, 0x46, 0x46], 0) && webpCheck) {
          matched = true;
        }
      }
    }

    if (!matched) {
      return yield* Effect.fail(
        new ValidationError({
          message: `File content does not match .${extension} format. The file may be corrupted or mislabeled.`,
        }),
      );
    }

    return extension;
  });
}

/**
 * Validates a video file (extension, magic bytes, and size).
 */
export function validateVideoFile(
  file: File | { buffer: ArrayBuffer; name: string; size: number },
): Effect.Effect<{ extension: string; mimeType: string }, ValidationError> {
  return Effect.gen(function* () {
    const buffer =
      file instanceof File
        ? new Uint8Array(yield* Effect.tryPromise({
            try: () => file.arrayBuffer(),
            catch: () => new ValidationError({ message: "Failed to read file" }),
          }))
        : new Uint8Array(file.buffer);

    const filename = file instanceof File ? file.name : file.name;
    const size = file instanceof File ? file.size : file.size;

    // Validate file size
    if (size > MAX_FILE_SIZES.video) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Video file size (${(size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size (${MAX_FILE_SIZES.video / (1024 * 1024)}MB)`,
        }),
      );
    }

    // Validate magic bytes
    const extension = yield* validateFileMagicBytes(buffer, filename, SUPPORTED_VIDEO_EXTENSIONS);

    // Get MIME type
    const detectedMimeType = detectFileType(buffer);
    const mimeType = detectedMimeType || `video/${extension}`;

    return { extension, mimeType };
  });
}

/**
 * Validates an image file (extension, magic bytes, and size).
 */
export function validateImageFile(
  file: File | { buffer: ArrayBuffer; name: string; size: number },
  maxSize = MAX_FILE_SIZES.image,
): Effect.Effect<{ extension: string; mimeType: string }, ValidationError> {
  return Effect.gen(function* () {
    const buffer =
      file instanceof File
        ? new Uint8Array(yield* Effect.tryPromise({
            try: () => file.arrayBuffer(),
            catch: () => new ValidationError({ message: "Failed to read file" }),
          }))
        : new Uint8Array(file.buffer);

    const filename = file instanceof File ? file.name : file.name;
    const size = file instanceof File ? file.size : file.size;

    // Validate file size
    if (size > maxSize) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Image file size (${(size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum allowed size (${maxSize / (1024 * 1024)}MB)`,
        }),
      );
    }

    // Validate magic bytes
    const extension = yield* validateFileMagicBytes(buffer, filename, SUPPORTED_IMAGE_EXTENSIONS);

    // Get MIME type
    const detectedMimeType = detectFileType(buffer);
    const mimeType = detectedMimeType || `image/${extension}`;

    return { extension, mimeType };
  });
}

/**
 * Quick check if a filename has a supported video extension.
 * Use this for initial filtering before full validation.
 */
export function isSupportedVideoExtension(filename: string): boolean {
  const ext = getFileExtension(filename);
  return SUPPORTED_VIDEO_EXTENSIONS.includes(ext);
}

/**
 * Quick check if a filename has a supported image extension.
 * Use this for initial filtering before full validation.
 */
export function isSupportedImageExtension(filename: string): boolean {
  const ext = getFileExtension(filename);
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
}
