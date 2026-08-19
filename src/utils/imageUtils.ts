/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resizes a base64 image data URL to a max width while maintaining aspect ratio
 * and compressing it as a JPEG to keep file sizes very small for Firestore.
 */
export function resizeBase64Image(base64Str: string, maxWidth: number = 600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(base64Str);
          return;
        }

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7); // 0.7 quality factor is excellent for visual clarity + small file size (20-40kb)
        resolve(compressedBase64);
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (err) => {
      reject(err);
    };
  });
}
