"use client";

import { Loader2, MoreVertical, Plus, Quote, Trash2 } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { QuoteCard } from "@/hooks/use-quote-cards";
import { useQuoteCards } from "@/hooks/use-quote-cards";
import { formatTime } from "@/lib/format-utils";
import { CreateQuoteCardDialog } from "./create-quote-card-dialog";

interface QuoteCardsProps {
  videoId: string;
  initialCards?: QuoteCard[];
  currentUser?: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
  onTimestampClick?: (seconds: number) => void;
}

export function QuoteCards({ videoId, initialCards = [], currentUser, onTimestampClick }: QuoteCardsProps) {
  const { cards, loading, deleteCard, refetch } = useQuoteCards({
    videoId,
    initialCards,
  });

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  const handleDelete = async (cardId: string) => {
    if (!confirm("Are you sure you want to delete this quote card?")) {
      return;
    }

    setDeletingCardId(cardId);
    try {
      await deleteCard(cardId);
    } finally {
      setDeletingCardId(null);
    }
  };

  const handleSuccess = () => {
    refetch();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Quote className="h-4 w-4" />
            Quote Cards ({cards.length})
          </CardTitle>
          {currentUser && (
            <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Quote Card
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading && cards.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading quote cards...
            </div>
          ) : cards.length === 0 ? (
            <div className="text-center py-8">
              <Quote className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">No quote cards yet</p>
              {currentUser && (
                <p className="text-muted-foreground text-xs mt-1">Create your first quote card to share!</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {cards.map((card) => (
                <div
                  key={card.id}
                  className="relative p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <blockquote className="text-base italic border-l-4 border-primary pl-4 mb-3">
                        "{card.quoteText}"
                      </blockquote>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          {card.speaker && (
                            <>
                              <span className="font-medium">— {card.speaker}</span>
                              {card.timestampSeconds !== null && <span>•</span>}
                            </>
                          )}
                          {card.timestampSeconds !== null && (
                            <button
                              type="button"
                              onClick={() => onTimestampClick?.(card.timestampSeconds ?? 0)}
                              className="flex items-center gap-1 hover:text-primary transition-colors font-mono"
                            >
                              {formatTime(card.timestampSeconds)}
                            </button>
                          )}
                        </div>

                        {currentUser?.id === card.createdBy && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">More options</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleDelete(card.id)}
                                disabled={deletingCardId === card.id}
                                className="text-destructive focus:text-destructive"
                              >
                                {deletingCardId === card.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Deleting...
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>

                      {card.creator && (
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={card.creator.image || undefined} alt={card.creator.name || "User"} />
                            <AvatarFallback className="text-xs">{card.creator.name?.[0] || "U"}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            Created by {card.creator.name || "Unknown"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {currentUser && (
        <CreateQuoteCardDialog
          videoId={videoId}
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}
