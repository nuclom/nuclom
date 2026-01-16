'use client';

/**
 * Speaker Assignment Modal Component
 *
 * Allows users to manually assign detected speakers (Speaker A, B, C, etc.)
 * to known meeting participants or organization members.
 */

import { Check, Loader2, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { formatDuration } from '@/lib/format-utils';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

export interface DetectedSpeaker {
  /** Speaker label from diarization (e.g., "A", "B", "C") */
  id: string;
  /** Label displayed in UI */
  label: string;
  /** Total speaking time in seconds */
  totalSpeakingTime: number;
  /** Percentage of total speaking time */
  speakingPercentage: number;
  /** Number of speech segments */
  segmentCount: number;
  /** Currently assigned speaker profile ID */
  assignedProfileId?: string | null;
}

export interface SpeakerProfile {
  id: string;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  userId?: string | null;
}

export interface SpeakerAssignment {
  speakerId: string;
  profileId: string | null;
}

export interface SpeakerAssignmentModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when modal should close */
  onOpenChange: (open: boolean) => void;
  /** Video ID for the assignment */
  videoId: string;
  /** Detected speakers from diarization */
  speakers: DetectedSpeaker[];
  /** Available speaker profiles to assign */
  availableProfiles: SpeakerProfile[];
  /** Callback when assignments are saved */
  onSave?: (assignments: SpeakerAssignment[]) => Promise<void>;
  /** Expected speakers from meeting participants */
  expectedSpeakers?: Array<{ name: string; email?: string }>;
}

// =============================================================================
// Speaker Color Mapping
// =============================================================================

const SPEAKER_COLORS: Record<string, string> = {
  A: 'bg-blue-500',
  B: 'bg-green-500',
  C: 'bg-purple-500',
  D: 'bg-orange-500',
  E: 'bg-pink-500',
  F: 'bg-cyan-500',
  G: 'bg-yellow-500',
  H: 'bg-red-500',
};

function getSpeakerColor(speaker: string): string {
  return SPEAKER_COLORS[speaker] || 'bg-gray-500';
}

// =============================================================================
// Component
// =============================================================================

export function SpeakerAssignmentModal({
  open,
  onOpenChange,
  videoId: _videoId,
  speakers,
  availableProfiles,
  onSave,
  expectedSpeakers,
}: SpeakerAssignmentModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [assignments, setAssignments] = useState<Map<string, string | null>>(new Map());

  // Initialize assignments from current speaker data
  useEffect(() => {
    const initialAssignments = new Map<string, string | null>();
    for (const speaker of speakers) {
      initialAssignments.set(speaker.id, speaker.assignedProfileId ?? null);
    }
    setAssignments(initialAssignments);
  }, [speakers]);

  const handleAssignmentChange = useCallback((speakerId: string, profileId: string | null) => {
    setAssignments((prev) => {
      const next = new Map(prev);
      next.set(speakerId, profileId === 'unassigned' ? null : profileId);
      return next;
    });
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);

      const assignmentList: SpeakerAssignment[] = Array.from(assignments.entries()).map(([speakerId, profileId]) => ({
        speakerId,
        profileId,
      }));

      if (onSave) {
        await onSave(assignmentList);
      }

      toast({
        title: 'Speakers assigned',
        description: 'Speaker assignments have been saved successfully.',
      });

      onOpenChange(false);
    } catch (error) {
      console.error('Error saving speaker assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to save speaker assignments. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Find matching profile for expected speaker (by name or email)
  const findMatchingProfile = (expectedName: string, expectedEmail?: string): string | undefined => {
    if (expectedEmail) {
      const byEmail = availableProfiles.find((p) => p.email?.toLowerCase() === expectedEmail.toLowerCase());
      if (byEmail) return byEmail.id;
    }

    const byName = availableProfiles.find((p) => p.displayName.toLowerCase() === expectedName.toLowerCase());
    return byName?.id;
  };

  // Auto-match button handler
  const handleAutoMatch = () => {
    if (!expectedSpeakers || expectedSpeakers.length === 0) return;

    const newAssignments = new Map(assignments);
    const sortedSpeakers = speakers.toSorted((a, b) => b.speakingPercentage - a.speakingPercentage);

    // Simple heuristic: match speakers by order of speaking time
    for (let i = 0; i < Math.min(sortedSpeakers.length, expectedSpeakers.length); i++) {
      const speaker = sortedSpeakers[i];
      const expected = expectedSpeakers[i];
      const profileId = findMatchingProfile(expected.name, expected.email);

      if (profileId) {
        newAssignments.set(speaker.id, profileId);
      }
    }

    setAssignments(newAssignments);
    toast({
      title: 'Auto-matching complete',
      description: 'Review the suggestions and adjust as needed.',
    });
  };

  // Calculate total speaking time
  const totalSpeakingTime = speakers.reduce((sum, s) => sum + s.totalSpeakingTime, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Assign Speakers
          </DialogTitle>
          <DialogDescription>
            Match detected speakers to meeting participants or team members. This helps identify who said what in the
            transcript.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Auto-match button (if expected speakers available) */}
          {expectedSpeakers && expectedSpeakers.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm font-medium">Meeting Participants Available</p>
                <p className="text-xs text-muted-foreground">
                  {expectedSpeakers.length} participants from meeting metadata
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleAutoMatch}>
                Auto-Match
              </Button>
            </div>
          )}

          {/* Speaker list */}
          <ScrollArea className="max-h-96">
            <div className="space-y-4">
              {speakers.map((speaker) => {
                const assignedProfileId = assignments.get(speaker.id);
                const assignedProfile = availableProfiles.find((p) => p.id === assignedProfileId);
                const color = getSpeakerColor(speaker.label);

                return (
                  <div key={speaker.id} className="flex items-start gap-4 p-4 border rounded-lg bg-card">
                    {/* Speaker indicator */}
                    <div className="flex flex-col items-center gap-2">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                          color,
                        )}
                      >
                        {speaker.label}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {speaker.speakingPercentage}%
                      </Badge>
                    </div>

                    {/* Speaker details */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Speaker {speaker.label}</Label>
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(speaker.totalSpeakingTime)} • {speaker.segmentCount} segments
                        </span>
                      </div>

                      {/* Speaking time bar */}
                      <Progress value={speaker.speakingPercentage} className="h-1.5" />

                      {/* Assignment dropdown */}
                      <Select
                        value={assignedProfileId ?? 'unassigned'}
                        onValueChange={(value) => handleAssignmentChange(speaker.id, value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a person..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">
                            <span className="text-muted-foreground">Unassigned</span>
                          </SelectItem>
                          {availableProfiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={profile.avatarUrl ?? undefined} />
                                  <AvatarFallback className="text-xs">
                                    {profile.displayName.slice(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{profile.displayName}</span>
                                {profile.email && (
                                  <span className="text-xs text-muted-foreground">({profile.email})</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Show assigned profile */}
                      {assignedProfile && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Check className="h-3 w-3 text-green-500" />
                          Assigned to {assignedProfile.displayName}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Summary */}
          {speakers.length > 0 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-4">
              <span>
                {speakers.filter((s) => assignments.get(s.id)).length} of {speakers.length} speakers assigned
              </span>
              <span>Total speaking time: {formatDuration(totalSpeakingTime)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Assignments
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
