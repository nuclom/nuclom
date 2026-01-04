# Load Testing Infrastructure

This directory contains k6 load testing scripts for validating the performance of the Nuclom platform under various load conditions.

## Prerequisites

Install k6 on your machine:

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
```

## Test Scripts

| Script | Description |
|--------|-------------|
| `auth-flow.js` | Tests authentication endpoints (sign in, session, sign out) |
| `video-page.js` | Tests video page loading (metadata, comments, transcript) |
| `search.js` | Tests search functionality (quick search, full search, suggestions) |
| `comments.js` | Tests comment operations (create, reply, react, delete) |
| `config.js` | Shared configuration and load profiles |

## Running Tests

### Environment Variables

Set these environment variables before running tests:

```bash
export K6_BASE_URL="https://staging.nuclom.com"
export K6_API_KEY="your-api-key"
export K6_TEST_EMAIL="load-test@example.com"
export K6_TEST_PASSWORD="test-password"
export K6_TEST_VIDEO_ID="test-video-id"
export K6_TEST_ORG_ID="test-org-id"
```

### Load Profiles

Each test supports different load profiles via the `PROFILE` environment variable:

| Profile | Description | VUs | Duration |
|---------|-------------|-----|----------|
| `smoke` | Minimal load, verify functionality | 5 | ~4 min |
| `load` | Moderate sustained load | 100 | ~14 min |
| `stress` | High load to find breaking point | 1000 | ~19 min |
| `spike` | Sudden traffic surge | 1000 | ~7 min |
| `soak` | Extended duration for memory leaks | 200 | ~2+ hours |

### Running Individual Tests

```bash
# Smoke test (quick verification)
PROFILE=smoke k6 run tests/load/auth-flow.js

# Load test
PROFILE=load k6 run tests/load/video-page.js

# Stress test
PROFILE=stress k6 run tests/load/search.js

# Spike test
PROFILE=spike k6 run tests/load/comments.js
```

### Running All Tests

```bash
# Run all tests sequentially
for test in auth-flow.js video-page.js search.js comments.js; do
  PROFILE=load k6 run tests/load/$test
done
```

## Performance Thresholds

Tests are configured with the following performance budgets:

| Metric | Threshold |
|--------|-----------|
| Response time (p95) | < 200ms |
| Response time (p99) | < 500ms |
| Error rate | < 1% |
| Check pass rate | > 95% |

## Output and Reporting

### Console Output

By default, k6 outputs a summary to the console with:
- Request duration statistics
- Pass/fail rates for checks
- Custom metric values

### JSON Output

Export results to JSON for further analysis:

```bash
k6 run --out json=results.json tests/load/video-page.js
```

### InfluxDB + Grafana

For real-time monitoring, output to InfluxDB:

```bash
k6 run --out influxdb=http://localhost:8086/k6 tests/load/video-page.js
```

### Cloud Output (k6 Cloud)

Stream results to k6 Cloud for visualization:

```bash
k6 cloud tests/load/video-page.js
```

## Best Practices

1. **Never test against production** - Always use staging or a dedicated test environment
2. **Use test accounts** - Create dedicated test users that can be easily identified
3. **Clean up test data** - Scripts should clean up any data they create
4. **Monitor the target** - Watch server metrics during tests to identify bottlenecks
5. **Start small** - Begin with smoke tests before ramping up load
6. **Baseline first** - Establish performance baselines before optimizing

## Interpreting Results

### Key Metrics

- **http_req_duration**: Total time for HTTP requests
- **http_req_blocked**: Time spent waiting for a connection
- **http_req_connecting**: Time spent establishing connection
- **http_req_waiting**: Time waiting for response (TTFB)
- **http_req_receiving**: Time receiving response body
- **http_req_failed**: Rate of failed requests

### Healthy Results

- p95 latency under 200ms for API calls
- Error rate under 1%
- All check pass rates above 95%
- No significant increase in latency under load

### Warning Signs

- p95 latency exceeding 500ms
- Error rate above 5%
- Check pass rates below 90%
- Latency increasing significantly under load (indicates saturation)

## Custom Metrics

Each test script includes custom metrics for specific operations:

- `login_duration` - Time to complete authentication
- `video_load_duration` - Time to fetch video metadata
- `search_success_rate` - Percentage of successful searches
- `comment_errors` - Count of comment operation failures

Access these in the summary output or export to InfluxDB/Cloud for visualization.
