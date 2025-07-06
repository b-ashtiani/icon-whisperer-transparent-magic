
// Inkscape-inspired algorithm for vector-like processing
export interface InkscapeOptions {
  threshold: number;
  simplification: number;
  smoothing: boolean;
}

const DEFAULT_INKSCAPE_OPTIONS: InkscapeOptions = {
  threshold: 128,
  simplification: 2,
  smoothing: true
};

function medianFilter(data: Uint8ClampedArray, width: number, height: number, channel: number): void {
  const result = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const neighbors = [];
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const index = ((y + dy) * width + (x + dx)) * 4 + channel;
          neighbors.push(data[index]);
        }
      }
      
      neighbors.sort((a, b) => a - b);
      const median = neighbors[Math.floor(neighbors.length / 2)];
      
      const index = (y * width + x) * 4 + channel;
      result[index] = median;
    }
  }
  
  data.set(result);
}

function detectEdges(data: Uint8ClampedArray, width: number, height: number): number[] {
  const edges = new Array(width * height).fill(0);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      // Sobel edge detection on luminance
      const getIntensity = (dx: number, dy: number) => {
        const index = ((y + dy) * width + (x + dx)) * 4;
        return 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
      };
      
      const gx = 
        -getIntensity(-1, -1) + getIntensity(1, -1) +
        -2 * getIntensity(-1, 0) + 2 * getIntensity(1, 0) +
        -getIntensity(-1, 1) + getIntensity(1, 1);
      
      const gy = 
        -getIntensity(-1, -1) - 2 * getIntensity(0, -1) - getIntensity(1, -1) +
        getIntensity(-1, 1) + 2 * getIntensity(0, 1) + getIntensity(1, 1);
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = magnitude;
    }
  }
  
  return edges;
}

export const inkscapeBackgroundRemoval = async (imageElement: HTMLImageElement, options: Partial<InkscapeOptions> = {}): Promise<Blob> => {
  const opts = { ...DEFAULT_INKSCAPE_OPTIONS, ...options };
  
  try {
    console.log('Starting Inkscape-style background removal...');
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    ctx.drawImage(imageElement, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = imageData;
    
    // Apply median filter for noise reduction
    medianFilter(data, width, height, 0); // R
    medianFilter(data, width, height, 1); // G
    medianFilter(data, width, height, 2); // B
    
    // Detect edges
    const edges = detectEdges(data, width, height);
    const maxEdge = Math.max(...edges);
    
    // Sample background from corners
    const corners = [
      [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]
    ];
    
    const backgroundColors = corners.map(([x, y]) => {
      const index = (y * width + x) * 4;
      return [data[index], data[index + 1], data[index + 2]];
    });
    
    // Use average of corner colors
    const backgroundColor = [
      Math.round(backgroundColors.reduce((sum, color) => sum + color[0], 0) / 4),
      Math.round(backgroundColors.reduce((sum, color) => sum + color[1], 0) / 4),
      Math.round(backgroundColors.reduce((sum, color) => sum + color[2], 0) / 4)
    ];
    
    // Create alpha mask
    const outputImageData = ctx.createImageData(width, height);
    const outputData = outputImageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      const pixelIndex = i / 4;
      const x = pixelIndex % width;
      const y = Math.floor(pixelIndex / width);
      
      // Copy RGB
      outputData[i] = data[i];
      outputData[i + 1] = data[i + 1];
      outputData[i + 2] = data[i + 2];
      
      // Calculate color difference
      const colorDiff = Math.sqrt(
        (data[i] - backgroundColor[0]) ** 2 +
        (data[i + 1] - backgroundColor[1]) ** 2 +
        (data[i + 2] - backgroundColor[2]) ** 2
      );
      
      // Consider edge strength
      const edgeStrength = edges[pixelIndex] / maxEdge;
      
      // Calculate alpha based on color difference and edge strength
      let alpha = 0;
      
      if (colorDiff > opts.threshold || edgeStrength > 0.3) {
        alpha = Math.min(255, colorDiff + edgeStrength * 128);
      }
      
      outputData[i + 3] = alpha;
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
    console.error('Inkscape algorithm error:', error);
    throw error;
  }
};
