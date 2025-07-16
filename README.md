# Frontend Benchmark - Cloudflare Caching Performance Testing CLI

A TypeScript CLI application that tests website performance and Cloudflare caching effectiveness under different network conditions using Puppeteer. Compatible with npm, pnpm, and Bun package managers.

## 🚀 Features

- **Real Browser Testing**: Uses Puppeteer for authentic browser behavior
- **Network Throttling**: Simulates slow3g, fast3g, and wifi conditions
- **Comprehensive Metrics**: Collects detailed performance and caching data for all static resources
- **CSV Export**: Automatically saves results with timestamped filenames
- **Static Resource Testing**: Tests all CSS, JS, images, fonts, and other static assets
- **Cache Analysis**: Tracks both Cloudflare and Worker cache performance
- **Fresh Visit Mode**: Option to clear cache between runs for first-time visitor simulation
- **Visual Charts**: Generate performance charts and graphs from CSV data
- **Summary Statistics**: Shows averages and cache hit rates by resource type

## 📦 Installation

Choose your preferred package manager and install dependencies:

### Using npm
```bash
npm install
```

### Using pnpm
```bash
pnpm install
```

### Using Bun
```bash
bun install
```

> **Note**: This project works with Node.js 18+ for npm/pnpm, or Bun runtime.

## 🖥 Usage

### Basic Usage

```bash
# Using npm
npm run test -- --url=https://example.com

# Using pnpm
pnpm test --url=https://example.com

# Using Bun
bun run test --url=https://example.com
```

### Advanced Usage

```bash
# Using npm
npm run test -- --url=https://example.com --runs=10 --profile=slow3g --output=custom-results.csv

# Using pnpm
pnpm test --url=https://example.com --runs=10 --profile=slow3g --output=custom-results.csv

# Using Bun
bun run test --url=https://example.com --runs=10 --profile=slow3g --output=custom-results.csv
```

### CLI Options

| Flag | Description | Default | Required |
|------|-------------|---------|----------|
| `--url` | Target website to test | - | ✅ |
| `--runs` | Number of test iterations | 5 | ❌ |
| `--profile` | Network profile (slow3g, fast3g, wifi) | wifi | ❌ |
| `--output` | Custom CSV filename | Auto-generated | ❌ |
| `--headful` | Run browser in non-headless mode | false | ❌ |
| `--fresh` | Clear cache/cookies between runs for fresh visits | false | ❌ |

### Network Profiles

| Profile | Latency | Download | Upload |
|---------|---------|----------|--------|
| **slow3g** | 400ms | 500 Kbps | 500 Kbps |
| **fast3g** | 100ms | 1.5 Mbps | 750 Kbps |
| **wifi** | 20ms | 10 Mbps | 5 Mbps |

## 📈 Data Visualization

Generate beautiful charts and graphs from your performance data:

### Basic Visualization

```bash
# Using npm
npm run visualize

# Using pnpm
pnpm visualize

# Using Bun
bun run visualize
```

### Advanced Visualization Options

```bash
# Specify a specific CSV file
npm run visualize -- --input=results/results_example.com_wifi_2025-01-16.csv
pnpm visualize --input=results/results_example.com_wifi_2025-01-16.csv
bun run visualize --input=results/results_example.com_wifi_2025-01-16.csv

# Generate only specific chart types
npm run visualize -- --type=performance  # Performance comparison
npm run visualize -- --type=cache       # Cache hit rates
npm run visualize -- --type=resources   # Resource distribution
npm run visualize -- --type=all         # All charts (default)

# Custom output directory and dimensions
npm run visualize -- --output=my-charts --width=1600 --height=900
pnpm visualize --output=my-charts --width=1600 --height=900
bun run visualize --output=my-charts --width=1600 --height=900
```

### Visualization CLI Options

| Flag | Description | Default | Options |
|------|-------------|---------|---------|
| `--input` | Specific CSV file to visualize | Latest CSV | Any CSV path |
| `--output` | Output directory for charts | charts | Any directory |
| `--type` | Chart types to generate | all | performance, cache, resources, all |
| `--width` | Chart width in pixels | 1200 | Any number |
| `--height` | Chart height in pixels | 800 | Any number |

### Generated Chart Types

#### 📊 **Performance Chart** (`*_performance.png`)
- Bar chart showing average TTFB by resource type
- Compares performance across different asset types
- Shows resource count for each type

#### 🎯 **Cache Hit Rate Chart** (`*_cache.png`)
- Dual bar chart comparing Cloudflare vs Worker cache performance
- Broken down by resource type
- Percentage-based visualization

#### 🥧 **Resource Distribution Chart** (`*_resources.png`)
- Pie chart showing breakdown of resource types
- Visual representation of asset composition
- Helpful for understanding site architecture

#### 📈 **Performance Timeline** (`*_timeline.png`)
- Line chart showing performance over time
- Tracks TTFB and page load times across test runs
- Useful for identifying performance trends

### Example Output

```bash
📊 Starting Performance Data Visualization
📁 Using latest CSV: results/results_example.com_wifi_2025-01-16_14-30-25.csv
📈 Loaded 48 data points
📁 Created output directory: charts
📊 Performance chart saved: charts/results_example.com_wifi_2025-01-16_14-30-25_performance.png
📊 Cache chart saved: charts/results_example.com_wifi_2025-01-16_14-30-25_cache.png
📊 Resource distribution chart saved: charts/results_example.com_wifi_2025-01-16_14-30-25_resources.png
📊 Timeline chart saved: charts/results_example.com_wifi_2025-01-16_14-30-25_timeline.png

✅ Visualization complete! Charts saved in charts/
```

