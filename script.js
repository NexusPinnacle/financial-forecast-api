const API_URL = '/api/forecast'; 
const EXPORT_API_URL = '/api/export'; 

const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const errorMessage = document.getElementById('error-message');
const annualButtons = document.querySelectorAll('.year-select-btn');
const monthlyDetailSelect = document.getElementById('monthly_detail_select');

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

let revenueChart = null;
let cashDebtChart = null;
let revenueStreams = []; 
let cogsStreams = []; 
let opexStreams = []; 
let currentYears = 5;

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => { updateGranularInputs(); });

annualButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        annualButtons.forEach(b => b.classList.remove('selected-year-btn'));
        btn.classList.add('selected-year-btn');
        currentYears = parseInt(btn.dataset.value);
        updateGranularInputs();
        refreshAllBuilders();
    });
});

function refreshAllBuilders() {
    refreshRevenueBuilder();
    refreshCogsBuilder();
    refreshOpExBuilder();
}

function updateGranularInputs() {
    for (const key in granularContainers) {
        const container = granularContainers[key];
        const currentVals = Array.from(container.querySelectorAll('input')).map(i => i.value);
        container.innerHTML = '';
        for (let i = 1; i <= currentYears; i++) {
            const val = currentVals[i-1] || '0';
            container.innerHTML += `<div class="granular-item"><span>Y${i}</span><input type="number" step="any" name="${key}_rates" value="${val}"></div>`;
        }
    }
}

// --- BUILDER LOGIC ---
function addStream(type) {
    let name, val, values;
    if (type === 'revenue') {
        name = document.getElementById('new_stream_name').value || 'Revenue Stream';
        const units = parseFloat(document.getElementById('new_stream_units').value) || 0;
        const price = parseFloat(document.getElementById('new_stream_price').value) || 0;
        val = units * price;
        values = new Array(currentYears * 12).fill(val);
        revenueStreams.push({ id: Date.now(), name, values });
        refreshRevenueBuilder();
    } else if (type === 'cogs') {
        name = document.getElementById('new_cogs_name').value || 'Direct Cost';
        val = parseFloat(document.getElementById('new_cogs_val').value) || 0;
        values = new Array(currentYears * 12).fill(val);
        cogsStreams.push({ id: Date.now(), name, values });
        refreshCogsBuilder();
    } else {
        name = document.getElementById('new_opex_name').value || 'OpEx Line';
        val = parseFloat(document.getElementById('new_opex_val').value) || 0;
        values = new Array(currentYears * 12).fill(val);
        opexStreams.push({ id: Date.now(), name, values });
        refreshOpExBuilder();
    }
}

document.getElementById('addStreamBtn').onclick = () => addStream('revenue');
document.getElementById('addExtraCogsBtn').onclick = () => addStream('cogs');
document.getElementById('addOpExBtn').onclick = () => addStream('opex');

function renderStreamContainer(containerId, streams, type, removeFnName, updateTotalsFn) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    streams.forEach(stream => {
        let matrixHtml = '';
        for (let m = 0; m < 12; m++) {
            matrixHtml += `<div class="matrix-cell"><label>M${m+1}</label><input type="number" class="matrix-val-input" data-type="${type}" data-stream-id="${stream.id}" data-month="${m}" value="${stream.values[m]}"></div>`;
        }
        container.innerHTML += `
            <div class="stream-card ${type}-card">
                <div class="stream-header"><h4>${stream.name}</h4><button type="button" class="remove-btn" onclick="${removeFnName}(${stream.id})">Remove</button></div>
                <div class="matrix-grid">${matrixHtml}</div>
            </div>`;
    });
    
    container.querySelectorAll('.matrix-val-input').forEach(input => {
        input.oninput = (e) => {
            const sId = parseInt(e.target.dataset.streamId);
            const m = parseInt(e.target.dataset.month);
            const val = parseFloat(e.target.value) || 0;
            const list = type === 'revenue' ? revenueStreams : (type === 'cogs' ? cogsStreams : opexStreams);
            const s = list.find(x => x.id === sId);
            if (s) { for (let i = m; i < s.values.length; i++) s.values[i] = val; updateTotalsFn(); }
        };
    });
    updateTotalsFn();
}

function refreshRevenueBuilder() { renderStreamContainer('revenue-streams-container', revenueStreams, 'revenue', 'removeRev', updateRevenueTotals); }
function refreshCogsBuilder() { renderStreamContainer('cogs-streams-container', cogsStreams, 'cogs', 'removeCogs', updateCogsTotals); }
function refreshOpExBuilder() { renderStreamContainer('opex-streams-container', opexStreams, 'opex', 'removeOpex', updateOpExTotals); }

