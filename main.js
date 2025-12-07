
/* 
    datta Ai - Generic Data Visualizer
    Production Version
*/

// --- Utility Functions ---

function getContrastRatio(foreground, background) {
    const lum1 = chroma(foreground).luminance();
    const lum2 = chroma(background).luminance();
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
}

// --- Engines & Managers ---

class ViewManager {
    constructor(uiManager) {
        this.um = uiManager;
        this.dashboardView = document.getElementById('dashboard-view');
        this.inspectorView = document.getElementById('inspector-view');
        this.inspectorSidebar = document.getElementById('inspector-sidebar');
        this.vizContainer = document.getElementById('viz-container');
        this.dataContainer = document.getElementById('data-table-container');
        this.isDashboard = true;
        
        document.getElementById('btn-back-dashboard').addEventListener('click', () => this.showDashboard());
        document.getElementById('btn-print-report').addEventListener('click', () => window.print());
        
        // Data View Toggle
        document.getElementById('view-mode-viz').addEventListener('click', () => this.switchMode('viz'));
        document.getElementById('view-mode-data').addEventListener('click', () => this.switchMode('data'));
        
        // Help Modal
        document.getElementById('btn-how-to-use').addEventListener('click', () => {
             document.getElementById('help-modal-overlay').classList.remove('hidden');
        });
        document.getElementById('close-help-modal').addEventListener('click', () => {
             document.getElementById('help-modal-overlay').classList.add('hidden');
        });
    }
    
    showDashboard() {
        this.isDashboard = true;
        this.toggleView(this.dashboardView, this.inspectorView);
        this.inspectorSidebar.classList.add('hidden', '-translate-x-full');
        document.getElementById('btn-print-report').classList.remove('hidden');
    }
    
    showInspector(config) {
        this.isDashboard = false;
        this.toggleView(this.inspectorView, this.dashboardView);
        this.inspectorSidebar.classList.remove('hidden');
        document.getElementById('btn-print-report').classList.add('hidden');
        
        requestAnimationFrame(() => {
            this.inspectorSidebar.classList.remove('-translate-x-full');
        });
        
        this.um.setInspectorConfig(config);
    }
    
    toggleView(show, hide) {
        hide.classList.remove('view-visible');
        hide.classList.add('view-hidden');
        
        setTimeout(() => {
            hide.classList.add('hidden'); // Wait for transition
            show.classList.remove('hidden');
            // Force reflow
            void show.offsetWidth;
            show.classList.remove('view-hidden');
            show.classList.add('view-visible');
        }, 50); // Small delay to allow CSS transition start
    }
    
    switchMode(mode) {
        const btnViz = document.getElementById('view-mode-viz');
        const btnData = document.getElementById('view-mode-data');
        
        if (mode === 'viz') {
            this.vizContainer.classList.remove('hidden');
            this.dataContainer.classList.add('hidden');
            btnViz.classList.add('bg-white', 'dark:bg-gray-600', 'shadow-sm');
            btnViz.classList.remove('text-gray-500', 'dark:text-gray-300');
            btnData.classList.remove('bg-white', 'dark:bg-gray-600', 'shadow-sm');
            btnData.classList.add('text-gray-500', 'dark:text-gray-300');
        } else {
            this.vizContainer.classList.add('hidden');
            this.dataContainer.classList.remove('hidden');
            btnData.classList.add('bg-white', 'dark:bg-gray-600', 'shadow-sm');
            btnData.classList.remove('text-gray-500', 'dark:text-gray-300');
            btnViz.classList.remove('bg-white', 'dark:bg-gray-600', 'shadow-sm');
            btnViz.classList.add('text-gray-500', 'dark:text-gray-300');
            
            // Render table if not done
            this.um.renderDataTable();
        }
    }
}

class StatisticsEngine {
    calculateChiSquare(data, rowCol, colCol) {
        const rowKeys = new Set();
        const colKeys = new Set();
        const observed = {};
        
        data.forEach(row => {
            const rVal = row[rowCol];
            const cVal = row[colCol];
            rowKeys.add(rVal);
            colKeys.add(cVal);
            
            if (!observed[rVal]) observed[rVal] = {};
            if (!observed[rVal][cVal]) observed[rVal][cVal] = 0;
            observed[rVal][cVal]++;
        });
        
        const rows = Array.from(rowKeys);
        const cols = Array.from(colKeys);
        const rowTotals = {};
        const colTotals = {};
        let total = 0;
        
        rows.forEach(r => {
            rowTotals[r] = 0;
            cols.forEach(c => {
                const val = observed[r][c] || 0;
                rowTotals[r] += val;
                if (!colTotals[c]) colTotals[c] = 0;
                colTotals[c] += val;
                total += val;
            });
        });
        
        let chiSquare = 0;
        rows.forEach(r => {
            cols.forEach(c => {
                const obs = observed[r][c] || 0;
                const exp = (rowTotals[r] * colTotals[c]) / total;
                if (exp > 0) {
                    chiSquare += Math.pow(obs - exp, 2) / exp;
                }
            });
        });
        
        const df = (rows.length - 1) * (cols.length - 1);
        const pValue = 1 - jStat.chisquare.cdf(chiSquare, df);
        
        return { chiSquare, df, pValue, significant: pValue < 0.05 };
    }
    
    calculateCI(count, total, confidenceLevel = 0.95) {
        if (total === 0) return { lower: 0, upper: 0, error: 0, proportion: 0 };
        const p = count / total;
        const z = jStat.normal.inv(1 - (1 - confidenceLevel) / 2, 0, 1);
        const error = z * Math.sqrt((p * (1 - p)) / total);
        return {
            proportion: p,
            lower: Math.max(0, p - error),
            upper: Math.min(1, p + error),
            error
        };
    }
}

class ColorManager {
    constructor() {
        this.systemDefaults = ['#005960', '#CC5500', '#AA2E25', '#DDAA33', '#43B3AE', '#3A577A', '#7FC8B8'];
        this.customColors = [];
        this.init();
    }
    
