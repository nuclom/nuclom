"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Play, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IMAGE_SIZES, VIDEO_THUMBNAIL_BLUR_DATA_URL } from "@/lib/image-utils";
import type { SeriesVideoWithDetails } from "@/lib/types";

interface SortableVideoItemProps {
  item: SeriesVideoWithDetails;
  organization: string;
  onRemove: (videoId: string) => void;
  isRemoving: boolean;
}

function SortableVideoItem({ item, organization, onRemove, isRemoving }: SortableVideoItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.videoId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const video = item.video;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 ${isDragging ? "opacity-50 shadow-lg" : ""}`}
    >
      <button type="button" className="cursor-grab active:cursor-grabbing touch-none" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>

      <span className="w-6 text-center text-sm text-muted-foreground font-mono">{item.position + 1}</span>

      <Link
        href={`/${organization}/videos/${video.id}`}
        className="relative h-16 w-28 flex-shrink-0 rounded overflow-hidden group"
      >
        <Image
          src={video.thumbnailUrl || "/placeholder.svg"}
          alt={video.title}
          fill
          sizes={IMAGE_SIZES.thumbnail}
          placeholder="blur"
          blurDataURL={VIDEO_THUMBNAIL_BLUR_DATA_URL}
          className="object-cover group-hover:scale-105 transition-transform"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Play className="h-6 w-6 text-white" />
        </div>
        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1 rounded">
          {video.duration}
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <Link
          href={`/${organization}/videos/${video.id}`}
          className="font-medium hover:text-primary transition-colors line-clamp-1"
        >
          {video.title}
        </Link>
        {video.description && <p className="text-sm text-muted-foreground line-clamp-1">{video.description}</p>}
        <p className="text-xs text-muted-foreground">By {video.author.name}</p>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(item.videoId)}
        disabled={isRemoving}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </Card>
  );
}

interface SortableVideoListProps {
  videos: SeriesVideoWithDetails[];
  organization: string;
  seriesId: string;
  onReorder: (videoIds: string[]) => Promise<void>;
  onRemove: (videoId: string) => Promise<void>;
}

export function SortableVideoList({
  videos,
  organization,
  seriesId: _seriesId,
  onReorder,
  onRemove,
}: SortableVideoListProps) {
  const [items, setItems] = useState(videos);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.videoId === active.id);
      const newIndex = items.findIndex((item) => item.videoId === over.id);

      const newItems = arrayMove(items, oldIndex, newIndex).map((item, index) => ({
        ...item,
        position: index,
      }));

      setItems(newItems);

      try {
        await onReorder(newItems.map((item) => item.videoId));
      } catch {
        // Revert on error
        setItems(videos);
      }
    }
  };

  const handleRemove = async (videoId: string) => {
    setRemovingId(videoId);
    try {
      await onRemove(videoId);
      setItems((prev) => prev.filter((item) => item.videoId !== videoId));
    } finally {
      setRemovingId(null);
    }
  };

  // Update items when videos prop changes
  if (videos !== items && videos.length !== items.length) {
    setItems(videos);
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No videos in this series yet.</p>
        <p className="text-sm mt-1">Click "Add Videos" to get started.</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.videoId)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((item) => (
            <SortableVideoItem
              key={item.videoId}
              item={item}
              organization={organization}
              onRemove={handleRemove}
              isRemoving={removingId === item.videoId}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