window.removeRev = (id) => { revenueStreams = revenueStreams.filter(s => s.id !== id); refreshRevenueBuilder(); };
window.removeCogs = (id) => { cogsStreams = cogsStreams.filter(s => s.id !== id); refreshCogsBuilder(); };
window.removeOpex = (id) => { opexStreams = opexStreams.filter(s => s.id !== id); refreshOpExBuilder(); };

function updateRevenueTotals() { calculatePreview(revenueStreams, 'revenue-total-preview', 'Revenue'); }
function updateCogsTotals() { calculatePreview(cogsStreams, 'cogs-total-preview', 'COGS'); }
function updateOpExTotals() { calculatePreview(opexStreams, 'opex-total-preview', 'OpEx'); }

function calculatePreview(streams, elId, label) {
    const totals = new Array(currentYears).fill(0);
    streams.forEach(s => { for (let y = 0; y < currentYears; y++) totals[y] += s.values.slice(y*12, (y+1)*12).reduce((a,b)=>a+b, 0); });
    let html = `<strong>Annual ${label}:</strong> `;
    totals.forEach((t, i) => html += `<span class="preview-tag">Y${i+1}: $${t.toLocaleString()}</span> `);
    document.getElementById(elId).innerHTML = html;
}

// --- RESULTS RENDERING ---
function renderResults(results) {
    resultsContainer.style.display = 'block';
    const labels = results.Display_Labels;
    const d = results.display_data;

    const buildTable = (tableId, rows) => {
        const table = document.getElementById(tableId);
        let head = `<tr><th>Financial Item</th>${labels.map(l => `<th>${l}</th>`).join('')}</tr>`;
        let body = rows.map(r => `
            <tr class="${r.isTotal ? 'total-row' : (r.isSub ? 'sub-item' : '')}">
                <td>${r.name}</td>
                ${r.values.map(v => `<td>${v.toLocaleString(undefined, {maximumFractionDigits:0})}</td>`).join('')}
            </tr>`).join('');
        table.querySelector('thead').innerHTML = head;
        table.querySelector('tbody').innerHTML = body;
    };

    buildTable('incomeStatementTable', [
        { name: 'Total Revenue', values: d.Revenue, isTotal: true },
        ...d.Stream_Rows.filter(s => s.type === 'Revenue').map(s => ({ name: `&nbsp;&nbsp;${s.name}`, values: s.values, isSub: true })),
        { name: 'Total COGS', values: d.COGS, isTotal: true },
        ...d.Stream_Rows.filter(s => s.type === 'COGS').map(s => ({ name: `&nbsp;&nbsp;${s.name}`, values: s.values, isSub: true })),
        { name: 'Gross Profit', values: d['Gross Profit'], isTotal: true },
        { name: 'Operating Expenses', values: d['Fixed Opex'], isTotal: true },
        ...d.Stream_Rows.filter(s => s.type === 'OpEx').map(s => ({ name: `&nbsp;&nbsp;${s.name}`, values: s.values, isSub: true })),
        { name: 'EBIT', values: d.EBIT, isTotal: true },
        { name: 'Net Income', values: d['Net Income'], isTotal: true }
    ]);

    buildTable('balanceSheetTable', [
        { name: 'Cash', values: d.Cash },
        { name: 'Accounts Receivable', values: d.AR },
        { name: 'Inventory', values: d.Inventory },
        { name: 'Net PP&E', values: d.PPE },
        { name: 'Total Assets', values: d['Total Assets'], isTotal: true },
        { name: 'Accounts Payable', values: d.AP },
        { name: 'Long Term Debt', values: d.Debt },
        { name: 'Retained Earnings', values: d.RE },
        { name: 'Total Liabilities & Equity', values: d['Total LiabEq'], isTotal: true }
    ]);

    renderCharts(labels, d);
}

function renderCharts(labels, d) {
    if (revenueChart) revenueChart.destroy();
    const ctx = document.getElementById('revenueKpiChart').getContext('2d');
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ label: 'Revenue', data: d.Revenue, borderColor: '#3b84f5' }, { label: 'Net Income', data: d['Net Income'], borderColor: '#10b981' }] }
    });
}

form.onsubmit = async (e) => {
    e.preventDefault();
    const data = {
        years: currentYears,
        monthly_detail: parseInt(monthlyDetailSelect.value),
        revenue_streams: revenueStreams,
        cogs_streams: cogsStreams,
        opex_streams: opexStreams
    };
    new FormData(form).forEach((v, k) => {
        if (k.endsWith('_rates')) {
            const ck = k.replace('_rates', '');
            if (!data[ck]) data[ck] = [];
            data[ck].push(parseFloat(v) || 0);
        } else data[k] = v;
    });
    const resp = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    renderResults(await resp.json());
};

window.openTab = (e, n) => {
    document.querySelectorAll(".tab-content, .tab-btn").forEach(x => x.classList.remove("active"));
    document.getElementById(n).classList.add("active");
    e.currentTarget.classList.add("active");
};
