'use client';

import { Globe, HardDrive, Laptop, Video } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BulkVideoUpload } from '@/components/bulk-video-upload';
import { GoogleDrivePicker } from '@/components/integrations/google-drive-picker';
import { RecordingBrowser } from '@/components/integrations/recording-browser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UrlVideoUpload } from '@/components/url-video-upload';
import { useToast } from '@/hooks/use-toast';

interface UploadHubProps {
  organizationId: string;
  organizationSlug: string;
  authorId: string;
  channelId?: string;
  collectionId?: string;
  redirectPath?: string;
}

type UploadSource = 'computer' | 'url' | 'google-drive' | 'zoom' | 'google-meet';

interface SourceOption {
  id: UploadSource;
  name: string;
  description: string;
  icon: React.ReactNode;
  available: boolean;
  comingSoon?: boolean;
}

export function UploadHub({
  organizationId,
  organizationSlug,
  authorId,
  channelId,
  collectionId,
  redirectPath,
}: UploadHubProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<UploadSource>('computer');
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showZoomBrowser, setShowZoomBrowser] = useState(false);
  const [showMeetBrowser, setShowMeetBrowser] = useState(false);

  const handleUploadComplete = (results: Array<{ videoId: string; title: string }>) => {
    toast({
      title: 'Videos Uploaded',
      description: `${results.length} video${results.length !== 1 ? 's' : ''} uploaded successfully.`,
    });
    if (redirectPath && results.length > 0) {
      router.push(`${redirectPath}/${results[0].videoId}`);
    }
  };

  const handleGoogleDriveImport = async (files: Array<{ id: string; name: string; size: number }>) => {
    const response = await fetch('/api/integrations/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'google_drive',
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

    toast({
      title: 'Import Started',
      description: `${data.data.imported} video${data.data.imported !== 1 ? 's' : ''} are being imported.`,
    });

    setShowDrivePicker(false);

    if (redirectPath) {
      router.push(redirectPath);
    }
  };

  const sourceOptions: SourceOption[] = [
    {
      id: 'computer',
      name: 'From Computer',
      description: 'Upload video files from your device',
      icon: <Laptop className="h-5 w-5" />,
      available: true,
    },
    {
      id: 'url',
      name: 'From URL',
      description: 'Import from a direct video link',
      icon: <Globe className="h-5 w-5" />,
      available: true,
    },
    {
      id: 'google-drive',
      name: 'Google Drive',
      description: 'Import from your Google Drive',
      icon: <HardDrive className="h-5 w-5" />,
      available: true,
    },
    {
      id: 'zoom',
      name: 'Zoom',
      description: 'Import Zoom recordings',
      icon: <Video className="h-5 w-5" />,
      available: true,
    },
    {
      id: 'google-meet',
      name: 'Google Meet',
      description: 'Import Meet recordings',
      icon: <Video className="h-5 w-5" />,
      available: true,
    },
  ];

  const handleSourceSelect = (source: UploadSource) => {
    switch (source) {
      case 'google-drive':
        setShowDrivePicker(true);
        break;
      case 'zoom':
        setShowZoomBrowser(true);
        break;
      case 'google-meet':
        setShowMeetBrowser(true);
        break;
      default:
        setActiveTab(source);
    }
  };

  const getSourceById = (id: UploadSource): SourceOption => {
    const source = sourceOptions.find((s) => s.id === id);
    if (!source) {
      throw new Error(`Source ${id} not found`);
    }
    return source;
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UploadSource)} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          {sourceOptions.map((source) => (
            <TabsTrigger
              key={source.id}
              value={source.id}
              className="gap-2 text-xs sm:text-sm"
              onClick={(e) => {
                if (['google-drive', 'zoom', 'google-meet'].includes(source.id)) {
                  e.preventDefault();
                  handleSourceSelect(source.id);
                }
              }}
            >
              {source.icon}
              <span className="hidden sm:inline">{source.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="computer" className="mt-0">
          <BulkVideoUpload
            organizationId={organizationId}
            authorId={authorId}
            channelId={channelId}
            collectionId={collectionId}
            onUploadComplete={handleUploadComplete}
          />
        </TabsContent>

        <TabsContent value="url" className="mt-0">
          <UrlVideoUpload
            organizationId={organizationId}
            authorId={authorId}
            channelId={channelId}
            collectionId={collectionId}
            onUploadComplete={handleUploadComplete}
          />
        </TabsContent>

        <TabsContent value="google-drive" className="mt-0">
          <IntegrationSourceCard source={getSourceById('google-drive')} onSelect={() => setShowDrivePicker(true)} />
        </TabsContent>

        <TabsContent value="zoom" className="mt-0">
          <IntegrationSourceCard source={getSourceById('zoom')} onSelect={() => setShowZoomBrowser(true)} />
        </TabsContent>

        <TabsContent value="google-meet" className="mt-0">
          <IntegrationSourceCard source={getSourceById('google-meet')} onSelect={() => setShowMeetBrowser(true)} />
        </TabsContent>
      </Tabs>

      {/* Integration Dialogs */}
      <GoogleDrivePicker
        open={showDrivePicker}
        onClose={() => setShowDrivePicker(false)}
        onImport={handleGoogleDriveImport}
      />

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
    </div>
  );
}

function IntegrationSourceCard({ source, onSelect }: { source: SourceOption; onSelect: () => void }) {
  return (
    <Card
      className="w-full max-w-3xl mx-auto cursor-pointer transition-all hover:shadow-md hover:border-primary"
      onClick={onSelect}
    >
      <CardHeader className="text-center">
        <div className="mx-auto p-4 rounded-full bg-muted text-muted-foreground mb-2">{source.icon}</div>
        <CardTitle>{source.name}</CardTitle>
        <CardDescription>{source.description}</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="text-sm text-muted-foreground">Click to browse and select videos to import</p>
        {source.id === 'google-drive' && (
          <p className="text-xs text-muted-foreground mt-2">Requires Google account to be connected in settings</p>
        )}
        {source.id === 'zoom' && (
          <p className="text-xs text-muted-foreground mt-2">Requires Zoom account to be connected in settings</p>
        )}
        {source.id === 'google-meet' && (
          <p className="text-xs text-muted-foreground mt-2">Requires Google account to be connected in settings</p>
        )}
      </CardContent>
    </Card>
  );
}
