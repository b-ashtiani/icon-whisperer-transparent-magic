
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Download, Image as ImageIcon, Loader2, Upload, Link, Search } from 'lucide-react';
import { removeBackground, loadImageFromUrl } from '@/utils/backgroundRemoval';
import { useToast } from '@/hooks/use-toast';

interface FoundImage {
  url: string;
  type: 'svg' | 'png';
  filename: string;
}

const BackgroundRemover = () => {
  const [inputUrl, setInputUrl] = useState('');
  const [foundImages, setFoundImages] = useState<FoundImage[]>([]);
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
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
    try {
      // Use a CORS proxy to fetch the page content
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      const html = data.contents;

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      const images: FoundImage[] = [];
      const baseUrl = new URL(url);

      // Find all img tags with src containing .png or .svg
      const imgTags = doc.querySelectorAll('img[src]');
      imgTags.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && (src.includes('.png') || src.includes('.svg'))) {
          const fullUrl = src.startsWith('http') ? src : new URL(src, baseUrl).href;
          const filename = src.split('/').pop() || 'image';
          const type = src.includes('.svg') ? 'svg' : 'png';
          images.push({ url: fullUrl, type, filename });
        }
      });

      // Find all links to .png or .svg files
      const linkTags = doc.querySelectorAll('a[href]');
      linkTags.forEach((link) => {
        const href = link.getAttribute('href');
        if (href && (href.endsWith('.png') || href.endsWith('.svg'))) {
          const fullUrl = href.startsWith('http') ? href : new URL(href, baseUrl).href;
          const filename = href.split('/').pop() || 'image';
          const type = href.endsWith('.svg') ? 'svg' : 'png';
          images.push({ url: fullUrl, type, filename });
        }
      });

      // Remove duplicates
      const uniqueImages = images.filter((img, index, self) => 
        index === self.findIndex(i => i.url === img.url)
      );

      return uniqueImages;
    } catch (error) {
      console.error('Error fetching images from URL:', error);
      throw new Error('Failed to fetch images from the provided URL');
    }
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
        description: "Failed to search for images. Please check if the URL is accessible.",
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
      const imageElement = await loadImageFromUrl(selectedImageUrl);
      setOriginalImage(selectedImageUrl);
      setProgress(30);

      console.log('Starting background removal...');
      const processedBlob = await removeBackground(imageElement);
      setProgress(80);

      const processedUrl = URL.createObjectURL(processedBlob);
      setProcessedImage(processedUrl);
      setDownloadUrl(processedUrl);
      setProgress(100);

      toast({
        title: "Success!",
        description: "Background removed successfully",
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

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'transparent-icon.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Downloaded!",
        description: "Your transparent icon has been downloaded",
      });
    }
  };

  const handleReset = () => {
    setInputUrl('');
    setFoundImages([]);
    setSelectedImageUrl('');
    setOriginalImage(null);
    setProcessedImage(null);
    setDownloadUrl(null);
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
          Icon Background Remover
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Enter a website URL to find SVG and PNG images, then remove backgrounds to make them transparent.
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
                  Find Images
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
          <CardContent className="space-y-4">
            <RadioGroup value={selectedImageUrl} onValueChange={setSelectedImageUrl}>
              <div className="grid gap-4 max-h-96 overflow-y-auto">
                {foundImages.map((image, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 border rounded-lg hover:bg-gray-50">
                    <RadioGroupItem value={image.url} id={`image-${index}`} />
                    <div className="flex-1 min-w-0">
                      <Label htmlFor={`image-${index}`} className="cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            <img
                              src={image.url}
                              alt={image.filename}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{image.filename}</p>
                            <p className="text-sm text-muted-foreground">
                              {image.type.toUpperCase()} • {image.url.length > 50 ? `${image.url.substring(0, 50)}...` : image.url}
                            </p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </RadioGroup>

            <Button 
              onClick={handleProcessImage} 
              disabled={isProcessing || !selectedImageUrl}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Remove Background
                </>
              )}
            </Button>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-center text-muted-foreground">
                  {progress < 30 ? 'Loading image...' : 
                   progress < 80 ? 'Removing background...' : 
                   'Finalizing...'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(originalImage || processedImage) && (
        <div className="grid md:grid-cols-2 gap-6">
          {originalImage && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Original Image
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full h-full object-contain"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {processedImage && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Processed Image
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg overflow-hidden relative">
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3e%3cg fill='%23000' fill-opacity='0.1' fill-rule='evenodd'%3e%3crect width='10' height='10'/%3e%3crect x='10' y='10' width='10' height='10'/%3e%3c/g%3e%3c/svg%3e")`,
                  }} />
                  <img
                    src={processedImage}
                    alt="Processed"
                    className="w-full h-full object-contain relative z-10"
                  />
                </div>
                <Button 
                  onClick={handleDownload} 
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Transparent Icon
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {(foundImages.length > 0 || originalImage || processedImage) && (
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
