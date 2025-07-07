
export const convertSvgToPng = async (svgElement: HTMLImageElement | string, scale: number = 2): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      let svgContent: string;
      
      if (typeof svgElement === 'string') {
        svgContent = svgElement;
      } else {
        // If it's an image element with SVG source, we need to fetch the content
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Set canvas size based on SVG dimensions
        canvas.width = svgElement.naturalWidth * scale;
        canvas.height = svgElement.naturalHeight * scale;
        
        // Draw the SVG image to canvas
        ctx.drawImage(svgElement, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert SVG to PNG'));
            }
          },
          'image/png',
          1.0
        );
        return;
      }

      // Parse SVG content to get dimensions
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgEl = svgDoc.querySelector('svg');
      
      if (!svgEl) {
        reject(new Error('Invalid SVG content'));
        return;
      }

      // Get SVG dimensions
      let width = 200; // default
      let height = 200; // default
      
      if (svgEl.hasAttribute('width') && svgEl.hasAttribute('height')) {
        width = parseFloat(svgEl.getAttribute('width') || '200');
        height = parseFloat(svgEl.getAttribute('height') || '200');
      } else if (svgEl.hasAttribute('viewBox')) {
        const viewBox = svgEl.getAttribute('viewBox')?.split(' ');
        if (viewBox && viewBox.length === 4) {
          width = parseFloat(viewBox[2]);
          height = parseFloat(viewBox[3]);
        }
      }

      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = width * scale;
      canvas.height = height * scale;
      
      // Create blob URL from SVG
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);
      
      // Create image and draw to canvas
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to convert SVG to PNG'));
            }
          },
          'image/png',
          1.0
        );
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG image'));
      };
      
      img.src = url;
    } catch (error) {
      reject(error);
    }
  });
};

export const isSvgImage = (imageElement: HTMLImageElement): boolean => {
  return imageElement.src.includes('svg') || 
         imageElement.src.startsWith('data:image/svg+xml') ||
         imageElement.src.startsWith('blob:') && imageElement.src.includes('svg');
};
