// Four Elements v0.4 module: sprite alpha bounds and solid crop helpers.

(function () {
  const spriteTrimCache = new WeakMap();
  const solidSpriteCache = new WeakMap();

  function imageReady(im) {
    return !!(im && im.complete && im.naturalWidth && im.naturalHeight);
  }

  function getAlphaBounds(im, alphaThreshold=130) {
    if (!imageReady(im)) return null;

    let cacheForImage = spriteTrimCache.get(im);
    if (!cacheForImage) {
      cacheForImage = new Map();
      spriteTrimCache.set(im, cacheForImage);
    }
    if (cacheForImage.has(alphaThreshold)) return cacheForImage.get(alphaThreshold);

    const c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    const cx = c.getContext('2d', { willReadFrequently:true });
    cx.drawImage(im, 0, 0);

    let data;
    try {
      data = cx.getImageData(0, 0, c.width, c.height).data;
    } catch {
      const full = { x:0, y:0, w:im.naturalWidth, h:im.naturalHeight };
      cacheForImage.set(alphaThreshold, full);
      return full;
    }

    let minX=c.width, minY=c.height, maxX=-1, maxY=-1;
    for (let y=0; y<c.height; y++) {
      for (let x=0; x<c.width; x++) {
        const a = data[(y*c.width+x)*4+3];
        if (a > alphaThreshold) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    const bounds = maxX < 0
      ? { x:0, y:0, w:im.naturalWidth, h:im.naturalHeight }
      : { x:minX, y:minY, w:maxX-minX+1, h:maxY-minY+1 };

    cacheForImage.set(alphaThreshold, bounds);
    return bounds;
  }

  function getSolidSprite(im, alphaThreshold=115) {
    if (!imageReady(im)) return null;

    let cacheForImage = solidSpriteCache.get(im);
    if (!cacheForImage) {
      cacheForImage = new Map();
      solidSpriteCache.set(im, cacheForImage);
    }
    if (cacheForImage.has(alphaThreshold)) return cacheForImage.get(alphaThreshold);

    const b = getAlphaBounds(im, alphaThreshold);
    if (!b) return null;

    const c = document.createElement('canvas');
    c.width = Math.max(1, b.w);
    c.height = Math.max(1, b.h);
    const cx = c.getContext('2d', { willReadFrequently:true });
    cx.drawImage(im, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);

    try {
      const imgData = cx.getImageData(0, 0, c.width, c.height);
      const data = imgData.data;

      for (let i=0; i<data.length; i+=4) {
        const a = data[i+3];
        if (a < alphaThreshold) data[i+3] = 0;
      }

      cx.putImageData(imgData, 0, 0);
    } catch {
      // If canvas access is blocked, use the cropped sprite as-is.
    }

    cacheForImage.set(alphaThreshold, c);
    return c;
  }

  window.FE_SPRITE_ALPHA = {
    imageReady,
    getAlphaBounds,
    getSolidSprite
  };
})();
