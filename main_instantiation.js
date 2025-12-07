
// Instantiation
const cm = new ColorManager();
const dm = new DataManager();
const stats = new StatisticsEngine();
const viz = new Visualizer(cm, stats, dm);
const fe = new FilterEngine(dm);
const cbm = new CodebookManager(dm);
const um = new UIManager(dm, viz, fe, cbm, null); 
const vm = new ViewManager(um);
um.vm = vm; 

// Initialize View State
vm.showDashboard();

dm.subscribe(() => {
    um.updateFilterCount();
    if(vm.isDashboard) {
        viz.renderDashboard(dm.filteredData, dm.headers, 'dashboard-grid', (col) => vm.showInspector({xAxis: col}));
    } else {
        um.updateVisualization();
        um.renderDataTable();
    }
});

// Drill-Down Handler
window.handleChartClick = (ids, label, group) => {
    const panel = document.getElementById('respondent-panel');
    const list = document.getElementById('respondent-list');
    const count = document.getElementById('inspector-count');
    list.innerHTML = '';
    count.textContent = ids.length;
    const displayIds = ids.slice(0, 100); 
    displayIds.forEach(id => {
        const btn = document.createElement('button');
        btn.className = 'px-2 py-1 text-[10px] bg-gray-100 dark:bg-gray-800 hover:bg-blue-100 dark:hover:bg-blue-900 rounded text-left truncate border border-gray-200 dark:border-gray-700';
        btn.textContent = `#${id}`; 
        btn.onclick = () => showRespondentModal(id);
        list.appendChild(btn);
    });
    if (ids.length > 100) {
        const more = document.createElement('div');
        more.className = 'text-[10px] text-gray-400 p-1';
        more.textContent = `+ ${ids.length - 100} more...`;
        list.appendChild(more);
    }
    panel.classList.remove('translate-y-full');
};

document.getElementById('close-panel').addEventListener('click', () => {
    document.getElementById('respondent-panel').classList.add('translate-y-full');
});

function showRespondentModal(rowId) {
    const row = dm.rawData.find(r => r._id === rowId); 
    const processedRow = dm.processedData.find(r => r._id === rowId);
    const modal = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    let html = '<div class="grid grid-cols-2 gap-4">';
    Object.entries(processedRow).forEach(([key, val]) => {
        if (key === '_id') return;
        html += `
            <div class="border-b dark:border-gray-700 pb-2">
                <div class="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">${key}</div>
                <div class="text-sm dark:text-gray-200">${val}</div>
            </div>
        `;
    });
    html += '</div>';
    content.innerHTML = html;
    modal.classList.remove('hidden');
}

document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
});
