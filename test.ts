#!/usr/bin/env tsx

import puppeteer from 'puppeteer';
import * as csvWriter from 'csv-writer';
import minimist from 'minimist';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

// Network profiles configuration
const NETWORK_PROFILES = {
    slow3g: {
        latency: 400,
        downloadThroughput: (500 * 1024) / 8, // 500 Kbps in bytes/sec
        uploadThroughput: (500 * 1024) / 8,   // 500 Kbps in bytes/sec
    },
    fast3g: {
        latency: 100,
        downloadThroughput: (1.5 * 1024 * 1024) / 8, // 1.5 Mbps in bytes/sec
        uploadThroughput: (750 * 1024) / 8,          // 750 Kbps in bytes/sec
    },
    wifi: {
        latency: 20,
        downloadThroughput: (10 * 1024 * 1024) / 8, // 10 Mbps in bytes/sec
        uploadThroughput: (5 * 1024 * 1024) / 8,    // 5 Mbps in bytes/sec
    },
};

// Performance metrics interface
interface PerformanceMetrics {
    timestamp: string;
    siteName: string;
    resourceUrl: string;
    resourceType: string;
    httpStatus: number;
    dnsLookupTime: number;
    tcpConnectionTime: number;
    tlsHandshakeTime: number;
    ttfb: number;
    domContentLoadedTime: number;
    fullPageLoadTime: number;
    cfCacheStatus: string;
    xWorkerCache: string;
    cacheControl: string;
    age: string;
    contentLength: string;
}

// CLI arguments interface
interface CLIArgs {
    url: string;
    runs: number;
    profile: keyof typeof NETWORK_PROFILES;
    output?: string;
    headful?: boolean;
    fresh?: boolean;
    _: string[];
}

// Parse CLI arguments
function parseArguments(): CLIArgs {
    const args = minimist(process.argv.slice(2), {
        string: ['url', 'profile', 'output'],
        boolean: ['headful', 'fresh'],
        default: {
            runs: 5,
            profile: 'wifi',
            headful: false,
            fresh: false,
        },
    });

    if (!args.url) {
        console.error('❌ Error: --url parameter is required');
        console.log('\nUsage: {npm|pnpm|bun} run test -- --url=https://example.com [options]');
        console.log('\nOptions:');
        console.log('  --url        Target website to test (required)');
        console.log('  --runs       Number of test iterations (default: 5)');
        console.log('  --profile    Network profile: slow3g, fast3g, wifi (default: wifi)');
        console.log('  --output     Custom CSV filename');
        console.log('  --headful    Run in non-headless mode');
        console.log('  --fresh      Clear cache/cookies between runs for fresh visits');
        process.exit(1);
    }

    if (!NETWORK_PROFILES[args.profile as keyof typeof NETWORK_PROFILES]) {
        console.error(`❌ Error: Invalid profile "${args.profile}". Use: slow3g, fast3g, or wifi`);
        process.exit(1);
    }

    return args as CLIArgs;
}

// Extract hostname from URL
function getHostname(url: string): string {
    try {
        return new URL(url).hostname;
    } catch {
        return 'invalid-url';
    }
}

// Determine resource type from URL and MIME type
function getResourceType(url: string, mimeType?: string): string {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname.toLowerCase();

        // Check by MIME type first
        if (mimeType) {
            if (mimeType.includes('text/html')) return 'document';
            if (mimeType.includes('text/css')) return 'stylesheet';
            if (mimeType.includes('javascript')) return 'script';
            if (mimeType.includes('image/')) return 'image';
            if (mimeType.includes('font/') || mimeType.includes('application/font')) return 'font';
        }

        // Check by file extension
        if (pathname.endsWith('.css')) return 'stylesheet';
        if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) return 'script';
        if (pathname.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) return 'image';
        if (pathname.match(/\.(woff|woff2|ttf|otf|eot)$/)) return 'font';
        if (pathname.endsWith('.html') || pathname === '/' || !pathname.includes('.')) return 'document';

        return 'other';
    } catch {
        return 'other';
    }
}

// Generate output filename
function generateOutputFilename(url: string, profile: string, customOutput?: string): string {
    if (customOutput) return customOutput;

    const hostname = getHostname(url);
    const now = new Date();
    const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS
    return `results/results_${hostname}_${profile}_${date}_${time}.csv`;
}

// Ensure results directory exists
async function ensureResultsDirectory(): Promise<void> {
    if (!existsSync('results')) {
        await mkdir('results', { recursive: true });
        console.log('📁 Created results/ directory');
    }
}

