#!/usr/bin/env node

/**
 * Build Memory Profiler
 *
 * This script monitors memory usage during the build process and generates
 * a detailed analysis with heat map visualization.
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '../.build-analysis');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Memory samples
const memorySamples = [];
const processMemorySamples = new Map(); // Track per-process memory
let buildStartTime = Date.now();
let currentPhase = 'init';
const phaseTimeline = [];

// ANSI colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Get system memory info
function getSystemMemory() {
  try {
    const memInfo = {};
    const proc = spawn('cat', ['/proc/meminfo'], { encoding: 'utf8' });
    return new Promise((resolve) => {
      let data = '';
      proc.stdout.on('data', (chunk) => data += chunk);
      proc.on('close', () => {
        const lines = data.split('\n');
        for (const line of lines) {
          const [key, value] = line.split(':').map(s => s?.trim());
          if (key && value) {
            const match = value.match(/(\d+)/);
            if (match) {
              memInfo[key] = parseInt(match[1], 10) * 1024; // Convert KB to bytes
            }
          }
        }
        resolve(memInfo);
      });
    });
  } catch {
    return Promise.resolve({});
  }
}

// Get memory usage of a process and its children
async function getProcessTreeMemory(pid) {
  return new Promise((resolve) => {
    const proc = spawn('ps', ['-o', 'pid,rss,vsz,comm', '--ppid', pid.toString(), '--pid', pid.toString()], {
      encoding: 'utf8'
    });
    let data = '';
    proc.stdout.on('data', (chunk) => data += chunk);
    proc.on('close', () => {
      const lines = data.trim().split('\n').slice(1);
      let totalRss = 0;
      let totalVsz = 0;
      const processes = [];

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          const rss = parseInt(parts[1], 10) * 1024; // KB to bytes
          const vsz = parseInt(parts[2], 10) * 1024;
          const comm = parts.slice(3).join(' ');
          totalRss += rss;
          totalVsz += vsz;
          processes.push({ pid: parts[0], rss, vsz, comm });
        }
      }

      resolve({ totalRss, totalVsz, processes });
    });
  });
}

// Detect build phase from output
function detectPhase(text) {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('linting') || lowerText.includes('eslint')) {
    return 'linting';
  }
  if (lowerText.includes('type checking') || lowerText.includes('checking validity')) {
    return 'type-checking';
  }
  if (lowerText.includes('compiling') || lowerText.includes('compiled') || lowerText.includes('building')) {
    return 'compiling';
  }
  if (lowerText.includes('optimizing') || lowerText.includes('minifying')) {
    return 'optimizing';
  }
  if (lowerText.includes('static generation') || lowerText.includes('generating static')) {
    return 'static-generation';
  }
  if (lowerText.includes('bundling') || lowerText.includes('bundle')) {
    return 'bundling';
  }
  if (lowerText.includes('collecting page data')) {
    return 'collecting-data';
  }
  if (lowerText.includes('creating an optimized production')) {
    return 'production-build';
  }

  return currentPhase;
}

// Sample memory at regular intervals
async function sampleMemory(buildProcess) {
  const timestamp = Date.now() - buildStartTime;
  const systemMem = await getSystemMemory();
  const processMem = await getProcessTreeMemory(buildProcess.pid);

  const sample = {
    timestamp,
    phase: currentPhase,
    system: {
      total: systemMem.MemTotal || 0,
      free: systemMem.MemFree || 0,
      available: systemMem.MemAvailable || 0,
      buffers: systemMem.Buffers || 0,
      cached: systemMem.Cached || 0,
    },
    process: {
      rss: processMem.totalRss,
      vsz: processMem.totalVsz,
      children: processMem.processes,
    },
    nodeHeap: process.memoryUsage(),
  };

  memorySamples.push(sample);

  // Track per-process memory over time
  for (const proc of processMem.processes) {
    const key = proc.comm;
    if (!processMemorySamples.has(key)) {
      processMemorySamples.set(key, []);
    }
    processMemorySamples.get(key).push({
      timestamp,
      rss: proc.rss,
      vsz: proc.vsz,
    });
  }

  return sample;
}

// Format bytes to human readable
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Generate ASCII heat map
function generateHeatMap(samples) {
  const width = 80;
  const height = 20;

  // Get max memory for scaling
  const maxRss = Math.max(...samples.map(s => s.process.rss));
  const maxSystem = Math.max(...samples.map(s => s.system.total - s.system.available));

  let heatMap = '\n' + colors.cyan + '='.repeat(width + 4) + colors.reset + '\n';
  heatMap += colors.cyan + '  MEMORY USAGE HEAT MAP (Build Timeline)' + colors.reset + '\n';
  heatMap += colors.cyan + '='.repeat(width + 4) + colors.reset + '\n\n';

  // Create timeline buckets
  const bucketSize = Math.ceil(samples.length / width);
  const buckets = [];

  for (let i = 0; i < width; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, samples.length);
    const bucketSamples = samples.slice(start, end);

    if (bucketSamples.length > 0) {
      const avgRss = bucketSamples.reduce((sum, s) => sum + s.process.rss, 0) / bucketSamples.length;
      const avgSystem = bucketSamples.reduce((sum, s) => sum + (s.system.total - s.system.available), 0) / bucketSamples.length;
      const phase = bucketSamples[Math.floor(bucketSamples.length / 2)].phase;
      buckets.push({ avgRss, avgSystem, phase });
    }
  }

  // Heat map characters
  const heatChars = [' ', '░', '▒', '▓', '█'];

  // Draw process memory
  heatMap += colors.yellow + '  Process RSS Memory:' + colors.reset + '\n  ';
  for (const bucket of buckets) {
    const intensity = Math.min(4, Math.floor((bucket.avgRss / maxRss) * 5));
    const color = intensity >= 3 ? colors.red : intensity >= 2 ? colors.yellow : colors.green;
    heatMap += color + heatChars[intensity] + colors.reset;
  }
  heatMap += '\n';

  // Draw system memory
  heatMap += colors.blue + '  System Memory Used:' + colors.reset + '\n  ';
  for (const bucket of buckets) {
    const intensity = Math.min(4, Math.floor((bucket.avgSystem / maxSystem) * 5));
    const color = intensity >= 3 ? colors.red : intensity >= 2 ? colors.yellow : colors.green;
    heatMap += color + heatChars[intensity] + colors.reset;
  }
  heatMap += '\n';

  // Draw phase timeline
  const phaseColors = {
    'init': colors.white,
    'linting': colors.magenta,
    'type-checking': colors.blue,
    'compiling': colors.yellow,
    'optimizing': colors.cyan,
    'static-generation': colors.green,
    'bundling': colors.red,
    'collecting-data': colors.magenta,
    'production-build': colors.yellow,
  };

  heatMap += colors.green + '  Build Phase:' + colors.reset + '\n  ';
  for (const bucket of buckets) {
    const color = phaseColors[bucket.phase] || colors.white;
    heatMap += color + '▀' + colors.reset;
  }
  heatMap += '\n';

  // Legend
  heatMap += '\n  ' + colors.cyan + 'Legend:' + colors.reset + ' ';
  heatMap += '░ Low  ▒ Medium  ▓ High  █ Peak\n';
  heatMap += '  ' + colors.cyan + 'Phases:' + colors.reset + ' ';
  for (const [phase, color] of Object.entries(phaseColors)) {
    heatMap += color + '■' + colors.reset + ' ' + phase + '  ';
  }
  heatMap += '\n';

  // Time scale
  const totalTime = samples[samples.length - 1]?.timestamp || 0;
  heatMap += '\n  ' + colors.cyan + 'Timeline:' + colors.reset + ' 0s';
  heatMap += ' '.repeat(width - 20);
  heatMap += (totalTime / 1000).toFixed(1) + 's\n';

  return heatMap;
}

// Analyze memory patterns
function analyzeMemoryPatterns(samples) {
  if (samples.length < 2) return { issues: [], recommendations: [] };

  const issues = [];
  const recommendations = [];

  // Calculate memory growth rate
  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];
  const memoryGrowth = lastSample.process.rss - firstSample.process.rss;
  const duration = (lastSample.timestamp - firstSample.timestamp) / 1000;
  const growthRate = memoryGrowth / duration; // bytes per second

  // Peak memory
  const peakRss = Math.max(...samples.map(s => s.process.rss));
  const avgRss = samples.reduce((sum, s) => sum + s.process.rss, 0) / samples.length;

  // Memory by phase
  const phaseMemory = {};
  for (const sample of samples) {
    if (!phaseMemory[sample.phase]) {
      phaseMemory[sample.phase] = { samples: [], peak: 0, total: 0 };
    }
    phaseMemory[sample.phase].samples.push(sample.process.rss);
    phaseMemory[sample.phase].peak = Math.max(phaseMemory[sample.phase].peak, sample.process.rss);
    phaseMemory[sample.phase].total += sample.process.rss;
  }

  // Detect potential memory leak (sustained growth without release)
  let sustainedGrowth = 0;
  let growthPeriods = 0;
  for (let i = 1; i < samples.length; i++) {
    if (samples[i].process.rss > samples[i - 1].process.rss) {
      sustainedGrowth++;
    } else {
      if (sustainedGrowth > 10) growthPeriods++;
      sustainedGrowth = 0;
    }
  }

  // Check for memory spikes
  const spikes = [];
  for (let i = 1; i < samples.length - 1; i++) {
    const prevRss = samples[i - 1].process.rss;
    const currRss = samples[i].process.rss;
    const nextRss = samples[i + 1].process.rss;

    if (currRss > prevRss * 1.5 && currRss > nextRss * 1.2) {
      spikes.push({
        timestamp: samples[i].timestamp,
        phase: samples[i].phase,
        memory: currRss,
        increase: currRss - prevRss,
      });
    }
  }

  // Generate issues and recommendations
  if (peakRss > 4 * 1024 * 1024 * 1024) { // 4GB
    issues.push({
      severity: 'critical',
      message: `Peak memory usage (${formatBytes(peakRss)}) exceeds 4GB`,
      details: 'This can cause OOM errors on CI/CD systems with limited memory',
    });
  } else if (peakRss > 2 * 1024 * 1024 * 1024) { // 2GB
    issues.push({
      severity: 'warning',
      message: `Peak memory usage (${formatBytes(peakRss)}) exceeds 2GB`,
      details: 'Consider optimizing for environments with limited memory',
    });
  }

  if (growthRate > 50 * 1024 * 1024) { // 50MB/s
    issues.push({
      severity: 'warning',
      message: `High memory growth rate: ${formatBytes(growthRate)}/s`,
      details: 'Memory is growing rapidly, which may indicate inefficient processing',
    });
  }

  if (growthPeriods > 3) {
    issues.push({
      severity: 'warning',
      message: `Detected ${growthPeriods} periods of sustained memory growth`,
      details: 'This pattern may indicate memory not being released between build phases',
    });
  }

  if (spikes.length > 0) {
    issues.push({
      severity: 'info',
      message: `Detected ${spikes.length} memory spike(s)`,
      details: spikes.map(s =>
        `+${formatBytes(s.increase)} at ${(s.timestamp/1000).toFixed(1)}s during ${s.phase}`
      ).join('\n          '),
    });
  }

  // Find memory-intensive phases
  for (const [phase, data] of Object.entries(phaseMemory)) {
    const avgPhaseMemory = data.total / data.samples.length;
    if (data.peak > peakRss * 0.9) {
      recommendations.push({
        phase,
        message: `Phase "${phase}" uses peak memory (${formatBytes(data.peak)})`,
        suggestion: 'Consider optimizing this phase or running it with more memory allocation',
      });
    }
  }

  // General recommendations
  if (peakRss > 2 * 1024 * 1024 * 1024) {
    recommendations.push({
      phase: 'general',
      message: 'High overall memory usage detected',
      suggestion: 'Enable incremental builds, split large bundles, or use swcMinify',
    });
  }

  return {
    summary: {
      peakMemory: peakRss,
      averageMemory: avgRss,
      totalDuration: duration,
      memoryGrowth,
      growthRate,
      spikeCount: spikes.length,
    },
    phaseMemory,
    spikes,
    issues,
    recommendations,
  };
}

// Generate detailed report
function generateReport(samples, analysis) {
  let report = '';

  report += '\n' + '═'.repeat(80) + '\n';
  report += '                    BUILD MEMORY ANALYSIS REPORT\n';
  report += '═'.repeat(80) + '\n\n';

  // Summary
  report += colors.cyan + '━━━ SUMMARY ━━━' + colors.reset + '\n\n';
  report += `  Peak Memory:      ${colors.yellow}${formatBytes(analysis.summary.peakMemory)}${colors.reset}\n`;
  report += `  Average Memory:   ${formatBytes(analysis.summary.averageMemory)}\n`;
  report += `  Build Duration:   ${analysis.summary.totalDuration.toFixed(1)}s\n`;
  report += `  Memory Growth:    ${formatBytes(analysis.summary.memoryGrowth)} total\n`;
  report += `  Growth Rate:      ${formatBytes(analysis.summary.growthRate)}/s\n`;
  report += `  Memory Spikes:    ${analysis.summary.spikeCount}\n\n`;

  // Phase breakdown
  report += colors.cyan + '━━━ MEMORY BY BUILD PHASE ━━━' + colors.reset + '\n\n';
  const sortedPhases = Object.entries(analysis.phaseMemory)
    .sort((a, b) => b[1].peak - a[1].peak);

  for (const [phase, data] of sortedPhases) {
    const avgMem = data.total / data.samples.length;
    const barLength = Math.floor((data.peak / analysis.summary.peakMemory) * 40);
    const bar = '█'.repeat(barLength) + '░'.repeat(40 - barLength);

    report += `  ${phase.padEnd(20)} ${colors.yellow}${bar}${colors.reset} ${formatBytes(data.peak).padStart(10)}\n`;
  }
  report += '\n';

  // Issues
  if (analysis.issues.length > 0) {
    report += colors.cyan + '━━━ ISSUES DETECTED ━━━' + colors.reset + '\n\n';
    for (const issue of analysis.issues) {
      const icon = issue.severity === 'critical' ? colors.red + '✗' :
                   issue.severity === 'warning' ? colors.yellow + '⚠' :
                   colors.blue + 'ℹ';
      report += `  ${icon}${colors.reset} ${issue.message}\n`;
      report += `     ${colors.white}${issue.details}${colors.reset}\n\n`;
    }
  }

  // Recommendations
  if (analysis.recommendations.length > 0) {
    report += colors.cyan + '━━━ RECOMMENDATIONS ━━━' + colors.reset + '\n\n';
    for (const rec of analysis.recommendations) {
      report += `  ${colors.green}→${colors.reset} ${rec.message}\n`;
      report += `     ${colors.white}${rec.suggestion}${colors.reset}\n\n`;
    }
  }

  // Process breakdown
  report += colors.cyan + '━━━ TOP MEMORY CONSUMERS (by process) ━━━' + colors.reset + '\n\n';
  const processStats = [];
  for (const [name, samples] of processMemorySamples.entries()) {
    const peakRss = Math.max(...samples.map(s => s.rss));
    processStats.push({ name, peakRss });
  }
  processStats.sort((a, b) => b.peakRss - a.peakRss);

  for (const proc of processStats.slice(0, 10)) {
    const barLength = Math.floor((proc.peakRss / processStats[0].peakRss) * 40);
    const bar = '█'.repeat(Math.max(1, barLength)) + '░'.repeat(40 - barLength);
    report += `  ${proc.name.padEnd(20).slice(0, 20)} ${colors.magenta}${bar}${colors.reset} ${formatBytes(proc.peakRss).padStart(10)}\n`;
  }
  report += '\n';

  report += '═'.repeat(80) + '\n';

  return report;
}

// Main execution
async function main() {
  console.log(colors.cyan + '\n╔════════════════════════════════════════════════════════════╗' + colors.reset);
  console.log(colors.cyan + '║           BUILD MEMORY PROFILER - Starting...              ║' + colors.reset);
  console.log(colors.cyan + '╚════════════════════════════════════════════════════════════╝\n' + colors.reset);

  // Get initial system memory
  const initialSystem = await getSystemMemory();
  console.log(`System Memory: ${formatBytes(initialSystem.MemTotal)} total, ${formatBytes(initialSystem.MemAvailable)} available\n`);

  // Start the build process
  buildStartTime = Date.now();

  const buildProcess = spawn('pnpm', ['build'], {
    cwd: process.cwd(),
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
      ...process.env,
      FORCE_COLOR: '1',
      NODE_OPTIONS: '--max-old-space-size=8192 --expose-gc',
    },
  });

  // Capture output and detect phases
  let outputBuffer = '';

  buildProcess.stdout.on('data', (data) => {
    const text = data.toString();
    outputBuffer += text;
    process.stdout.write(text);

    const newPhase = detectPhase(text);
    if (newPhase !== currentPhase) {
      phaseTimeline.push({
        phase: newPhase,
        timestamp: Date.now() - buildStartTime,
        previousPhase: currentPhase,
      });
      currentPhase = newPhase;
    }
  });

  buildProcess.stderr.on('data', (data) => {
    const text = data.toString();
    outputBuffer += text;
    process.stderr.write(text);

    const newPhase = detectPhase(text);
    if (newPhase !== currentPhase) {
      phaseTimeline.push({
        phase: newPhase,
        timestamp: Date.now() - buildStartTime,
        previousPhase: currentPhase,
      });
      currentPhase = newPhase;
    }
  });

  // Sample memory every 500ms
  const samplingInterval = setInterval(async () => {
    try {
      await sampleMemory(buildProcess);
    } catch (err) {
      // Process may have ended
    }
  }, 500);

  // Wait for build to complete
  const exitCode = await new Promise((resolve) => {
    buildProcess.on('close', (code) => {
      clearInterval(samplingInterval);
      resolve(code);
    });
  });

  // Take final sample
  const buildDuration = Date.now() - buildStartTime;

  // Analyze results
  console.log('\n' + colors.cyan + 'Analyzing memory usage...' + colors.reset + '\n');

  const analysis = analyzeMemoryPatterns(memorySamples);

  // Generate heat map
  const heatMap = generateHeatMap(memorySamples);
  console.log(heatMap);

  // Generate report
  const report = generateReport(memorySamples, analysis);
  console.log(report);

  // Save data to files
  const reportData = {
    buildDuration,
    exitCode,
    samples: memorySamples,
    phaseTimeline,
    analysis,
    timestamp: new Date().toISOString(),
  };

  writeFileSync(
    join(OUTPUT_DIR, 'memory-profile.json'),
    JSON.stringify(reportData, null, 2)
  );

  // Save HTML heat map
  const htmlReport = generateHtmlReport(memorySamples, analysis, phaseTimeline);
  writeFileSync(join(OUTPUT_DIR, 'memory-heatmap.html'), htmlReport);

  console.log(colors.green + `\n✓ Reports saved to ${OUTPUT_DIR}/` + colors.reset);
  console.log(`  - memory-profile.json (raw data)`);
  console.log(`  - memory-heatmap.html (interactive visualization)\n`);

  process.exit(exitCode);
}

// Generate HTML heat map report
function generateHtmlReport(samples, analysis, phaseTimeline) {
  const timestamps = samples.map(s => s.timestamp / 1000);
  const processRss = samples.map(s => s.process.rss / (1024 * 1024));
  const systemUsed = samples.map(s => (s.system.total - s.system.available) / (1024 * 1024));
  const phases = samples.map(s => s.phase);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Build Memory Analysis - Heat Map</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 2rem;
    }
    h1 { color: #58a6ff; margin-bottom: 1rem; }
    h2 { color: #8b949e; margin: 2rem 0 1rem; font-size: 1.2rem; }
    .container { max-width: 1400px; margin: 0 auto; }
    .chart-container {
      background: #161b22;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      border: 1px solid #30363d;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: #161b22;
      border-radius: 8px;
      padding: 1.5rem;
      border: 1px solid #30363d;
    }
    .stat-card .label { color: #8b949e; font-size: 0.85rem; }
    .stat-card .value { color: #58a6ff; font-size: 1.8rem; font-weight: bold; }
    .stat-card .unit { color: #6e7681; font-size: 0.9rem; }
    .issues { margin-top: 2rem; }
    .issue {
      background: #161b22;
      border-radius: 8px;
      padding: 1rem 1.5rem;
      margin-bottom: 0.5rem;
      border-left: 4px solid;
    }
    .issue.critical { border-color: #f85149; }
    .issue.warning { border-color: #d29922; }
    .issue.info { border-color: #58a6ff; }
    .issue .title { font-weight: bold; margin-bottom: 0.25rem; }
    .issue .details { color: #8b949e; font-size: 0.9rem; }
    .heatmap-row {
      display: flex;
      height: 30px;
      margin-bottom: 0.5rem;
      border-radius: 4px;
      overflow: hidden;
    }
    .heatmap-cell {
      flex: 1;
      min-width: 2px;
    }
    .legend {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
      margin-top: 1rem;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }
    .legend-color {
      width: 16px;
      height: 16px;
      border-radius: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
    }
    th, td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid #30363d;
    }
    th { color: #8b949e; font-weight: 500; }
    .bar {
      height: 20px;
      background: linear-gradient(90deg, #238636, #3fb950);
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Build Memory Analysis Report</h1>
    <p style="color: #8b949e; margin-bottom: 2rem;">Generated: ${new Date().toLocaleString()}</p>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Peak Memory</div>
        <div class="value">${(analysis.summary.peakMemory / (1024 * 1024 * 1024)).toFixed(2)}</div>
        <div class="unit">GB</div>
      </div>
      <div class="stat-card">
        <div class="label">Average Memory</div>
        <div class="value">${(analysis.summary.averageMemory / (1024 * 1024 * 1024)).toFixed(2)}</div>
        <div class="unit">GB</div>
      </div>
      <div class="stat-card">
        <div class="label">Build Duration</div>
        <div class="value">${analysis.summary.totalDuration.toFixed(1)}</div>
        <div class="unit">seconds</div>
      </div>
      <div class="stat-card">
        <div class="label">Growth Rate</div>
        <div class="value">${(analysis.summary.growthRate / (1024 * 1024)).toFixed(1)}</div>
        <div class="unit">MB/s</div>
      </div>
    </div>

    <h2>Memory Timeline</h2>
    <div class="chart-container">
      <canvas id="memoryChart"></canvas>
    </div>

    <h2>Memory Heat Map</h2>
    <div class="chart-container">
      <div style="margin-bottom: 0.5rem; color: #8b949e;">Process RSS Memory</div>
      <div class="heatmap-row" id="rssHeatmap"></div>
      <div style="margin-bottom: 0.5rem; color: #8b949e;">System Memory Used</div>
      <div class="heatmap-row" id="systemHeatmap"></div>
      <div style="margin-bottom: 0.5rem; color: #8b949e;">Build Phase</div>
      <div class="heatmap-row" id="phaseHeatmap"></div>
      <div class="legend">
        <div class="legend-item"><div class="legend-color" style="background: #238636"></div> Low</div>
        <div class="legend-item"><div class="legend-color" style="background: #d29922"></div> Medium</div>
        <div class="legend-item"><div class="legend-color" style="background: #f85149"></div> High</div>
      </div>
    </div>

    <h2>Memory by Build Phase</h2>
    <div class="chart-container">
      <table>
        <thead>
          <tr>
            <th>Phase</th>
            <th>Peak Memory</th>
            <th style="width: 50%">Usage</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(analysis.phaseMemory)
            .sort((a, b) => b[1].peak - a[1].peak)
            .map(([phase, data]) => `
              <tr>
                <td>${phase}</td>
                <td>${(data.peak / (1024 * 1024)).toFixed(0)} MB</td>
                <td><div class="bar" style="width: ${(data.peak / analysis.summary.peakMemory * 100).toFixed(0)}%"></div></td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>

    ${analysis.issues.length > 0 ? `
    <h2>Issues Detected</h2>
    <div class="issues">
      ${analysis.issues.map(issue => `
        <div class="issue ${issue.severity}">
          <div class="title">${issue.message}</div>
          <div class="details">${issue.details}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}

    ${analysis.recommendations.length > 0 ? `
    <h2>Recommendations</h2>
    <div class="issues">
      ${analysis.recommendations.map(rec => `
        <div class="issue info">
          <div class="title">${rec.message}</div>
          <div class="details">${rec.suggestion}</div>
        </div>
      `).join('')}
    </div>
    ` : ''}
  </div>

  <script>
    const timestamps = ${JSON.stringify(timestamps)};
    const processRss = ${JSON.stringify(processRss)};
    const systemUsed = ${JSON.stringify(systemUsed)};
    const phases = ${JSON.stringify(phases)};
    const peakMemory = ${analysis.summary.peakMemory / (1024 * 1024)};

    // Phase colors
    const phaseColors = {
      'init': '#6e7681',
      'linting': '#a371f7',
      'type-checking': '#58a6ff',
      'compiling': '#d29922',
      'optimizing': '#3fb950',
      'static-generation': '#238636',
      'bundling': '#f85149',
      'collecting-data': '#a371f7',
      'production-build': '#d29922',
    };

    // Memory timeline chart
    new Chart(document.getElementById('memoryChart'), {
      type: 'line',
      data: {
        labels: timestamps.map(t => t.toFixed(1) + 's'),
        datasets: [
          {
            label: 'Process RSS',
            data: processRss,
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            fill: true,
            tension: 0.4,
          },
          {
            label: 'System Used',
            data: systemUsed,
            borderColor: '#f85149',
            backgroundColor: 'rgba(248, 81, 73, 0.1)',
            fill: true,
            tension: 0.4,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#c9d1d9' } }
        },
        scales: {
          x: {
            ticks: { color: '#8b949e', maxTicksLimit: 20 },
            grid: { color: '#30363d' }
          },
          y: {
            title: { display: true, text: 'Memory (MB)', color: '#8b949e' },
            ticks: { color: '#8b949e' },
            grid: { color: '#30363d' }
          }
        }
      }
    });

    // Generate heat maps
    function getHeatColor(value, max) {
      const ratio = value / max;
      if (ratio > 0.8) return '#f85149';
      if (ratio > 0.6) return '#d29922';
      if (ratio > 0.4) return '#3fb950';
      return '#238636';
    }

    const rssHeatmap = document.getElementById('rssHeatmap');
    const systemHeatmap = document.getElementById('systemHeatmap');
    const phaseHeatmap = document.getElementById('phaseHeatmap');

    const maxRss = Math.max(...processRss);
    const maxSystem = Math.max(...systemUsed);

    for (let i = 0; i < processRss.length; i++) {
      const rssCell = document.createElement('div');
      rssCell.className = 'heatmap-cell';
      rssCell.style.backgroundColor = getHeatColor(processRss[i], maxRss);
      rssCell.title = \`\${timestamps[i].toFixed(1)}s: \${processRss[i].toFixed(0)} MB\`;
      rssHeatmap.appendChild(rssCell);

      const sysCell = document.createElement('div');
      sysCell.className = 'heatmap-cell';
      sysCell.style.backgroundColor = getHeatColor(systemUsed[i], maxSystem);
      sysCell.title = \`\${timestamps[i].toFixed(1)}s: \${systemUsed[i].toFixed(0)} MB\`;
      systemHeatmap.appendChild(sysCell);

      const phaseCell = document.createElement('div');
      phaseCell.className = 'heatmap-cell';
      phaseCell.style.backgroundColor = phaseColors[phases[i]] || '#6e7681';
      phaseCell.title = \`\${timestamps[i].toFixed(1)}s: \${phases[i]}\`;
      phaseHeatmap.appendChild(phaseCell);
    }
  </script>
</body>
</html>`;
}

main().catch(console.error);
