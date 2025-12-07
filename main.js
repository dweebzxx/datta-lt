
/*
    datta Ai - Generic Data Visualizer
    Production Version
*/

let um = null;

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
        this.themes = {
            aurora: ['#005960', '#0099A8', '#4BC0C8', '#FF7E67', '#FFC4A3', '#5B7DB1', '#3E517A', '#42B883', '#DDDDDD', '#13293D'],
            canyon: ['#FF5E5B', '#D7263D', '#F2A541', '#F7D488', '#E0E2DB', '#116979', '#87A8A4', '#B2B1B9', '#F26419', '#33658A'],
            seashore: ['#023E8A', '#0077B6', '#0096C7', '#00B4D8', '#48CAE4', '#90E0EF', '#CAF0F8', '#03045E', '#1D3557', '#457B9D'],
            ltikes: ['#EE3338', '#005C9F', '#FFD100', '#27A9E1', '#3CB878', '#F7941D', '#F09EA7', '#8E44AD', '#0F2C52', '#E6E7E8'],
            moss: ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51', '#1B4332', '#2D6A4F', '#52B788', '#74C69D', '#D8F3DC'],
            bloom: ['#6A0572', '#AB83A1', '#C9CCD5', '#FFB5A7', '#FCD5CE', '#F8EDEB', '#9D8189', '#5C5470', '#9F86C0', '#D1D1D1'],
            mono: ['#0B132B', '#1C2541', '#3A506B', '#5BC0BE', '#6FFFE9', '#BFC0C0', '#8D99AE', '#2B2D42', '#EDF2F4', '#EF233C'],
            jewel: ['#051923', '#003554', '#006494', '#0582CA', '#00A6FB', '#1B4965', '#2E8BC0', '#145DA0', '#B1D4E0', '#89C2D9'],
            pastelpunch: ['#F72585', '#B5179E', '#7209B7', '#560BAD', '#480CA8', '#3A0CA3', '#3F37C9', '#4361EE', '#4895EF', '#4CC9F0'],
            midnight: ['#0B3954', '#087E8B', '#FF5A5F', '#00A6A6', '#B8B08D', '#F18F01', '#C5D86D', '#9CAFB7', '#6F1D1B', '#FFD166']
        };
        const storedTheme = localStorage.getItem('activeTheme');
        this.activeTheme = this.themes[storedTheme] ? storedTheme : 'aurora';
        this.systemDefaults = this.themes[this.activeTheme];
        localStorage.setItem('activeTheme', this.activeTheme);
        this.customColors = [];
        this.paletteListeners = [];
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
        } else {
            this.applyThemeToInputs();
        }

        const inputs = document.querySelectorAll('.color-input');
        inputs.forEach((input) => {
            input.addEventListener('change', () => {
                this.updateCustomColors();
                this.notifyPaletteChange();
            });
        });

        const themeSelect = document.getElementById('color-theme-select');
        if (themeSelect) {
            themeSelect.value = this.activeTheme;
            themeSelect.addEventListener('change', (e) => {
                this.setTheme(e.target.value);
                this.notifyPaletteChange();
            });
        }

        document.getElementById('btn-shuffle-colors').addEventListener('click', () => {
            this.shuffleColors();
            this.notifyPaletteChange();
        });

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

    notifyPaletteChange() {
        this.paletteListeners.forEach(cb => cb());
    }

    onPaletteChange(cb) {
        this.paletteListeners.push(cb);
    }

    setTheme(themeName) {
        if (this.themes[themeName]) {
            this.activeTheme = themeName;
            localStorage.setItem('activeTheme', themeName);
            this.systemDefaults = this.themes[themeName];
            this.customColors = [];
            localStorage.removeItem('customColors');
            this.applyThemeToInputs();
        }
    }

    applyThemeToInputs() {
        if (!this.systemDefaults) this.systemDefaults = this.themes['aurora'];
        const inputs = document.querySelectorAll('.color-input');
        inputs.forEach((input, i) => {
            input.value = this.systemDefaults[i] || '';
        });
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
            this.systemDefaults.forEach(c => palette.push(c));
            while (palette.length < 10) palette.push(chroma.random().hex());
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

class FilterEngine {
    constructor(dataManager, onChange) {
        this.dm = dataManager;
        this.onChange = onChange;
        this.activeFilters = {};
        this.container = document.getElementById('filters-container');
        this.addBtn = document.getElementById('btn-add-filter');

        if (this.addBtn) {
            this.addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addFilterRow();
            });
        }
    }

    setOnChange(callback) {
        this.onChange = callback;
    }

    generateFilters() {
        // Remove all rows except the add button
        this.activeFilters = {};
        if (!this.container) return;

        this.container.querySelectorAll('.filter-row').forEach(row => row.remove());
        this.updateFilters();
    }

    refreshFilterOptions() {
        if (!this.container) return;

        const headers = this.dm.headers.filter(h => h !== '_id');
        this.container.querySelectorAll('.filter-row select[data-type="column"]').forEach(select => {
            const current = select.value;
            this.populateColumnOptions(select, headers);
            if (headers.includes(current)) {
                select.value = current;
                this.populateValueOptions(select.closest('.filter-row'), current);
            }
        });
    }

    addFilterRow() {
        if (!this.container) return;

        const row = document.createElement('div');
        row.className = 'filter-row border border-gray-200 dark:border-gray-700 rounded p-2 space-y-2 glass-panel';

        const columnSelect = document.createElement('select');
        columnSelect.className = 'w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none';
        columnSelect.dataset.type = 'column';
        columnSelect.innerHTML = '<option value="">Select column...</option>';
        this.populateColumnOptions(columnSelect, this.dm.headers.filter(h => h !== '_id'));

        const valueSelect = document.createElement('select');
        valueSelect.className = 'w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none';
        valueSelect.multiple = true;
        valueSelect.size = 5;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'text-[10px] text-red-500 hover:text-red-700';
        removeBtn.textContent = 'Remove';

        row.appendChild(columnSelect);
        row.appendChild(valueSelect);
        row.appendChild(removeBtn);

        this.container.insertBefore(row, this.addBtn);

        columnSelect.addEventListener('change', () => {
            const col = columnSelect.value;
            this.populateValueOptions(row, col);
        });

        valueSelect.addEventListener('change', () => {
            const col = columnSelect.value;
            const values = Array.from(valueSelect.selectedOptions).map(opt => opt.value);
            if (col) {
                this.activeFilters[col] = values;
                this.updateFilters();
            }
        });

        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const col = columnSelect.value;
            if (col && this.activeFilters[col]) delete this.activeFilters[col];
            row.remove();
            this.updateFilters();
        });
    }

    populateColumnOptions(select, headers) {
        while (select.options.length > 1) select.remove(1);
        headers.forEach(h => {
            const option = document.createElement('option');
            option.value = h;
            option.textContent = h;
            select.add(option);
        });
    }

    populateValueOptions(row, column) {
        const valueSelect = row.querySelector('select[multiple]');
        if (!valueSelect) return;

        valueSelect.innerHTML = '';
        if (!column) {
            this.updateFilters();
            return;
        }

        const values = this.getUniqueValues(column);
        values.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            valueSelect.add(opt);
        });
    }

    getUniqueValues(column) {
        const set = new Set();
        this.dm.processedData.forEach(row => {
            let val = row[column];
            if (typeof val === 'string' && val.includes(',')) {
                val.split(',').map(v => v.trim()).forEach(v => set.add(v || 'N/A'));
            } else {
                set.add(val === undefined || val === null ? 'N/A' : String(val));
            }
        });
        return Array.from(set).sort();
    }

    updateFilters() {
        this.dm.applyFilters(this.activeFilters);
        if (typeof this.onChange === 'function') this.onChange();
    }
}

