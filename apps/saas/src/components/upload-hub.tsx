'use client';

import { cn } from '@nuclom/lib/utils';
import { Link } from '@vercel/microfrontends/next/client';
import {
  ArrowRight,
  CheckCircle2,
  Cloud,
  FileVideo,
  Laptop,
  Link2,
  Loader2,
  Plus,
  Settings,
  Upload,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BulkVideoUpload } from '@/components/bulk-video-upload';
import { GoogleDrivePicker } from '@/components/integrations/google-drive-picker';
import { RecordingBrowser } from '@/components/integrations/recording-browser';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UrlVideoUpload } from '@/components/url-video-upload';
import { useToast } from '@/hooks/use-toast';

interface UploadHubProps {
  organizationId: string;
  organizationSlug: string;
  authorId: string;
  collectionId?: string;
  redirectPath?: string;
}

type UploadView = 'home' | 'computer' | 'url';
type IntegrationProvider = 'google_drive' | 'zoom' | 'google_meet';

interface IntegrationStatus {
  connected: boolean;
  accountName?: string;
  loading: boolean;
}

interface GoogleDriveFile {
  id: string;
  name: string;
  size: number;
}

export function UploadHub({ organizationId, organizationSlug, authorId, collectionId, redirectPath }: UploadHubProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<UploadView>('home');
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showZoomBrowser, setShowZoomBrowser] = useState(false);
  const [showMeetBrowser, setShowMeetBrowser] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Integration connection status
  const [integrations, setIntegrations] = useState<Record<IntegrationProvider, IntegrationStatus>>({
    google_drive: { connected: false, loading: true },
    zoom: { connected: false, loading: true },
    google_meet: { connected: false, loading: true },
  });

  // Fetch integration status on mount
  useEffect(() => {
    const fetchIntegrations = async () => {
      try {
        const response = await fetch('/api/integrations');
        const data = await response.json();

        if (data.success && data.data) {
          const connected: Record<IntegrationProvider, IntegrationStatus> = {
            google_drive: { connected: false, loading: false },
            zoom: { connected: false, loading: false },
            google_meet: { connected: false, loading: false },
          };

          for (const integration of data.data) {
            if (integration.provider === 'google') {
              connected.google_drive = {
                connected: true,
                accountName: integration.accountEmail || 'Connected',
                loading: false,
              };
              connected.google_meet = {
                connected: true,
                accountName: integration.accountEmail || 'Connected',
                loading: false,
              };
            } else if (integration.provider === 'zoom') {
              connected.zoom = {
                connected: true,
                accountName: integration.accountEmail || 'Connected',
                loading: false,
              };
            }
          }

          setIntegrations(connected);
        }
      } catch {
        setIntegrations({
          google_drive: { connected: false, loading: false },
          zoom: { connected: false, loading: false },
          google_meet: { connected: false, loading: false },
        });
      }
    };

    fetchIntegrations();
  }, []);

  const handleUploadComplete = (results: Array<{ videoId: string; title: string }>) => {
    toast({
      title: 'Videos Uploaded',
      description: `${results.length} video${results.length !== 1 ? 's' : ''} uploaded successfully.`,
    });
    if (redirectPath && results.length > 0) {
      router.push(`${redirectPath}/${results[0].videoId}`);
    }
  };

  const handleGoogleDriveImport = async (files: Array<GoogleDriveFile>) => {
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

  const handleIntegrationClick = (provider: IntegrationProvider) => {
    const status = integrations[provider];

    if (!status.connected) {
      // Redirect to settings to connect
      toast({
        title: 'Not Connected',
        description: `Connect your ${getProviderName(provider)} account in settings first.`,
        action: (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/org/${organizationSlug}/settings/integrations`}>
              <Settings className="h-4 w-4 mr-1" />
              Settings
            </Link>
          </Button>
        ),
      });
      return;
    }

    switch (provider) {
      case 'google_drive':
        setShowDrivePicker(true);
        break;
      case 'zoom':
        setShowZoomBrowser(true);
        break;
      case 'google_meet':
        setShowMeetBrowser(true);
        break;
    }
  };

  const getProviderName = (provider: IntegrationProvider): string => {
    switch (provider) {
      case 'google_drive':
        return 'Google Drive';
      case 'zoom':
        return 'Zoom';
      case 'google_meet':
        return 'Google Meet';
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    // Navigate to computer upload and files will be handled there
    setCurrentView('computer');
  }, []);

  // Show upload component based on current view
  if (currentView === 'computer') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setCurrentView('home')} className="gap-2">
          <ArrowRight className="h-4 w-4 rotate-180" />
          Back to upload options
        </Button>
        <BulkVideoUpload
          organizationId={organizationId}
          authorId={authorId}
          collectionId={collectionId}
          onUploadComplete={handleUploadComplete}
          onCancel={() => setCurrentView('home')}
        />
      </div>
    );
  }

  if (currentView === 'url') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setCurrentView('home')} className="gap-2">
          <ArrowRight className="h-4 w-4 rotate-180" />
          Back to upload options
        </Button>
        <UrlVideoUpload
          organizationId={organizationId}
          authorId={authorId}
          collectionId={collectionId}
          onUploadComplete={handleUploadComplete}
          onCancel={() => setCurrentView('home')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Drop Zone */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group',
          dragActive
            ? 'border-primary bg-primary/5 scale-[1.01] shadow-lg shadow-primary/10'
            : 'border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30 hover:shadow-md',
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => setCurrentView('computer')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setCurrentView('computer');
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Drop zone for video upload"
      >
        {/* Animated Background Gradient */}
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 transition-opacity duration-500',
            dragActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        />

        {/* Animated Corner Accents */}
        <div
          className={cn(
            'absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 rounded-tl-2xl transition-all duration-300',
            dragActive ? 'border-primary opacity-100' : 'border-transparent opacity-0 group-hover:border-primary/30 group-hover:opacity-100',
          )}
        />
        <div
          className={cn(
            'absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 rounded-tr-2xl transition-all duration-300',
            dragActive ? 'border-primary opacity-100' : 'border-transparent opacity-0 group-hover:border-primary/30 group-hover:opacity-100',
          )}
        />
        <div
          className={cn(
            'absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 rounded-bl-2xl transition-all duration-300',
            dragActive ? 'border-primary opacity-100' : 'border-transparent opacity-0 group-hover:border-primary/30 group-hover:opacity-100',
          )}
        />
        <div
          className={cn(
            'absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 rounded-br-2xl transition-all duration-300',
            dragActive ? 'border-primary opacity-100' : 'border-transparent opacity-0 group-hover:border-primary/30 group-hover:opacity-100',
          )}
        />

        <div className="relative p-12 text-center">
          {/* Animated Icon Container */}
          <div
            className={cn(
              'inline-flex p-6 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 mb-6 transition-all duration-300',
              dragActive ? 'scale-125 bg-primary/15' : 'group-hover:scale-110',
            )}
          >
            <div className="relative">
              <Upload
                className={cn(
                  'h-12 w-12 text-primary transition-all duration-300',
                  dragActive && 'animate-bounce',
                )}
              />
              {/* Pulse ring when dragging */}
              {dragActive && (
                <span className="absolute inset-0 rounded-full animate-ping bg-primary/20" />
              )}
            </div>
          </div>

          <h2 className="text-2xl font-semibold mb-2 transition-colors">
            {dragActive ? (
              <span className="text-primary">Release to upload</span>
            ) : (
              'Drag and drop videos to upload'
            )}
          </h2>
          <p className="text-muted-foreground mb-6">
            {dragActive ? 'Your files are ready to be uploaded' : 'or click to browse from your computer'}
          </p>

          <Button size="lg" className="gap-2 transition-transform group-hover:scale-105">
            <Laptop className="h-5 w-5" />
            Choose Files
          </Button>

          {/* Feature highlights */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Auto transcription
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              AI summaries
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
              Up to 5GB per file
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Supports MP4, MOV, AVI, MKV, WebM, and more
          </p>
        </div>
      </div>

      {/* Upload Sources Grid */}
      <div className="space-y-6">
        {/* Local Sources */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Laptop className="h-4 w-4" />
            Upload from Device
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SourceCard
              icon={<FileVideo className="h-6 w-6" />}
              title="Upload Files"
              description="Select multiple video files from your computer"
              onClick={() => setCurrentView('computer')}
              accentColor="blue"
            />
            <SourceCard
              icon={<Link2 className="h-6 w-6" />}
              title="Import from URL"
              description="Paste a link to import videos from the web"
              onClick={() => setCurrentView('url')}
              accentColor="purple"
            />
          </div>
        </div>

        {/* Connected Services */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Import from Services
            </h3>
            <Button variant="ghost" size="sm" asChild className="text-xs">
              <Link href={`/org/${organizationSlug}/settings/integrations`}>
                <Settings className="h-3 w-3 mr-1" />
                Manage connections
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <IntegrationCard
              icon={<GoogleDriveIcon />}
              title="Google Drive"
              description="Browse and import videos"
              status={integrations.google_drive}
              onClick={() => handleIntegrationClick('google_drive')}
              connectUrl={`/org/${organizationSlug}/settings/integrations`}
            />
            <IntegrationCard
              icon={<ZoomIcon />}
              title="Zoom"
              description="Import cloud recordings"
              status={integrations.zoom}
              onClick={() => handleIntegrationClick('zoom')}
              connectUrl={`/org/${organizationSlug}/settings/integrations`}
            />
            <IntegrationCard
              icon={<GoogleMeetIcon />}
              title="Google Meet"
              description="Import meeting recordings"
              status={integrations.google_meet}
              onClick={() => handleIntegrationClick('google_meet')}
              connectUrl={`/org/${organizationSlug}/settings/integrations`}
            />
          </div>
        </div>
      </div>

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

// Local source card component
interface SourceCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  accentColor: 'blue' | 'purple' | 'green' | 'orange';
}

function SourceCard({ icon, title, description, onClick, accentColor }: SourceCardProps) {
  const colorClasses = {
    blue: 'from-blue-500/10 to-blue-600/5 text-blue-600 dark:text-blue-400 group-hover:from-blue-500/20 group-hover:to-blue-600/10',
    purple:
      'from-purple-500/10 to-purple-600/5 text-purple-600 dark:text-purple-400 group-hover:from-purple-500/20 group-hover:to-purple-600/10',
    green:
      'from-green-500/10 to-green-600/5 text-green-600 dark:text-green-400 group-hover:from-green-500/20 group-hover:to-green-600/10',
    orange:
      'from-orange-500/10 to-orange-600/5 text-orange-600 dark:text-orange-400 group-hover:from-orange-500/20 group-hover:to-orange-600/10',
  };

  return (
    <Card
      className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div
            className={cn('p-3 rounded-xl bg-gradient-to-br transition-colors duration-200', colorClasses[accentColor])}
          >
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium mb-1 group-hover:text-primary transition-colors">{title}</h4>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>
      </CardContent>
    </Card>
  );
}

// Integration card component with connection status
interface IntegrationCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: IntegrationStatus;
  onClick: () => void;
  connectUrl: string;
}

function IntegrationCard({ icon, title, description, status, onClick, connectUrl }: IntegrationCardProps) {
  return (
    <Card
      className={cn(
        'group cursor-pointer transition-all duration-200',
        status.connected
          ? 'hover:shadow-md hover:border-primary/30'
          : 'opacity-80 hover:opacity-100 hover:border-muted-foreground/30',
      )}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-xl bg-muted/50 group-hover:bg-muted transition-colors">{icon}</div>
          <div>
            <h4 className="font-medium mb-1 group-hover:text-primary transition-colors">{title}</h4>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>

          {/* Connection Status */}
          {status.loading ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking...
            </div>
          ) : status.connected ? (
            <Badge
              variant="secondary"
              className="gap-1 text-xs bg-green-500/10 text-green-600 dark:text-green-400 border-0"
            >
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </Badge>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              asChild
              onClick={(e) => e.stopPropagation()}
            >
              <Link href={connectUrl}>
                <Plus className="h-3 w-3" />
                Connect
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Brand icons
function GoogleDriveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path d="M8.24 2.5L1.87 13.5L4.62 18.5L11 7.5L8.24 2.5Z" fill="#0066DA" />
      <path d="M15.76 2.5H8.24L14.62 13.5H22.13L15.76 2.5Z" fill="#00AC47" />
      <path d="M1.87 13.5L4.62 18.5H19.38L22.13 13.5H1.87Z" fill="#FFBA00" />
    </svg>
  );
}

function ZoomIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <rect width="24" height="24" rx="4" fill="#2D8CFF" />
      <path
        d="M5.5 8.5C5.5 7.67 6.17 7 7 7H13C13.83 7 14.5 7.67 14.5 8.5V15.5C14.5 16.33 13.83 17 13 17H7C6.17 17 5.5 16.33 5.5 15.5V8.5Z"
        fill="white"
      />
      <path d="M15.5 10L18.5 8V16L15.5 14V10Z" fill="white" />
    </svg>
  );
}

function GoogleMeetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
      <path d="M12 4L20 8V16L12 20L4 16V8L12 4Z" fill="#00897B" />
      <path d="M12 4L20 8L12 12L4 8L12 4Z" fill="#00BFA5" />
      <path d="M12 12V20L4 16V8L12 12Z" fill="#00897B" />
      <path d="M12 12V20L20 16V8L12 12Z" fill="#004D40" />
    </svg>
  );
}