## 📊 Collected Metrics

The CLI collects detailed performance metrics for **every static resource** on the page (HTML, CSS, JS, images, fonts, etc.):

### Resource Information
- **Resource URL**: Full URL of each resource
- **Resource Type**: Category (document, stylesheet, script, image, font, other)
- **Site Name**: Hostname extracted from URL
- **Timestamp**: When the test was performed

### Timing Metrics (per resource)
- **DNS Lookup Time**: Time to resolve domain name
- **TCP Connection Time**: Time to establish TCP connection
- **TLS Handshake Time**: Time for SSL/TLS negotiation
- **TTFB (Time to First Byte)**: Server response time
- **DOM Content Loaded**: Time until DOM is ready (shared across resources)
- **Full Page Load**: Complete page load time (shared across resources)

### Caching Data (per resource)
- **HTTP Status Code**: Response status (200, 404, etc.)
- **CF Cache Status**: Cloudflare cache status (HIT, MISS, EXPIRED, etc.)
- **X-Worker-Cache**: Worker cache status (HIT, MISS, etc.)
- **Cache Control**: Cache-Control header value
- **Age**: Age header value (cache age)
- **Content Length**: Response content size

## 📁 Output

Results are automatically saved to CSV files in the `results/` directory with the format:

```
results/results_{hostname}_{profile}_{date}.csv
```

Example: `results/results_example.com_slow3g_2025-01-13.csv`

### CSV Structure

```csv
Timestamp,Site Name,Resource URL,Resource Type,HTTP Status,DNS Lookup (ms),TCP Connection (ms),TLS Handshake (ms),TTFB (ms),DOM Content Loaded (ms),Full Page Load (ms),CF Cache Status,X-Worker-Cache,Cache Control,Age,Content Length
2025-01-16T10:30:45.123Z,example.com,https://example.com/,document,200,15,25,30,120,650,650,MISS,N/A,max-age=3600,0,25634
2025-01-16T10:30:45.123Z,example.com,https://example.com/style.css,stylesheet,200,0,0,0,45,650,650,HIT,HIT,max-age=86400,3600,12456
2025-01-16T10:30:45.123Z,example.com,https://example.com/app.js,script,200,0,0,0,32,650,650,HIT,MISS,max-age=86400,1800,34567
```

## 🎯 Example Output

```bash
🚀 Starting Cloudflare Caching Performance Test
   Target: https://example.com
   Runs: 3
   Network Profile: wifi
   Headless: true
   Fresh visits: false
   Output: results/results_example.com_wifi_2025-01-16_14-30-25.csv

🏃 Run 1: 24 resources (18 static) | Page Load 1200ms | Main TTFB 245ms
🏃 Run 2: 24 resources (18 static) | Page Load 890ms | Main TTFB 89ms
🏃 Run 3: 24 resources (18 static) | Page Load 920ms | Main TTFB 95ms

✅ Results saved to results/results_example.com_wifi_2025-01-16_14-30-25.csv

📊 Summary Statistics:
   Total Resources: 72
   Resource Types: document, stylesheet, script, image, font
   Average TTFB: 67ms
   Average Full Load: 1003ms
   CF Cache Hit Rate: 83% (60/72)
   Worker Cache Hit Rate: 45% (32/72)
   HTTP Status Codes: 200
   document: 3 resources, avg TTFB 143ms, cache hit 33%
   stylesheet: 9 resources, avg TTFB 45ms, cache hit 100%
   script: 24 resources, avg TTFB 52ms, cache hit 92%
   image: 30 resources, avg TTFB 23ms, cache hit 87%
   font: 6 resources, avg TTFB 89ms, cache hit 100%
```

## 🔧 Use Cases

- **Performance Monitoring**: Track website and static asset performance across different network conditions
- **Cache Strategy Optimization**: Analyze Cloudflare and Worker cache effectiveness for different resource types
- **Static Asset Analysis**: Identify slow-loading CSS, JS, images, or fonts
- **First-Time vs. Returning Visitor Analysis**: Use `--fresh` flag to simulate different user scenarios
- **A/B Testing**: Compare performance before/after changes with visual charts
- **Network Impact Analysis**: Understand how network conditions affect different asset types
- **Performance Reporting**: Generate CSV data and visual charts for stakeholder reports
- **Resource Optimization**: Identify which static assets need optimization or better caching
- **CDN Performance**: Measure effectiveness of your Cloudflare setup across all resources

## 🛠 Technical Details

- **Runtime**: Node.js 18+ (npm/pnpm) or Bun
- **Language**: TypeScript (executed via tsx for npm/pnpm)
- **Browser**: Puppeteer (Chromium)
- **Network Simulation**: Chrome DevTools Protocol
- **CSV Generation**: csv-writer library
- **CLI Parsing**: minimist

## 📋 Requirements

### For npm/pnpm users:
- Node.js 18 or higher
- npm or pnpm package manager

### For Bun users:
- Bun runtime

### All environments:
- Modern system with Chromium support
- Network access to target websites

## 🐛 Troubleshooting

### Common Issues

**"Cannot find module" errors**: Install dependencies with your package manager:
- `npm install` (for npm)
- `pnpm install` (for pnpm)
- `bun install` (for Bun)

**TypeScript execution errors**: Make sure you're using the correct commands for your package manager (see usage examples above)

**Puppeteer launch fails**: Try running with `--headful` flag for debugging

**Network timeout errors**: Increase timeout or check network connectivity

**Permission errors**: Ensure write permissions for results directory

**Node.js version issues**: Ensure you have Node.js 18+ installed when using npm/pnpm

## 📄 License

MIT License - feel free to use this tool for your performance testing needs!