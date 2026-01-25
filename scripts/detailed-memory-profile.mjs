#!/usr/bin/env node

/**
 * Detailed Build Memory Profiler
 *
 * Monitors ALL Node.js processes during build to capture actual memory usage
 * including Turbopack workers, Next.js compilation, and bundling processes.
 */

import { spawn, execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../.build-analysis');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Data structures
const samples = [];
let buildStartTime = Date.now();
let currentPhase = 'init';
const phaseTransitions = [];

// Get all Node.js processes and their memory
function getAllNodeProcesses() {
  try {
    const output = execSync(
      'ps aux | grep -E "(node|next|turbo)" | grep -v grep | grep -v "profile-build"',
      { encoding: 'utf8', timeout: 5000 }
    ).trim();

    const processes = [];
    const lines = output.split('\n').filter(l => l.trim());

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 11) {
        const pid = parts[1];
        const cpuPercent = parseFloat(parts[2]) || 0;
        const memPercent = parseFloat(parts[3]) || 0;
        const vsz = parseInt(parts[4], 10) * 1024; // KB to bytes
        const rss = parseInt(parts[5], 10) * 1024; // KB to bytes
        const command = parts.slice(10).join(' ');

        // Categorize process
        let category = 'other';
        if (command.includes('turbo')) category = 'turbo';
        else if (command.includes('next')) category = 'next';
        else if (command.includes('node')) category = 'node-worker';

        processes.push({
          pid,
          cpuPercent,
          memPercent,
          vsz,
          rss,
          command: command.slice(0, 80),
          category,
        });
      }
    }

    return processes;
  } catch {
    return [];
  }
}

// Get system memory stats
function getSystemMemory() {
  try {
    const meminfo = execSync('cat /proc/meminfo', { encoding: 'utf8' });
    const stats = {};
    for (const line of meminfo.split('\n')) {
      const match = line.match(/^(\w+):\s+(\d+)/);
      if (match) {
        stats[match[1]] = parseInt(match[2], 10) * 1024; // KB to bytes
      }
    }
    return {
      total: stats.MemTotal || 0,
      free: stats.MemFree || 0,
      available: stats.MemAvailable || 0,
      buffers: stats.Buffers || 0,
      cached: stats.Cached || 0,
      swapTotal: stats.SwapTotal || 0,
      swapFree: stats.SwapFree || 0,
    };
  } catch {
    return {};
  }
}

// Detect build phase from output
function detectPhase(text) {
  const lower = text.toLowerCase();

  if (lower.includes('discovering workflow')) return 'workflow-discovery';
  if (lower.includes('creating webhook')) return 'workflow-setup';
  if (lower.includes('created manifest')) return 'workflow-manifest';
  if (lower.includes('compiled successfully')) return 'compilation-done';
  if (lower.includes('compiling') || lower.includes('building')) return 'compiling';
  if (lower.includes('running typescript') || lower.includes('type checking')) return 'type-checking';
  if (lower.includes('collecting page data')) return 'collecting-data';
  if (lower.includes('generating static')) return 'static-generation';
  if (lower.includes('optimizing') || lower.includes('minifying')) return 'optimizing';
  if (lower.includes('bundling')) return 'bundling';
  if (lower.includes('finalizing')) return 'finalizing';
  if (lower.includes('creating an optimized')) return 'production-build';
  if (lower.includes('linting') || lower.includes('eslint')) return 'linting';

  return currentPhase;
}

// Sample all processes
function takeSample() {
  const timestamp = Date.now() - buildStartTime;
  const processes = getAllNodeProcesses();
  const systemMem = getSystemMemory();

  // Aggregate by category
  const byCategory = {};
  let totalRss = 0;
  let totalVsz = 0;

  for (const proc of processes) {
    if (!byCategory[proc.category]) {
      byCategory[proc.category] = { count: 0, rss: 0, vsz: 0, cpu: 0, processes: [] };
    }
    byCategory[proc.category].count++;
    byCategory[proc.category].rss += proc.rss;
    byCategory[proc.category].vsz += proc.vsz;
    byCategory[proc.category].cpu += proc.cpuPercent;
    byCategory[proc.category].processes.push({
      pid: proc.pid,
      rss: proc.rss,
      command: proc.command,
    });

    totalRss += proc.rss;
    totalVsz += proc.vsz;
  }

  const sample = {
    timestamp,
    phase: currentPhase,
    processCount: processes.length,
    totalRss,
    totalVsz,
    byCategory,
    system: systemMem,
    processes: processes.map(p => ({
      pid: p.pid,
      rss: p.rss,
      category: p.category,
      command: p.command.slice(0, 50),
    })),
  };

  samples.push(sample);
  return sample;
}

// Format bytes
function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(3, Math.floor(Math.log(bytes) / Math.log(k)));
  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
}