// Collect performance metrics from browser
async function collectMetrics(page: any, url: string): Promise<Partial<PerformanceMetrics>> {
    // Get performance timing data
    const performanceData = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
            dnsLookupTime: navigation.domainLookupEnd - navigation.domainLookupStart,
            tcpConnectionTime: navigation.connectEnd - navigation.connectStart,
            tlsHandshakeTime: navigation.secureConnectionStart > 0
                ? navigation.connectEnd - navigation.secureConnectionStart
                : 0,
            ttfb: navigation.responseStart - navigation.requestStart,
            domContentLoadedTime: navigation.domContentLoadedEventEnd - navigation.fetchStart,
            fullPageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        };
    });

    // Get response from the main request
    const response = await page.goto(url, { waitUntil: 'load' });
    const headers = response.headers();

    return {
        timestamp: new Date().toISOString(),
        siteName: getHostname(url),
        httpStatus: response.status(),
        ...performanceData,
        cfCacheStatus: headers['cf-cache-status'] || 'N/A',
        cacheControl: headers['cache-control'] || 'N/A',
        age: headers['age'] || 'N/A',
        contentLength: headers['content-length'] || 'N/A',
    };
}

// Run a single performance test
async function runSingleTest(
    browser: any,
    url: string,
    profile: keyof typeof NETWORK_PROFILES,
    runNumber: number,
    fresh: boolean = false
): Promise<PerformanceMetrics[]> {
    const page = await browser.newPage();

    try {
        // Create CDP session for network operations
        const client = await page.target().createCDPSession();
        await client.send('Network.enable');

        // Clear cache and cookies for fresh visits
        if (fresh) {
            // Clear browser cache
            await client.send('Network.clearBrowserCache');

            // Clear cookies
            const cookies = await page.cookies();
            if (cookies.length > 0) {
                await page.deleteCookie(...cookies);
            }

            // Disable cache for this page
            await page.setCacheEnabled(false);
        }

        // Apply network throttling
        const networkProfile = NETWORK_PROFILES[profile];
        await client.send('Network.emulateNetworkConditions', {
            offline: false,
            latency: networkProfile.latency,
            downloadThroughput: networkProfile.downloadThroughput,
            uploadThroughput: networkProfile.uploadThroughput,
        });

        // Track all network requests
        const networkRequests = new Map();

        // Listen to network events
        client.on('Network.responseReceived', (params) => {
            const request = params.response;
            networkRequests.set(params.requestId, {
                url: request.url,
                status: request.status,
                headers: request.headers,
                mimeType: request.mimeType,
                timing: request.timing
            });
        });

        // Navigate and collect metrics
        const startTime = Date.now();
        const response = await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

        // Get performance timing data for the main page
        const performanceData = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            return {
                dnsLookupTime: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
                tcpConnectionTime: Math.round(navigation.connectEnd - navigation.connectStart),
                tlsHandshakeTime: navigation.secureConnectionStart > 0
                    ? Math.round(navigation.connectEnd - navigation.secureConnectionStart)
                    : 0,
                ttfb: Math.round(navigation.responseStart - navigation.requestStart),
                domContentLoadedTime: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
                fullPageLoadTime: Math.round(navigation.loadEventEnd - navigation.fetchStart),
            };
        });

        const allMetrics: PerformanceMetrics[] = [];
        const timestamp = new Date().toISOString();
        const siteName = getHostname(url);

        // Process all network requests
        for (const [requestId, request] of networkRequests) {
            const resourceType = getResourceType(request.url, request.mimeType);

            // Calculate timing metrics for this resource
            const timing = request.timing || {};
            const resourceMetrics: PerformanceMetrics = {
                timestamp,
                siteName,
                resourceUrl: request.url,
                resourceType,
                httpStatus: request.status,
                dnsLookupTime: timing.dnsEnd && timing.dnsStart ? Math.round(timing.dnsEnd - timing.dnsStart) : 0,
                tcpConnectionTime: timing.connectEnd && timing.connectStart ? Math.round(timing.connectEnd - timing.connectStart) : 0,
                tlsHandshakeTime: timing.sslEnd && timing.sslStart ? Math.round(timing.sslEnd - timing.sslStart) : 0,
                ttfb: timing.receiveHeadersEnd && timing.sendEnd ? Math.round(timing.receiveHeadersEnd - timing.sendEnd) : 0,
                domContentLoadedTime: performanceData.domContentLoadedTime,
                fullPageLoadTime: performanceData.fullPageLoadTime,
                cfCacheStatus: request.headers['cf-cache-status'] || 'N/A',
                xWorkerCache: request.headers['x-worker-cache'] || 'N/A',
                cacheControl: request.headers['cache-control'] || 'N/A',
                age: request.headers['age'] || 'N/A',
                contentLength: request.headers['content-length'] || 'N/A',
            };

            allMetrics.push(resourceMetrics);
        }

        // Print run summary
        const freshIndicator = fresh ? ' [FRESH]' : '';
        const totalResources = allMetrics.length;
        const staticResources = allMetrics.filter(m => m.resourceType !== 'document').length;
        console.log(
            `🏃 Run ${runNumber}${freshIndicator}: ${totalResources} resources (${staticResources} static) | ` +
            `Page Load ${performanceData.fullPageLoadTime}ms | ` +
            `Main TTFB ${performanceData.ttfb}ms`
        );

        return allMetrics;
    } finally {
        await page.close();
    }
}

