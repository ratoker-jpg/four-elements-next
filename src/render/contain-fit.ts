/**
 * Contain-fit helper: compute draw dimensions that preserve a source image's
 * natural aspect ratio within a maximum bounding box.
 *
 * Used by building, environment, and spritesheet render paths so that source
 * content is not stretched to fill a non-square profile.size bounding box.
 *
 * Spritesheet frames pass FRAME_SIZE × FRAME_SIZE (256×256) as natural
 * dimensions, ensuring the square source frame is contained properly even
 * if profile.size becomes non-square.
 */

export interface ContainFitResult {
  /** Draw width in pixels (after aspect-ratio preservation). */
  drawWidth: number;
  /** Draw height in pixels (after aspect-ratio preservation). */
  drawHeight: number;
}

/**
 * Compute contain-fit draw dimensions preserving the source image's natural
 * aspect ratio inside the given maximum bounding box.
 *
 * - If naturalWidth/naturalHeight are positive and valid, the image is scaled
 *   to fit inside maxWidth × maxHeight while preserving its aspect ratio
 *   (CSS "object-fit: contain" semantics).
 * - If natural dimensions are missing or invalid (0, negative, NaN), falls
 *   back to the full maxWidth × maxHeight bounding box.
 *
 * @param naturalWidth  - Source image naturalWidth (e.g. img.naturalWidth)
 * @param naturalHeight - Source image naturalHeight (e.g. img.naturalHeight)
 * @param maxWidth      - Maximum draw width (profile.size[0] * zoom)
 * @param maxHeight     - Maximum draw height (profile.size[1] * zoom)
 * @returns Contain-fit draw dimensions
 */
export function containFit(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number,
): ContainFitResult {
  // Fallback when natural dimensions are unavailable or invalid
  if (
    !isFinite(naturalWidth) || naturalWidth <= 0 ||
    !isFinite(naturalHeight) || naturalHeight <= 0
  ) {
    return { drawWidth: maxWidth, drawHeight: maxHeight };
  }

  const naturalAspect = naturalWidth / naturalHeight;
  const boxAspect = maxWidth / maxHeight;

  if (naturalAspect > boxAspect) {
    // Image is wider than box → width constrained, height reduced
    const drawWidth = maxWidth;
    const drawHeight = maxWidth / naturalAspect;
    return { drawWidth, drawHeight };
  } else {
    // Image is taller than box (or same) → height constrained, width reduced
    const drawHeight = maxHeight;
    const drawWidth = maxHeight * naturalAspect;
    return { drawWidth, drawHeight };
  }
}
