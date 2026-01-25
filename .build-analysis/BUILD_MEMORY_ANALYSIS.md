# Build Memory Analysis Report

**Generated:** 2026-01-25
**Build Duration:** ~150 seconds
**Peak Memory:** 15.93 GB

## Executive Summary

The Next.js build process consumes significantly more memory than the configured 8GB limit. **No memory leak was detected** - the high usage is due to parallel worker processes and the size of the codebase being compiled.

## Memory Usage Heat Map (Visual)

```
Timeline: 0s ──────────────────────────────────────────────────────────────────► 150s

Total RSS:    ░░░░░░░░░░░░░░▒▒▒▓▓▓▓▓▓▓▓▓▓████████████████████████████████████▓▓▓▓
Processes:    ░░░░░░░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▓▓▓▓▓▓▓▓████████████████████████████████████
Phase:        │INIT│ WORKFLOW DISC │ COMPILE │ TYPE-CHECK │ COLLECT DATA │ FINALIZE

Legend: ░ Low (<4GB)  ▒ Medium (4-8GB)  ▓ High (8-12GB)  █ Peak (>12GB)
```

## Key Findings

### 1. Peak Memory: 15.93 GB

| Metric | Value |
|--------|-------|
| Peak Memory | **15.93 GB** |
| Average Memory | 10.49 GB |
| Peak Phase | `production-build` |
| Peak Time | 70.4s into build |
| Peak Process Count | 28 Node.js processes |

### 2. Memory by Build Phase

| Phase | Peak Memory | Process Count |
|-------|-------------|---------------|
| `production-build` | 15.93 GB | 28 |
| `type-checking` | 15.37 GB | 29 |
| `collecting-data` | 14.94 GB | **43** |
| `workflow-setup` | 3.14 GB | 11 |
| `workflow-manifest` | 3.10 GB | 11 |
| `workflow-discovery` | 2.96 GB | 11 |
| `compilation-done` | 2.50 GB | 11 |
| `init` | 866 MB | 8 |

### 3. Top Memory Consumers at Peak

| Process | Memory | % of Total |
|---------|--------|------------|
| Next.js Main Process | **6.54 GB** | 41.0% |
| esbuild | 1.28 GB | 8.0% |
| Webpack Worker 1 | 573 MB | 3.5% |
| Webpack Worker 2 | 557 MB | 3.4% |
| Webpack Worker 3 | 544 MB | 3.3% |
| Webpack Worker 4 | 516 MB | 3.2% |
| Webpack Worker 5 | 509 MB | 3.1% |
| Webpack Worker 6 | 499 MB | 3.1% |

### 4. Memory Spikes

- **+2.12 GB** spike at 43s during `production-build` phase
- Spike coincides with bundling starting

### 5. Memory Leak Analysis

**Status: No Memory Leak Detected**

Normal garbage collection patterns were observed. Memory increases during compilation phases and stabilizes - no unbounded growth.

## Root Cause Analysis

### Why is Memory So High?

1. **Parallel Worker Processes (43 at peak)**
   - Next.js uses 15+ workers for page data collection
   - Each worker consumes 200-600MB
   - Combined with main process, this exceeds available memory

2. **Large Codebase**
   - SaaS app source: 17MB total
   - Effect-TS services: 1.6MB (62K+ lines)
   - API routes: 1.6MB
   - 72K+ lines of TypeScript to compile

3. **Workflow Discovery Overhead**
   - 23 workflow files with 74 steps and 17 workflows
   - Takes 22-27 seconds to discover and bundle
   - Creates intermediate bundles that consume memory

4. **esbuild Bundling**
   - Workflow bundling uses esbuild (1.28 GB at peak)
   - Runs in parallel with Next.js compilation

## Recommendations

### Applied Optimizations (for 8GB environments)

#### 1. Sequential Turbo Builds
```json
// turbo.json - builds run one at a time, not in parallel
"concurrency": 1
```

This prevents marketing + saas from building simultaneously, cutting peak memory by ~50%.

#### 2. Disabled Worker Threads
```typescript
// next.config.ts
experimental: {
  workerThreads: false,  // Disable parallel workers
  cpus: 4,               // Limit CPU parallelism
}
```

#### 3. Expanded Package Import Optimization
Added to `optimizePackageImports`:
- `effect`
- `@effect/platform`
- `@effect/sql`
- `ai`

### Additional Optimizations (if still needed)

#### 5. Code Split Large Routes
The API routes directory (1.6MB) could benefit from dynamic imports:
```typescript
// Instead of static imports for heavy dependencies
const heavyModule = await import('./heavy-module');
```

#### 6. Lazy Load Workflows
The workflow discovery takes 22-27 seconds. Consider:
- Lazy loading workflow definitions
- Caching workflow manifests between builds
- Pre-building workflow bundles separately

### Long-Term Architectural Changes

#### 7. Extract Heavy Services
The Effect services (1.6MB, 62K lines) could be:
- Split into separate packages
- Compiled separately and cached
- Loaded dynamically per-route

#### 8. Use Incremental Type Checking
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".next/cache/tsbuildinfo.json"
  }
}
```

#### 9. Consider Module Federation
For large monorepo apps, consider Vercel's microfrontends (already enabled) to split compilation across apps.

## CI/CD Considerations

### Required Resources for Build

| Environment | Recommended Memory | Workers |
|-------------|-------------------|---------|
| Local Dev | 16GB | Auto |
| CI (Standard) | 16GB | 8 |
| CI (Limited) | 8GB | 4 |
| Vercel Build | Auto-managed | Auto |

### Vercel Deployment
Vercel automatically manages memory for builds. However, if builds fail:
1. Check build logs for OOM errors
2. Contact Vercel support for memory limit increases
3. Consider using `vercel build` locally with `--prod` flag

## Files Generated

| File | Description |
|------|-------------|
| `memory-profile.json` | Raw memory samples (basic) |
| `detailed-memory-profile.json` | Comprehensive profiling data |
| `memory-heatmap.html` | Basic interactive visualization |
| `memory-heatmap-detailed.html` | Detailed interactive visualization with charts |

## How to Re-Run Analysis

```bash
# Basic profiling
node scripts/profile-build-memory.mjs

# Detailed profiling (recommended)
node scripts/detailed-memory-profile.mjs
```

## Conclusion

The build's high memory usage is **not a memory leak** but rather the result of:
1. Parallel compilation workers
2. Large TypeScript codebase
3. Workflow bundle generation

The most effective immediate fix is **reducing worker parallelism** in CI environments, which trades build speed for lower memory usage.
