/**
 * Resizes and compresses an image file using Canvas.
 * Returns a Promise that resolves to a base64 Data URL.
 * 
 * @param file The uploaded image File object
 * @param maxWidth Maximum width in pixels
 * @param maxHeight Maximum height in pixels
 * @param quality Compression quality (0 to 1) for JPEG
 */
export function resizeAndCompressImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If we're not running in a browser environment, return early
    if (typeof window === 'undefined' || !window.FileReader) {
      reject(new Error('Browser environment required for image processing'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions keeping the aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // If canvas context is not supported, fall back to the original base64
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Keep transparent formats as PNG (quality parameter ignored),
        // and convert other formats (JPEG, AVIF, BMP etc) to JPEG for efficient compression
        const hasAlpha = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/svg+xml';
        const outputType = hasAlpha ? 'image/png' : 'image/jpeg';

        try {
          const compressedDataUrl = canvas.toDataURL(outputType, hasAlpha ? undefined : quality);
          
          // Fall back to original base64 if the compressed one is somehow larger
          const originalBase64 = event.target?.result as string;
          if (compressedDataUrl.length > originalBase64.length) {
            resolve(originalBase64);
          } else {
            resolve(compressedDataUrl);
          }
        } catch (e) {
          // Fall back to original base64 on error
          resolve(event.target?.result as string);
        }
      };
      
      img.onerror = (err) => {
        reject(err);
      };
      
      img.src = event.target?.result as string;
    };
    
    reader.onerror = (err) => {
      reject(err);
    };
    
    reader.readAsDataURL(file);
  });
}