// Generate comprehensive analysis
function analyzeResults() {
  if (samples.length < 2) return null;

  // Find peak memory
  const peakSample = samples.reduce((max, s) => s.totalRss > max.totalRss ? s : max, samples[0]);

  // Memory by phase
  const phaseStats = {};
  for (const sample of samples) {
    if (!phaseStats[sample.phase]) {
      phaseStats[sample.phase] = {
        samples: [],
        peakRss: 0,
        avgRss: 0,
        totalRss: 0,
        peakProcessCount: 0,
      };
    }
    phaseStats[sample.phase].samples.push(sample);
    phaseStats[sample.phase].totalRss += sample.totalRss;
    phaseStats[sample.phase].peakRss = Math.max(phaseStats[sample.phase].peakRss, sample.totalRss);
    phaseStats[sample.phase].peakProcessCount = Math.max(
      phaseStats[sample.phase].peakProcessCount,
      sample.processCount
    );
  }

  for (const phase of Object.keys(phaseStats)) {
    phaseStats[phase].avgRss = phaseStats[phase].totalRss / phaseStats[phase].samples.length;
  }

  // Memory growth analysis
  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];
  const totalGrowth = lastSample.totalRss - firstSample.totalRss;
  const duration = (lastSample.timestamp - firstSample.timestamp) / 1000;

  // Peak process analysis
  const peakProcesses = peakSample.processes.sort((a, b) => b.rss - a.rss).slice(0, 10);

  // Category analysis at peak
  const categoryAtPeak = peakSample.byCategory;

  // Memory leak detection - check if memory keeps growing without release
  let consecutiveGrowth = 0;
  let maxConsecutiveGrowth = 0;
  let leakSuspect = false;

  for (let i = 1; i < samples.length; i++) {
    if (samples[i].totalRss > samples[i-1].totalRss * 1.01) { // 1% growth
      consecutiveGrowth++;
      maxConsecutiveGrowth = Math.max(maxConsecutiveGrowth, consecutiveGrowth);
    } else {
      consecutiveGrowth = 0;
    }
  }

  // If 50%+ of samples show continuous growth, suspect leak
  if (maxConsecutiveGrowth > samples.length * 0.5) {
    leakSuspect = true;
  }

  // Find memory spikes (>30% increase in one sample)
  const spikes = [];
  for (let i = 1; i < samples.length; i++) {
    const increase = samples[i].totalRss - samples[i-1].totalRss;
    if (increase > samples[i-1].totalRss * 0.3 && increase > 100 * 1024 * 1024) { // >30% and >100MB
      spikes.push({
        timestamp: samples[i].timestamp,
        phase: samples[i].phase,
        increase,
        newTotal: samples[i].totalRss,
      });
    }
  }

  return {
    summary: {
      totalSamples: samples.length,
      buildDuration: duration,
      peakMemory: peakSample.totalRss,
      peakTimestamp: peakSample.timestamp,
      peakPhase: peakSample.phase,
      peakProcessCount: peakSample.processCount,
      avgMemory: samples.reduce((sum, s) => sum + s.totalRss, 0) / samples.length,
      memoryGrowth: totalGrowth,
      growthRate: totalGrowth / duration,
    },
    phaseStats,
    peakAnalysis: {
      processes: peakProcesses,
      categories: categoryAtPeak,
    },
    memoryLeak: {
      suspected: leakSuspect,
      maxConsecutiveGrowthPeriods: maxConsecutiveGrowth,
      reason: leakSuspect
        ? 'Memory grew continuously for ' + maxConsecutiveGrowth + ' consecutive samples'
        : 'Normal garbage collection observed',
    },
    spikes,
  };
}

