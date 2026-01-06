const API_URL = '/api/forecast'; 
const EXPORT_API_URL = '/api/export'; 

const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const errorMessage = document.getElementById('error-message');

const annualButtons = document.querySelectorAll('.year-select-btn');
const monthlyDetailSelect = document.getElementById('monthly_detail_select');

// Granular Containers for standard assumptions
const granularContainers = {
    revenue_growth: document.getElementById('revenue-growth-container'),
    cogs_pct: document.getElementById('cogs-pct-container'),
    fixed_opex: document.getElementById('fixed-opex-container'),
    capex: document.getElementById('capex-container'),
    dso_days: document.getElementById('dso-days-container'),
    dio_days: document.getElementById('dio-days-container'),
    dpo_days: document.getElementById('dpo-days-container'),
    debt_repayment: document.getElementById('debt-repayment-container')
};

// State Management
let revenueChart = null;
let cashDebtChart = null;
let revenueStreams = []; 
let cogsStreams = []; 
let opexStreams = []; 
let currentYears = 5;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    updateGranularInputs();
});

annualButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        annualButtons.forEach(b => b.classList.remove('selected-year-btn'));
        btn.classList.add('selected-year-btn');
        currentYears = parseInt(btn.dataset.value);
        updateGranularInputs();
        refreshRevenueBuilder();
        refreshCogsBuilder();
        refreshOpExBuilder();
    });
});

function updateGranularInputs() {
    for (const key in granularContainers) {
        const container = granularContainers[key];
        const currentVals = Array.from(container.querySelectorAll('input')).map(i => i.value);
        container.innerHTML = '';
        for (let i = 1; i <= currentYears; i++) {
            const val = currentVals[i-1] || '0';
            const div = document.createElement('div');
            div.className = 'granular-item';
            div.innerHTML = `<span>Y${i}</span><input type="number" step="any" name="${key}_rates" value="${val}">`;
            container.appendChild(div);
        }
    }
}

// --- BUILDER LOGIC (REVENUE, COGS, OPEX) ---

// REVENUE
document.getElementById('addStreamBtn').addEventListener('click', () => {
    const name = document.getElementById('new_stream_name').value || 'New Revenue Stream';
    const units = parseFloat(document.getElementById('new_stream_units').value) || 0;
    const price = parseFloat(document.getElementById('new_stream_price').value) || 0;
    const monthlyVal = units * price;
    const values = new Array(currentYears * 12).fill(monthlyVal);
    revenueStreams.push({ id: Date.now(), name, values });
    refreshRevenueBuilder();
});

function refreshRevenueBuilder() {
    renderStreamContainer('revenue-streams-container', revenueStreams, 'revenue', 'removeRevenueStream', updateRevenueTotals);
}

window.removeRevenueStream = function(id) {
    revenueStreams = revenueStreams.filter(s => s.id !== id);
    refreshRevenueBuilder();
};

// COGS (Task 1)
document.getElementById('addExtraCogsBtn').addEventListener('click', () => {
    const name = document.getElementById('new_cogs_name').value || 'Direct Cost';
    const val = parseFloat(document.getElementById('new_cogs_val').value) || 0;
    const values = new Array(currentYears * 12).fill(val);
    cogsStreams.push({ id: Date.now(), name, values });
    refreshCogsBuilder();
});

function refreshCogsBuilder() {
    renderStreamContainer('cogs-streams-container', cogsStreams, 'cogs', 'removeCogsStream', updateCogsTotals);
}

window.removeCogsStream = function(id) {
    cogsStreams = cogsStreams.filter(s => s.id !== id);
    refreshCogsBuilder();
};

// OPEX (Task 2)
document.getElementById('addOpExBtn').addEventListener('click', () => {
    const name = document.getElementById('new_opex_name').value || 'Operating Exp';
    const val = parseFloat(document.getElementById('new_opex_val').value) || 0;
    const values = new Array(currentYears * 12).fill(val);
    opexStreams.push({ id: Date.now(), name, values });
    refreshOpExBuilder();
});

