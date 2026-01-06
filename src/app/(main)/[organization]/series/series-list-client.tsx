'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SeriesCard, SeriesForm } from '@/components/series';
import { Button } from '@/components/ui/button';
import type { SeriesProgressWithDetails, SeriesWithVideoCount } from '@/lib/types';

interface SeriesListClientProps {
  organization: string;
  organizationId: string;
  initialSeries: (SeriesWithVideoCount & { progress?: SeriesProgressWithDetails })[];
}

export function SeriesListClient({ organization, organizationId, initialSeries }: SeriesListClientProps) {
  const router = useRouter();
  const [series, setSeries] = useState(initialSeries);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<SeriesWithVideoCount | null>(null);

  const handleEdit = (seriesItem: SeriesWithVideoCount) => {
    setEditingSeries(seriesItem);
    setIsFormOpen(true);
  };

  const handleDelete = async (seriesId: string) => {
    try {
      const response = await fetch(`/api/series/${seriesId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete series');
      }

      setSeries((prev) => prev.filter((s) => s.id !== seriesId));
    } catch (error) {
      console.error('Failed to delete series:', error);
    }
  };

  const handleFormClose = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingSeries(null);
    }
  };

  const handleFormSuccess = () => {
    router.refresh();
    // Refetch series data
    fetchSeries();
  };

  const fetchSeries = async () => {
    try {
      const response = await fetch(`/api/series?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setSeries(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch series:', error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Series</h1>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Series
        </Button>
      </div>

      {series.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No series yet</p>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first series
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {series.map((seriesItem) => (
            <SeriesCard
              key={seriesItem.id}
              series={seriesItem}
              organization={organization}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <SeriesForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        organizationId={organizationId}
        series={editingSeries}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
}
