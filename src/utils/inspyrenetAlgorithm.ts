
// InSPyReNet-inspired algorithm for salient object detection
import { pipeline, env } from '@huggingface/transformers';

env.allowLocalModels = false;
env.useBrowserCache = false;

export const inspyrenetBackgroundRemoval = async (imageElement: HTMLImageElement): Promise<Blob> => {
  try {
    console.log('Starting InSPyReNet-style background removal...');
    
    // Use a salient object detection model similar to InSPyReNet
    const segmenter = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
      device: 'webgpu',
    });
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    ctx.drawImage(imageElement, 0, 0);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
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
    
    // Apply salient object detection with enhanced edge preservation
    for (let i = 0; i < result[0].mask.data.length; i++) {
      const maskValue = result[0].mask.data[i];
      
      // Apply InSPyReNet-style refinement for better salient object detection
      let alpha = Math.round(maskValue * 255);
      
      // Enhanced salient object detection with better edge handling
      if (maskValue > 0.05 && maskValue < 0.95) {
        // Apply non-linear transformation for better edge definition
        const refined = Math.pow(maskValue, 0.8); // Gamma correction for better contrast
        alpha = Math.round(refined * 255);
      } else if (maskValue <= 0.05) {
        alpha = 0; // Clear background
      } else {
        alpha = 255; // Clear foreground
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
    console.error('InSPyReNet algorithm error:', error);
    throw error;
  }
};
