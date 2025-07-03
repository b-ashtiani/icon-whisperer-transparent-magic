
export interface IconProcessingOptions {
  tolerance: number;
  edgeThreshold: number;
  smoothing: boolean;
}

const DEFAULT_OPTIONS: IconProcessingOptions = {
  tolerance: 30,
  edgeThreshold: 10,
  smoothing: true
};

function getColorDistance(color1: [number, number, number], color2: [number, number, number]): number {
  const [r1, g1, b1] = color1;
  const [r2, g2, b2] = color2;
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

function sampleBackgroundColor(imageData: ImageData): [number, number, number] {
  const { data, width, height } = imageData;
  const samples: [number, number, number][] = [];
  
  // Sample from corners and edges
  const samplePoints = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1], // corners
    [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1], // top/bottom center
    [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)] // left/right center
  ];
  
  samplePoints.forEach(([x, y]) => {
    const index = (y * width + x) * 4;
    samples.push([data[index], data[index + 1], data[index + 2]]);
  });
  
  // Find the most common color (background)
  const colorCounts = new Map<string, { count: number; color: [number, number, number] }>();
  
  samples.forEach(color => {
    const key = color.join(',');
    if (colorCounts.has(key)) {
      colorCounts.get(key)!.count++;
    } else {
      colorCounts.set(key, { count: 1, color });
    }
  });
  
  let maxCount = 0;
  let backgroundColor: [number, number, number] = [255, 255, 255];
  
  colorCounts.forEach(({ count, color }) => {
    if (count > maxCount) {
      maxCount = count;
      backgroundColor = color;
    }
  });
  
  return backgroundColor;
}

function detectEdges(imageData: ImageData): boolean[] {
  const { data, width, height } = imageData;
  const edges = new Array(width * height).fill(false);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = (y * width + x) * 4;
      
      // Sobel edge detection
      const gx = 
        -data[((y - 1) * width + (x - 1)) * 4] + data[((y - 1) * width + (x + 1)) * 4] +
        -2 * data[(y * width + (x - 1)) * 4] + 2 * data[(y * width + (x + 1)) * 4] +
        -data[((y + 1) * width + (x - 1)) * 4] + data[((y + 1) * width + (x + 1)) * 4];
      
      const gy = 
        -data[((y - 1) * width + (x - 1)) * 4] - 2 * data[((y - 1) * width + x) * 4] - data[((y - 1) * width + (x + 1)) * 4] +
        data[((y + 1) * width + (x - 1)) * 4] + 2 * data[((y + 1) * width + x) * 4] + data[((y + 1) * width + (x + 1)) * 4];
      
      const magnitude = Math.sqrt(gx * gx + gy * gy);
      edges[y * width + x] = magnitude > 50; // Edge threshold
    }
  }
  
  return edges;
}

function floodFill(imageData: ImageData, startX: number, startY: number, targetColor: [number, number, number], tolerance: number): boolean[] {
  const { data, width, height } = imageData;
  const filled = new Array(width * height).fill(false);
  const stack = [[startX, startY]];
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    
    if (x < 0 || x >= width || y < 0 || y >= height || filled[y * width + x]) {
      continue;
    }
    
    const index = (y * width + x) * 4;
    const currentColor: [number, number, number] = [data[index], data[index + 1], data[index + 2]];
    
    if (getColorDistance(currentColor, targetColor) <= tolerance) {
      filled[y * width + x] = true;
      
      // Add neighbors to stack
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }
  
  return filled;
}

export const removeIconBackground = async (imageElement: HTMLImageElement, options: Partial<IconProcessingOptions> = {}): Promise<Blob> => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  try {
    console.log('Starting icon background removal...');
    
    // Create canvas and get image data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    canvas.width = imageElement.naturalWidth;
    canvas.height = imageElement.naturalHeight;
    ctx.drawImage(imageElement, 0, 0);
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    console.log(`Processing image: ${canvas.width}x${canvas.height}`);
    
    // Sample background color
    const backgroundColor = sampleBackgroundColor(imageData);
    console.log('Detected background color:', backgroundColor);
    
    // Create mask using flood fill from corners
    const mask = new Array(canvas.width * canvas.height).fill(false);
    
    // Start flood fill from corners
    const corners = [
      [0, 0],
      [canvas.width - 1, 0],
      [0, canvas.height - 1],
      [canvas.width - 1, canvas.height - 1]
    ];
    
    corners.forEach(([x, y]) => {
      const cornerFill = floodFill(imageData, x, y, backgroundColor, opts.tolerance);
      for (let i = 0; i < mask.length; i++) {
        if (cornerFill[i]) mask[i] = true;
      }
    });
    
    // Detect edges to preserve fine details
    const edges = detectEdges(imageData);
    
    // Apply mask to create transparency
    const outputImageData = ctx.createImageData(canvas.width, canvas.height);
    const outputData = outputImageData.data;
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      const pixelIndex = i / 4;
      const isBackground = mask[pixelIndex];
      const isEdge = edges[pixelIndex];
      
      // Copy RGB values
      outputData[i] = imageData.data[i];
      outputData[i + 1] = imageData.data[i + 1];
      outputData[i + 2] = imageData.data[i + 2];
      
      // Set alpha based on whether it's background or foreground
      if (isBackground && !isEdge) {
        outputData[i + 3] = 0; // Transparent
      } else {
        // Check color similarity for anti-aliasing
        const currentColor: [number, number, number] = [
          imageData.data[i],
          imageData.data[i + 1],
          imageData.data[i + 2]
        ];
        const colorDistance = getColorDistance(currentColor, backgroundColor);
        
        if (colorDistance < opts.tolerance) {
          // Gradually fade based on distance
          const alpha = Math.max(0, Math.min(255, (colorDistance / opts.tolerance) * 255));
          outputData[i + 3] = alpha;
        } else {
          outputData[i + 3] = imageData.data[i + 3]; // Keep original alpha
        }
      }
    }
    
    // Apply smoothing if enabled
    if (opts.smoothing) {
      // Simple blur on alpha channel for smoother edges
      const smoothData = new Uint8ClampedArray(outputData);
      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
          const index = (y * canvas.width + x) * 4 + 3;
          
          const neighbors = [
            outputData[((y - 1) * canvas.width + x) * 4 + 3],
            outputData[(y * canvas.width + (x - 1)) * 4 + 3],
            outputData[(y * canvas.width + (x + 1)) * 4 + 3],
            outputData[((y + 1) * canvas.width + x) * 4 + 3],
          ];
          
          const avgAlpha = neighbors.reduce((a, b) => a + b, outputData[index]) / 5;
          smoothData[index] = Math.round(avgAlpha);
        }
      }
      outputData.set(smoothData);
    }
    
    ctx.putImageData(outputImageData, 0, 0);
    console.log('Icon background removed successfully');
    
    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/png',
        1.0
      );
    });
  } catch (error) {
    console.error('Error removing icon background:', error);
    throw error;
  }
};
