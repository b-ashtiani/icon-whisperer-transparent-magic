
// MODNet-inspired algorithm for portrait matting
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = false;

export const modnetBackgroundRemoval = async (imageElement: HTMLImageElement): Promise<Blob> => {
  try {
    console.log('Starting MODNet-style background removal...');
    
    // Use a model better suited for portrait/object matting
    const segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
      device: 'webgpu',
    });
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    // Resize for better performance while maintaining quality
    const maxDim = 512;
    let { width, height } = imageElement;
    
    if (width > maxDim || height > maxDim) {
      const ratio = Math.min(maxDim / width, maxDim / height);
      width *= ratio;
      height *= ratio;
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imageElement, 0, 0, width, height);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.85);
    const result = await segmenter(imageData);
    
    if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
      throw new Error('Invalid segmentation result');
    }
    
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvas.width;
    outputCanvas.height = canvas.height;
    const outputCtx = outputCanvas.getContext('2d');
    
    if (!outputCtx) throw new Error('Could not get output canvas context');
    
    outputCtx.drawImage(canvas, 0, 0);
    
    const outputImageData = outputCtx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const data = outputImageData.data;
    
    // Apply trimap-like processing for better edges
    for (let i = 0; i < result[0].mask.data.length; i++) {
      const maskValue = result[0].mask.data[i];
      let alpha = Math.round(maskValue * 255);
      
      // Enhance edge definition
      if (maskValue > 0.1 && maskValue < 0.9) {
        alpha = maskValue > 0.5 ? Math.min(255, alpha * 1.2) : Math.max(0, alpha * 0.8);
      }
      
      data[i * 4 + 3] = alpha;
    }
    
    outputCtx.putImageData(outputImageData, 0, 0);
    
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
        'image/png',
        1.0
      );
    });
  } catch (error) {
    console.error('MODNet algorithm error:', error);
    throw error;
  }
};