class CodebookManager {
    constructor(dataManager) {
        this.dm = dataManager;
        this.overlay = document.getElementById('map-modal-overlay');
        this.columnSelect = document.getElementById('map-column-select');
        this.tableBody = document.getElementById('map-table-body');
        this.saveBtn = document.getElementById('save-map');
        this.closeBtn = document.getElementById('close-map-modal');
        this.downloadTemplateBtn = document.getElementById('btn-download-codebook');

        this.registerEvents();
    }

    registerEvents() {
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
        if (this.overlay) this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
        if (this.columnSelect) this.columnSelect.addEventListener('change', (e) => this.renderTable(e.target.value));
        if (this.saveBtn) this.saveBtn.addEventListener('click', () => this.saveMapping());
        if (this.downloadTemplateBtn) this.downloadTemplateBtn.addEventListener('click', () => this.downloadTemplate());
    }

    open(headers) {
        if (!this.overlay) return;
        this.refreshColumns(headers || this.dm.headers);
        this.overlay.classList.remove('hidden');
    }

    close() {
        if (this.overlay) this.overlay.classList.add('hidden');
    }

    refreshColumns(headers = []) {
        if (!this.columnSelect) return;

        const safeHeaders = headers.filter(h => h !== '_id');
        while (this.columnSelect.options.length > 1) this.columnSelect.remove(1);
        safeHeaders.forEach(h => {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = h;
            this.columnSelect.add(opt);
        });

        if (safeHeaders.length > 0) {
            this.columnSelect.value = safeHeaders[0];
            this.renderTable(safeHeaders[0]);
        }
    }

    renderTable(column) {
        if (!this.tableBody) return;
        this.tableBody.innerHTML = '';
        if (!column) return;

        const values = this.getUniqueValues(column);
        values.forEach(val => {
            const tr = document.createElement('tr');
            const tdVal = document.createElement('td');
            tdVal.className = 'px-6 py-3 text-gray-700 dark:text-gray-200';
            tdVal.textContent = val;

            const tdInput = document.createElement('td');
            tdInput.className = 'px-6 py-3';
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'w-full border rounded p-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-700';
            input.dataset.original = val;

            if (this.dm.codebook.mapping[column] && this.dm.codebook.mapping[column][val]) {
                input.value = this.dm.codebook.mapping[column][val];
            }

            tdInput.appendChild(input);
            tr.appendChild(tdVal);
            tr.appendChild(tdInput);
            this.tableBody.appendChild(tr);
        });
    }

    getUniqueValues(column) {
        const set = new Set();
        this.dm.processedData.forEach(row => {
            let val = row[column];
            if (typeof val === 'string' && val.includes(',')) {
                val.split(',').map(v => v.trim()).forEach(v => set.add(v || 'N/A'));
            } else {
                set.add(val === undefined || val === null ? 'N/A' : String(val));
            }
        });
        return Array.from(set).sort();
    }

