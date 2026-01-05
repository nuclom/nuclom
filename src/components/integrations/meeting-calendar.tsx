"use client";

import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { clientLogger } from "@/lib/client-logger";

interface Integration {
  id: string;
  provider: "zoom" | "google_meet";
  connected: boolean;
  expiresAt: string | null;
  metadata: {
    email?: string;
    accountId?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  meetingLink?: string;
  provider: "zoom" | "google_meet";
  hasRecording?: boolean;
  attendees?: Array<{ email: string; name?: string; status?: string }>;
  conferenceId?: string;
}

interface MeetingCalendarProps {
  integrations: Integration[];
  organizationSlug: string;
  onImportRecording: (provider: "zoom" | "google_meet") => void;
}

export function MeetingCalendar({
  integrations,
  organizationSlug: _organizationSlug,
  onImportRecording,
}: MeetingCalendarProps) {
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [_activeView, _setActiveView] = useState<"month" | "week" | "day">("month");

  const hasZoom = integrations.some((i) => i.provider === "zoom");
  const hasGoogle = integrations.some((i) => i.provider === "google_meet");

  const loadEvents = useCallback(async () => {
    if (integrations.length === 0) return;

    try {
      setLoading(true);

      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);

      const allEvents: CalendarEvent[] = [];

      // Load events from Google Calendar if connected
      if (hasGoogle) {
        try {
          const response = await fetch(
            `/api/integrations/google/calendar?from=${startDate.toISOString()}&to=${endDate.toISOString()}`,
          );
          const data = await response.json();

          if (data.success && data.data?.events) {
            const googleEvents: CalendarEvent[] = data.data.events.map(
              (event: {
                id: string;
                summary: string;
                description?: string;
                start: { dateTime?: string; date?: string };
                end: { dateTime?: string; date?: string };
                hangoutLink?: string;
                attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
                conferenceData?: { conferenceId?: string };
              }) => ({
                id: event.id,
                title: event.summary || "Untitled Meeting",
                description: event.description,
                start: new Date(event.start.dateTime || event.start.date || ""),
                end: new Date(event.end.dateTime || event.end.date || ""),
                meetingLink: event.hangoutLink,
                provider: "google_meet" as const,
                attendees: event.attendees?.map((a) => ({
                  email: a.email,
                  name: a.displayName,
                  status: a.responseStatus,
                })),
                conferenceId: event.conferenceData?.conferenceId,
              }),
            );
            allEvents.push(...googleEvents);
          }
        } catch (error) {
          clientLogger.error("Failed to load Google Calendar events", error);
        }
      }

      // Load events from Zoom if connected
      if (hasZoom) {
        try {
          const response = await fetch(
            `/api/integrations/zoom/meetings?from=${startDate.toISOString()}&to=${endDate.toISOString()}`,
          );
          const data = await response.json();

          if (data.success && data.data?.meetings) {
            const zoomEvents: CalendarEvent[] = data.data.meetings.map(
              (meeting: {
                id: string;
                topic: string;
                agenda?: string;
                start_time: string;
                duration: number;
                join_url?: string;
              }) => ({
                id: meeting.id,
                title: meeting.topic || "Zoom Meeting",
                description: meeting.agenda,
                start: new Date(meeting.start_time),
                end: new Date(new Date(meeting.start_time).getTime() + meeting.duration * 60000),
                meetingLink: meeting.join_url,
                provider: "zoom" as const,
              }),
            );
            allEvents.push(...zoomEvents);
          }
        } catch (error) {
          clientLogger.error("Failed to load Zoom meetings", error);
        }
      }

      // Sort events by start time
      allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
      setEvents(allEvents);
    } catch (error) {
      clientLogger.error("Failed to load calendar events", error);
      toast({
        title: "Error",
        description: "Failed to load calendar events",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [integrations, currentMonth, hasZoom, hasGoogle, toast]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentMonth((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(new Date());
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => isSameDay(event.start, date));
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  // Generate calendar days
  const renderCalendarDays = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days: React.ReactElement[] = [];
    let day = startDate;

    while (day <= endDate) {
      const currentDay = day;
      const dayEvents = getEventsForDate(currentDay);
      const isSelected = selectedDate && isSameDay(currentDay, selectedDate);
      const isCurrentMonth = isSameMonth(currentDay, currentMonth);
      const isTodayDate = isToday(currentDay);

      days.push(
        <button
          key={currentDay.toISOString()}
          type="button"
          onClick={() => setSelectedDate(currentDay)}
          className={`
            relative min-h-[80px] p-1 text-left border-b border-r transition-colors
            ${isCurrentMonth ? "bg-background" : "bg-muted/30 text-muted-foreground"}
            ${isSelected ? "bg-primary/10 ring-2 ring-primary ring-inset" : "hover:bg-muted/50"}
            ${isTodayDate ? "font-semibold" : ""}
          `}
        >
          <span
            className={`
            inline-flex items-center justify-center w-6 h-6 text-sm rounded-full
            ${isTodayDate ? "bg-primary text-primary-foreground" : ""}
          `}
          >
            {format(currentDay, "d")}
          </span>
          <div className="mt-1 space-y-0.5 overflow-hidden">
            {dayEvents.slice(0, 3).map((event) => (
              <div
                key={event.id}
                className={`
                  text-[10px] px-1 py-0.5 rounded truncate
                  ${event.provider === "zoom" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"}
                `}
              >
                {event.title}
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} more</div>
            )}
          </div>
        </button>,
      );

      day = addDays(day, 1);
    }

    return days;
  };

  if (integrations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Integrations Connected</h3>
          <p className="text-muted-foreground text-center max-w-md mb-4">
            Connect Zoom or Google Meet to view your meeting calendar and import recordings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Calendar View */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <CardTitle className="text-lg">{format(currentMonth, "MMMM yyyy")}</CardTitle>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigateMonth("prev")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => navigateMonth("next")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div>
              {/* Day headers */}
              <div className="grid grid-cols-7 text-center text-sm font-medium text-muted-foreground border-b">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="py-2 border-r last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 border-l">{renderCalendarDays()}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Day Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Select a date"}
          </CardTitle>
          <CardDescription>
            {selectedDateEvents.length > 0
              ? `${selectedDateEvents.length} meeting${selectedDateEvents.length !== 1 ? "s" : ""}`
              : "No meetings scheduled"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            {selectedDateEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <VideoOff className="h-8 w-8 mb-2" />
                <p className="text-sm">No meetings on this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`
                      p-3 rounded-lg border transition-colors
                      ${event.provider === "zoom" ? "border-blue-200 dark:border-blue-800" : "border-green-200 dark:border-green-800"}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{event.title}</p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {format(event.start, "h:mm a")} - {format(event.end, "h:mm a")}
                          </span>
                        </div>
                        {event.attendees && event.attendees.length > 0 && (
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <Users className="h-3.5 w-3.5" />
                            <span>
                              {event.attendees.length} attendee{event.attendees.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {event.provider === "zoom" ? "Zoom" : "Meet"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      {event.meetingLink && (
                        <Button variant="outline" size="sm" asChild className="h-7 text-xs">
                          <Link href={event.meetingLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Join
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onImportRecording(event.provider)}
                      >
                        <Video className="h-3 w-3 mr-1" />
                        Recordings
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
