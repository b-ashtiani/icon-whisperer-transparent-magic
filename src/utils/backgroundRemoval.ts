import { pipeline, env } from '@huggingface/transformers';
import { removeIconBackground } from './iconBackgroundRemoval';
import { rembgBackgroundRemoval } from './rembgAlgorithm';
import { modnetBackgroundRemoval } from './modnetAlgorithm';
import { gimpBackgroundRemoval } from './gimpAlgorithm';
import { inkscapeBackgroundRemoval } from './inkscapeAlgorithm';
import { inspyrenetBackgroundRemoval } from './inspyrenetAlgorithm';

// Configure transformers.js to always download models
env.allowLocalModels = false;
env.useBrowserCache = false;

const MAX_IMAGE_DIMENSION = 1024;

function resizeImageIfNeeded(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    if (width > height) {
      height = Math.round((height * MAX_IMAGE_DIMENSION) / width);
      width = MAX_IMAGE_DIMENSION;
    } else {
      width = Math.round((width * MAX_IMAGE_DIMENSION) / height);
      height = MAX_IMAGE_DIMENSION;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    return true;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);
  return false;
}

export type BackgroundRemovalAlgorithm = 'icon' | 'ai' | 'rembg' | 'modnet' | 'gimp' | 'inkscape' | 'inspyrenet';

export const algorithmInfo = {
  icon: { name: 'Icon Algorithm', description: 'Best for solid color backgrounds' },
  ai: { name: 'AI Algorithm', description: 'General purpose AI model' },
  rembg: { name: 'Rembg', description: 'U²-Net based removal' },
  modnet: { name: 'MODNet', description: 'Portrait matting focused' },
  gimp: { name: 'GIMP-style', description: 'Color selection with feathering' },
  inkscape: { name: 'Inkscape-style', description: 'Vector-like edge detection' },
  inspyrenet: { name: 'InSPyReNet', description: 'Salient object detection' }
};

export const removeBackgroundWithAlgorithm = async (
  imageElement: HTMLImageElement, 
  algorithm: BackgroundRemovalAlgorithm
): Promise<Blob> => {
  console.log(`Using ${algorithm} algorithm for background removal`);
  
  switch (algorithm) {
    case 'icon':
      return await removeIconBackground(imageElement, {
        tolerance: 35,
        edgeThreshold: 10,
        smoothing: true
      });
    
    case 'rembg':
      return await rembgBackgroundRemoval(imageElement);
    
    case 'modnet':
      return await modnetBackgroundRemoval(imageElement);
    
    case 'gimp':
      return await gimpBackgroundRemoval(imageElement);
    
    case 'inkscape':
      return await inkscapeBackgroundRemoval(imageElement);
    
    case 'inspyrenet':
      return await inspyrenetBackgroundRemoval(imageElement);
    
    case 'ai':
    default:
      // Fallback to AI model for complex backgrounds
      console.log('Using AI model for background removal...');
      const remover = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
        device: 'webgpu',
      });
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('Could not get canvas context');
      
      const wasResized = resizeImageIfNeeded(canvas, ctx, imageElement);
      console.log(`Image ${wasResized ? 'was' : 'was not'} resized. Final dimensions: ${canvas.width}x${canvas.height}`);
      
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      console.log('Image converted to base64');
      
      console.log('Processing with background removal model...');
      const result = await remover(imageData);
      
      console.log('Background removal result:', result);
      
      if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
        throw new Error('Invalid background removal result');
      }
      
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = canvas.width;
      outputCanvas.height = canvas.height;
      const outputCtx = outputCanvas.getContext('2d');
      
      if (!outputCtx) throw new Error('Could not get output canvas context');
      
      outputCtx.drawImage(canvas, 0, 0);
      
      const outputImageData = outputCtx.getImageData(
        0, 0,
        outputCanvas.width,
        outputCanvas.height
      );
      const data = outputImageData.data;
      
      for (let i = 0; i < result[0].mask.data.length; i++) {
        const alpha = Math.round(result[0].mask.data[i] * 255);
        data[i * 4 + 3] = alpha;
      }
      
      outputCtx.putImageData(outputImageData, 0, 0);
      console.log('Background removed successfully');
      
      return new Promise((resolve, reject) => {
        outputCanvas.toBlob(
          (blob) => {
            if (blob) {
              console.log('Successfully created final blob');
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob'));
            }
          },
          'image/png',
          1.0
        );
      });
  }
};

export const processImageWithAllAlgorithms = async (imageElement: HTMLImageElement): Promise<{
  algorithm: BackgroundRemovalAlgorithm;
  result: string;
  blob: Blob;
}[]> => {
  const algorithms: BackgroundRemovalAlgorithm[] = ['icon', 'ai', 'rembg', 'modnet', 'gimp', 'inkscape', 'inspyrenet'];
  const results = [];
  
  for (const algorithm of algorithms) {
    try {
      console.log(`Processing with ${algorithm} algorithm...`);
      const blob = await removeBackgroundWithAlgorithm(imageElement, algorithm);
      const result = URL.createObjectURL(blob);
      results.push({ algorithm, result, blob });
    } catch (error) {
      console.error(`Error with ${algorithm} algorithm:`, error);
      // Continue with other algorithms even if one fails
    }
  }
  
  return results;
};

export const loadImage = (file: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

export const loadImageFromUrl = async (url: string): Promise<HTMLImageElement> => {
  console.log('Attempting to load image from URL:', url);
  
  // Try to fetch the image through a proxy first to avoid CORS issues
  const corsProxies = [
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    `https://cors-anywhere.herokuapp.com/${url}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  ];

  for (const proxyUrl of corsProxies) {
    try {
      console.log(`Trying to fetch image via proxy: ${proxyUrl}`);
      
      const response = await fetch(proxyUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Verify it's actually an image
      if (!blob.type.startsWith('image/')) {
        throw new Error('Response is not an image');
      }

      console.log('Successfully fetched image via proxy, creating image element');
      
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          console.log('Image loaded successfully');
          resolve(img);
        };
        img.onerror = (error) => {
          console.error('Error loading image from blob:', error);
          reject(new Error('Failed to load image from blob'));
        };
        img.src = URL.createObjectURL(blob);
      });

    } catch (error) {
      console.warn(`Proxy failed: ${proxyUrl}`, error);
      continue;
    }
  }

  // If all proxies failed, try direct load as fallback
  console.log('All proxies failed, trying direct load...');
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log('Direct image load successful');
      resolve(img);
    };
    img.onerror = (error) => {
      console.error('Direct image load failed:', error);
      reject(new Error('Failed to load image. The image may be blocked by CORS policy or the URL may be inaccessible.'));
    };
    img.src = url;
  });
};