// Generate terminal report
function generateReport(analysis) {
  const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bgRed: '\x1b[41m',
    bgYellow: '\x1b[43m',
  };

  let report = '\n';
  report += c.cyan + '╔' + '═'.repeat(78) + '╗' + c.reset + '\n';
  report += c.cyan + '║' + c.bold + '           BUILD MEMORY ANALYSIS - COMPREHENSIVE REPORT'.padEnd(78) + c.reset + c.cyan + '║' + c.reset + '\n';
  report += c.cyan + '╚' + '═'.repeat(78) + '╝' + c.reset + '\n\n';

  // Summary
  report += c.yellow + c.bold + '━━━ SUMMARY ━━━' + c.reset + '\n\n';
  report += `  ${c.cyan}Peak Memory:${c.reset}        ${c.bold}${formatBytes(analysis.summary.peakMemory)}${c.reset}\n`;
  report += `  ${c.cyan}Average Memory:${c.reset}     ${formatBytes(analysis.summary.avgMemory)}\n`;
  report += `  ${c.cyan}Build Duration:${c.reset}     ${analysis.summary.buildDuration.toFixed(1)}s\n`;
  report += `  ${c.cyan}Peak Phase:${c.reset}         ${analysis.summary.peakPhase}\n`;
  report += `  ${c.cyan}Peak Time:${c.reset}          ${(analysis.summary.peakTimestamp / 1000).toFixed(1)}s into build\n`;
  report += `  ${c.cyan}Peak Processes:${c.reset}     ${analysis.summary.peakProcessCount} Node.js processes\n`;
  report += `  ${c.cyan}Memory Growth:${c.reset}      ${formatBytes(analysis.summary.memoryGrowth)}\n`;
  report += `  ${c.cyan}Growth Rate:${c.reset}        ${formatBytes(analysis.summary.growthRate)}/s\n\n`;

  // Memory Leak Analysis
  report += c.yellow + c.bold + '━━━ MEMORY LEAK ANALYSIS ━━━' + c.reset + '\n\n';
  if (analysis.memoryLeak.suspected) {
    report += `  ${c.bgRed}${c.bold} POTENTIAL LEAK DETECTED ${c.reset}\n`;
    report += `  ${c.red}${analysis.memoryLeak.reason}${c.reset}\n\n`;
  } else {
    report += `  ${c.green}✓ No memory leak detected${c.reset}\n`;
    report += `  ${analysis.memoryLeak.reason}\n\n`;
  }

  // Phase breakdown
  report += c.yellow + c.bold + '━━━ MEMORY BY BUILD PHASE ━━━' + c.reset + '\n\n';
  const sortedPhases = Object.entries(analysis.phaseStats)
    .sort((a, b) => b[1].peakRss - a[1].peakRss);

  const maxPhasePeak = sortedPhases[0]?.[1].peakRss || 1;

  for (const [phase, stats] of sortedPhases) {
    const barLen = Math.floor((stats.peakRss / maxPhasePeak) * 40);
    const bar = '█'.repeat(barLen) + '░'.repeat(40 - barLen);
    const color = stats.peakRss > analysis.summary.peakMemory * 0.9 ? c.red :
                  stats.peakRss > analysis.summary.peakMemory * 0.5 ? c.yellow : c.green;
    report += `  ${phase.padEnd(22)} ${color}${bar}${c.reset} ${formatBytes(stats.peakRss).padStart(12)} (${stats.peakProcessCount} procs)\n`;
  }
  report += '\n';

  // Peak memory breakdown by category
  report += c.yellow + c.bold + '━━━ PEAK MEMORY BY PROCESS CATEGORY ━━━' + c.reset + '\n\n';
  for (const [category, data] of Object.entries(analysis.peakAnalysis.categories)) {
    const percent = ((data.rss / analysis.summary.peakMemory) * 100).toFixed(1);
    const barLen = Math.floor((data.rss / analysis.summary.peakMemory) * 40);
    const bar = '█'.repeat(Math.max(1, barLen)) + '░'.repeat(40 - barLen);
    report += `  ${category.padEnd(15)} ${c.magenta}${bar}${c.reset} ${formatBytes(data.rss).padStart(12)} (${percent}%) - ${data.count} processes\n`;
  }
  report += '\n';

  // Top memory consumers at peak
  report += c.yellow + c.bold + '━━━ TOP MEMORY CONSUMERS AT PEAK ━━━' + c.reset + '\n\n';
  for (const proc of analysis.peakAnalysis.processes.slice(0, 8)) {
    const percent = ((proc.rss / analysis.summary.peakMemory) * 100).toFixed(1);
    report += `  ${c.cyan}PID ${proc.pid}${c.reset}: ${formatBytes(proc.rss).padStart(12)} (${percent}%)\n`;
    report += `         ${c.blue}${proc.command.slice(0, 60)}${c.reset}\n`;
  }
  report += '\n';

  // Memory spikes
  if (analysis.spikes.length > 0) {
    report += c.yellow + c.bold + '━━━ MEMORY SPIKES DETECTED ━━━' + c.reset + '\n\n';
    for (const spike of analysis.spikes) {
      report += `  ${c.red}+${formatBytes(spike.increase)}${c.reset} at ${(spike.timestamp / 1000).toFixed(1)}s during "${spike.phase}"\n`;
      report += `         New total: ${formatBytes(spike.newTotal)}\n`;
    }
    report += '\n';
  }

  // Recommendations
  report += c.yellow + c.bold + '━━━ RECOMMENDATIONS ━━━' + c.reset + '\n\n';

  const issues = [];
  const recommendations = [];

  if (analysis.summary.peakMemory > 4 * 1024 * 1024 * 1024) { // >4GB
    issues.push({
      severity: 'critical',
      message: `Peak memory (${formatBytes(analysis.summary.peakMemory)}) exceeds 4GB`,
    });
    recommendations.push('Increase NODE_OPTIONS --max-old-space-size or reduce parallelism');
    recommendations.push('Consider using swcMinify for smaller memory footprint');
  } else if (analysis.summary.peakMemory > 2 * 1024 * 1024 * 1024) { // >2GB
    issues.push({
      severity: 'warning',
      message: `Peak memory (${formatBytes(analysis.summary.peakMemory)}) exceeds 2GB`,
    });
    recommendations.push('May need memory tuning for CI environments with limited RAM');
  }

  if (analysis.memoryLeak.suspected) {
    issues.push({
      severity: 'critical',
      message: 'Potential memory leak detected',
    });
    recommendations.push('Review long-running build plugins for memory retention');
    recommendations.push('Check for circular references in build-time code');
  }

  // High process count
  if (analysis.summary.peakProcessCount > 20) {
    issues.push({
      severity: 'warning',
      message: `High process count (${analysis.summary.peakProcessCount}) at peak`,
    });
    recommendations.push('Consider reducing worker count with --workers flag');
  }

  // Phase-specific recommendations
  const workflowPhases = Object.entries(analysis.phaseStats)
    .filter(([phase]) => phase.includes('workflow'));
  if (workflowPhases.length > 0) {
    const workflowMem = workflowPhases.reduce((sum, [, stats]) => sum + stats.peakRss, 0);
    if (workflowMem > 500 * 1024 * 1024) {
      recommendations.push('Workflow discovery is memory-intensive. Consider lazy loading workflows.');
    }
  }

  // Add default recommendations
  recommendations.push('Use optimizePackageImports for large packages (already enabled)');
  recommendations.push('Consider code splitting for large page bundles');
  recommendations.push('Ensure NODE_OPTIONS includes --max-old-space-size=8192');

  for (const issue of issues) {
    const icon = issue.severity === 'critical' ? c.bgRed + ' ✗ ' + c.reset : c.bgYellow + ' ⚠ ' + c.reset;
    report += `  ${icon} ${issue.message}\n`;
  }

  report += '\n';
  for (const rec of recommendations) {
    report += `  ${c.green}→${c.reset} ${rec}\n`;
  }

  report += '\n' + c.cyan + '═'.repeat(80) + c.reset + '\n';

  return report;
}

