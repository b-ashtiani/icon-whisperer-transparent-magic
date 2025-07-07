
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Download, Image as ImageIcon, Loader2, Upload, Link, Search, Grid, FileImage } from 'lucide-react';
import { processImageWithAllAlgorithms, loadImageFromUrl, algorithmInfo, BackgroundRemovalAlgorithm, loadImage } from '@/utils/backgroundRemoval';
import { convertSvgToPng, isSvgImage } from '@/utils/svgToPng';
import { useToast } from '@/hooks/use-toast';

interface FoundImage {
  url: string;
  type: 'svg' | 'png' | 'inline-svg';
  filename: string;
  svgContent?: string;
}

type AlgorithmType = 'icon' | 'ai';

const BackgroundRemover = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [foundImages, setFoundImages] = useState<FoundImage[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedResults, setProcessedResults] = useState<{
    algorithm: BackgroundRemovalAlgorithm;
    result: string;
    blob: Blob;
  }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [convertSvgToPngEnabled, setConvertSvgToPngEnabled] = useState(true);
  const { toast } = useToast();

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const findImagesFromUrl = async (url: string): Promise<FoundImage[]> => {
    // List of CORS proxy services to try
    const corsProxies = [
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      `https://cors-anywhere.herokuapp.com/${url}`,
      `https://thingproxy.freeboard.io/fetch/${url}`,
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`
    ];

    let lastError: Error | null = null;

    for (const proxyUrl of corsProxies) {
      try {
        console.log(`Trying proxy: ${proxyUrl}`);
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json, text/html, */*',
          },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        let html: string;
        const contentType = response.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          const data = await response.json();
          html = data.contents || data.body || '';
        } else {
          html = await response.text();
        }

        if (!html || html.trim().length === 0) {
          throw new Error('Empty response received');
        }

        console.log('Successfully fetched page content');
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const images: FoundImage[] = [];
        const baseUrl = new URL(url);

        // Find all img tags with src containing .png or .svg
        const imgTags = doc.querySelectorAll('img[src]');
        imgTags.forEach((img) => {
          const src = img.getAttribute('src');
          if (src && (src.includes('.png') || src.includes('.svg'))) {
            try {
              const fullUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
              const filename = src.split('/').pop()?.split('?')[0] || 'image';
              const type = src.includes('.svg') ? 'svg' : 'png';
              images.push({ url: fullUrl, type, filename });
            } catch (e) {
              console.warn('Invalid image URL:', src);
            }
          }
        });

        // Find all links to .png or .svg files
        const linkTags = doc.querySelectorAll('a[href]');
        linkTags.forEach((link) => {
          const href = link.getAttribute('href');
          if (href && (href.endsWith('.png') || href.endsWith('.svg') || href.includes('.png?') || href.includes('.svg?'))) {
            try {
              const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
              const filename = href.split('/').pop()?.split('?')[0] || 'image';
              const type = href.includes('.svg') ? 'svg' : 'png';
              images.push({ url: fullUrl, type, filename });
            } catch (e) {
              console.warn('Invalid link URL:', href);
            }
          }
        });

        // Find all inline SVG elements
        const svgElements = doc.querySelectorAll('svg');
        svgElements.forEach((svg, index) => {
          const svgContent = svg.outerHTML;
          const svgId = svg.getAttribute('id') || svg.getAttribute('class') || `svg-${index + 1}`;
          
          // Create a data URL for the SVG
          const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
          const svgUrl = URL.createObjectURL(svgBlob);
          
          images.push({
            url: svgUrl,
            type: 'inline-svg',
            filename: `${svgId}.svg`,
            svgContent: svgContent
          });
        });

        // Remove duplicates
        const uniqueImages = images.filter((img, index, self) => 
          index === self.findIndex(i => i.url === img.url)
        );

        console.log(`Found ${uniqueImages.length} unique images (including inline SVGs)`);
        return uniqueImages;

      } catch (error) {
        console.warn(`Proxy failed: ${proxyUrl}`, error);
        lastError = error as Error;
        continue;
      }
    }

    // If all proxies failed, throw the last error
    throw new Error(`Failed to fetch images from the provided URL. All proxy services failed. Last error: ${lastError?.message || 'Unknown error'}`);
  };

  const handleSearchImages = async () => {
    if (!inputUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a URL",
        variant: "destructive",
      });
      return;
    }

    if (!isValidUrl(inputUrl)) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSearching(true);
      console.log('Searching for images at URL:', inputUrl);
      
      const images = await findImagesFromUrl(inputUrl);
      
      if (images.length === 0) {
        toast({
          title: "No Images Found",
          description: "No SVG or PNG images were found at the provided URL",
          variant: "destructive",
        });
      } else {
        setFoundImages(images);
        toast({
          title: "Images Found!",
          description: `Found ${images.length} image(s) available for processing`,
        });
      }
    } catch (error) {
      console.error('Error searching for images:', error);
      toast({
        title: "Error",
        description: "Failed to search for images. The website may be blocking access or the URL may not be accessible.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleProcessImage = async () => {
    if (!selectedImageUrl) {
      toast({
        title: "Error",
        description: "Please select an image to process",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      setProgress(10);
      
      console.log('Loading image from URL:', selectedImageUrl);
      let imageElement = await loadImageFromUrl(selectedImageUrl);
      
      // Check if it's an SVG and convert to PNG if option is enabled
      if (convertSvgToPngEnabled && isSvgImage(imageElement)) {
        console.log('Converting SVG to PNG...');
        setProgress(20);
        
        try {
          const pngBlob = await convertSvgToPng(imageElement, 2);
          imageElement = await loadImage(pngBlob);
          console.log('SVG successfully converted to PNG');
          
          toast({
            title: "SVG Converted",
            description: "SVG has been converted to PNG for better processing",
          });
        } catch (conversionError) {
          console.warn('SVG conversion failed, proceeding with original:', conversionError);
          toast({
            title: "Conversion Warning",
            description: "SVG conversion failed, using original image",
            variant: "destructive",
          });
        }
      }
      
      setOriginalImage(selectedImageUrl);
      setProgress(30);

      console.log('Processing image with all algorithms...');
      const results = await processImageWithAllAlgorithms(imageElement);
      setProgress(90);

      setProcessedResults(results);
      setProgress(100);

      toast({
        title: "Success!",
        description: `Processed with ${results.length} algorithms successfully`,
      });
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: "Error",
        description: "Failed to process image. Please try a different image.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleDownload = (algorithm: BackgroundRemovalAlgorithm, blob: Blob) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `transparent-icon-${algorithm}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Downloaded!",
      description: `Your ${algorithmInfo[algorithm].name} result has been downloaded`,
    });
  };

  const handleReset = () => {
    setInputUrl('');
    setFoundImages([]);
    setSelectedImageUrl('');
    setOriginalImage(null);
    setProcessedResults([]);
    
    // Clean up object URLs
    processedResults.forEach(result => {
      URL.revokeObjectURL(result.result);
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Multi-Algorithm Background Remover
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Enter a website URL to find images, then see results from multiple background removal algorithms side-by-side.
        </p>
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Enter Website URL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="flex-1"
              disabled={isSearching}
            />
            <Button 
              onClick={handleSearchImages} 
              disabled={isSearching || !inputUrl.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Find Images & SVGs
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {foundImages.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Select Image to Process ({foundImages.length} found)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <RadioGroup value={selectedImageUrl} onValueChange={setSelectedImageUrl}>
              <div className="grid gap-4 max-h-96 overflow-y-auto">
                {foundImages.map((image, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value={image.url} id={`image-${index}`} />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`image-${index}`} className="cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            {image.type === 'inline-svg' && image.svgContent ? (
                              <div 
                                className="w-full h-full flex items-center justify-center"
                                dangerouslySetInnerHTML={{ __html: image.svgContent }}
                              />
                            ) : (
                              <img
                                src={image.url}
                                alt={image.filename}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{image.filename}</p>
                            <p className="text-sm text-muted-foreground">
                              {image.type === 'inline-svg' ? 'Inline SVG' : image.type.toUpperCase()} • 
                              {image.type === 'inline-svg' ? 'Embedded SVG element' : 
                               (image.url.length > 50 ? `${image.url.substring(0, 50)}...` : image.url)}
                            </p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>

            {/* SVG to PNG Conversion Option */}
            <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50">
              <div className="flex items-center gap-3">
                <FileImage className="h-5 w-5 text-blue-600" />
                <div>
                  <Label htmlFor="svg-convert" className="font-medium text-blue-900">
                    Convert SVGs to PNG
                  </Label>
                  <p className="text-sm text-blue-700">
                    Automatically convert SVG images to PNG format for better algorithm compatibility
                  </p>
                </div>
              </div>
              <Switch
                id="svg-convert"
                checked={convertSvgToPngEnabled}
                onCheckedChange={setConvertSvgToPngEnabled}
              />
            </div>

            <Button 
              onClick={handleProcessImage} 
              disabled={isProcessing || !selectedImageUrl}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing with All Algorithms
                </>
              ) : (
                <>
                  <Grid className="h-4 w-4 mr-2" />
                  Process with All Algorithms
                </>
              )}
            </Button>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-center text-muted-foreground">
                  {progress < 30 ? 'Loading image...' : 
                   progress < 90 ? 'Processing with multiple algorithms...' : 
                   'Finalizing results...'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results Grid */}
      {(originalImage && processedResults.length > 0) && (
        <div className="space-y-6">
          {/* Original Image */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Original Image
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden max-w-md mx-auto">
                <img
                  src={originalImage}
                  alt="Original"
                  className="w-full h-full object-contain"
                />
              </div>
            </CardContent>
          </Card>

          {/* Algorithm Results */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Grid className="h-5 w-5" />
                Algorithm Comparison ({processedResults.length} results)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {processedResults.map(({ algorithm, result, blob }) => (
                  <div key={algorithm} className="space-y-4">
                    <div className="text-center">
                      <h3 className="font-semibold text-lg">{algorithmInfo[algorithm].name}</h3>
                      <p className="text-sm text-muted-foreground">{algorithmInfo[algorithm].description}</p>
                    </div>
                    
                    <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden relative">
                      <div className="absolute inset-0 opacity-20" style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3e%3cg fill='%23000' fill-opacity='0.1' fill-rule='evenodd'%3e%3crect width='10' height='10'/%3e%3crect x='10' y='10' width='10' height='10'/%3e%3c/g%3e%3c/svg%3e")`,
                      }} />
                      <img
                        src={result}
                        alt={`${algorithmInfo[algorithm].name} result`}
                        className="w-full h-full object-contain relative z-10"
                      />
                    </div>
                    
                    <Button 
                      onClick={() => handleDownload(algorithm, blob)}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download {algorithmInfo[algorithm].name}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {(foundImages.length > 0 || originalImage || processedResults.length > 0) && (
        <div className="text-center">
          <Button 
            onClick={handleReset} 
            variant="outline"
            className="hover:bg-gray-50"
          >
            Start Over
          </Button>
        </div>
      )}
    </div>
  );
};

export default BackgroundRemover;
