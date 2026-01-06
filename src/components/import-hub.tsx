'use client';

import { Cloud, FileVideo, HardDrive, Plus, Upload, Video } from 'lucide-react';
import { useState } from 'react';
import { BulkVideoUpload } from '@/components/bulk-video-upload';
import { GoogleDrivePicker } from '@/components/integrations/google-drive-picker';
import { RecordingBrowser } from '@/components/integrations/recording-browser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface ImportHubProps {
  organizationId: string;
  organizationSlug: string;
  authorId: string;
  channelId?: string;
  collectionId?: string;
  onImportComplete?: (count: number) => void;
}

interface ImportSource {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  comingSoon?: boolean;
}

export function ImportHub({
  organizationId,
  organizationSlug,
  authorId,
  channelId,
  collectionId,
  onImportComplete,
}: ImportHubProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('local');
  const [showZoomBrowser, setShowZoomBrowser] = useState(false);
  const [showMeetBrowser, setShowMeetBrowser] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const handleBulkUploadComplete = (results: Array<{ videoId: string; title: string }>) => {
    toast({
      title: 'Videos Uploaded',
      description: `${results.length} video${results.length !== 1 ? 's' : ''} uploaded successfully.`,
    });
    onImportComplete?.(results.length);
    setOpen(false);
  };

  const handleGoogleDriveImport = async (files: Array<{ id: string; name: string; size: number }>) => {
    // Use the existing import API
    const response = await fetch('/api/integrations/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google_meet',
        recordings: files.map((f) => ({
          externalId: f.id,
          downloadUrl: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`,
          title: f.name.replace(/\.[^/.]+$/, ''),
          fileSize: f.size,
        })),
      }),
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Import failed');
    }

    onImportComplete?.(data.data.imported);
    setShowDrivePicker(false);
    setOpen(false);
  };

  const importSources: ImportSource[] = [
    {
      id: 'local',
      name: 'Local Files',
      description: 'Upload video files from your computer',
      icon: <Upload className="h-6 w-6" />,
      available: true,
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Import videos stored in Google Drive',
      icon: <HardDrive className="h-6 w-6" />,
      available: true,
    },
    {
      id: 'google-meet',
      name: 'Google Meet',
      description: 'Import recordings from Google Meet',
      icon: <Video className="h-6 w-6" />,
      available: true,
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Import recordings from Zoom meetings',
      icon: <Video className="h-6 w-6" />,
      available: true,
    },
    {
      id: 'dropbox',
      name: 'Dropbox',
      description: 'Import videos from Dropbox',
      icon: <Cloud className="h-6 w-6" />,
      available: false,
      comingSoon: true,
    },
    {
      id: 'onedrive',
      name: 'OneDrive',
      description: 'Import videos from Microsoft OneDrive',
      icon: <Cloud className="h-6 w-6" />,
      available: false,
      comingSoon: true,
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Import Videos
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileVideo className="h-5 w-5" />
              Import Videos
            </DialogTitle>
            <DialogDescription>
              Choose a source to import videos from. You can upload local files or import from connected services.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="local" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Files
              </TabsTrigger>
              <TabsTrigger value="sources" className="gap-2">
                <Cloud className="h-4 w-4" />
                Import Sources
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="mt-0">
              <BulkVideoUpload
                organizationId={organizationId}
                authorId={authorId}
                channelId={channelId}
                collectionId={collectionId}
                onUploadComplete={handleBulkUploadComplete}
                onCancel={() => setOpen(false)}
              />
            </TabsContent>

            <TabsContent value="sources" className="mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {importSources
                  .filter((s) => s.id !== 'local')
                  .map((source) => (
                    <Card
                      key={source.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        source.available ? 'hover:border-primary' : 'opacity-60 cursor-not-allowed'
                      }`}
                      onClick={() => {
                        if (!source.available) return;
                        switch (source.id) {
                          case 'google-drive':
                            setShowDrivePicker(true);
                            break;
                          case 'google-meet':
                            setShowMeetBrowser(true);
                            break;
                          case 'zoom':
                            setShowZoomBrowser(true);
                            break;
                        }
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="p-2 rounded-lg bg-muted text-muted-foreground">{source.icon}</div>
                          {source.comingSoon && (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                              Coming Soon
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardTitle className="text-base mb-1">{source.name}</CardTitle>
                        <CardDescription className="text-sm">{source.description}</CardDescription>
                      </CardContent>
                    </Card>
                  ))}
              </div>

              {/* Quick Actions */}
              <div className="mt-6 pt-6 border-t">
                <h3 className="text-sm font-medium mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowDrivePicker(true)}>
                    <HardDrive className="h-4 w-4" />
                    Browse Google Drive
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowMeetBrowser(true)}>
                    <Video className="h-4 w-4" />
                    Import from Meet
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowZoomBrowser(true)}>
                    <Video className="h-4 w-4" />
                    Import from Zoom
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Recording Browsers */}
      <RecordingBrowser
        provider="zoom"
        open={showZoomBrowser}
        onClose={() => setShowZoomBrowser(false)}
        organizationSlug={organizationSlug}
      />

      <RecordingBrowser
        provider="google_meet"
        open={showMeetBrowser}
        onClose={() => setShowMeetBrowser(false)}
        organizationSlug={organizationSlug}
      />

      {/* Google Drive Picker */}
      <GoogleDrivePicker
        open={showDrivePicker}
        onClose={() => setShowDrivePicker(false)}
        onImport={handleGoogleDriveImport}
      />
    </>
  );
}

// Standalone Import Button for simpler use cases
interface ImportButtonProps {
  organizationId: string;
  organizationSlug: string;
  authorId: string;
  channelId?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function ImportButton({
  organizationId,
  organizationSlug,
  authorId,
  channelId,
  variant: _variant = 'default', // Reserved for future use
  size: _size = 'default', // Reserved for future use
}: ImportButtonProps) {
  return (
    <ImportHub
      organizationId={organizationId}
      organizationSlug={organizationSlug}
      authorId={authorId}
      channelId={channelId}
    />
  );
}
