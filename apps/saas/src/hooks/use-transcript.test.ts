import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TranscriptSegment } from '@/lib/db/schema';
import { useTranscript } from './use-transcript';

// Store original fetch to restore later
const originalFetch = global.fetch;

// Create mock fetch
const mockFetch = vi.fn();

describe('useTranscript', () => {
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    global.fetch = originalFetch;
  });

  const mockTranscriptData = {
    segments: [
      { text: 'Hello world', startTime: 0, endTime: 1 },
      { text: 'How are you', startTime: 1, endTime: 2 },
    ] as TranscriptSegment[],
    processingStatus: 'completed' as const,
  };

  it('should initialize with empty segments when initialSegments provided as empty array', () => {
    const { result } = renderHook(() => useTranscript({ videoId: 'video-123', initialSegments: [], autoFetch: false }));

    expect(result.current.segments).toEqual([]);
    // When initialSegments is provided (even empty), isLoading should be false
    expect(result.current.isLoading).toBe(false);
  });

  it('should initialize with initialSegments when provided', () => {
    const initialSegments: TranscriptSegment[] = [{ text: 'Initial', startTime: 0, endTime: 1 }];

    const { result } = renderHook(() =>
      useTranscript({
        videoId: 'video-123',
        initialSegments,
        autoFetch: false,
      }),
    );

    expect(result.current.segments).toEqual(initialSegments);
    expect(result.current.isLoading).toBe(false);
  });

  it('should fetch transcript data on mount when autoFetch is true', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockTranscriptData }),
    });

    const { result } = renderHook(() => useTranscript({ videoId: 'video-123', autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/videos/video-123/transcript');
    expect(result.current.segments).toEqual(mockTranscriptData.segments);
    expect(result.current.processingStatus).toBe('completed');
  });

  it('should not fetch when initialSegments are provided', async () => {
    const initialSegments: TranscriptSegment[] = [{ text: 'Initial', startTime: 0, endTime: 1 }];

    renderHook(() =>
      useTranscript({
        videoId: 'video-123',
        initialSegments,
        autoFetch: true,
      }),
    );

    // Wait a bit to ensure no fetch is triggered
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should handle fetch error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Not found' }),
    });

    const { result } = renderHook(() => useTranscript({ videoId: 'video-123', autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Not found');
    expect(result.current.segments).toEqual([]);
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useTranscript({ videoId: 'video-123', autoFetch: true }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('should save segments successfully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const { result } = renderHook(() => useTranscript({ videoId: 'video-123', autoFetch: false }));

    const newSegments: TranscriptSegment[] = [{ text: 'Updated', startTime: 0, endTime: 1 }];

    let saveResult = false;
    await act(async () => {
      saveResult = await result.current.saveSegments(newSegments);
    });

    expect(saveResult).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/videos/video-123/transcript', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ segments: newSegments }),
    });
    expect(result.current.segments).toEqual(newSegments);
  });

  it('should handle save error', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Save failed' }),
    });

    const { result } = renderHook(() => useTranscript({ videoId: 'video-123', autoFetch: false }));

    let saveResult = true;
    await act(async () => {
      saveResult = await result.current.saveSegments([]);
    });

    expect(saveResult).toBe(false);
    expect(result.current.error).toBe('Save failed');
  });

  it('should not save when videoId is empty', async () => {
    const { result } = renderHook(() => useTranscript({ videoId: '', autoFetch: false }));

    let saveResult = true;
    await act(async () => {
      saveResult = await result.current.saveSegments([]);
    });

    expect(saveResult).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should update a single segment', () => {
    const initialSegments: TranscriptSegment[] = [
      { text: 'First', startTime: 0, endTime: 1 },
      { text: 'Second', startTime: 1, endTime: 2 },
    ];

    const { result } = renderHook(() =>
      useTranscript({
        videoId: 'video-123',
        initialSegments,
        autoFetch: false,
      }),
    );

    act(() => {
      result.current.updateSegment(0, { text: 'Updated First', startTime: 0, endTime: 1 });
    });

    expect(result.current.segments[0].text).toBe('Updated First');
    expect(result.current.segments[1].text).toBe('Second');
  });

  it('should delete a segment', () => {
    const initialSegments: TranscriptSegment[] = [
      { text: 'First', startTime: 0, endTime: 1 },
      { text: 'Second', startTime: 1, endTime: 2 },
    ];

    const { result } = renderHook(() =>
      useTranscript({
        videoId: 'video-123',
        initialSegments,
        autoFetch: false,
      }),
    );

    act(() => {
      result.current.deleteSegment(0);
    });

    expect(result.current.segments).toHaveLength(1);
    expect(result.current.segments[0].text).toBe('Second');
  });

  it('should track unsaved changes', () => {
    const initialSegments: TranscriptSegment[] = [{ text: 'Original', startTime: 0, endTime: 1 }];

    const { result } = renderHook(() =>
      useTranscript({
        videoId: 'video-123',
        initialSegments,
        autoFetch: false,
      }),
    );

    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => {
      result.current.updateSegment(0, { text: 'Modified', startTime: 0, endTime: 1 });
    });

    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it('should reset unsaved changes after save', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    const initialSegments: TranscriptSegment[] = [{ text: 'Original', startTime: 0, endTime: 1 }];

    const { result } = renderHook(() =>
      useTranscript({
        videoId: 'video-123',
        initialSegments,
        autoFetch: false,
      }),
    );

    act(() => {
      result.current.updateSegment(0, { text: 'Modified', startTime: 0, endTime: 1 });
    });

    expect(result.current.hasUnsavedChanges).toBe(true);

    await act(async () => {
      await result.current.saveSegments(result.current.segments);
    });

    expect(result.current.hasUnsavedChanges).toBe(false);
  });

  it('should refetch transcript data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: mockTranscriptData }),
    });

    const { result } = renderHook(() => useTranscript({ videoId: 'video-123', autoFetch: false }));

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/videos/video-123/transcript');
    expect(result.current.segments).toEqual(mockTranscriptData.segments);
  });

  it('should update segments when initialSegments prop changes', () => {
    const initialSegments: TranscriptSegment[] = [{ text: 'Original', startTime: 0, endTime: 1 }];
    const newSegments: TranscriptSegment[] = [{ text: 'New', startTime: 0, endTime: 1 }];

    const { result, rerender } = renderHook(
      ({ segments }) =>
        useTranscript({
          videoId: 'video-123',
          initialSegments: segments,
          autoFetch: false,
        }),
      { initialProps: { segments: initialSegments } },
    );

    expect(result.current.segments).toEqual(initialSegments);

    rerender({ segments: newSegments });

    expect(result.current.segments).toEqual(newSegments);
  });
});