    init() {
        // Load custom colors from storage
        const storedColors = localStorage.getItem('customColors');
        if (storedColors) {
            this.customColors = JSON.parse(storedColors);
            const inputs = document.querySelectorAll('.color-input');
            this.customColors.forEach((c, i) => {
                if (inputs[i]) inputs[i].value = c;
            });
        }
        
        const inputs = document.querySelectorAll('.color-input');
        inputs.forEach((input, idx) => {
            input.addEventListener('change', () => this.updateCustomColors());
        });
        
        document.getElementById('btn-shuffle-colors').addEventListener('click', () => this.shuffleColors());
        
        // Dark Mode Toggle
        document.getElementById('dark-mode-toggle').addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            const isDark = document.documentElement.classList.contains('dark');
            localStorage.setItem('themeMode', isDark ? 'dark' : 'light');
            if (um) um.updateVisualization();
        });
        
        // Load theme mode
        const storedTheme = localStorage.getItem('themeMode');
        if (storedTheme === 'dark') {
            document.documentElement.classList.add('dark');
        }
    }
    
    updateCustomColors() {
        this.customColors = [];
        document.querySelectorAll('.color-input').forEach(input => {
            if (input.value && /^#[0-9A-F]{6}$/i.test(input.value)) {
                this.customColors.push(input.value);
            }
        });
        localStorage.setItem('customColors', JSON.stringify(this.customColors));
        if (um) um.updateVisualization();
    }

    shuffleColors() {
        const palette = [...this.customColors];
        if (palette.length === 0) {
            // If no custom colors, start with defaults or random
            for(let i=0; i<10; i++) palette.push(chroma.random().hex());
        } else {
             // Fisher-Yates shuffle
            for (let i = palette.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [palette[i], palette[j]] = [palette[j], palette[i]];
            }
        }
        this.customColors = palette;
        // Update Inputs
        const inputs = document.querySelectorAll('.color-input');
        inputs.forEach((input, i) => {
            if (palette[i]) input.value = palette[i];
            else input.value = '';
        });
        this.updateCustomColors();
    }
    
    getPalette(count) {
        let palette = [];
        if (this.customColors.length === 0) {
            palette = this.systemDefaults;
        } else if (this.customColors.length >= count) {
            palette = this.customColors.slice(0, count);
        } else {
            // Interpolate if we need more colors than custom defined, OR if we have few custom colors defined but need more.
            // If user defined 10 colors, use them.
            // If user defined 2 colors but we need 5, interpolate.
            if (this.customColors.length > 1) {
                palette = chroma.scale(this.customColors).mode('lch').colors(count);
            } else {
                palette = chroma.scale([this.customColors[0], '#cccccc']).mode('lch').colors(count);
            }
        }
        return palette;
    }
    
    getTextColor() {
        return document.documentElement.classList.contains('dark') ? '#F4F3EE' : '#2C2C2C'; // High contrast
    }
    
    getGridColor() {
        return document.documentElement.classList.contains('dark') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    }
}

class DataManager {
    constructor() {
        this.rawData = []; 
        this.processedData = []; 
        this.filteredData = [];
        this.headers = [];
        this.codebook = { mapping: {}, questions: {} }; // { mapping: {col: {val: label}}, questions: {col: "Text"} }
        this.listeners = [];
        this.loadPersistedCodebook();
    }
    subscribe(callback) { this.listeners.push(callback); }
    notify() { this.listeners.forEach(cb => cb(this)); }
    
    loadPersistedCodebook() {
        const stored = localStorage.getItem('codebook');
        if (stored) {
            try {
                this.codebook = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to load codebook", e);
            }
        }
    }
    
    persistCodebook() {
        localStorage.setItem('codebook', JSON.stringify(this.codebook));
    }
    
    async loadFile(file) {
        return new Promise((resolve, reject) => {
            if (file.name.endsWith('.csv')) {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        this.rawData = results.data;
                        this.headers = results.meta.fields;
                        this.processData();
                        resolve();
                    },
                    error: (err) => reject(err)
                });
            } else if (file.name.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const json = JSON.parse(e.target.result);
                        if (json.raw_data && Array.isArray(json.raw_data)) {
                            this.rawData = json.raw_data;
                        } else if (Array.isArray(json)) {
                            this.rawData = json;
                        } else {
                            throw new Error('Invalid JSON format');
                        }
                        if (this.rawData.length > 0) this.headers = Object.keys(this.rawData[0]);
                        this.processData();
                        resolve();
                    } catch (err) { reject(err); }
                };
                reader.readAsText(file);
            } else { reject(new Error('Unsupported file format')); }
        });
    }
    
    processData() {
        // We do NOT map values here anymore to preserve raw data for correct multi-select splitting.
        // Mapping happens at visualization time.
        this.processedData = this.rawData.map(row => {
            const newRow = { ...row };
            if (!newRow._id) newRow._id = this.rawData.indexOf(row);
            return newRow;
        });
        this.filteredData = [...this.processedData];
        this.notify();
    }
    
    setCodebook(column, mapping) {
        if (!this.codebook.mapping[column]) this.codebook.mapping[column] = {};
        this.codebook.mapping[column] = mapping;
        this.persistCodebook();
        this.processData();
    }
    
    setQuestion(column, text) {
        this.codebook.questions[column] = text;
        this.persistCodebook();
    }
    
    applyFilters(activeFilters) {
        this.filteredData = this.processedData.filter(row => {
            return Object.entries(activeFilters).every(([col, selectedValues]) => {
                if (!selectedValues || selectedValues.length === 0) return true;
                let cellValue = row[col];
                if (typeof cellValue === 'string' && cellValue.includes(',')) {
                    const values = cellValue.split(',').map(v => v.trim());
                    return selectedValues.some(sv => values.includes(sv));
                }
                return selectedValues.includes(String(cellValue));
            });
        });
        this.notify();
    }
}

class Visualizer {
    constructor(colorManager, statsEngine, dataManager) {
        this.colorManager = colorManager;
        this.statsEngine = statsEngine;
        this.dm = dataManager; // Access to codebook questions
        this.chartInstance = null;
    }

