import { renderHook, waitFor } from '@testing-library/react';
import { Either } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { useOrganizations, useVideo, useVideos } from './use-api';

// Mock the Effect client
vi.mock('@nuclom/lib/effect/client', () => ({
  runClientEffect: vi.fn(),
  videoApiEffect: {
    getVideos: vi.fn(),
    getVideo: vi.fn(),
  },
  organizationApiEffect: {
    getOrganizations: vi.fn(),
  },
}));

vi.mock('@nuclom/lib/api', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

import { organizationApiEffect, runClientEffect, videoApiEffect } from '@nuclom/lib/effect/client';

describe('useVideos', () => {
  it('should start in loading state', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ data: [], total: 0, page: 1, limit: 10 }));

    const { result } = renderHook(() => useVideos());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    // Wait for async operation to complete to prevent memory leak
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should fetch videos successfully', async () => {
    const mockVideos = {
      data: [
        { id: '1', title: 'Video 1', author: { name: 'Author 1' } },
        { id: '2', title: 'Video 2', author: { name: 'Author 2' } },
      ],
      total: 2,
      page: 1,
      limit: 10,
    };
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockVideos));

    const { result } = renderHook(() => useVideos());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockVideos);
    expect(result.current.error).toBeNull();
  });

  it('should handle fetch errors', async () => {
    const mockError = { _tag: 'HttpError', message: 'Network error', status: 500 };
    vi.mocked(runClientEffect).mockResolvedValue(Either.left(mockError));

    const { result } = renderHook(() => useVideos());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Failed to fetch data (500)');
  });

  it('should pass organizationId parameter', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ data: [], total: 0, page: 1, limit: 10 }));

    const { result } = renderHook(() => useVideos({ organizationId: 'org-123' }));

    expect(videoApiEffect.getVideos).toHaveBeenCalledWith({ organizationId: 'org-123' });

    // Wait for async operation to complete to prevent memory leak
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should pass all filter parameters', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ data: [], total: 0, page: 1, limit: 10 }));

    const { result } = renderHook(() =>
      useVideos({
        organizationId: 'org-123',
        collectionId: 'collection-789',
        page: 2,
        limit: 20,
      }),
    );

    expect(videoApiEffect.getVideos).toHaveBeenCalledWith({
      organizationId: 'org-123',
      collectionId: 'collection-789',
      page: 2,
      limit: 20,
    });

    // Wait for async operation to complete to prevent memory leak
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should refetch when params change', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ data: [], total: 0, page: 1, limit: 10 }));

    const { rerender } = renderHook(({ params }) => useVideos(params), {
      initialProps: { params: { organizationId: 'org-1' } },
    });

    await waitFor(() => {
      expect(videoApiEffect.getVideos).toHaveBeenCalledWith({ organizationId: 'org-1' });
    });

    rerender({ params: { organizationId: 'org-2' } });

    await waitFor(() => {
      expect(videoApiEffect.getVideos).toHaveBeenCalledWith({ organizationId: 'org-2' });
    });
  });

  it('should handle generic Error objects', async () => {
    const mockError = new Error('Something went wrong');
    vi.mocked(runClientEffect).mockResolvedValue(Either.left(mockError));

    const { result } = renderHook(() => useVideos());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Something went wrong');
  });
});

describe('useVideo', () => {
  it('should not fetch when id is null', () => {
    const { result } = renderHook(() => useVideo(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
    expect(videoApiEffect.getVideo).not.toHaveBeenCalled();
  });

  it('should fetch video when id is provided', async () => {
    const mockVideo = {
      id: 'video-123',
      title: 'Test Video',
      author: { name: 'Test Author' },
    };
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockVideo));

    const { result } = renderHook(() => useVideo('video-123'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockVideo);
    expect(videoApiEffect.getVideo).toHaveBeenCalledWith('video-123');
  });

  it('should handle fetch errors', async () => {
    const mockError = { _tag: 'HttpError', message: 'Video not found', status: 404 };
    vi.mocked(runClientEffect).mockResolvedValue(Either.left(mockError));

    const { result } = renderHook(() => useVideo('video-123'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Failed to fetch data (404)');
  });

  it('should refetch when id changes', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ id: '1', title: 'Video 1' }));

    const { result, rerender } = renderHook(({ id }) => useVideo(id), {
      initialProps: { id: 'video-1' },
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(videoApiEffect.getVideo).toHaveBeenCalledWith('video-1');

    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ id: '2', title: 'Video 2' }));
    rerender({ id: 'video-2' });

    await waitFor(() => {
      expect(videoApiEffect.getVideo).toHaveBeenCalledWith('video-2');
    });
  });

  it('should clear data when id changes to null', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right({ id: '1', title: 'Video 1' }));

    const { result, rerender } = renderHook(({ id }) => useVideo(id), {
      initialProps: { id: 'video-1' as string | null },
    });

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    rerender({ id: null });

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });
});

describe('useOrganizations', () => {
  it('should start in loading state', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right([]));

    const { result } = renderHook(() => useOrganizations());

    expect(result.current.loading).toBe(true);

    // Wait for async operation to complete to prevent memory leak
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should fetch organizations successfully', async () => {
    const mockOrgs = [
      { id: 'org-1', name: 'Org 1' },
      { id: 'org-2', name: 'Org 2' },
    ];
    vi.mocked(runClientEffect).mockResolvedValue(Either.right(mockOrgs));

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockOrgs);
    expect(result.current.error).toBeNull();
  });

  it('should pass userId parameter', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right([]));

    const { result } = renderHook(() => useOrganizations('user-123'));

    expect(organizationApiEffect.getOrganizations).toHaveBeenCalledWith('user-123');

    // Wait for async operation to complete to prevent memory leak
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should handle fetch errors', async () => {
    const mockError = { _tag: 'HttpError', message: 'Unauthorized', status: 401 };
    vi.mocked(runClientEffect).mockResolvedValue(Either.left(mockError));

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Failed to fetch data (401)');
  });

  it('should refetch when userId changes', async () => {
    vi.mocked(runClientEffect).mockResolvedValue(Either.right([]));

    const { rerender } = renderHook(({ userId }) => useOrganizations(userId), {
      initialProps: { userId: 'user-1' },
    });

    await waitFor(() => {
      expect(organizationApiEffect.getOrganizations).toHaveBeenCalledWith('user-1');
    });

    rerender({ userId: 'user-2' });

    await waitFor(() => {
      expect(organizationApiEffect.getOrganizations).toHaveBeenCalledWith('user-2');
    });
  });
});
