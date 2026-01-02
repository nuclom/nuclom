"use client";

import { CalendarIcon, Filter, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DecisionTag, User } from "@/lib/db/schema";
import { format } from "date-fns";

interface DecisionFiltersProps {
  organization: string;
  tags?: DecisionTag[];
  members?: User[];
}

export function DecisionFilters({ organization, tags = [], members = [] }: DecisionFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Current filter values
  const status = searchParams.get("status") || "";
  const source = searchParams.get("source") || "";
  const search = searchParams.get("search") || "";
  const topics = searchParams.get("topics")?.split(",").filter(Boolean) || [];
  const participants = searchParams.get("participants")?.split(",").filter(Boolean) || [];
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const hasActiveFilters = status || source || search || topics.length > 0 || participants.length > 0 || from || to;

  const updateFilter = useCallback(
    (key: string, value: string | string[]) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());

        if (Array.isArray(value)) {
          if (value.length === 0) {
            params.delete(key);
          } else {
            params.set(key, value.join(","));
          }
        } else if (value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }

        // Reset to page 1 when filtering
        params.delete("page");

        router.push(`/${organization}/decisions?${params.toString()}`);
      });
    },
    [router, organization, searchParams]
  );

  const clearAllFilters = useCallback(() => {
    startTransition(() => {
      router.push(`/${organization}/decisions`);
    });
  }, [router, organization]);

  const toggleTopic = (tagName: string) => {
    const newTopics = topics.includes(tagName)
      ? topics.filter((t) => t !== tagName)
      : [...topics, tagName];
    updateFilter("topics", newTopics);
  };

  const toggleParticipant = (userId: string) => {
    const newParticipants = participants.includes(userId)
      ? participants.filter((p) => p !== userId)
      : [...participants, userId];
    updateFilter("participants", newParticipants);
  };

  const activeFilterCount = [
    status,
    source,
    search,
    topics.length > 0,
    participants.length > 0,
    from,
    to,
  ].filter(Boolean).length;

  return (
    <div className={cn("space-y-4", isPending && "opacity-70 pointer-events-none")}>
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search decisions..."
          value={search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="pl-10"
        />
        {search && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
            onClick={() => updateFilter("search", "")}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status Filter */}
        <Select value={status} onValueChange={(v) => updateFilter("status", v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="decided">Decided</SelectItem>
            <SelectItem value="proposed">Proposed</SelectItem>
            <SelectItem value="superseded">Superseded</SelectItem>
          </SelectContent>
        </Select>

        {/* Source Filter */}
        <Select value={source} onValueChange={(v) => updateFilter("source", v === "all" ? "" : v)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="adhoc">Ad-hoc</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>

        {/* Topics Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[120px]">
              <Filter className="mr-2 h-4 w-4" />
              Topics
              {topics.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {topics.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[240px] p-3" align="start">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Filter by topic</h4>
              <div className="flex flex-wrap gap-1 max-h-[200px] overflow-y-auto">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTopic(tag.name)}
                    className={cn(
                      "px-2 py-1 text-xs rounded-full border transition-colors",
                      topics.includes(tag.name)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    #{tag.name}
                  </button>
                ))}
                {tags.length === 0 && (
                  <span className="text-sm text-muted-foreground">No topics available</span>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Participants Filter */}
        {members.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                Participants
                {participants.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {participants.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-3" align="start">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Filter by participant</h4>
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {members.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => toggleParticipant(member.id)}
                      className={cn(
                        "w-full px-2 py-1.5 text-sm rounded-md text-left transition-colors",
                        participants.includes(member.id)
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      )}
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Date Range - From */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-[140px] justify-start text-left font-normal", !from && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {from ? format(new Date(from), "PP") : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={from ? new Date(from) : undefined}
              onSelect={(date) => updateFilter("from", date ? format(date, "yyyy-MM-dd") : "")}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Date Range - To */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn("w-[140px] justify-start text-left font-normal", !to && "text-muted-foreground")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {to ? format(new Date(to), "PP") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={to ? new Date(to) : undefined}
              onSelect={(date) => updateFilter("to", date ? format(date, "yyyy-MM-dd") : "")}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            <X className="mr-1 h-3 w-3" />
            Clear ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Active Filter Tags */}
      {(topics.length > 0 || participants.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <Badge key={topic} variant="secondary" className="gap-1">
              #{topic}
              <button
                type="button"
                onClick={() => toggleTopic(topic)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {participants.map((participantId) => {
            const member = members.find((m) => m.id === participantId);
            return (
              <Badge key={participantId} variant="secondary" className="gap-1">
                {member?.name || participantId}
                <button
                  type="button"
                  onClick={() => toggleParticipant(participantId)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