// Generate ASCII heat map
function generateHeatMap() {
  const c = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    magenta: '\x1b[35m',
  };

  const width = 76;
  const bucketSize = Math.max(1, Math.ceil(samples.length / width));
  const buckets = [];

  for (let i = 0; i < width && i * bucketSize < samples.length; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, samples.length);
    const bucketSamples = samples.slice(start, end);

    if (bucketSamples.length > 0) {
      const avgRss = bucketSamples.reduce((sum, s) => sum + s.totalRss, 0) / bucketSamples.length;
      const maxRss = Math.max(...bucketSamples.map(s => s.totalRss));
      const avgProcs = bucketSamples.reduce((sum, s) => sum + s.processCount, 0) / bucketSamples.length;
      const phase = bucketSamples[Math.floor(bucketSamples.length / 2)].phase;
      buckets.push({ avgRss, maxRss, avgProcs, phase });
    }
  }

  const maxRss = Math.max(...buckets.map(b => b.maxRss));
  const maxProcs = Math.max(...buckets.map(b => b.avgProcs));

  const heatChars = [' ', '░', '▒', '▓', '█'];

  function getIntensity(val, max) {
    return Math.min(4, Math.floor((val / max) * 5));
  }

  function getColor(intensity) {
    if (intensity >= 4) return c.red;
    if (intensity >= 3) return c.yellow;
    if (intensity >= 2) return c.green;
    return c.green;
  }

  const phaseColors = {
    'init': c.white,
    'workflow-discovery': c.magenta,
    'workflow-setup': c.magenta,
    'workflow-manifest': c.magenta,
    'compiling': c.yellow,
    'compilation-done': c.yellow,
    'type-checking': c.blue,
    'collecting-data': c.cyan,
    'static-generation': c.green,
    'optimizing': c.cyan,
    'bundling': c.red,
    'finalizing': c.green,
    'production-build': c.yellow,
  };

  let heatMap = '\n';
  heatMap += c.cyan + '╔' + '═'.repeat(width + 2) + '╗' + c.reset + '\n';
  heatMap += c.cyan + '║ ' + 'MEMORY HEAT MAP (Build Timeline)'.padEnd(width) + ' ║' + c.reset + '\n';
  heatMap += c.cyan + '╚' + '═'.repeat(width + 2) + '╝' + c.reset + '\n\n';

  // Memory heat map
  heatMap += c.yellow + '  Total RSS:' + c.reset + ' ';
  for (const bucket of buckets) {
    const intensity = getIntensity(bucket.avgRss, maxRss);
    heatMap += getColor(intensity) + heatChars[intensity] + c.reset;
  }
  heatMap += '\n';

  // Process count heat map
  heatMap += c.blue + '  Processes:' + c.reset + ' ';
  for (const bucket of buckets) {
    const intensity = getIntensity(bucket.avgProcs, maxProcs);
    heatMap += getColor(intensity) + heatChars[intensity] + c.reset;
  }
  heatMap += '\n';

  // Phase timeline
  heatMap += c.green + '  Phase:    ' + c.reset + ' ';
  for (const bucket of buckets) {
    const color = phaseColors[bucket.phase] || c.white;
    heatMap += color + '▀' + c.reset;
  }
  heatMap += '\n';

  // Legend
  const totalTime = samples[samples.length - 1]?.timestamp || 0;
  heatMap += '\n  ' + c.cyan + 'Scale:' + c.reset + ' ░Low ▒Med ▓High █Peak';
  heatMap += '  ' + c.cyan + 'Time:' + c.reset + ' 0s → ' + (totalTime / 1000).toFixed(0) + 's\n';

  return heatMap;
}