    saveMapping() {
        if (!this.columnSelect) return;
        const column = this.columnSelect.value;
        if (!column) return;

        const mapping = {};
        this.tableBody.querySelectorAll('input[data-original]').forEach(input => {
            if (input.value.trim() !== '') {
                mapping[input.dataset.original] = input.value.trim();
            }
        });

        this.dm.setCodebook(column, mapping);
        alert('Mapping saved');
    }

    downloadTemplate() {
        const headers = this.dm.headers.filter(h => h !== '_id');
        const rows = [['Variable', 'Value', 'Label', 'Question']];
        headers.forEach(h => rows.push([h, '', '', '']));

        const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'codebook_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    }
}

class Visualizer {
    constructor(colorManager, statsEngine, dataManager) {
        this.colorManager = colorManager;
        this.statsEngine = statsEngine;
        this.dm = dataManager; // Access to codebook questions
        this.chartInstance = null;
        this.resizeHandler = null;
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
                    itemStyle: { borderRadius: 2 },
                    colorBy: 'data'
                }]
            };
        }
        instance.setOption(option);
    }

    // --- Inspector Main Chart ---
    render(data, config) {
        const chartDom = document.getElementById('main-chart');
        const titleEl = document.getElementById('chart-title');
        const hasCustomTitle = Boolean(config.customTitle || config.customSubtitle);
        
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

        if (this.chartInstance) {
            this.chartInstance.dispose();
            if (this.resizeHandler) window.removeEventListener('resize', this.resizeHandler);
        }

        if (config.chartType === 'crosstab') {
            this.renderCrosstab(chartDom, data, config);
            this.updateStats(data, config);
            return;
        }

        this.chartInstance = echarts.init(chartDom);
        this.resizeHandler = () => this.chartInstance && this.chartInstance.resize();
        window.addEventListener('resize', this.resizeHandler);

        // Prepare Data based on chart type requirements
        let processedData;
        if (config.multiAxisVariables?.length && this.isMultiAxisChart(config.chartType)) {
             processedData = this.prepareMultiAxisComparison(data, config);
        } else if (config.chartType === 'scatter' || config.chartType === 'scatter-jitter' || config.chartType === 'heatmap' || config.chartType === 'demographic-heatmap' || config.chartType === 'correlation-heatmap' || config.chartType === 'boxplot' || config.chartType === 'sankey') {
             // These types might need raw-ish data or special processing
             processedData = this.prepareSpecialData(data, config);
        } else if (config.chartType === 'histogram') {
             processedData = this.prepareHistogram(data, config);
        } else {
             processedData = this.aggregateData(data, config);
        }

        if (processedData && processedData.error) {
            chartDom.innerHTML = `<div class="flex items-center justify-center h-full text-center px-4 text-sm text-red-600 dark:text-red-300">${processedData.error}</div>`;
            return;
        }

        const option = this.generateOption(processedData, config);

        // Inject Custom Titles if they exist in UI but not fully in option yet (though generateOption should handle it)
        if(hasCustomTitle) {
             const titleTextStyle = { color: this.colorManager.getTextColor(), fontSize: config.titleFontSize || 18, fontWeight: 'bold' };
             const subTitleTextStyle = { color: chroma(this.colorManager.getTextColor()).alpha(0.7).css(), fontSize: config.subtitleFontSize || 14, fontWeight: '600' };
             const baseTop = (option.title && option.title.top !== undefined) ? option.title.top : 10;
             const adjustedTop = baseTop + (config.titleTopOffset || 0);
             option.title = {
                 ...(option.title || {}),
                 text: config.customTitle || displayTitle,
                 subtext: config.customSubtitle || '',
                 left: config.titleLeft || 'center',
                 top: adjustedTop,
                 textStyle: { ...titleTextStyle, ...(option.title ? option.title.textStyle : {}) },
                 subtextStyle: { ...subTitleTextStyle, ...(option.title ? option.title.subtextStyle : {}) }
             };
            if (option.legend) {
                const baseLegendTop = option.legend.top ?? 20;
                option.legend.top = hasCustomTitle ? Math.max(baseLegendTop, adjustedTop + 40) : baseLegendTop;
            }
            if (option.grid && hasCustomTitle) {
                const baseGridTop = option.grid.top ?? 60;
                option.grid.top = Math.max(baseGridTop, adjustedTop + 70);
            }
        }

        this.chartInstance.setOption(option);
        
        // Only attach click handler if it's a standard aggregated chart where findIdsForPoint works well
        if (!['scatter', 'scatter-jitter', 'boxplot', 'sankey', 'histogram', 'heatmap', 'demographic-heatmap', 'correlation-heatmap'].includes(config.chartType)) {
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
                backgroundColor: '#ffffff'
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

    isMultiAxisChart(chartType) {
        const supported = ['side-by-side-bar', 'stacked-column', '100-stacked-column', 'horizontal-stacked', 'horizontal-100-stacked'];
        return supported.includes(chartType);
    }

    prepareMultiAxisComparison(data, config) {
        const variables = (config.multiAxisVariables || []).filter(Boolean).slice(0, 6);
        if (!variables.length) {
            return { error: 'Pick at least one variable in the multi-variable selector.' };
        }

        const { splitValues, strictMode } = config;
        const responseBuckets = {};
        const categories = new Set();
        variables.forEach(v => responseBuckets[v] = {});

        data.forEach(row => {
            variables.forEach(variable => {
                let raw = row[variable];
                if (raw === undefined || raw === null) raw = 'N/A';
                let values = [];

                if (splitValues && typeof raw === 'string') {
                    if (strictMode) {
                        values = raw.split(',').map(s => s.trim());
                    } else {
                        if (raw.includes(';')) values = raw.split(';').map(s => s.trim());
                        else if (raw.includes(',')) values = raw.split(',').map(s => s.trim());
                        else values = [raw.trim()];
                    }
                } else {
                    values = [String(raw).trim()];
                }

                values.forEach(val => {
                    let mapped = val === '' ? 'N/A' : val;
                    if (this.dm.codebook.mapping[variable] && this.dm.codebook.mapping[variable][mapped]) {
                        mapped = this.dm.codebook.mapping[variable][mapped];
                    }
                    categories.add(mapped);
                    responseBuckets[variable][mapped] = (responseBuckets[variable][mapped] || 0) + 1;
                });
            });
        });

        const categoryList = Array.from(categories).sort();
        const totalsPerCategory = categoryList.map(cat => variables.reduce((sum, v) => sum + (responseBuckets[v][cat] || 0), 0));
        const isPercentage = config.chartType.includes('100');

        const series = variables.map(variable => {
            const dataPoints = categoryList.map((cat, idx) => {
                const rawVal = responseBuckets[variable][cat] || 0;
                if (isPercentage) {
                    const total = totalsPerCategory[idx] || 0;
                    return total > 0 ? (rawVal / total) * 100 : 0;
                }
                return rawVal;
            });

            return {
                name: variable,
                type: 'bar',
                stack: config.chartType.includes('stacked') ? 'total' : undefined,
                data: dataPoints,
                itemStyle: { borderRadius: 3 }
            };
        });

        return { categories: categoryList, series, isPercentage, multiSeriesMode: true };
    }
    
    // Preparation methods for new chart types
    prepareSpecialData(data, config) {
        const { xAxis, yAxis, groupBy } = config;
        
        if (config.chartType === 'scatter' || config.chartType === 'scatter-jitter') {
             // Need numeric X and Y.
             if (!yAxis) return { error: 'Scatter plots require both X and Y axes.' };
             const groups = {};

             data.forEach(row => {
                 const xBase = parseFloat(row[xAxis]);
                 const yBase = parseFloat(row[yAxis]);
                 if (!isNaN(xBase) && !isNaN(yBase)) {
                     const gVal = groupBy ? (row[groupBy] || 'All') : 'All';
                     if (!groups[gVal]) groups[gVal] = [];
                     const jitterX = config.chartType === 'scatter-jitter' ? (Math.random() - 0.5) * 0.6 : 0;
                     const jitterY = config.chartType === 'scatter-jitter' ? (Math.random() - 0.5) * 0.6 : 0;
                     groups[gVal].push([xBase + jitterX, yBase + jitterY]);
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
        
        if (config.chartType === 'correlation-heatmap') {
             const numericCols = this.dm.headers.filter(h => h !== '_id').filter(col => data.some(row => !isNaN(parseFloat(row[col]))));
             if (numericCols.length < 2) return { error: 'Correlation heatmap requires at least two numeric columns.' };
             const matrixData = [];
             numericCols.forEach((colA, i) => {
                 numericCols.forEach((colB, j) => {
                     const arrA = [];
                     const arrB = [];
                     data.forEach(row => {
                         const a = parseFloat(row[colA]);
                         const b = parseFloat(row[colB]);
                         if (!isNaN(a) && !isNaN(b)) {
                             arrA.push(a);
                             arrB.push(b);
                         }
                     });
                     const corr = arrA.length > 1 ? jStat.corrcoeff(arrA, arrB) : 0;
                     matrixData.push([j, i, corr]);
                 });
             });
             return { labels: numericCols, matrixData };
        }

        if (config.chartType === 'heatmap' || config.chartType === 'demographic-heatmap') {
             // 2D Density (Numeric X, Numeric Y) OR Crosstab Heatmap (Cat X, Cat Y)
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
        const axisLabelStyle = {
            color: textColor,
            fontSize: config.axisLabelFontSize || 13,
            fontWeight: 'bold',
            margin: config.axisLabelMargin ?? 8
        };
        const axisNameStyle = { color: textColor, fontSize: config.axisTitleFontSize || 14, fontWeight: 'bold' };
        const axisTitleGap = config.axisTitleGap ?? 30;
        const legendTextStyle = { color: textColor, fontSize: 13, fontWeight: 'bold' };
        const hasCustomTitle = Boolean(config.customTitle || config.customSubtitle);

        if (processed && processed.multiSeriesMode) {
            const isHorizontal = chartType.includes('horizontal');
            const is100Stacked = chartType.includes('100');
            const finalPalette = this.colorManager.getPalette(processed.series.length);

            processed.series.forEach((s, idx) => {
                s.color = finalPalette[idx];
                s.emphasis = { focus: 'series' };
            });

            let categoryAxis = { type: 'category', data: processed.categories, axisLabel: { ...axisLabelStyle, rotate: isHorizontal ? 0 : 30, hideOverlap: true }, nameTextStyle: axisNameStyle, nameGap: axisTitleGap, nameLocation: 'middle' };
            let valueAxis = { type: 'value', axisLabel: { ...axisLabelStyle, rotate: 0 }, splitLine: { lineStyle: { color: gridColor } }, nameTextStyle: axisNameStyle, nameGap: axisTitleGap, nameLocation: 'middle' };

            const categoryName = config.customXLabel || 'Response Options';
            const valueName = config.customYLabel || (is100Stacked ? 'Percentage' : 'Count');

            if (isHorizontal) {
                categoryAxis = { ...categoryAxis, name: config.customYLabel || categoryName };
                valueAxis = { ...valueAxis, name: config.customXLabel || valueName };
            } else {
                categoryAxis = { ...categoryAxis, name: categoryName };
                valueAxis = { ...valueAxis, name: valueName };
            }

            const option = {
                color: finalPalette,
                ...animation,
                tooltip: {
                    trigger: 'axis',
                    axisPointer: { type: 'shadow' },
                    valueFormatter: (value) => is100Stacked ? `${value.toFixed(1)}%` : value
                },
                legend: { textStyle: legendTextStyle, top: hasCustomTitle ? 60 : 20 },
                grid: { left: '3%', right: '4%', bottom: '10%', top: hasCustomTitle ? 100 : 60, containLabel: true, borderColor: gridColor },
                xAxis: isHorizontal ? valueAxis : categoryAxis,
                yAxis: isHorizontal ? categoryAxis : valueAxis,
                series: processed.series,
                backgroundColor: 'transparent'
            };

            return option;
        }

        // --- SCATTER ---
        if (chartType === 'scatter' || chartType === 'scatter-jitter') {
             const { groups } = processed;
             const series = Object.keys(groups || {}).map(g => ({
                 name: g,
                 type: 'scatter',
                 data: groups[g],
                 symbolSize: 8,
                 emphasis: { focus: 'series' }
             }));
             return {
                 color: palette,
                 ...animation,
                 tooltip: { trigger: 'item' },
                 legend: { textStyle: legendTextStyle },
                xAxis: { type: 'value', name: config.customXLabel || config.xAxis, nameLocation: 'middle', nameGap: axisTitleGap, axisLabel: { ...axisLabelStyle }, nameTextStyle: axisNameStyle, splitLine: { lineStyle: { color: gridColor } } },
                yAxis: { type: 'value', name: config.customYLabel || config.yAxis, nameLocation: 'middle', nameGap: axisTitleGap, axisLabel: { ...axisLabelStyle }, nameTextStyle: axisNameStyle, splitLine: { lineStyle: { color: gridColor } } },
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
                xAxis: { type: 'category', data: axisData, axisLabel: { ...axisLabelStyle }, name: config.customXLabel || config.groupBy || "Group", nameTextStyle: axisNameStyle, nameGap: axisTitleGap, nameLocation: 'middle' },
                yAxis: { type: 'value', axisLabel: { ...axisLabelStyle }, splitLine: { lineStyle: { color: gridColor } }, name: config.customYLabel || config.xAxis || "Value", nameTextStyle: axisNameStyle, nameGap: axisTitleGap, nameLocation: 'middle' },
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
        if (chartType === 'heatmap' || chartType === 'demographic-heatmap') {
             const { xArr, yArr, seriesData, maxVal } = processed;
             return {
                 color: palette,
                 tooltip: { position: 'top' },
                 grid: { height: '70%', bottom: '15%' },
                xAxis: { type: 'category', data: xArr, axisLabel: { ...axisLabelStyle, rotate: 30 }, name: config.customXLabel || config.xAxis, nameTextStyle: axisNameStyle, nameGap: axisTitleGap, nameLocation: 'middle' },
                yAxis: { type: 'category', data: yArr, axisLabel: { ...axisLabelStyle }, name: config.customYLabel || (config.yAxis || config.groupBy), nameTextStyle: axisNameStyle, nameGap: axisTitleGap, nameLocation: 'middle' },
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
                    label: { show: true, color: textColor, fontWeight: 'bold' },
                    itemStyle: {
                        emphasis: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' }
                    }
                }],
                 backgroundColor: 'transparent'
             };
        }

        if (chartType === 'correlation-heatmap') {
             const { labels, matrixData } = processed;
             return {
                 tooltip: { position: 'top', formatter: ({ value }) => `Correlation: ${Number(value[2]).toFixed(2)}` },
                 grid: { height: '70%', bottom: '15%' },
                xAxis: { type: 'category', data: labels, axisLabel: { ...axisLabelStyle }, name: 'Variables', nameTextStyle: axisNameStyle, nameGap: axisTitleGap, nameLocation: 'middle' },
                yAxis: { type: 'category', data: labels, axisLabel: { ...axisLabelStyle }, name: 'Variables', nameTextStyle: axisNameStyle, nameGap: axisTitleGap, nameLocation: 'middle' },
                 visualMap: {
                     min: -1,
                     max: 1,
                     calculable: true,
                     orient: 'horizontal',
                     left: 'center',
                     bottom: '0%',
                     textStyle: { color: textColor },
                     inRange: { color: ['#8B0000', '#ffffff', '#00429d'] }
                 },
                series: [{
                    type: 'heatmap',
                    data: matrixData,
                    label: { show: true, formatter: ({ value }) => Number(value[2]).toFixed(2), color: textColor, fontWeight: 'bold' },
                    emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.3)' } }
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
                xAxis: { type: 'category', data: xLabels, axisLabel: { ...axisLabelStyle }, name: config.customXLabel || config.xAxis, nameTextStyle: axisNameStyle, nameGap: axisTitleGap, nameLocation: 'middle' },
                yAxis: { type: 'value', axisLabel: { ...axisLabelStyle }, splitLine: { lineStyle: { color: gridColor } }, name: config.customYLabel || "Count", nameTextStyle: axisNameStyle, nameGap: axisTitleGap, nameLocation: 'middle' },
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
        const isHorizontal = chartType === 'bar-horizontal' || chartType.includes('horizontal') || isDiverging; // Diverging usually horizontal
        const hasCustomTitle = Boolean(config.customTitle || config.customSubtitle);

        const axisConfig = {
            axisLabel: { ...axisLabelStyle, interval: 0, rotate: 30, hideOverlap: true },
            nameTextStyle: axisNameStyle,
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
                label: { color: textColor, formatter: '{b}: {d}%', fontSize: config.pieLabelFontSize || 13 }
            });
            return {
                color: finalPalette,
                ...animation,
                tooltip: { 
                    trigger: 'item',
                    formatter: '{b}: {c} ({d}%)'
                },
                legend: { top: '5%', left: 'center', textStyle: legendTextStyle },
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
                legend: { data: isGrouped ? groups : [], textStyle: legendTextStyle },
                radar: { indicator: indicators, axisName: { color: textColor, fontSize: 13, fontWeight: 'bold' }, splitLine: { lineStyle: { color: gridColor } } },
                series: series,
                backgroundColor: 'transparent'
            };
        } else {
            const iterGroups = isGrouped ? groups : ['All'];
            
            iterGroups.forEach((g, groupIndex) => {
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
                const useDataColoring = !isGrouped && type === 'bar';
                const finalData = isDiverging ? data.map(v => v * (groupIndex % 2 === 0 ? 1 : -1)) : data;
                series.push({
                    name: isGrouped ? g : config.yAxis || 'Count',
                    type: type,
                    stack: stack,
                    areaStyle: areaStyle,
                    data: finalData,
                    colorBy: useDataColoring ? 'data' : 'series',
                    itemStyle: type === 'bar' ? { borderRadius: 3 } : undefined
                });
            });

            const is100Stacked = chartType.includes('100-stacked');
            
            // X and Y Axis setup
            let finalXAxis = { type: 'category', data: xValues, ...axisConfig };
            let finalYAxis = { type: 'value', ...axisConfig };

            if (isHorizontal) {
                finalXAxis = { type: 'value', ...axisConfig };
                finalYAxis = { type: 'category', data: xValues, ...axisConfig };
            }

            if (isHorizontal) {
                finalXAxis.axisLabel = { ...finalXAxis.axisLabel, rotate: 0 };
                finalYAxis.axisLabel = { ...finalYAxis.axisLabel, rotate: 0 };
            }
            
            // Inject Custom Labels if not default
            if (config.customXLabel) finalXAxis.name = config.customXLabel;
            if (config.customYLabel) finalYAxis.name = config.customYLabel;
            // Axis Name Location
            finalXAxis.nameLocation = 'middle';
            finalXAxis.nameGap = axisTitleGap;
            finalYAxis.nameLocation = 'middle';
            finalYAxis.nameGap = isHorizontal ? axisTitleGap : axisTitleGap + 10;

            return {
                color: finalPalette,
                ...animation,
                tooltip: { 
                    trigger: 'axis', 
                    axisPointer: { type: 'shadow' },
                    valueFormatter: (value) => is100Stacked ? value.toFixed(1) + '%' : value
                },
                legend: { data: isGrouped ? groups : [], textStyle: legendTextStyle, top: hasCustomTitle ? 60 : 20 },
                grid: { left: '3%', right: '4%', bottom: '10%', top: hasCustomTitle ? 100 : 60, containLabel: true, borderColor: gridColor },
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
        this.yAxisManuallySet = false;
        this.initEventListeners();
    }
    initEventListeners() {
        const fileInput = document.getElementById('file-upload');
        const fileInfo = document.getElementById('file-name-display');

        this.initializeCollapsibles();

        this.viz.colorManager.onPaletteChange(() => this.updateVisualization());
        
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    fileInfo.textContent = 'Loading...';
                    await this.dm.loadFile(file);
                    this.onDataReady(file.name);

                } catch (err) {
                    alert(`Error: ${err.message}`);
                }
            }
        });
        
        const updateViz = () => this.updateVisualization();

        document.getElementById('x-axis-select').addEventListener('change', updateViz);
        document.getElementById('y-axis-select').addEventListener('change', () => {
            this.yAxisManuallySet = true;
            updateViz();
        });
        const multiAxisSelect = document.getElementById('multi-axis-select');
        if (multiAxisSelect) {
            multiAxisSelect.addEventListener('change', () => {
                if (multiAxisSelect.selectedOptions.length > 6) {
                    alert('You can compare up to 6 variables at a time. Showing the first 6 selected.');
                }
                updateViz();
            });
        }
        document.getElementById('group-by-select').addEventListener('change', updateViz);
        document.getElementById('split-values').addEventListener('change', updateViz);
        document.getElementById('strict-mode').addEventListener('change', updateViz);
        document.getElementById('hide-self-comparison').addEventListener('change', updateViz);
        
        // Label Inputs Triggers
        ['custom-title', 'custom-subtitle', 'custom-xlabel', 'custom-ylabel', 'title-font-size', 'subtitle-font-size', 'title-left', 'title-offset-y', 'axis-title-font-size', 'axis-label-font-size', 'axis-title-gap', 'axis-label-margin', 'pie-label-font-size'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateViz);
        });

        document.querySelectorAll('.chart-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('btn-active'));
                e.target.classList.add('btn-active');
                this.updateVisualization();
            });
        });

        document.getElementById('btn-reset-visualizer').addEventListener('click', () => this.resetVisualizer());

        document.getElementById('btn-demo-bar').addEventListener('click', () => this.applyDemoPreset('bar'));
        document.getElementById('btn-demo-heatmap').addEventListener('click', () => this.applyDemoPreset('heatmap'));
        
        // Codebook Triggers
        document.getElementById('btn-codebook-trigger').addEventListener('click', () => {
             this.cbm.open(this.dm.headers);
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

    initializeCollapsibles() {
        document.querySelectorAll('.section-toggle').forEach(toggle => {
            const targetId = toggle.dataset.target;
            const target = document.getElementById(targetId);
            const icon = toggle.querySelector('svg');
            if (!target) return;

            const setState = (expanded) => {
                toggle.setAttribute('aria-expanded', expanded);
                target.classList.toggle('hidden', !expanded);
                if (icon) icon.classList.toggle('-rotate-90', !expanded);
            };

            const initialExpanded = toggle.getAttribute('aria-expanded') !== 'false';
            setState(initialExpanded);

            toggle.addEventListener('click', () => {
                const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
                setState(!isExpanded);
            });
        });
    }

    resetVisualizer() {
        ['x-axis-select', 'y-axis-select', 'group-by-select', 'multi-axis-select'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
            if (el && el.multiple) {
                Array.from(el.options).forEach(opt => opt.selected = false);
            }
        });

        this.yAxisManuallySet = false;

        document.getElementById('split-values').checked = false;
        document.getElementById('strict-mode').checked = false;
        document.getElementById('hide-self-comparison').checked = true;

        ['custom-title', 'custom-subtitle', 'custom-xlabel', 'custom-ylabel'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });

        const numericDefaults = {
            'title-font-size': 18,
            'subtitle-font-size': 14,
            'title-offset-y': 0,
            'axis-title-font-size': 14,
            'axis-label-font-size': 13,
            'axis-title-gap': 30,
            'axis-label-margin': 8,
            'pie-label-font-size': 13
        };
        Object.entries(numericDefaults).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input) input.value = value;
        });
        const titleLeft = document.getElementById('title-left');
        if (titleLeft) titleLeft.value = 'center';

        document.querySelectorAll('.chart-type-btn').forEach(btn => btn.classList.remove('btn-active'));
        const defaultChart = document.querySelector('.chart-type-btn[data-type="bar"]');
        if (defaultChart) defaultChart.classList.add('btn-active');

        const themeSelect = document.getElementById('color-theme-select');
        if (themeSelect) {
            themeSelect.value = 'aurora';
            this.viz.colorManager.setTheme('aurora');
            this.viz.colorManager.notifyPaletteChange();
        }

        this.viz.colorManager.customColors = [];
        localStorage.removeItem('customColors');
        this.viz.colorManager.applyThemeToInputs();

        const chartDom = document.getElementById('main-chart');
        if (this.viz.chartInstance) {
            this.viz.chartInstance.dispose();
            this.viz.chartInstance = null;
        }
        if (chartDom) chartDom.innerHTML = '';
        const titleEl = document.getElementById('chart-title');
        if (titleEl) titleEl.textContent = '';

        const viewVizBtn = document.getElementById('view-mode-viz');
        if (viewVizBtn) viewVizBtn.click();

        this.updateVisualization();
    }

    onDataReady(label = 'Data') {
        this.yAxisManuallySet = false;
        document.getElementById('file-name-display').textContent = label;
        document.getElementById('row-count-display').textContent = `${this.dm.rawData.length} rows`;
        document.getElementById('data-summary').classList.remove('hidden');

        this.populateColumnSelects();
        this.ensureDefaultAxes();
        this.fe.generateFilters();
        this.cbm.refreshColumns(this.dm.headers);
        this.updateFilterCount();

        this.viz.renderDashboard(
            this.dm.filteredData,
            this.dm.headers,
            'dashboard-grid',
            (col) => this.vm.showInspector({ xAxis: col })
        );
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
        const selects = ['x-axis-select', 'y-axis-select', 'group-by-select', 'map-column-select', 'multi-axis-select'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            const currentVal = el.multiple ? Array.from(el.selectedOptions).map(opt => opt.value) : el.value;
            const keepFirst = 1;
            while (el.options.length > keepFirst) el.remove(keepFirst);
            headers.forEach(h => {
                const option = document.createElement('option');
                option.value = h;
                option.text = h;
                el.add(option);
            });
            if (el.multiple) {
                Array.from(el.options).forEach(opt => {
                    if (currentVal && Array.isArray(currentVal) && currentVal.includes(opt.value)) {
                        opt.selected = true;
                    }
                });
            } else if (headers.includes(currentVal)) el.value = currentVal;
        });
    }

    ensureDefaultAxes() {
        const headers = this.dm.headers.filter(h => h !== '_id');
        const [first, second] = headers;
        const xSelect = document.getElementById('x-axis-select');
        const ySelect = document.getElementById('y-axis-select');
        const groupSelect = document.getElementById('group-by-select');

        if (xSelect && (!xSelect.value || !headers.includes(xSelect.value))) {
            xSelect.value = first || '';
        }
        if (ySelect) {
            const hasValidYAxis = headers.includes(ySelect.value);
            if ((!ySelect.value || !hasValidYAxis) && !this.yAxisManuallySet) {
                ySelect.value = second || '';
            } else if (ySelect.value && !hasValidYAxis) {
                ySelect.value = '';
            }
        }
        if (groupSelect && groupSelect.value && !headers.includes(groupSelect.value)) {
            groupSelect.value = '';
        }
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
        this.ensureDefaultAxes();
        const getNumber = (id, fallback) => {
            const raw = document.getElementById(id)?.value;
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? parsed : fallback;
        };
        const activeChartBtn = document.querySelector('.chart-type-btn.btn-active');
        const multiAxisSelect = document.getElementById('multi-axis-select');
        const selectedMulti = multiAxisSelect ? Array.from(multiAxisSelect.selectedOptions).map(opt => opt.value).filter(Boolean).slice(0, 6) : [];
        const config = {
            xAxis: document.getElementById('x-axis-select').value,
            yAxis: document.getElementById('y-axis-select').value,
            groupBy: document.getElementById('group-by-select').value,
            splitValues: document.getElementById('split-values').checked,
            strictMode: document.getElementById('strict-mode').checked,
            chartType: activeChartBtn ? activeChartBtn.dataset.type : 'bar',
            multiAxisVariables: selectedMulti,

            // Custom Labels
            customTitle: document.getElementById('custom-title').value,
            customSubtitle: document.getElementById('custom-subtitle').value,
            customXLabel: document.getElementById('custom-xlabel').value,
            customYLabel: document.getElementById('custom-ylabel').value,
            titleFontSize: getNumber('title-font-size', 18),
            subtitleFontSize: getNumber('subtitle-font-size', 14),
            titleTopOffset: getNumber('title-offset-y', 0),
            titleLeft: document.getElementById('title-left').value || 'center',
            axisTitleFontSize: getNumber('axis-title-font-size', 14),
            axisLabelFontSize: getNumber('axis-label-font-size', 13),
            axisTitleGap: getNumber('axis-title-gap', 30),
            axisLabelMargin: getNumber('axis-label-margin', 8),
            pieLabelFontSize: getNumber('pie-label-font-size', 13)
        };
        if (config.xAxis || config.multiAxisVariables.length) {
            this.viz.render(this.dm.filteredData, config);
        }
    }

    applyDemoPreset(type) {
        if (!this.dm.headers.length) return;
        const usable = this.dm.headers.filter(h => h !== '_id');
        const [first, second, third] = usable;
        document.getElementById('x-axis-select').value = first || '';
        document.getElementById('y-axis-select').value = second || '';
        document.getElementById('group-by-select').value = third || '';

        const setChartType = (t) => {
            const target = document.querySelector(`.chart-type-btn[data-type="${t}"]`);
            if (target) {
                document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('btn-active'));
                target.classList.add('btn-active');
            }
        };

        const themeSelect = document.getElementById('color-theme-select');
        if (themeSelect) {
            themeSelect.value = type === 'heatmap' ? 'canyon' : 'seashore';
            themeSelect.dispatchEvent(new Event('change'));
        }

        if (type === 'bar') {
            setChartType('bar');
            document.getElementById('custom-title').value = 'Sample Bar Chart';
            document.getElementById('custom-subtitle').value = 'Auto-filled demo showcasing labels and export';
            document.getElementById('custom-xlabel').value = first || 'Category';
            document.getElementById('custom-ylabel').value = second ? `Value of ${second}` : 'Count';
        } else {
            setChartType('heatmap');
            document.getElementById('custom-title').value = 'Sample Heatmap';
            document.getElementById('custom-subtitle').value = 'Demographic × Response view';
            document.getElementById('custom-xlabel').value = first || 'Category';
            document.getElementById('custom-ylabel').value = second || 'Group';
        }

        this.updateVisualization();
    }
    
    updateFilterCount() {
        const total = this.dm.processedData.length;
        const filtered = this.dm.filteredData.length;
        const display = document.getElementById('filter-count-display');
        display.textContent = `Showing ${filtered} of ${total} respondents`;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const colorManager = new ColorManager();
    const statsEngine = new StatisticsEngine();
    const dataManager = new DataManager();
    const filterEngine = new FilterEngine(dataManager);
    const codebookManager = new CodebookManager(dataManager);
    const viewManager = new ViewManager(null);
    const visualizer = new Visualizer(colorManager, statsEngine, dataManager);

    um = new UIManager(dataManager, visualizer, filterEngine, codebookManager, viewManager);
    viewManager.um = um;

    filterEngine.setOnChange(() => {
        um.updateVisualization();
        um.updateFilterCount();
    });

    dataManager.subscribe(() => {
        filterEngine.refreshFilterOptions();
        um.updateFilterCount();
    });

    const loadDefaultData = async () => {
        try {
            const resp = await fetch('detailed_survey_data.json');
            if (!resp.ok) return;

            const json = await resp.json();
            dataManager.rawData = json.raw_data || json;
            if (dataManager.rawData.length > 0) {
                dataManager.headers = Object.keys(dataManager.rawData[0]);
                dataManager.processData();
                um.onDataReady('detailed_survey_data.json');
            }
        } catch (err) {
            console.warn('Default data load skipped', err);
        }
    };

    await loadDefaultData();
});