    // --- Dashboard Mini Cards ---
    renderDashboard(data, headers, containerId, clickHandler) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        headers.forEach(header => {
            if (header === '_id') return;
            
            const card = document.createElement('div');
            card.className = 'mini-card glass-panel rounded-xl p-4 flex flex-col relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 group';
            // Click whole card defaults to inspector
            // card.onclick = () => clickHandler(header); 
            
            const headerDiv = document.createElement('div');
            headerDiv.className = 'flex justify-between items-start mb-2';
            
            const title = document.createElement('h3');
            title.className = 'text-xs font-bold uppercase text-gray-500 truncate flex-1';
            title.textContent = header;
            headerDiv.appendChild(title);

            // Focus View Button (Visible on Hover)
            const focusBtn = document.createElement('button');
            focusBtn.className = 'opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-blue-100 text-blue-600 rounded hover:bg-blue-200';
            focusBtn.innerHTML = '<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>';
            focusBtn.title = "Focus View";
            focusBtn.onclick = (e) => {
                e.stopPropagation();
                clickHandler(header);
            };
            headerDiv.appendChild(focusBtn);

            card.appendChild(headerDiv);
            
            const chartDiv = document.createElement('div');
            chartDiv.className = 'flex-1 w-full h-full';
            card.onclick = () => clickHandler(header); // Make chart clickable too
            card.appendChild(chartDiv);
            
            container.appendChild(card);
            
            // Render with automatic split detection for Dashboard
            // For dashboard, we guess if it needs splitting if comma is present and avg length is high? 
            // Or just check if any value has comma. 
            // For simplicity in Phase 1, we check if commas exist in the first 10 non-empty values.
            let hasComma = false;
            let count = 0;
            for(let row of data) {
                if(row[header] && typeof row[header] === 'string' && row[header].includes(',')) {
                    hasComma = true;
                    break;
                }
                count++;
                if(count > 20) break;
            }

            this.renderMiniChart(chartDiv, data, header, hasComma);
        });
    }
    
    renderMiniChart(dom, data, column, splitValues = false) {
        const instance = echarts.init(dom);
        
        // Use aggregateData logic but simplified for mini chart
        // We simulate a config object
        const config = {
            xAxis: column,
            yAxis: null,
            groupBy: null,
            splitValues: splitValues
        };

        const processed = this.aggregateData(data, config);
        const { agg, xValues } = processed;
        
        const counts = {};
        xValues.forEach(x => {
            counts[x] = agg[x]['All'].count;
        });

        const keys = Object.keys(counts);
        const values = Object.values(counts);
        const uniqueCount = keys.length;
        
        let option = {};
        const palette = this.colorManager.getPalette(uniqueCount);
        
        const animation = {
             universalTransition: true,
             animationDuration: 500
        };

        if (uniqueCount <= 6) {
            option = {
                color: palette,
                ...animation,
                series: [{
                    type: 'pie',
                    radius: ['40%', '70%'],
                    data: keys.map((k, i) => ({ name: k, value: values[i] })),
                    label: { show: false },
                    emphasis: { scale: false }
                }]
            };
        } else {
            option = {
                color: palette,
                ...animation,
                grid: { top: 5, bottom: 5, left: 5, right: 5 },
                xAxis: { show: false, data: keys },
                yAxis: { show: false },
                series: [{
                    type: 'bar',
                    data: values,
                    itemStyle: { borderRadius: 2 }
                }]
            };
        }
        instance.setOption(option);
    }

    // --- Inspector Main Chart ---
    render(data, config) {
        const chartDom = document.getElementById('main-chart');
        const titleEl = document.getElementById('chart-title');
        
        // Hide Self-Comparison Logic
        if (document.getElementById('hide-self-comparison').checked && config.xAxis && config.xAxis === config.groupBy) {
            if (this.chartInstance) this.chartInstance.dispose();
            chartDom.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500 italic">Self-comparison hidden. Select a different Group By variable.</div>';
            titleEl.textContent = config.xAxis;
            document.getElementById('stats-container').innerHTML = '';
            return;
        }

        // Set Title (Priority: Custom > Codebook Question > Variable Name)
        const question = this.dm.codebook.questions[config.xAxis];
        let displayTitle = config.customTitle || question || config.xAxis;
        
        titleEl.textContent = displayTitle;

        if (this.chartInstance) this.chartInstance.dispose();

        if (config.chartType === 'crosstab') {
            this.renderCrosstab(chartDom, data, config);
            this.updateStats(data, config);
            return;
        }

        this.chartInstance = echarts.init(chartDom);
        window.addEventListener('resize', () => this.chartInstance.resize());

        // Prepare Data based on chart type requirements
        let processedData;
        if (config.chartType === 'scatter' || config.chartType === 'heatmap' || config.chartType === 'boxplot' || config.chartType === 'sankey') {
             // These types might need raw-ish data or special processing
             processedData = this.prepareSpecialData(data, config);
        } else if (config.chartType === 'histogram') {
             processedData = this.prepareHistogram(data, config);
        } else {
             processedData = this.aggregateData(data, config);
        }

        const option = this.generateOption(processedData, config);
        
        // Inject Custom Titles if they exist in UI but not fully in option yet (though generateOption should handle it)
        if(config.customTitle || config.customSubtitle) {
             option.title = {
                 text: config.customTitle || displayTitle,
                 subtext: config.customSubtitle || '',
                 left: 'center',
                 textStyle: { color: this.colorManager.getTextColor() },
                 subtextStyle: { color: chroma(this.colorManager.getTextColor()).alpha(0.7).css() }
             };
        }

        this.chartInstance.setOption(option);
        
        // Only attach click handler if it's a standard aggregated chart where findIdsForPoint works well
        if (!['scatter', 'boxplot', 'sankey', 'histogram', 'heatmap'].includes(config.chartType)) {
            this.chartInstance.on('click', (params) => {
                if (window.handleChartClick) {
                    const ids = this.findIdsForPoint(data, config, params);
                    window.handleChartClick(ids, params.name, params.seriesName);
                }
            });
        }
        
        this.updateStats(data, config, processedData);
    }
    
    downloadChart() {
        if (this.chartInstance) {
            const url = this.chartInstance.getDataURL({
                type: 'png',
                backgroundColor: document.documentElement.classList.contains('dark') ? '#1a202c' : '#ffffff'
            });
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chart.png';
            a.click();
        }
    }
    
    renderCrosstab(dom, data, config) {
        const rowCol = config.xAxis;
        const colCol = config.groupBy; 
        
        if (!rowCol || !colCol) {
            dom.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Select X-Axis and Group By column for Crosstab</div>';
            return;
        }
        
        const counts = {};
        const rowKeys = new Set();
        const colKeys = new Set();
        
        data.forEach(row => {
            const rVal = String(row[rowCol] || 'N/A');
            const cVal = String(row[colCol] || 'N/A');
            rowKeys.add(rVal);
            colKeys.add(cVal);
            
            if (!counts[rVal]) counts[rVal] = {};
            if (!counts[rVal][cVal]) counts[rVal][cVal] = 0;
            counts[rVal][cVal]++;
        });
        
        const sortedRows = Array.from(rowKeys).sort();
        const sortedCols = Array.from(colKeys).sort();
        
        let maxVal = 0;
        sortedRows.forEach(r => sortedCols.forEach(c => {
            if ((counts[r][c] || 0) > maxVal) maxVal = counts[r][c] || 0;
        }));
        
        let html = `<div class="w-full h-full overflow-auto"><table class="crosstab-table"><thead><tr><th>${rowCol} \\ ${colCol}</th>`;
        sortedCols.forEach(c => html += `<th>${c}</th>`);
        html += '</tr></thead><tbody>';
        
        sortedRows.forEach(r => {
            html += `<tr><td class="font-bold">${r}</td>`;
            sortedCols.forEach(c => {
                const val = counts[r][c] || 0;
                const opacity = maxVal > 0 ? (val / maxVal) : 0;
                const bg = chroma(this.colorManager.systemDefaults[0]).alpha(opacity * 0.5).css(); 
                html += `<td style="background: ${bg}">${val}</td>`;
            });
            html += '</tr>';
        });
        html += '</tbody></table></div>';
        
        dom.innerHTML = html;
    }

    updateStats(data, config, processed) {
        const statsContainer = document.getElementById('stats-container');
        statsContainer.innerHTML = '';
        
        if (config.chartType === 'crosstab') {
            const res = this.statsEngine.calculateChiSquare(data, config.xAxis, config.groupBy);
            statsContainer.innerHTML = `
                <div class="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <p class="font-bold">Chi-Squared Test</p>
                    <p>Stat: ${res.chiSquare.toFixed(2)}</p>
                    <p>p-value: ${res.pValue.toFixed(4)}</p>
                    <span class="inline-block mt-1 px-2 py-0.5 text-xs rounded text-white ${res.significant ? 'bg-green-500' : 'bg-gray-400'}">
                        ${res.significant ? 'Significant' : 'Not Significant'}
                    </span>
                </div>
            `;
        } else if (['bar', 'donut', 'pie', 'bar-horizontal'].includes(config.chartType) && processed) {
            let html = '<div class="space-y-1">';
            const total = processed.totalCount;
            // Handle if xValues not present (e.g. histogram)
            if (processed.xValues) {
                processed.xValues.slice(0, 5).forEach(x => {
                    let count = 0;
                    if (processed.isGrouped) {
                        Object.values(processed.agg[x]).forEach(g => count += g.count);
                    } else {
                        count = processed.agg[x]['All'].count;
                    }
                    const ci = this.statsEngine.calculateCI(count, total);
                    html += `
                        <div class="flex justify-between text-xs border-b dark:border-gray-700 pb-1">
                            <span class="truncate w-20">${x}</span>
                            <span>${(ci.proportion * 100).toFixed(1)}%</span>
                            <span class="text-gray-500">±${(ci.error * 100).toFixed(1)}%</span>
                        </div>
                    `;
                });
                html += '</div><p class="text-[10px] text-gray-400 mt-1">95% Confidence Intervals</p>';
                statsContainer.innerHTML = html;
            }
        }
    }

    aggregateData(data, config) {
        const { xAxis, yAxis, groupBy, splitValues, strictMode } = config;
        const agg = {};
        const groups = new Set();
        const xValues = new Set();
        let totalCount = 0;

        data.forEach(row => {
            let xVal = row[xAxis];
            if (xVal === undefined || xVal === null) xVal = "N/A";
            
            let xVals = [xVal];
            
            // Split Logic (Step 1)
            if (splitValues) {
                if (typeof xVal === 'string') {
                    if (strictMode) {
                        // Strict mode: Only split if delimiter is present and follows rules (simple comma for now)
                        xVals = xVal.split(',').map(s => s.trim());
                    } else {
                        // Relaxed mode: detect ; or ,
                        if (xVal.includes(';')) xVals = xVal.split(';').map(s => s.trim());
                        else if (xVal.includes(',')) xVals = xVal.split(',').map(s => s.trim());
                        else xVals = [xVal.trim()];
                    }
                }
            } else {
                xVals = [String(xVal).trim()];
            }

            xVals.forEach(xv => {
                // Map Logic (Step 2)
                let mappedX = xv;
                if (this.dm.codebook.mapping[xAxis] && this.dm.codebook.mapping[xAxis][xv]) {
                    mappedX = this.dm.codebook.mapping[xAxis][xv];
                }
                
                xValues.add(mappedX);
                
                let groupVal = "All";
                if (groupBy) {
                    let rawGroup = row[groupBy];
                    if (rawGroup === undefined || rawGroup === null) rawGroup = "N/A";
                    // Map Group Value 
                    groupVal = String(rawGroup);
                    if (this.dm.codebook.mapping[groupBy] && this.dm.codebook.mapping[groupBy][groupVal]) {
                        groupVal = this.dm.codebook.mapping[groupBy][groupVal];
                    }
                    groups.add(groupVal);
                }
                
                // Aggregate (Step 3)
                if (!agg[mappedX]) agg[mappedX] = {};
                if (!agg[mappedX][groupVal]) agg[mappedX][groupVal] = { count: 0, sumY: 0, ids: [] };

                agg[mappedX][groupVal].count++;
                agg[mappedX][groupVal].ids.push(row._id);
                
                if (yAxis) {
                    const yVal = parseFloat(row[yAxis]);
                    if (!isNaN(yVal)) {
                        agg[mappedX][groupVal].sumY += yVal;
                    }
                }
                totalCount++;
            });
        });

        return {
            agg,
            xValues: Array.from(xValues).sort(),
            groups: Array.from(groups).sort(),
            isGrouped: !!groupBy,
            isYAxis: !!yAxis,
            totalCount
        };
    }
    
    // Preparation methods for new chart types
    prepareSpecialData(data, config) {
        const { xAxis, yAxis, groupBy } = config;
        
        if (config.chartType === 'scatter') {
             // Need numeric X and Y.
             // Grouping
             const groups = {};
             
             data.forEach(row => {
                 const x = parseFloat(row[xAxis]);
                 const y = parseFloat(row[yAxis]);
                 if (!isNaN(x) && !isNaN(y)) {
                     const gVal = groupBy ? (row[groupBy] || 'All') : 'All';
                     if (!groups[gVal]) groups[gVal] = [];
                     groups[gVal].push([x, y]);
                 }
             });
             return { groups };
        }
        
        if (config.chartType === 'boxplot') {
             // X Axis = Category (or All), Y Axis = Numeric Value to distribute
             // Use jStat for quartiles
             const groups = {};
             data.forEach(row => {
                 let cat = 'All';
                 let val = null;
                 
                 // If Y-Axis is present, X is category, Y is value.
                 if (yAxis) {
                     cat = row[xAxis] || 'N/A';
                     val = parseFloat(row[yAxis]);
                 } else {
                     // Histogram-like boxplot? 
                     // Let's assume if no Y, X is the value. GroupBy splits it.
                     val = parseFloat(row[xAxis]);
                     if (groupBy) cat = row[groupBy] || 'N/A';
                 }
                 
                 if (!isNaN(val)) {
                    if (!groups[cat]) groups[cat] = [];
                    groups[cat].push(val);
                 }
             });
             
             // Calculate stats
             const boxData = [];
             const axisData = [];
             const outliers = [];
             
             Object.keys(groups).sort().forEach((cat, idx) => {
                 axisData.push(cat);
                 const vals = groups[cat].sort((a,b)=>a-b);
                 if (vals.length === 0) return;
                 
                 const q1 = jStat.percentile(vals, 0.25);
                 const median = jStat.percentile(vals, 0.5);
                 const q3 = jStat.percentile(vals, 0.75);
                 const iqr = q3 - q1;
                 // whiskers 1.5IQR
                 let lower = q1 - 1.5 * iqr;
                 let upper = q3 + 1.5 * iqr;
                 
                 // Constrain to actual data
                 const validVals = vals.filter(v => v >= lower && v <= upper);
                 const realMin = validVals.length ? validVals[0] : q1;
                 const realMax = validVals.length ? validVals[validVals.length-1] : q3;
                 
                 boxData.push([realMin, q1, median, q3, realMax]);
                 
                 // Outliers
                 vals.forEach(v => {
                     if (v < lower || v > upper) {
                         outliers.push([idx, v]);
                     }
                 });
             });
             
             return { boxData, axisData, outliers };
        }
        
        if (config.chartType === 'heatmap') {
             // 2D Density (Numeric X, Numeric Y) OR Crosstab Heatmap (Cat X, Cat Y)
             // Let's implement Cat X Cat Heatmap for now as it maps to Crosstab logic but visually.
             const xCol = xAxis;
             const yCol = yAxis || groupBy;
             
             if (!yCol) return { error: "Heatmap requires Y-Axis or Group By variable." };
             
             const counts = {};
             const xKeys = new Set();
             const yKeys = new Set();
             let maxVal = 0;
             
             data.forEach(row => {
                 const x = row[xCol] || 'N/A';
                 const y = row[yCol] || 'N/A';
                 xKeys.add(x);
                 yKeys.add(y);
                 const k = `${x}|||${y}`;
                 counts[k] = (counts[k] || 0) + 1;
                 if (counts[k] > maxVal) maxVal = counts[k];
             });
             
             const xArr = Array.from(xKeys).sort();
             const yArr = Array.from(yKeys).sort();
             
             const seriesData = [];
             xArr.forEach((x, i) => {
                 yArr.forEach((y, j) => {
                     const val = counts[`${x}|||${y}`] || 0;
                     seriesData.push([i, j, val]);
                 });
             });
             
             return { xArr, yArr, seriesData, maxVal };
        }

        if (config.chartType === 'sankey') {
             // Flow from X (Source) -> GroupBy (Target)
             const sourceCol = xAxis;
             const targetCol = groupBy;
             
             if (!targetCol) return { error: "Sankey requires a Group By variable as target." };
             
             const linksObj = {};
             const nodesSet = new Set();
             
             data.forEach(row => {
                 const s = String(row[sourceCol] || 'N/A');
                 const t = String(row[targetCol] || 'N/A');
                 
                 const sNode = `${s} (Source)`;
                 const tNode = `${t} (Target)`;
                 
                 nodesSet.add(sNode);
                 nodesSet.add(tNode);
                 
                 const k = `${sNode}->${tNode}`;
                 linksObj[k] = (linksObj[k] || 0) + 1;
             });
             
             const nodes = Array.from(nodesSet).map(n => ({ name: n }));
             const links = Object.entries(linksObj).map(([k, v]) => {
                 const [s, t] = k.split('->');
                 return { source: s, target: t, value: v };
             });
             
             return { nodes, links };
        }
        
        return {};
    }

    prepareHistogram(data, config) {
         const { xAxis, groupBy } = config;
         // Extract numeric values
         let values = [];
         data.forEach(row => {
             const v = parseFloat(row[xAxis]);
             if (!isNaN(v)) values.push(v);
         });
         
         if (values.length === 0) return { error: "No numeric data for histogram" };
         
         // Simple Binning (Sturges' formula)
         const binCount = Math.ceil(Math.log2(values.length) + 1);
         const min = Math.min(...values);
         const max = Math.max(...values);
         const range = max - min;
         const width = range / binCount;
         
         const bins = new Array(binCount).fill(0);
         const binEdges = [];
         for(let i=0; i<=binCount; i++) binEdges.push(min + i*width);
         
         values.forEach(v => {
             let idx = Math.floor((v - min) / width);
             if (idx >= binCount) idx = binCount - 1; 
             bins[idx]++;
         });
         
         // Format X Axis labels as ranges
         const xLabels = [];
         for(let i=0; i<binCount; i++) {
             xLabels.push(`${binEdges[i].toFixed(1)} - ${binEdges[i+1].toFixed(1)}`);
         }
         
         return { xLabels, counts: bins };
    }

    generateOption(processed, config) {
        const { chartType } = config;
        
        // Handle new types
        const textColor = this.colorManager.getTextColor();
        const gridColor = this.colorManager.getGridColor();
        const animation = { universalTransition: true, animationDuration: 500 };
        const palette = this.colorManager.getPalette(10); // Default palette size

        // --- SCATTER ---
        if (chartType === 'scatter') {
             const { groups } = processed;
             const series = Object.keys(groups || {}).map(g => ({
                 name: g,
                 type: 'scatter',
                 data: groups[g],
                 symbolSize: 8
             }));
             return {
                 color: palette,
                 ...animation,
                 tooltip: { trigger: 'item' },
                 legend: { textStyle: { color: textColor } },
                 xAxis: { type: 'value', name: config.customXLabel || config.xAxis, nameLocation: 'middle', nameGap: 30, axisLabel: { color: textColor }, splitLine: { lineStyle: { color: gridColor } } },
                 yAxis: { type: 'value', name: config.customYLabel || config.yAxis, nameLocation: 'middle', nameGap: 30, axisLabel: { color: textColor }, splitLine: { lineStyle: { color: gridColor } } },
                 series: series,
                 backgroundColor: 'transparent'
             };
        }
        
        // --- BOXPLOT ---
        if (chartType === 'boxplot') {
             const { boxData, axisData, outliers } = processed;
             return {
                 color: palette,
                 ...animation,
                 tooltip: { trigger: 'item', confine: true },
                 xAxis: { type: 'category', data: axisData, axisLabel: { color: textColor }, name: config.customXLabel || config.groupBy || "Group" },
                 yAxis: { type: 'value', axisLabel: { color: textColor }, splitLine: { lineStyle: { color: gridColor } }, name: config.customYLabel || config.xAxis || "Value" },
                 series: [
                     {
                         name: 'boxplot',
                         type: 'boxplot',
                         data: boxData,
                         itemStyle: { borderColor: textColor }
                     },
                     {
                         name: 'outlier',
                         type: 'scatter',
                         data: outliers
                     }
                 ],
                 backgroundColor: 'transparent'
             };
        }
        
        // --- HEATMAP ---
        if (chartType === 'heatmap') {
             const { xArr, yArr, seriesData, maxVal } = processed;
             return {
                 color: palette,
                 tooltip: { position: 'top' },
                 grid: { height: '70%', bottom: '15%' },
                 xAxis: { type: 'category', data: xArr, axisLabel: { color: textColor, rotate: 30 }, name: config.customXLabel || config.xAxis },
                 yAxis: { type: 'category', data: yArr, axisLabel: { color: textColor }, name: config.customYLabel || (config.yAxis || config.groupBy) },
                 visualMap: {
                     min: 0,
                     max: maxVal,
                     calculable: true,
                     orient: 'horizontal',
                     left: 'center',
                     bottom: '0%',
                     textStyle: { color: textColor }
                 },
                 series: [{
                     type: 'heatmap',
                     data: seriesData,
                     label: { show: true },
                     itemStyle: {
                         emphasis: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                     }
                 }],
                 backgroundColor: 'transparent'
             };
        }

        // --- SANKEY ---
        if (chartType === 'sankey') {
             const { nodes, links } = processed;
             return {
                 color: palette,
                 tooltip: { trigger: 'item', triggerOn: 'mousemove' },
                 series: [{
                     type: 'sankey',
                     data: nodes,
                     links: links,
                     emphasis: { focus: 'adjacency' },
                     lineStyle: { color: 'gradient', curveness: 0.5 },
                     label: { color: textColor }
                 }],
                 backgroundColor: 'transparent'
             };
        }

        // --- HISTOGRAM ---
        if (chartType === 'histogram') {
             const { xLabels, counts } = processed;
             return {
                 color: palette,
                 ...animation,
                 tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                 xAxis: { type: 'category', data: xLabels, axisLabel: { color: textColor }, name: config.customXLabel || config.xAxis },
                 yAxis: { type: 'value', axisLabel: { color: textColor }, splitLine: { lineStyle: { color: gridColor } }, name: config.customYLabel || "Count" },
                 series: [{
                     type: 'bar',
                     data: counts,
                     barWidth: '95%',
                     name: 'Count'
                 }],
                 backgroundColor: 'transparent'
             };
        }

        // --- STANDARD AGGREGATED TYPES ---
        const { agg, xValues, groups, isGrouped, isYAxis } = processed;
        
        // Handle Diverging Bar (Approximation)
        // If type is diverging-bar, we need to treat negative values differently or offset them.
        // For simplicity, we'll assume it's just a stacked bar where we might have negative values, 
        // or we use 'stack' and let ECharts handle pos/neg.
        // If it's Likert, we'd need complex logic to map "Strongly Disagree" to negative.
        // For this iteration, map diverging-bar to a stacked bar with specific stacking.
        
        const isDiverging = chartType === 'diverging-bar';
        const isHorizontal = chartType === 'bar-horizontal' || isDiverging; // Diverging usually horizontal
        
        const axisConfig = {
            axisLabel: { color: textColor, interval: 0, rotate: 30 },
            nameTextStyle: { color: textColor },
            splitLine: { lineStyle: { color: gridColor } }
        };

        const finalPalette = this.colorManager.getPalette(isGrouped ? groups.length : xValues.length);
        const series = [];

        if (['pie', 'donut'].includes(chartType)) {
            const data = [];
            let totalVal = 0;
            xValues.forEach(x => {
                let value = 0;
                Object.values(agg[x]).forEach(g => {
                    value += isYAxis ? g.sumY : g.count;
                });
                data.push({ value, name: x });
                totalVal += value;
            });
            series.push({
                type: 'pie',
                radius: chartType === 'donut' ? ['40%', '70%'] : '50%',
                data: data,
                emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
                label: { color: textColor, formatter: '{b}: {d}%' }
            });
            return {
                color: finalPalette,
                ...animation,
                tooltip: { 
                    trigger: 'item',
                    formatter: '{b}: {c} ({d}%)'
                },
                legend: { top: '5%', left: 'center', textStyle: { color: textColor } },
                series: series,
                backgroundColor: 'transparent'
            };
        } else if (chartType === 'wordCloud') {
            const data = [];
            const stopWords = ['the', 'and', 'or', 'a', 'an', 'in', 'on', 'of', 'for', 'to', 'is', 'are', 'was', 'were'];
            xValues.forEach(x => {
                 if (stopWords.includes(String(x).toLowerCase())) return;
                let value = 0;
                Object.values(agg[x]).forEach(g => value += isYAxis ? g.sumY : g.count);
                data.push({ name: x, value });
            });
            series.push({
                type: 'wordCloud',
                shape: 'circle',
                sizeRange: [12, 60],
                rotationRange: [-90, 90],
                data: data,
                textStyle: {
                    color: () => 'rgb(' + [
                            Math.round(Math.random() * 160),
                            Math.round(Math.random() * 160),
                            Math.round(Math.random() * 160)
                        ].join(',') + ')'
                }
            });
        } else if (chartType === 'radar') {
            const indicators = xValues.map(x => ({ name: x }));
            const radarData = [];
            const iterGroups = isGrouped ? groups : ['All'];
            iterGroups.forEach(g => {
                const values = xValues.map(x => {
                    const bucket = agg[x][g];
                    return bucket ? (isYAxis ? bucket.sumY : bucket.count) : 0;
                });
                radarData.push({ value: values, name: g });
            });
            series.push({ type: 'radar', data: radarData });
            return {
                color: finalPalette,
                ...animation,
                tooltip: {},
                legend: { data: isGrouped ? groups : [], textStyle: { color: textColor } },
                radar: { indicator: indicators, axisName: { color: textColor }, splitLine: { lineStyle: { color: gridColor } } },
                series: series,
                backgroundColor: 'transparent'
            };
        } else {
            const iterGroups = isGrouped ? groups : ['All'];
            
            iterGroups.forEach(g => {
                const data = xValues.map(x => {
                    const bucket = agg[x][g];
                    return bucket ? (isYAxis ? bucket.sumY : bucket.count) : 0;
                });
                let type = 'bar';
                let stack = undefined;
                let areaStyle = undefined;
                
                if (chartType === 'line' || chartType === 'area' || chartType === 'slope') {
                    type = 'line';
                    if (chartType === 'area') areaStyle = {};
                } else if (chartType.includes('stacked') || isDiverging) {
                    type = 'bar';
                    stack = 'total';
                    if (chartType === '100-stacked-column') {
                        // Normalize
                        const normalizedData = data.map((val, idx) => {
                            const x = xValues[idx];
                            let total = 0;
                            groups.forEach(grp => {
                                const bucket = agg[x][grp];
                                total += bucket ? (isYAxis ? bucket.sumY : bucket.count) : 0;
                            });
                            return total > 0 ? (val / total) * 100 : 0;
                        });
                        for(let i=0; i<data.length; i++) data[i] = normalizedData[i];
                    }
                } else if (isHorizontal) {
                    type = 'bar';
                }
                series.push({
                    name: isGrouped ? g : config.yAxis || 'Count',
                    type: type,
                    stack: stack,
                    areaStyle: areaStyle,
                    data: data
                });
            });
            
            const is100Stacked = chartType === '100-stacked-column';
            
            // X and Y Axis setup
            let finalXAxis = { type: 'category', data: xValues, ...axisConfig };
            let finalYAxis = { type: 'value', ...axisConfig };
            
            if (isHorizontal) {
                finalXAxis = { type: 'value', ...axisConfig };
                finalYAxis = { type: 'category', data: xValues, ...axisConfig };
            }
            
            // Inject Custom Labels if not default
            if (config.customXLabel) finalXAxis.name = config.customXLabel;
            if (config.customYLabel) finalYAxis.name = config.customYLabel;
            // Axis Name Location
            finalXAxis.nameLocation = 'middle';
            finalXAxis.nameGap = 30;
            finalYAxis.nameLocation = 'middle';
            finalYAxis.nameGap = isHorizontal ? 30 : 40;

            return {
                color: finalPalette,
                ...animation,
                tooltip: { 
                    trigger: 'axis', 
                    axisPointer: { type: 'shadow' },
                    valueFormatter: (value) => is100Stacked ? value.toFixed(1) + '%' : value
                },
                legend: { data: isGrouped ? groups : [], textStyle: { color: textColor } },
                grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true, borderColor: gridColor },
                xAxis: finalXAxis,
                yAxis: finalYAxis,
                series: series,
                backgroundColor: 'transparent'
            };
        }
    }

    findIdsForPoint(data, config, params) {
        const { xAxis, groupBy, splitValues } = config;
        const targetX = params.name;
        const targetGroup = params.seriesName;
        const matchedIds = [];
        data.forEach(row => {
            let xVal = row[xAxis];
            if (xVal === undefined || xVal === null) xVal = "N/A";
            let matchX = false;
            if (splitValues && typeof xVal === 'string' && xVal.includes(',')) {
                matchX = xVal.split(',').map(s => s.trim()).includes(targetX);
            } else {
                matchX = (String(xVal) === targetX);
            }
            if (matchX) {
                if (groupBy) {
                    const gVal = row[groupBy] || "N/A";
                    if (gVal === targetGroup) matchedIds.push(row._id);
                } else {
                    matchedIds.push(row._id);
                }
            }
        });
        return matchedIds;
    }
}