// Generate HTML report
function generateHtmlReport(analysis) {
  const timestamps = samples.map(s => s.timestamp / 1000);
  const totalRss = samples.map(s => s.totalRss / (1024 * 1024));
  const processCount = samples.map(s => s.processCount);
  const phases = samples.map(s => s.phase);

  // Category breakdown over time
  const categories = ['turbo', 'next', 'node-worker', 'other'];
  const categoryData = {};
  for (const cat of categories) {
    categoryData[cat] = samples.map(s => (s.byCategory[cat]?.rss || 0) / (1024 * 1024));
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Build Memory Analysis - Detailed Heat Map</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #0d1117 0%, #161b22 100%);
      color: #c9d1d9;
      padding: 2rem;
      min-height: 100vh;
    }
    .container { max-width: 1600px; margin: 0 auto; }
    h1 { color: #58a6ff; margin-bottom: 0.5rem; font-size: 2rem; }
    h2 { color: #8b949e; margin: 2rem 0 1rem; font-size: 1.3rem; border-bottom: 1px solid #30363d; padding-bottom: 0.5rem; }
    .subtitle { color: #8b949e; margin-bottom: 2rem; }
    .grid { display: grid; gap: 1.5rem; }
    .grid-2 { grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); }
    .grid-4 { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
    .card {
      background: rgba(22, 27, 34, 0.8);
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid #30363d;
      backdrop-filter: blur(10px);
    }
    .stat-value { font-size: 2.5rem; font-weight: bold; color: #58a6ff; }
    .stat-label { color: #8b949e; font-size: 0.9rem; margin-top: 0.25rem; }
    .stat-sub { color: #6e7681; font-size: 0.8rem; }
    .chart-container { position: relative; height: 300px; }
    .heatmap-container { padding: 1rem 0; }
    .heatmap-row { display: flex; height: 24px; border-radius: 4px; overflow: hidden; margin-bottom: 0.5rem; }
    .heatmap-cell { flex: 1; min-width: 1px; transition: opacity 0.2s; }
    .heatmap-cell:hover { opacity: 0.8; }
    .heatmap-label { color: #8b949e; font-size: 0.85rem; margin-bottom: 0.25rem; }
    .legend { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #30363d; }
    .legend-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; }
    .legend-color { width: 16px; height: 16px; border-radius: 4px; }
    .alert { padding: 1rem 1.5rem; border-radius: 8px; margin-bottom: 1rem; border-left: 4px solid; }
    .alert-critical { background: rgba(248, 81, 73, 0.1); border-color: #f85149; }
    .alert-warning { background: rgba(210, 153, 34, 0.1); border-color: #d29922; }
    .alert-success { background: rgba(35, 134, 54, 0.1); border-color: #238636; }
    .alert-title { font-weight: bold; margin-bottom: 0.25rem; }
    .phase-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; margin: 1rem 0; }
    .phase-segment { transition: all 0.3s; }
    .phase-segment:hover { filter: brightness(1.2); }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #30363d; }
    th { color: #8b949e; font-weight: 500; font-size: 0.9rem; }
    .bar-cell { width: 50%; }
    .bar { height: 20px; border-radius: 4px; background: linear-gradient(90deg, #238636, #3fb950); transition: width 0.5s; }
    .bar-warning { background: linear-gradient(90deg, #9e6a03, #d29922); }
    .bar-critical { background: linear-gradient(90deg, #da3633, #f85149); }
    .recommendation { padding: 0.75rem 1rem; background: rgba(56, 139, 253, 0.1); border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid #58a6ff; }
    .timeline-marker { position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(248, 81, 73, 0.5); pointer-events: none; }
    .peak-marker::after { content: 'PEAK'; position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 10px; color: #f85149; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Build Memory Analysis Report</h1>
    <p class="subtitle">Generated: ${new Date().toLocaleString()} | Duration: ${analysis.summary.buildDuration.toFixed(1)}s</p>

    <div class="grid grid-4" style="margin-bottom: 2rem;">
      <div class="card">
        <div class="stat-value">${(analysis.summary.peakMemory / (1024 * 1024 * 1024)).toFixed(2)}</div>
        <div class="stat-label">Peak Memory (GB)</div>
        <div class="stat-sub">at ${(analysis.summary.peakTimestamp / 1000).toFixed(1)}s</div>
      </div>
      <div class="card">
        <div class="stat-value">${(analysis.summary.avgMemory / (1024 * 1024 * 1024)).toFixed(2)}</div>
        <div class="stat-label">Average Memory (GB)</div>
      </div>
      <div class="card">
        <div class="stat-value">${analysis.summary.peakProcessCount}</div>
        <div class="stat-label">Peak Processes</div>
        <div class="stat-sub">Node.js workers</div>
      </div>
      <div class="card">
        <div class="stat-value">${(analysis.summary.growthRate / (1024 * 1024)).toFixed(1)}</div>
        <div class="stat-label">Growth Rate (MB/s)</div>
      </div>
    </div>

    ${analysis.memoryLeak.suspected ? `
    <div class="alert alert-critical">
      <div class="alert-title">⚠️ Potential Memory Leak Detected</div>
      <div>${analysis.memoryLeak.reason}</div>
    </div>
    ` : `
    <div class="alert alert-success">
      <div class="alert-title">✓ No Memory Leak Detected</div>
      <div>${analysis.memoryLeak.reason}</div>
    </div>
    `}

    <h2>Memory Timeline</h2>
    <div class="card">
      <div class="chart-container">
        <canvas id="memoryChart"></canvas>
      </div>
    </div>

    <h2>Memory Heat Map</h2>
    <div class="card">
      <div class="heatmap-container">
        <div class="heatmap-label">Total Memory (RSS)</div>
        <div class="heatmap-row" id="memoryHeatmap"></div>
        <div class="heatmap-label">Process Count</div>
        <div class="heatmap-row" id="processHeatmap"></div>
        <div class="heatmap-label">Build Phase</div>
        <div class="heatmap-row" id="phaseHeatmap"></div>
        <div class="legend">
          <div class="legend-item"><div class="legend-color" style="background: #238636"></div> Low</div>
          <div class="legend-item"><div class="legend-color" style="background: #d29922"></div> Medium</div>
          <div class="legend-item"><div class="legend-color" style="background: #f85149"></div> High/Peak</div>
        </div>
      </div>
    </div>

    <div class="grid grid-2">
      <div>
        <h2>Memory by Process Category</h2>
        <div class="card">
          <div class="chart-container">
            <canvas id="categoryChart"></canvas>
          </div>
        </div>
      </div>
      <div>
        <h2>Memory by Build Phase</h2>
        <div class="card">
          <table>
            <thead>
              <tr>
                <th>Phase</th>
                <th>Peak Memory</th>
                <th class="bar-cell">Usage</th>
              </tr>
            </thead>
            <tbody>
              ${Object.entries(analysis.phaseStats)
                .sort((a, b) => b[1].peakRss - a[1].peakRss)
                .map(([phase, stats]) => {
                  const percent = (stats.peakRss / analysis.summary.peakMemory * 100);
                  const barClass = percent > 90 ? 'bar-critical' : percent > 60 ? 'bar-warning' : '';
                  return `
                  <tr>
                    <td>${phase}</td>
                    <td>${(stats.peakRss / (1024 * 1024)).toFixed(0)} MB</td>
                    <td class="bar-cell"><div class="bar ${barClass}" style="width: ${percent.toFixed(0)}%"></div></td>
                  </tr>`;
                }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <h2>Top Memory Consumers at Peak</h2>
    <div class="card">
      <table>
        <thead>
          <tr>
            <th>PID</th>
            <th>Memory</th>
            <th>% of Total</th>
            <th>Command</th>
          </tr>
        </thead>
        <tbody>
          ${analysis.peakAnalysis.processes.slice(0, 10).map(proc => `
          <tr>
            <td>${proc.pid}</td>
            <td>${(proc.rss / (1024 * 1024)).toFixed(0)} MB</td>
            <td>${((proc.rss / analysis.summary.peakMemory) * 100).toFixed(1)}%</td>
            <td style="font-family: monospace; font-size: 0.85rem; color: #8b949e;">${proc.command}</td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${analysis.spikes.length > 0 ? `
    <h2>Memory Spikes</h2>
    <div class="card">
      ${analysis.spikes.map(spike => `
      <div class="alert alert-warning">
        <div class="alert-title">+${(spike.increase / (1024 * 1024)).toFixed(0)} MB spike at ${(spike.timestamp / 1000).toFixed(1)}s</div>
        <div>During "${spike.phase}" phase. New total: ${(spike.newTotal / (1024 * 1024)).toFixed(0)} MB</div>
      </div>
      `).join('')}
    </div>
    ` : ''}

    <h2>Recommendations</h2>
    <div class="card">
      ${analysis.summary.peakMemory > 4 * 1024 * 1024 * 1024 ? `
      <div class="recommendation">
        <strong>Critical:</strong> Peak memory exceeds 4GB. Increase NODE_OPTIONS --max-old-space-size or reduce worker parallelism.
      </div>
      ` : ''}
      ${analysis.summary.peakMemory > 2 * 1024 * 1024 * 1024 ? `
      <div class="recommendation">
        <strong>Warning:</strong> Peak memory exceeds 2GB. May need tuning for CI environments with limited RAM.
      </div>
      ` : ''}
      ${analysis.memoryLeak.suspected ? `
      <div class="recommendation">
        <strong>Leak:</strong> Review build plugins and build-time code for memory retention issues.
      </div>
      ` : ''}
      <div class="recommendation">
        Continue using optimizePackageImports for large packages like lucide-react.
      </div>
      <div class="recommendation">
        Consider code splitting for pages with large bundles to reduce peak memory during bundling.
      </div>
      <div class="recommendation">
        The workflow discovery phase (${
          Object.entries(analysis.phaseStats)
            .filter(([p]) => p.includes('workflow'))
            .reduce((sum, [,s]) => sum + s.peakRss, 0) / (1024*1024)
        }MB) could benefit from lazy loading.
      </div>
    </div>
  </div>

  <script>
    const timestamps = ${JSON.stringify(timestamps)};
    const totalRss = ${JSON.stringify(totalRss)};
    const processCount = ${JSON.stringify(processCount)};
    const phases = ${JSON.stringify(phases)};
    const categoryData = ${JSON.stringify(categoryData)};
    const peakMemory = ${analysis.summary.peakMemory / (1024 * 1024)};
    const peakTimestamp = ${analysis.summary.peakTimestamp / 1000};

    const phaseColors = {
      'init': '#6e7681',
      'workflow-discovery': '#a371f7',
      'workflow-setup': '#a371f7',
      'workflow-manifest': '#a371f7',
      'compiling': '#d29922',
      'compilation-done': '#d29922',
      'type-checking': '#58a6ff',
      'collecting-data': '#3fb950',
      'static-generation': '#238636',
      'optimizing': '#79c0ff',
      'bundling': '#f85149',
      'finalizing': '#238636',
      'production-build': '#d29922',
    };

    // Memory timeline chart
    new Chart(document.getElementById('memoryChart'), {
      type: 'line',
      data: {
        labels: timestamps.map(t => t.toFixed(1) + 's'),
        datasets: [
          {
            label: 'Total RSS',
            data: totalRss,
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
          },
          ...Object.entries(categoryData).map(([cat, data], i) => ({
            label: cat,
            data: data,
            borderColor: ['#f85149', '#3fb950', '#d29922', '#a371f7'][i],
            backgroundColor: 'transparent',
            borderWidth: 1,
            tension: 0.3,
            pointRadius: 0,
          }))
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { labels: { color: '#c9d1d9' } },
          annotation: {
            annotations: {
              peakLine: {
                type: 'line',
                xMin: timestamps.indexOf(peakTimestamp),
                xMax: timestamps.indexOf(peakTimestamp),
                borderColor: '#f85149',
                borderWidth: 2,
                borderDash: [5, 5],
                label: {
                  content: 'Peak',
                  enabled: true,
                  position: 'start'
                }
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: '#8b949e', maxTicksLimit: 15 },
            grid: { color: '#21262d' }
          },
          y: {
            title: { display: true, text: 'Memory (MB)', color: '#8b949e' },
            ticks: { color: '#8b949e' },
            grid: { color: '#21262d' }
          }
        }
      }
    });

    // Category stacked area chart
    new Chart(document.getElementById('categoryChart'), {
      type: 'line',
      data: {
        labels: timestamps.map(t => t.toFixed(1) + 's'),
        datasets: Object.entries(categoryData).map(([cat, data], i) => ({
          label: cat,
          data: data,
          borderColor: ['#f85149', '#3fb950', '#d29922', '#a371f7'][i],
          backgroundColor: ['rgba(248, 81, 73, 0.3)', 'rgba(63, 185, 80, 0.3)', 'rgba(210, 153, 34, 0.3)', 'rgba(163, 113, 247, 0.3)'][i],
          fill: true,
          tension: 0.3,
          pointRadius: 0,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#c9d1d9' } } },
        scales: {
          x: { ticks: { color: '#8b949e', maxTicksLimit: 10 }, grid: { color: '#21262d' } },
          y: {
            stacked: true,
            title: { display: true, text: 'Memory (MB)', color: '#8b949e' },
            ticks: { color: '#8b949e' },
            grid: { color: '#21262d' }
          }
        }
      }
    });

    // Generate heat maps
    function getHeatColor(value, max) {
      const ratio = value / max;
      if (ratio > 0.8) return '#f85149';
      if (ratio > 0.5) return '#d29922';
      return '#238636';
    }

    const memoryHeatmap = document.getElementById('memoryHeatmap');
    const processHeatmap = document.getElementById('processHeatmap');
    const phaseHeatmap = document.getElementById('phaseHeatmap');

    const maxRss = Math.max(...totalRss);
    const maxProcs = Math.max(...processCount);

    for (let i = 0; i < totalRss.length; i++) {
      const memCell = document.createElement('div');
      memCell.className = 'heatmap-cell';
      memCell.style.backgroundColor = getHeatColor(totalRss[i], maxRss);
      memCell.title = timestamps[i].toFixed(1) + 's: ' + totalRss[i].toFixed(0) + ' MB';
      memoryHeatmap.appendChild(memCell);

      const procCell = document.createElement('div');
      procCell.className = 'heatmap-cell';
      procCell.style.backgroundColor = getHeatColor(processCount[i], maxProcs);
      procCell.title = timestamps[i].toFixed(1) + 's: ' + processCount[i] + ' processes';
      processHeatmap.appendChild(procCell);

      const phaseCell = document.createElement('div');
      phaseCell.className = 'heatmap-cell';
      phaseCell.style.backgroundColor = phaseColors[phases[i]] || '#6e7681';
      phaseCell.title = timestamps[i].toFixed(1) + 's: ' + phases[i];
      phaseHeatmap.appendChild(phaseCell);
    }
  </script>
</body>
</html>`;
}

// Main
async function main() {
  console.log('\n\x1b[36m╔════════════════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║   DETAILED BUILD MEMORY PROFILER - Tracking All Processes      ║\x1b[0m');
  console.log('\x1b[36m╚════════════════════════════════════════════════════════════════╝\x1b[0m\n');

  const systemMem = getSystemMemory();
  console.log(`System: ${formatBytes(systemMem.total)} total, ${formatBytes(systemMem.available)} available\n`);

  buildStartTime = Date.now();

  // Start build
  const build = spawn('pnpm', ['build'], {
    cwd: process.cwd(),
    stdio: ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  // Monitor output for phase detection
  build.stdout.on('data', (data) => {
    const text = data.toString();
    process.stdout.write(text);

    const newPhase = detectPhase(text);
    if (newPhase !== currentPhase) {
      phaseTransitions.push({
        from: currentPhase,
        to: newPhase,
        timestamp: Date.now() - buildStartTime,
      });
      currentPhase = newPhase;
    }
  });

  build.stderr.on('data', (data) => {
    const text = data.toString();
    process.stderr.write(text);

    const newPhase = detectPhase(text);
    if (newPhase !== currentPhase) {
      phaseTransitions.push({
        from: currentPhase,
        to: newPhase,
        timestamp: Date.now() - buildStartTime,
      });
      currentPhase = newPhase;
    }
  });

  // Sample every 500ms
  const interval = setInterval(() => {
    try {
      takeSample();
    } catch {}
  }, 500);

  // Wait for completion
  const exitCode = await new Promise((resolve) => {
    build.on('close', (code) => {
      clearInterval(interval);
      resolve(code);
    });
  });

  // Final sample
  takeSample();

  console.log('\n\x1b[36mAnalyzing memory data...\x1b[0m\n');

  // Analyze
  const analysis = analyzeResults();

  if (analysis) {
    // Print heat map
    console.log(generateHeatMap());

    // Print report
    console.log(generateReport(analysis));

    // Save files
    writeFileSync(
      join(OUTPUT_DIR, 'detailed-memory-profile.json'),
      JSON.stringify({ samples, analysis, phaseTransitions }, null, 2)
    );

    writeFileSync(
      join(OUTPUT_DIR, 'memory-heatmap-detailed.html'),
      generateHtmlReport(analysis)
    );

    console.log('\x1b[32m✓ Reports saved:\x1b[0m');
    console.log(`  - ${OUTPUT_DIR}/detailed-memory-profile.json`);
    console.log(`  - ${OUTPUT_DIR}/memory-heatmap-detailed.html\n`);
  } else {
    console.log('\x1b[31mNot enough samples to analyze.\x1b[0m\n');
  }

  process.exit(exitCode);
}

main().catch(console.error);
