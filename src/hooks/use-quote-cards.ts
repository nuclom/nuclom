"use client";

/**
 * Quote Cards Hook
 *
 * React hook for managing quote cards with CRUD operations and optimistic updates.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

// =============================================================================
// Types
// =============================================================================

export interface QuoteCard {
  id: string;
  videoId: string;
  organizationId: string;
  quoteText: string;
  speaker: string | null;
  timestampSeconds: number | null;
  template: {
    templateId: string;
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    brandingEnabled?: boolean;
  } | null;
  imageUrl: string | null;
  storageKey: string | null;
  createdBy: string | null;
  createdAt: string;
  creator?: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;
}

export interface CreateQuoteCardInput {
  quoteText: string;
  speaker?: string;
  timestampSeconds?: number;
  templateId?: string;
}

export interface UpdateQuoteCardInput {
  quoteText?: string;
  speaker?: string | null;
}

interface UseQuoteCardsOptions {
  videoId: string;
  initialCards?: QuoteCard[];
}

interface UseQuoteCardsResult {
  cards: QuoteCard[];
  loading: boolean;
  error: string | null;
  createCard: (data: CreateQuoteCardInput) => Promise<void>;
  updateCard: (id: string, data: UpdateQuoteCardInput) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

// =============================================================================
// useQuoteCards Hook
// =============================================================================

export function useQuoteCards({ videoId, initialCards = [] }: UseQuoteCardsOptions): UseQuoteCardsResult {
  const router = useRouter();
  const { toast } = useToast();
  const [cards, setCards] = useState<QuoteCard[]>(initialCards);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch quote cards
  const fetchCards = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/videos/${videoId}/quote-cards`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch quote cards");
      }

      const result = await response.json();
      setCards(result.data || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch quote cards";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [videoId, toast]);

  // Create a new quote card
  const createCard = useCallback(
    async (data: CreateQuoteCardInput) => {
      try {
        const response = await fetch(`/api/videos/${videoId}/quote-cards`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create quote card");
        }

        const result = await response.json();

        // Optimistic update
        if (result.success && result.data) {
          setCards((prev) => [...prev, result.data]);
        }

        toast({
          title: "Quote card created",
          description: "Your quote card has been created successfully.",
        });

        router.refresh();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to create quote card";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        throw err;
      }
    },
    [videoId, toast, router],
  );

  // Update an existing quote card
  const updateCard = useCallback(
    async (id: string, data: UpdateQuoteCardInput) => {
      try {
        const response = await fetch(`/api/quote-cards/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update quote card");
        }

        const result = await response.json();

        // Optimistic update
        if (result.success && result.data) {
          setCards((prev) => prev.map((card) => (card.id === id ? result.data : card)));
        }

        toast({
          title: "Quote card updated",
          description: "Your quote card has been updated successfully.",
        });

        router.refresh();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to update quote card";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        throw err;
      }
    },
    [toast, router],
  );

  // Delete a quote card
  const deleteCard = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/quote-cards/${id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to delete quote card");
        }

        // Optimistic update
        setCards((prev) => prev.filter((card) => card.id !== id));

        toast({
          title: "Quote card deleted",
          description: "Your quote card has been deleted successfully.",
        });

        router.refresh();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to delete quote card";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
        throw err;
      }
    },
    [toast, router],
  );

  // Fetch cards on mount if no initial cards
  useEffect(() => {
    if (initialCards.length === 0) {
      fetchCards();
    }
  }, [initialCards.length, fetchCards]);

  return {
    cards,
    loading,
    error,
    createCard,
    updateCard,
    deleteCard,
    refetch: fetchCards,
  };
}
