#!/usr/bin/env tsx

import { createCanvas } from 'canvas';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { existsSync } from 'fs';
import minimist from 'minimist';
import * as path from 'path';

// CLI arguments interface
interface VisualizeArgs {
    input?: string;
    output?: string;
    type?: 'performance' | 'cache' | 'resources' | 'all';
    width?: number;
    height?: number;
    _: string[];
}

// Parse CSV data
function parseCSV(content: string): any[] {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
            const value = values[index];
            // Convert numeric fields
            if (['httpStatus', 'dnsLookupTime', 'tcpConnectionTime', 'tlsHandshakeTime',
                'ttfb', 'domContentLoadedTime', 'fullPageLoadTime'].includes(header)) {
                row[header] = parseInt(value) || 0;
            } else {
                row[header] = value;
            }
        });
        data.push(row);
    }
    return data;
}

// Generate performance comparison chart
function createPerformanceChart(data: any[], outputPath: string, width: number, height: number): void {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Group data by resource type
    const resourceTypes = [...new Set(data.map(d => d.resourceType))].filter(Boolean);
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#4BC0C0'
    ];

    const datasets = resourceTypes.map((type, index) => {
        const typeData = data.filter(d => d.resourceType === type);
        const avgTtfb = typeData.reduce((sum, d) => sum + d.ttfb, 0) / typeData.length;

        return {
            label: `${type} (${typeData.length} resources)`,
            data: [avgTtfb],
            backgroundColor: colors[index % colors.length],
            borderColor: colors[index % colors.length],
            borderWidth: 1
        };
    });

    new Chart(ctx as any, {
        type: 'bar',
        data: {
            labels: ['Average TTFB (ms)'],
            datasets: datasets
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Performance by Resource Type',
                    font: { size: 16 }
                },
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Time to First Byte (ms)'
                    }
                }
            }
        }
    });

    const buffer = canvas.toBuffer('image/png');
    writeFileSync(outputPath, buffer);
    console.log(`📊 Performance chart saved: ${outputPath}`);
}

// Generate cache hit rate chart
function createCacheChart(data: any[], outputPath: string, width: number, height: number): void {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Calculate cache hit rates by resource type
    const resourceTypes = [...new Set(data.map(d => d.resourceType))].filter(Boolean);

    const cfCacheData = resourceTypes.map(type => {
        const typeData = data.filter(d => d.resourceType === type);
        const hits = typeData.filter(d => d.cfCacheStatus === 'HIT').length;
        return Math.round((hits / typeData.length) * 100);
    });

    const workerCacheData = resourceTypes.map(type => {
        const typeData = data.filter(d => d.resourceType === type);
        const hits = typeData.filter(d => d.xWorkerCache === 'HIT').length;
        return Math.round((hits / typeData.length) * 100);
    });

    new Chart(ctx as any, {
        type: 'bar',
        data: {
            labels: resourceTypes,
            datasets: [
                {
                    label: 'Cloudflare Cache Hit Rate (%)',
                    data: cfCacheData,
                    backgroundColor: '#FF6384',
                    borderColor: '#FF6384',
                    borderWidth: 1
                },
                {
                    label: 'Worker Cache Hit Rate (%)',
                    data: workerCacheData,
                    backgroundColor: '#36A2EB',
                    borderColor: '#36A2EB',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Cache Hit Rates by Resource Type',
                    font: { size: 16 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Hit Rate (%)'
                    }
                }
            }
        }
    });

    const buffer = canvas.toBuffer('image/png');
    writeFileSync(outputPath, buffer);
    console.log(`📊 Cache chart saved: ${outputPath}`);
}

// Generate resource count pie chart
function createResourceChart(data: any[], outputPath: string, width: number, height: number): void {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Count resources by type
    const resourceCounts: { [key: string]: number } = {};
    data.forEach(d => {
        if (d.resourceType) {
            resourceCounts[d.resourceType] = (resourceCounts[d.resourceType] || 0) + 1;
        }
    });

    const labels = Object.keys(resourceCounts);
    const counts = Object.values(resourceCounts);
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
        '#9966FF', '#FF9F40', '#FF6384', '#4BC0C0'
    ];

    new Chart(ctx as any, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: counts,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Resource Distribution',
                    font: { size: 16 }
                },
                legend: {
                    position: 'right'
                }
            }
        }
    });

    const buffer = canvas.toBuffer('image/png');
    writeFileSync(outputPath, buffer);
    console.log(`📊 Resource distribution chart saved: ${outputPath}`);
}