class UIManager {
    constructor(dataManager, visualizer, filterEngine, codebookManager, viewManager) {
        this.dm = dataManager;
        this.viz = visualizer;
        this.fe = filterEngine;
        this.cbm = codebookManager;
        this.vm = viewManager;
        this.initEventListeners();
    }
    initEventListeners() {
        const fileInput = document.getElementById('file-upload');
        const fileInfo = document.getElementById('file-name-display');
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    fileInfo.textContent = 'Loading...';
                    await this.dm.loadFile(file);
                    fileInfo.textContent = file.name;
                    document.getElementById('row-count-display').textContent = `${this.dm.rawData.length} rows`;
                    document.getElementById('data-summary').classList.remove('hidden');
                    
                    this.populateColumnSelects();
                    this.fe.generateFilters(); 
                    
                    // Render Dashboard
                    this.viz.renderDashboard(
                        this.dm.filteredData, 
                        this.dm.headers, 
                        'dashboard-grid', 
                        (col) => this.vm.showInspector({ xAxis: col })
                    );
                    
                } catch (err) {
                    alert(`Error: ${err.message}`);
                }
            }
        });
        
        const updateViz = () => this.updateVisualization();

        document.getElementById('x-axis-select').addEventListener('change', updateViz);
        document.getElementById('y-axis-select').addEventListener('change', updateViz);
        document.getElementById('group-by-select').addEventListener('change', updateViz);
        document.getElementById('split-values').addEventListener('change', updateViz);
        document.getElementById('strict-mode').addEventListener('change', updateViz);
        document.getElementById('hide-self-comparison').addEventListener('change', updateViz);
        
        // Label Inputs Triggers
        ['custom-title', 'custom-subtitle', 'custom-xlabel', 'custom-ylabel'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateViz);
        });

        // Toggle Labels Section
        document.getElementById('toggle-labels-section').addEventListener('click', () => {
            const content = document.getElementById('labels-section-content');
            if (content.classList.contains('hidden')) {
                content.classList.remove('hidden');
            } else {
                content.classList.add('hidden');
            }
        });
        
        document.querySelectorAll('.chart-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('btn-active'));
                e.target.classList.add('btn-active');
                this.updateVisualization();
            });
        });
        
        // Codebook Triggers
        document.getElementById('btn-codebook-trigger').addEventListener('click', () => {
             document.getElementById('map-modal-overlay').classList.remove('hidden');
        });
        
         document.getElementById('codebook-csv-upload').addEventListener('change', (e) => {
             const file = e.target.files[0];
             if(file) {
                 Papa.parse(file, {
                     header: true, 
                     skipEmptyLines: true,
                     complete: (res) => {
                         // Expect Variable,Value,Label,Question
                         res.data.forEach(row => {
                             const v = row.Variable || row.variable;
                             const val = row.Value || row.value;
                             const lbl = row.Label || row.label;
                             const q = row.Question || row.question;
                             if(v && val && lbl) {
                                 if(!this.dm.codebook.mapping[v]) this.dm.codebook.mapping[v] = {};
                                 this.dm.codebook.mapping[v][val] = lbl;
                             }
                             if(v && q) {
                                 this.dm.setQuestion(v, q);
                             }
                         });
                         this.dm.persistCodebook();
                         this.dm.processData();
                         alert('Codebook CSV Imported');
                     }
                 });
             }
         });
         
         // Download Chart
         document.getElementById('btn-download-chart').addEventListener('click', () => {
             this.viz.downloadChart();
         });
         
         // Notes
         const notesArea = document.getElementById('chart-notes');
         notesArea.addEventListener('input', (e) => {
             const col = document.getElementById('x-axis-select').value;
             if(col) {
                 const notes = JSON.parse(localStorage.getItem('chartNotes') || '{}');
                 notes[col] = e.target.value;
                 localStorage.setItem('chartNotes', JSON.stringify(notes));
             }
         });
    }
    
    setInspectorConfig(config) {
        if (config.xAxis) {
            document.getElementById('x-axis-select').value = config.xAxis;
            // Load Notes
            const notes = JSON.parse(localStorage.getItem('chartNotes') || '{}');
            document.getElementById('chart-notes').value = notes[config.xAxis] || '';
        }
        this.updateVisualization();
    }
    
    populateColumnSelects() {
        const headers = this.dm.headers;
        const selects = ['x-axis-select', 'y-axis-select', 'group-by-select', 'map-column-select'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            const currentVal = el.value;
            while (el.options.length > 1) el.remove(1);
            headers.forEach(h => {
                const option = document.createElement('option');
                option.value = h;
                option.text = h;
                el.add(option);
            });
            if (headers.includes(currentVal)) el.value = currentVal;
        });
    }
    
    renderDataTable() {
        const thead = document.getElementById('raw-data-head');
        const tbody = document.getElementById('raw-data-body');
        thead.innerHTML = '';
        tbody.innerHTML = '';
        
        if (this.dm.headers.length === 0) return;
        
        const trHead = document.createElement('tr');
        this.dm.headers.forEach(h => {
            const th = document.createElement('th');
            th.className = 'px-2 py-1 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-left font-semibold text-xs whitespace-nowrap';
            th.textContent = h;
            trHead.appendChild(th);
        });
        thead.appendChild(trHead);
        
        // Render first 500 rows for performance
        this.dm.filteredData.slice(0, 500).forEach(row => {
            const tr = document.createElement('tr');
            this.dm.headers.forEach(h => {
                const td = document.createElement('td');
                td.className = 'px-2 py-1 border-b border-gray-100 dark:border-gray-800 whitespace-nowrap';
                td.textContent = row[h];
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }

    updateVisualization() {
        const config = {
            xAxis: document.getElementById('x-axis-select').value,
            yAxis: document.getElementById('y-axis-select').value,
            groupBy: document.getElementById('group-by-select').value,
            splitValues: document.getElementById('split-values').checked,
            strictMode: document.getElementById('strict-mode').checked,
            chartType: document.querySelector('.chart-type-btn.btn-active').dataset.type,
            
            // Custom Labels
            customTitle: document.getElementById('custom-title').value,
            customSubtitle: document.getElementById('custom-subtitle').value,
            customXLabel: document.getElementById('custom-xlabel').value,
            customYLabel: document.getElementById('custom-ylabel').value
        };
        if (config.xAxis) {
            this.viz.render(this.dm.filteredData, config);
        }
    }
    
    updateFilterCount() {
        const total = this.dm.processedData.length;
        const filtered = this.dm.filteredData.length;
        const display = document.getElementById('filter-count-display');
        display.textContent = `Showing ${filtered} of ${total} respondents`;
    }
}