function refreshOpExBuilder() {
    renderStreamContainer('opex-streams-container', opexStreams, 'opex', 'removeOpExStream', updateOpExTotals);
}

window.removeOpExStream = function(id) {
    opexStreams = opexStreams.filter(s => s.id !== id);
    refreshOpExBuilder();
};

// GENERIC RENDERER
function renderStreamContainer(containerId, streams, type, removeFnName, updateTotalsFn) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    streams.forEach(stream => {
        const card = document.createElement('div');
        card.className = `stream-card ${type}-card`;
        let matrixHtml = '';
        for (let m = 0; m < 12; m++) {
            matrixHtml += `
                <div class="matrix-cell">
                    <label>M${m+1}</label>
                    <input type="number" class="stream-input" data-type="${type}" data-stream-id="${stream.id}" data-month="${m}" value="${stream.values[m]}">
                </div>`;
        }
        card.innerHTML = `
            <div class="stream-header">
                <h4>${stream.name}</h4>
                <button type="button" class="remove-btn" onclick="${removeFnName}(${stream.id})">Remove</button>
            </div>
            <div class="matrix-grid">${matrixHtml}</div>
        `;
        container.appendChild(card);
    });

    container.querySelectorAll('.stream-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const sId = parseInt(e.target.dataset.streamId);
            const month = parseInt(e.target.dataset.month);
            const val = parseFloat(e.target.value) || 0;
            const streamList = type === 'revenue' ? revenueStreams : (type === 'cogs' ? cogsStreams : opexStreams);
            const stream = streamList.find(s => s.id === sId);
            if (stream) {
                for (let i = month; i < stream.values.length; i++) stream.values[i] = val;
                updateTotalsFn();
            }
        });
    });
    updateTotalsFn();
}

function updateRevenueTotals() { calculateAnnualPreview(revenueStreams, 'revenue-total-preview', 'Annual Revenue'); }
function updateCogsTotals() { calculateAnnualPreview(cogsStreams, 'cogs-total-preview', 'Annual Extra COGS'); }
function updateOpExTotals() { calculateAnnualPreview(opexStreams, 'opex-total-preview', 'Annual OpEx Total'); }

function calculateAnnualPreview(streams, elementId, label) {
    const totals = new Array(currentYears).fill(0);
    streams.forEach(s => {
        for (let y = 0; y < currentYears; y++) {
            totals[y] += s.values.slice(y * 12, (y + 1) * 12).reduce((a, b) => a + b, 0);
        }
    });
    let html = `<strong>${label} Preview:</strong> `;
    totals.forEach((t, i) => { html += `<span class="preview-tag">Y${i+1}: $${t.toLocaleString()}</span> `; });
    document.getElementById(elementId).innerHTML = html;
}

// --- DATA COLLECTION & API ---
function collectInputData() {
    const formData = new FormData(form);
    const data = {
        years: currentYears,
        monthly_detail: parseInt(monthlyDetailSelect.value),
        revenue_streams: revenueStreams,
        cogs_streams: cogsStreams,
        opex_streams: opexStreams
    };
    formData.forEach((value, key) => {
        const cleanKey = key.replace('_rates', '');
        if (key.endsWith('_rates')) {
            if (!data[cleanKey]) data[cleanKey] = [];
            data[cleanKey].push(parseFloat(value) || 0);
        } else {
            data[key] = value;
        }
    });
    return data;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.style.display = 'none';
    const data = collectInputData();
    try {
        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await resp.json();
        if (result.error) throw new Error(result.error);
        renderResults(result);
    } catch (err) {
        errorMessage.innerText = err.message;
        errorMessage.style.display = 'block';
    }
});

