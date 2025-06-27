
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, Image as ImageIcon, Loader2, Upload, Link } from 'lucide-react';
import { removeBackground, loadImageFromUrl } from '@/utils/backgroundRemoval';
import { useToast } from '@/hooks/use-toast';

const BackgroundRemover = () => {
  const [imageUrl, setImageUrl] = useState('');
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
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

  const handleUrlSubmit = async () => {
    if (!imageUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter an image URL",
        variant: "destructive",
      });
      return;
    }

    if (!isValidUrl(imageUrl)) {
      toast({
        title: "Error",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsProcessing(true);
      setProgress(10);
      
      console.log('Loading image from URL:', imageUrl);
      const imageElement = await loadImageFromUrl(imageUrl);
      setOriginalImage(imageUrl);
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
        description: "Failed to process image. Please try a different image or check if the URL is accessible.",
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
    setImageUrl('');
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
          Transform any icon by removing its background and making it transparent. Perfect for logos, icons, and graphics.
        </p>
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Enter Image URL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://example.com/your-icon.png"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="flex-1"
              disabled={isProcessing}
            />
            <Button 
              onClick={handleUrlSubmit} 
              disabled={isProcessing || !imageUrl.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Process
                </>
              )}
            </Button>
          </div>

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

      {(originalImage || processedImage) && (
        <div className="text-center">
          <Button 
            onClick={handleReset} 
            variant="outline"
            className="hover:bg-gray-50"
          >
            Process Another Image
          </Button>
        </div>
      )}
    </div>
  );
};

export default BackgroundRemover;
