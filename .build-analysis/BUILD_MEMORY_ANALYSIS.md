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

### Verified Memory Breakdown (Actual Measurements)

| Component | Memory | % of Peak | Reducible? |
|-----------|--------|-----------|------------|
| **Turbopack main process** | 6.38 GB | 40% | **No** - architectural |
| esbuild (workflow bundler) | 1.25 GB | 8% | Partially |
| 6 type-check workers | ~3 GB | 19% | Yes - via cpus |
| Other processes | ~5 GB | 31% | Partially |

**Key Finding:** Next.js 16 uses Turbopack by default, which requires ~6-7 GB for the main process alone. This is not configurable.

### Applied Optimizations

#### 1. Sequential Turbo Builds
```json
// turbo.json
"concurrency": "1"
```
**Result:** Prevents parallel app builds, but doesn't reduce single-app memory.

#### 2. Reduced Worker Count
```typescript
// next.config.ts
experimental: {
  workerThreads: false,
  cpus: 4,
}
```
**Result:** Page data collection uses 4 workers instead of 15 (~1GB saved).

#### 3. Package Import Optimization
```typescript
optimizePackageImports: ['effect', '@effect/platform', '@effect/sql', 'ai', ...]
```
**Result:** Faster builds, marginal memory improvement.

### Options for 8GB Environments

#### Option 1: Configure Swap Space (Recommended for CI)
```bash
# Add 16GB swap on Linux CI
sudo fallocate -l 16G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```
Build will be slower but complete. Peak 16GB will use ~8GB swap.

#### Option 2: Use Vercel for Builds
Vercel automatically allocates sufficient memory for Next.js builds. Deploy via `git push` instead of building locally.

#### Option 3: Split the Build (Advanced)
Build packages separately with caching:
```bash
# Build libs first (cached)
turbo build --filter=@nuclom/lib --filter=@nuclom/ui

# Then build apps separately
turbo build --filter=nuclom-marketing
turbo build --filter=nuclom-saas
```

#### Option 4: Downgrade to Next.js 15
Next.js 15 supports webpack bundler which uses less memory (~4-6GB peak). Not recommended due to feature loss.

### What Does NOT Work

| Attempted | Result |
|-----------|--------|
| `bundler: 'webpack'` | Invalid in Next.js 16 |
| `--no-turbopack` | Flag doesn't exist |
| `workerThreads: false` | Only affects workers, not main process |
| `cpus: 4` | Reduces workers but main process still 6+ GB |

### Minimum Requirements

| Environment | Minimum RAM | Recommended |
|-------------|-------------|-------------|
| Local dev | 8 GB + swap | 16 GB |
| CI/CD | 8 GB + 16GB swap | 16 GB |
| Vercel | Auto-managed | N/A |

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