// --- RENDERING RESULTS (TABLES & CHARTS) ---
function renderResults(results) {
    resultsContainer.style.display = 'block';
    const labels = results.Display_Labels;
    const d = results.display_data;

    const buildTable = (tableId, rows) => {
        const table = document.getElementById(tableId);
        let head = `<tr><th>Financial Item</th>${labels.map(l => `<th>${l}</th>`).join('')}</tr>`;
        let body = '';
        rows.forEach(r => {
            const isTotal = r.isTotal ? 'total-row' : '';
            const isSub = r.isSub ? 'sub-item' : '';
            body += `<tr class="${isTotal} ${isSub}">
                <td>${r.name}</td>
                ${r.values.map(v => `<td>${v.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}</td>`).join('')}
            </tr>`;
        });
        table.querySelector('thead').innerHTML = head;
        table.querySelector('tbody').innerHTML = body;
    };

    // 1. Income Statement
    let isRows = [
        { name: 'Total Revenue', values: d.Revenue, isTotal: true },
        ...d.Stream_Rows.filter(s => s.type === 'Revenue').map(s => ({ name: `+ ${s.name}`, values: s.values, isSub: true })),
        { name: 'Total COGS', values: d.COGS, isTotal: true },
        ...d.Stream_Rows.filter(s => s.type === 'COGS').map(s => ({ name: `- ${s.name}`, values: s.values, isSub: true })),
        { name: 'Gross Profit', values: d['Gross Profit'], isTotal: true },
        { name: 'Operating Expenses', values: d['Fixed Opex'], isTotal: true },
        ...d.Stream_Rows.filter(s => s.type === 'OpEx').map(s => ({ name: `- ${s.name}`, values: s.values, isSub: true })),
        { name: 'EBITDA / EBIT', values: d.EBIT, isTotal: true },
        { name: 'Net Income', values: d['Net Income'], isTotal: true }
    ];
    buildTable('incomeStatementTable', isRows);

    // 2. Balance Sheet
    let bsRows = [
        { name: 'Cash', values: d.Cash },
        { name: 'Accounts Receivable', values: d.AR },
        { name: 'Inventory', values: d.Inventory },
        { name: 'PP&E', values: d.PPE },
        { name: 'Total Assets', values: d['Total Assets'], isTotal: true },
        { name: 'Accounts Payable', values: d.AP },
        { name: 'Debt', values: d.Debt },
        { name: 'Retained Earnings', values: d.RE },
        { name: 'Total Liab & Equity', values: d['Total LiabEq'], isTotal: true }
    ];
    buildTable('balanceSheetTable', bsRows);

    // 3. Cash Flow
    let cfRows = [
        { name: 'Net Income', values: d.CF_NI },
        { name: 'Depreciation (Non-Cash)', values: d.CF_Dep },
        { name: 'Change in NWC', values: d.CF_NWC },
        { name: 'Cash Flow from Operations', values: d.CFO, isTotal: true },
        { name: 'Cash Flow from Investing', values: d.CFI },
        { name: 'Cash Flow from Financing', values: d.CFF },
        { name: 'Net Change in Cash', values: d['Net Cash Change'], isTotal: true }
    ];
    buildTable('cashFlowTable', cfRows);

    renderCharts(labels, d);
}

function renderCharts(labels, d) {
    if (revenueChart) revenueChart.destroy();
    if (cashDebtChart) cashDebtChart.destroy();

    const ctx1 = document.getElementById('revenueKpiChart').getContext('2d');
    revenueChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Revenue', data: d.Revenue, borderColor: '#3b84f5', fill: false },
                { label: 'Net Income', data: d['Net Income'], borderColor: '#10b981', fill: false }
            ]
        }
    });

    const ctx2 = document.getElementById('cashDebtChart').getContext('2d');
    cashDebtChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'Cash Balance', data: d.Cash, backgroundColor: 'rgba(59, 132, 245, 0.5)' },
                { label: 'Total Debt', data: d.Debt, backgroundColor: 'rgba(239, 68, 68, 0.5)' }
            ]
        }
    });
}

// UI Tabs
window.openTab = function(evt, tabName) {
    document.querySelectorAll(".tab-content").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(tabName).classList.add("active");
    evt.currentTarget.classList.add("active");
};

// Export
document.getElementById('exportBtn').addEventListener('click', async () => {
    const data = collectInputData();
    const resp = await fetch(EXPORT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "financial_forecast.xlsx";
    a.click();
});
