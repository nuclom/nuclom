'use client';

/**
 * Vocabulary Settings Page
 *
 * Allows organization admins to manage custom vocabulary terms for improved transcription.
 */

import { logger } from '@nuclom/lib/client-logger';
import { Badge } from '@nuclom/ui/badge';
import { Button } from '@nuclom/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@nuclom/ui/dialog';
import { Input } from '@nuclom/ui/input';
import { Label } from '@nuclom/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@nuclom/ui/select';
import { Textarea } from '@nuclom/ui/textarea';
import { BookText, Building2, Check, Code2, FileUp, Loader2, Package, Plus, Trash2, User, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth/auth-guard';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// Types
// =============================================================================

type VocabularyCategory = 'product' | 'person' | 'technical' | 'acronym' | 'company';

interface VocabularyItem {
  id: string;
  term: string;
  variations: string[];
  category: VocabularyCategory;
  pronunciation: string | null;
  description: string | null;
  createdBy: string;
  createdAt: string;
  createdByUser: {
    id: string;
    name: string;
    image: string | null;
  } | null;
}

const CATEGORY_CONFIG: Record<VocabularyCategory, { label: string; icon: React.ElementType; color: string }> = {
  product: { label: 'Product', icon: Package, color: 'bg-blue-500' },
  person: { label: 'Person', icon: User, color: 'bg-green-500' },
  technical: { label: 'Technical', icon: Code2, color: 'bg-purple-500' },
  acronym: { label: 'Acronym', icon: BookText, color: 'bg-orange-500' },
  company: { label: 'Company', icon: Building2, color: 'bg-red-500' },
};

// =============================================================================
// Main Component
// =============================================================================

function VocabularyContent() {
  const params = useParams();
  const organizationId = params.organization as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<VocabularyItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState('');

  // Form state
  const [term, setTerm] = useState('');
  const [variations, setVariations] = useState('');
  const [category, setCategory] = useState<VocabularyCategory>('technical');
  const [pronunciation, setPronunciation] = useState('');
  const [description, setDescription] = useState('');

  // Filter state
  const [filterCategory, setFilterCategory] = useState<VocabularyCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadVocabulary = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/organizations/${organizationId}/vocabulary`);
      const data = await response.json();

      if (data.success) {
        setVocabulary(data.data);
      }
    } catch (error) {
      logger.error('Failed to load vocabulary', error);
      toast({
        title: 'Error',
        description: 'Failed to load vocabulary',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    loadVocabulary();
  }, [loadVocabulary]);

  const resetForm = () => {
    setTerm('');
    setVariations('');
    setCategory('technical');
    setPronunciation('');
    setDescription('');
    setSelectedItem(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (item: VocabularyItem) => {
    setSelectedItem(item);
    setTerm(item.term);
    setVariations(item.variations.join(', '));
    setCategory(item.category);
    setPronunciation(item.pronunciation || '');
    setDescription(item.description || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!term.trim()) {
      toast({
        title: 'Error',
        description: 'Term is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const variationsArray = variations
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v.length > 0);

      const body = {
        term: term.trim(),
        variations: variationsArray,
        category,
        pronunciation: pronunciation.trim() || undefined,
        description: description.trim() || undefined,
      };

      const url = selectedItem
        ? `/api/organizations/${organizationId}/vocabulary?vocabularyId=${selectedItem.id}`
        : `/api/organizations/${organizationId}/vocabulary`;

      const response = await fetch(url, {
        method: selectedItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: selectedItem ? 'Term updated' : 'Term created',
          description: `"${term}" has been ${selectedItem ? 'updated' : 'added'} to your vocabulary.`,
        });
        setDialogOpen(false);
        resetForm();
        await loadVocabulary();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Failed to save vocabulary term', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save vocabulary',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      const response = await fetch(`/api/organizations/${organizationId}/vocabulary?vocabularyId=${selectedItem.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Term deleted',
          description: `"${selectedItem.term}" has been removed from your vocabulary.`,
        });
        setDeleteDialogOpen(false);
        setSelectedItem(null);
        await loadVocabulary();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Failed to delete vocabulary term', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete vocabulary',
        variant: 'destructive',
      });
    }
  };

  const handleBulkImport = async () => {
    if (!csvText.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter CSV data',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      // Parse CSV (format: term,category,variations,description)
      const lines = csvText.trim().split('\n');
      const items: Array<{
        term: string;
        category: VocabularyCategory;
        variations?: string[];
        description?: string;
      }> = [];

      for (const line of lines) {
        const parts = line.split(',').map((p) => p.trim());
        if (parts.length >= 2) {
          const [termPart, categoryPart, variationsPart, descPart] = parts;
          const cat = categoryPart as VocabularyCategory;
          if (['product', 'person', 'technical', 'acronym', 'company'].includes(cat)) {
            items.push({
              term: termPart,
              category: cat,
              variations: variationsPart ? variationsPart.split('|').map((v) => v.trim()) : undefined,
              description: descPart || undefined,
            });
          }
        }
      }

      if (items.length === 0) {
        toast({
          title: 'Error',
          description: 'No valid entries found. Format: term,category,variations,description',
          variant: 'destructive',
        });
        return;
      }

      const response = await fetch(`/api/organizations/${organizationId}/vocabulary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Import successful',
          description: `${items.length} terms have been imported.`,
        });
        setImportDialogOpen(false);
        setCsvText('');
        await loadVocabulary();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Failed to import vocabulary', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import vocabulary',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter vocabulary
  const filteredVocabulary = vocabulary.filter((item) => {
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesSearch =
      searchTerm === '' ||
      item.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.variations.some((v) => v.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookText className="h-5 w-5" />
              Vocabulary
            </CardTitle>
            <CardDescription>Loading vocabulary...</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookText className="h-5 w-5" />
                Vocabulary
              </CardTitle>
              <CardDescription>Custom terms, names, and jargon to improve transcription accuracy</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <FileUp className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Add Term
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Search terms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as VocabularyCategory | 'all')}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mb-6">
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const count = vocabulary.filter((v) => v.category === key).length;
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${config.color}`} />
                  <span className="text-sm text-muted-foreground">
                    {config.label}: {count}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Vocabulary List */}
      {filteredVocabulary.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {vocabulary.length === 0
                ? 'No vocabulary terms yet. Add terms to improve transcription accuracy.'
                : 'No terms match your search.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredVocabulary.map((item) => {
            const categoryConfig = CATEGORY_CONFIG[item.category];
            const CategoryIcon = categoryConfig.icon;

            return (
              <Card key={item.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${categoryConfig.color}/10`}>
                      <CategoryIcon className={`h-5 w-5 text-${categoryConfig.color.replace('bg-', '')}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{item.term}</span>
                        <Badge variant="secondary" className="text-xs">
                          {categoryConfig.label}
                        </Badge>
                      </div>
                      {item.variations.length > 0 && (
                        <p className="text-sm text-muted-foreground">Also: {item.variations.join(', ')}</p>
                      )}
                      {item.description && <p className="text-sm text-muted-foreground mt-1">{item.description}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedItem(item);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedItem ? 'Edit Term' : 'Add Term'}</DialogTitle>
            <DialogDescription>
              {selectedItem
                ? 'Update the vocabulary term and its variations.'
                : 'Add a new term to your vocabulary for better transcription accuracy.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="term">Term</Label>
              <Input id="term" placeholder="e.g., Kubernetes" value={term} onChange={(e) => setTerm(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as VocabularyCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="variations">Variations (comma-separated)</Label>
              <Input
                id="variations"
                placeholder="e.g., k8s, kube, kubernetes"
                value={variations}
                onChange={(e) => setVariations(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Common misspellings or alternative forms that should be corrected to the main term.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pronunciation">Pronunciation (optional)</Label>
              <Input
                id="pronunciation"
                placeholder="e.g., koo-ber-NET-eez"
                value={pronunciation}
                onChange={(e) => setPronunciation(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Additional context about this term..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !term.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {selectedItem ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Term</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedItem?.term}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Vocabulary from CSV</DialogTitle>
            <DialogDescription>Paste CSV data in the format: term,category,variations,description</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              placeholder={`Kubernetes,technical,k8s|kube,Container orchestration platform
John Smith,person,john|johnny,Engineering lead
AWS,acronym,amazon web services,Cloud provider`}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Categories: product, person, technical, acronym, company
              <br />
              Use | to separate multiple variations
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleBulkImport} disabled={saving || !csvText.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VocabularySettingsPage() {
  return (
    <RequireAuth>
      <VocabularyContent />
    </RequireAuth>
  );
}