// Generate performance timeline chart
function createTimelineChart(data: any[], outputPath: string, width: number, height: number): void {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Group data by timestamp and calculate averages
    const timeGroups: { [key: string]: any[] } = {};
    data.forEach(d => {
        // Handle both 'timestamp' and 'Timestamp' field names
        const timestamp = d.timestamp || d.Timestamp || d['Timestamp'];
        if (!timestamp) return;

        // Parse ISO timestamp: "2025-07-16T07:45:12.283Z" -> "07:45"
        try {
            const date = new Date(timestamp);
            const timeKey = date.toISOString().substring(11, 16); // Extract HH:MM
            if (!timeGroups[timeKey]) timeGroups[timeKey] = [];
            timeGroups[timeKey].push(d);
        } catch (error) {
            console.warn('Failed to parse timestamp:', timestamp);
        }
    });

    const timeLabels = Object.keys(timeGroups).sort();
    const avgTtfbData = timeLabels.map(time => {
        const group = timeGroups[time];
        return Math.round(group.reduce((sum, d) => sum + d.ttfb, 0) / group.length);
    });

    const avgLoadData = timeLabels.map(time => {
        const group = timeGroups[time];
        return Math.round(group.reduce((sum, d) => sum + d.fullPageLoadTime, 0) / group.length);
    });

    new Chart(ctx as any, {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                {
                    label: 'Average TTFB (ms)',
                    data: avgTtfbData,
                    borderColor: '#FF6384',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.4
                },
                {
                    label: 'Average Page Load (ms)',
                    data: avgLoadData,
                    borderColor: '#36A2EB',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Performance Over Time',
                    font: { size: 16 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Time (ms)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                }
            }
        }
    });

    const buffer = canvas.toBuffer('image/png');
    writeFileSync(outputPath, buffer);
    console.log(`📊 Timeline chart saved: ${outputPath}`);
}

// Parse CLI arguments
function parseArguments(): VisualizeArgs {
    const args = minimist(process.argv.slice(2), {
        string: ['input', 'output', 'type', 'width', 'height'],
        default: {
            type: 'all',
            width: 1200,
            height: 800,
        },
    });

    // Convert width and height to numbers
    if (args.width) args.width = parseInt(args.width as string);
    if (args.height) args.height = parseInt(args.height as string);

    return args as VisualizeArgs;
}

// Find latest CSV file if no input specified
function findLatestCSV(): string | undefined {
    if (!existsSync('results')) return undefined;

    const csvFiles = readdirSync('results')
        .filter(f => f.endsWith('.csv'))
        .map(f => ({
            name: f,
            path: path.join('results', f),
            stat: require('fs').statSync(path.join('results', f))
        }))
        .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

    return csvFiles.length > 0 ? csvFiles[0].path : undefined;
}

// Main function
async function main(): Promise<void> {
    const args = parseArguments();

    console.log('📊 Starting Performance Data Visualization');

    // Determine input file
    let inputFile = args.input;
    if (!inputFile) {
        inputFile = findLatestCSV();
        if (!inputFile) {
            console.error('❌ No CSV files found in results/ directory');
            console.log('Usage: {npm|pnpm|bun} run visualize [--input=file.csv] [--output=charts] [--type=all|performance|cache|resources] [--width=1200] [--height=800]');
            process.exit(1);
        }
        console.log(`📁 Using latest CSV: ${inputFile}`);
    }

    if (!existsSync(inputFile)) {
        console.error(`❌ Input file not found: ${inputFile}`);
        process.exit(1);
    }

    // Parse CSV data
    const csvContent = readFileSync(inputFile, 'utf-8');
    const data = parseCSV(csvContent);
    console.log(`📈 Loaded ${data.length} data points`);

    // Determine output directory
    const outputDir = args.output || 'charts';
    if (!existsSync(outputDir)) {
        require('fs').mkdirSync(outputDir, { recursive: true });
        console.log(`📁 Created output directory: ${outputDir}`);
    }

    // Generate charts based on type
    const { width, height } = args;
    const baseFilename = path.basename(inputFile, '.csv');

    if (args.type === 'all' || args.type === 'performance') {
        createPerformanceChart(data, path.join(outputDir, `${baseFilename}_performance.png`), width!, height!);
    }

    if (args.type === 'all' || args.type === 'cache') {
        createCacheChart(data, path.join(outputDir, `${baseFilename}_cache.png`), width!, height!);
    }

    if (args.type === 'all' || args.type === 'resources') {
        createResourceChart(data, path.join(outputDir, `${baseFilename}_resources.png`), width!, height!);
    }

    if (args.type === 'all') {
        createTimelineChart(data, path.join(outputDir, `${baseFilename}_timeline.png`), width!, height!);
    }

    console.log(`\n✅ Visualization complete! Charts saved in ${outputDir}/`);
}

// Run the script
main().catch((error) => {
    console.error('❌ Visualization error:', error);
    process.exit(1);
});