// Calculate and display summary statistics
function displaySummary(results: PerformanceMetrics[]): void {
    if (results.length === 0) return;

    const totalResources = results.length;
    const resourceTypes = [...new Set(results.map(r => r.resourceType))];

    // Calculate averages for each resource type
    const avgTtfb = Math.round(results.reduce((sum, r) => sum + r.ttfb, 0) / results.length);
    const avgFullLoad = Math.round(results.reduce((sum, r) => sum + r.fullPageLoadTime, 0) / results.length);

    // Cache statistics
    const cfCacheHits = results.filter(r => r.cfCacheStatus === 'HIT').length;
    const workerCacheHits = results.filter(r => r.xWorkerCache === 'HIT').length;
    const cfCacheHitRate = Math.round((cfCacheHits / results.length) * 100);
    const workerCacheHitRate = Math.round((workerCacheHits / results.length) * 100);

    console.log('\n📊 Summary Statistics:');
    console.log(`   Total Resources: ${totalResources}`);
    console.log(`   Resource Types: ${resourceTypes.join(', ')}`);
    console.log(`   Average TTFB: ${avgTtfb}ms`);
    console.log(`   Average Full Load: ${avgFullLoad}ms`);
    console.log(`   CF Cache Hit Rate: ${cfCacheHitRate}% (${cfCacheHits}/${results.length})`);
    console.log(`   Worker Cache Hit Rate: ${workerCacheHitRate}% (${workerCacheHits}/${results.length})`);
    console.log(`   HTTP Status Codes: ${[...new Set(results.map(r => r.httpStatus))].join(', ')}`);

    // Resource type breakdown
    resourceTypes.forEach(type => {
        const typeResults = results.filter(r => r.resourceType === type);
        const typeAvgTtfb = Math.round(typeResults.reduce((sum, r) => sum + r.ttfb, 0) / typeResults.length);
        const typeCacheHits = typeResults.filter(r => r.cfCacheStatus === 'HIT').length;
        const typeCacheHitRate = Math.round((typeCacheHits / typeResults.length) * 100);
        console.log(`   ${type}: ${typeResults.length} resources, avg TTFB ${typeAvgTtfb}ms, cache hit ${typeCacheHitRate}%`);
    });
}

// Main execution function
async function main(): Promise<void> {
    const args = parseArguments();

    console.log('🚀 Starting Cloudflare Caching Performance Test');
    console.log(`   Target: ${args.url}`);
    console.log(`   Runs: ${args.runs}`);
    console.log(`   Network Profile: ${args.profile}`);
    console.log(`   Headless: ${!args.headful}`);
    console.log(`   Fresh visits: ${args.fresh}`);

    // Ensure results directory exists
    await ensureResultsDirectory();

    // Generate output filename
    const outputFile = generateOutputFilename(args.url, args.profile, args.output);
    console.log(`   Output: ${outputFile}\n`);

    // Launch browser
    const browser = await puppeteer.launch({
        headless: !args.headful,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const results: PerformanceMetrics[] = [];

    try {
        // Run tests
        for (let i = 1; i <= args.runs; i++) {
            try {
                const metricsArray = await runSingleTest(browser, args.url, args.profile, i, args.fresh);
                results.push(...metricsArray);
            } catch (error) {
                console.error(`❌ Run ${i} failed:`, error instanceof Error ? error.message : 'Unknown error');
            }
        }

        // Create CSV writer
        const csv = csvWriter.createObjectCsvWriter({
            path: outputFile,
            header: [
                { id: 'timestamp', title: 'Timestamp' },
                { id: 'siteName', title: 'Site Name' },
                { id: 'resourceUrl', title: 'Resource URL' },
                { id: 'resourceType', title: 'Resource Type' },
                { id: 'httpStatus', title: 'HTTP Status' },
                { id: 'dnsLookupTime', title: 'DNS Lookup (ms)' },
                { id: 'tcpConnectionTime', title: 'TCP Connection (ms)' },
                { id: 'tlsHandshakeTime', title: 'TLS Handshake (ms)' },
                { id: 'ttfb', title: 'TTFB (ms)' },
                { id: 'domContentLoadedTime', title: 'DOM Content Loaded (ms)' },
                { id: 'fullPageLoadTime', title: 'Full Page Load (ms)' },
                { id: 'cfCacheStatus', title: 'CF Cache Status' },
                { id: 'xWorkerCache', title: 'X-Worker-Cache' },
                { id: 'cacheControl', title: 'Cache Control' },
                { id: 'age', title: 'Age' },
                { id: 'contentLength', title: 'Content Length' },
            ],
        });

        // Write results to CSV
        if (results.length > 0) {
            await csv.writeRecords(results);
            console.log(`\n✅ Results saved to ${outputFile}`);
            displaySummary(results);
        } else {
            console.log('\n❌ No successful test runs to save');
        }

    } finally {
        await browser.close();
    }
}

// Handle errors and run main function
main().catch((error) => {
    console.error('❌ Application error:', error);
    process.exit(1);
});