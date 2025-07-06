
// GIMP-inspired algorithm using color selection and feathering
export interface GimpOptions {
  colorTolerance: number;
  featherRadius: number;
  antiAlias: boolean;
}

const DEFAULT_GIMP_OPTIONS: GimpOptions = {
  colorTolerance: 25,
  featherRadius: 2,
  antiAlias: true
};

function getPixelColor(data: Uint8ClampedArray, x: number, y: number, width: number): [number, number, number] {
  const index = (y * width + x) * 4;
  return [data[index], data[index + 1], data[index + 2]];
}

function colorDistance(color1: [number, number, number], color2: [number, number, number]): number {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function gaussianBlur(data: number[], width: number, height: number, radius: number): number[] {
  const result = new Array(data.length);
  const sigma = radius / 3;
  const kernel: number[] = [];
  const kernelSize = Math.ceil(radius) * 2 + 1;
  
  // Generate Gaussian kernel
  let sum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - Math.floor(kernelSize / 2);
    const value = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel[i] = value;
    sum += value;
  }
  
  // Normalize kernel
  for (let i = 0; i < kernelSize; i++) {
    kernel[i] /= sum;
  }
  
  // Apply horizontal blur
  const temp = new Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < kernelSize; k++) {
        const kx = x + k - Math.floor(kernelSize / 2);
        if (kx >= 0 && kx < width) {
          sum += data[y * width + kx] * kernel[k];
        }
      }
      temp[y * width + x] = sum;
    }
  }
  
  // Apply vertical blur
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < kernelSize; k++) {
        const ky = y + k - Math.floor(kernelSize / 2);
        if (ky >= 0 && ky < height) {
          sum += temp[ky * width + x] * kernel[k];
        }
      }
      result[y * width + x] = sum;
    }
  }
  
  return result;
}

export const gimpBackgroundRemoval = async (imageElement: HTMLImageElement, options: Partial<GimpOptions> = {}): Promise<Blob> => {
  const opts = { ...DEFAULT_GIMP_OPTIONS, ...options };
  
  try {
    console.log('Starting GIMP-style background removal...');
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    ctx.drawImage(imageElement, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;
    
    // Sample background colors from corners
    const corners = [
      getPixelColor(data, 0, 0, width),
      getPixelColor(data, width - 1, 0, width),
      getPixelColor(data, 0, height - 1, width),
      getPixelColor(data, width - 1, height - 1, width)
    ];
    
    // Use the most common corner color as background
    const backgroundColor = corners[0]; // Simplified for this implementation
    
    // Create selection mask
    const mask: number[] = new Array(width * height).fill(0);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelColor = getPixelColor(data, x, y, width);
        const distance = colorDistance(pixelColor, backgroundColor);
        
        if (distance <= opts.colorTolerance) {
          mask[y * width + x] = 1; // Background
        }
      }
    }
    
    // Apply feathering (Gaussian blur to the mask)
    let alphaMask = mask.map(x => x === 1 ? 0 : 1); // Invert mask
    
    if (opts.featherRadius > 0) {
      alphaMask = gaussianBlur(alphaMask, width, height, opts.featherRadius);
    }
    
    // Apply the mask
    const outputImageData = ctx.createImageData(width, height);
    const outputData = outputImageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      
      // Copy RGB
      outputData[i] = data[i];
      outputData[i + 1] = data[i + 1];
      outputData[i + 2] = data[i + 2];
      
      // Set alpha from mask
      outputData[i + 3] = Math.round(alphaMask[pixelIndex] * 255);
    }
    
    ctx.putImageData(outputImageData, 0, 0);
    
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
        'image/png',
        1.0
      );
    });
  } catch (error) {
    console.error('GIMP algorithm error:', error);
    throw error;
  }
};
