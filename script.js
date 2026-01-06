const API_URL = '/api/forecast'; 
const EXPORT_API_URL = '/api/export'; 

const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const errorMessage = document.getElementById('error-message');
const forecastYearsInput = document.getElementById('forecast_years');

let revenueStreams = []; 
let extraCogs = [];
let opexStreams = [];

// --- REVENUE BUILDER ---
document.getElementById('addStreamBtn').addEventListener('click', () => {
    const name = document.getElementById('new_stream_name').value || 'Stream ' + (revenueStreams.length + 1);
    const price = parseFloat(document.getElementById('new_stream_price').value) || 0;
    const qty = parseFloat(document.getElementById('new_stream_qty').value) || 0;
    const growth = parseFloat(document.getElementById('new_stream_growth').value) || 0;
    const id = Date.now();
    const months = parseInt(forecastYearsInput.value) * 12;

    const streamObj = { id, name, price, qty, growth, months };
    revenueStreams.push(streamObj);
    renderRevenueStream(streamObj);
    updateTotalRevenuePreview();
    refreshCogsBuilder();
});

function renderRevenueStream(stream) {
    const container = document.getElementById('revenue-streams-list');
    const div = document.createElement('div');
    div.className = 'stream-card';
    div.id = `stream-${stream.id}`;

    const monthlyVals = [];
    const annualGrowthFactor = 1 + (stream.growth / 100);
    let currentYearlyRevenue = (stream.price * stream.qty); 

    for(let i=0; i < stream.months; i++) {
        if (i > 0 && i % 12 === 0) currentYearlyRevenue *= annualGrowthFactor;
        monthlyVals.push(currentYearlyRevenue / 12);
    }

    let html = `<div class="stream-header"><h4>${stream.name}</h4><button type="button" class="remove-stream-btn" onclick="removeStream(${stream.id})">Remove</button></div><div class="matrix-scroll-wrapper">`;
    monthlyVals.forEach((val, i) => {
        html += `<div class="matrix-cell"><label>M${i+1}</label><input type="number" class="stream-val-input" data-stream="${stream.id}" value="${val.toFixed(2)}" onchange="updateTotalRevenuePreview(); updateTotalCogsPreview();"></div>`;
    });
    div.innerHTML = html + `</div>`;
    container.appendChild(div);
}

window.removeStream = function(id) {
    revenueStreams = revenueStreams.filter(s => s.id !== id);
    document.getElementById(`stream-${id}`).remove();
    updateTotalRevenuePreview();
    refreshCogsBuilder();
};

// --- COGS BUILDER ---
document.getElementById('addExtraCogsBtn').addEventListener('click', () => {
    const name = document.getElementById('new_cogs_name').value || 'Extra COGS';
    const pct = parseFloat(document.getElementById('new_cogs_pct').value) || 0;
    extraCogs.push({ id: Date.now(), name: name, defaultPct: pct });
    refreshCogsBuilder();
    document.getElementById('new_cogs_name').value = '';
    document.getElementById('new_cogs_pct').value = '';
});

function refreshCogsBuilder() {
    const container = document.getElementById('stream-cogs-list');
    container.innerHTML = '<h3>Stream Margins & Extra Direct Costs</h3>';
    const years = parseInt(forecastYearsInput.value);

    revenueStreams.forEach(stream => {
        const div = document.createElement('div');
        div.className = 'stream-card cogs-card';
        div.innerHTML = `<div class="stream-header"><h4>${stream.name} - Margin (%)</h4></div><div class="matrix-scroll-wrapper">${generateMatrixInputs(stream.id, 'stream-cogs', years, 40)}</div>`;
        container.appendChild(div);
    });

    extraCogs.forEach(cogs => {
        const div = document.createElement('div');
        div.className = 'stream-card cogs-card';
        div.innerHTML = `<div class="stream-header"><h4>${cogs.name} ($)</h4><button type="button" class="remove-stream-btn" onclick="removeExtraCogs(${cogs.id})">Remove</button></div><div class="matrix-scroll-wrapper">${generateMatrixInputs(cogs.id, 'extra-cogs', years, cogs.defaultPct)}</div>`;
        container.appendChild(div);
    });
    updateTotalCogsPreview();
}

window.removeExtraCogs = function(id) {
    extraCogs = extraCogs.filter(c => c.id !== id);
    refreshCogsBuilder();
};

// --- OPEX BUILDER ---
document.getElementById('addOpexStreamBtn').addEventListener('click', () => {
    const name = document.getElementById('new_opex_name').value || 'Expense';
    const base = parseFloat(document.getElementById('new_opex_base').value) || 0;
    const id = Date.now();
    const streamObj = { id, name, base };
    opexStreams.push(streamObj);
    renderOpexStream(streamObj);
    updateTotalOpexPreview();
});

function renderOpexStream(stream) {
    const container = document.getElementById('opex-streams-list');
    const div = document.createElement('div');
    div.className = 'stream-card opex-card';
    div.id = `opex-${stream.id}`;
    const years = parseInt(forecastYearsInput.value);

    let html = `<div class="stream-header"><h4>${stream.name}</h4><button type="button" class="remove-stream-btn" onclick="removeOpexStream(${stream.id})">Remove</button></div><div class="matrix-scroll-wrapper">`;
    for(let i=0; i < years * 12; i++) {
        html += `<div class="matrix-cell"><label>M${i+1}</label><input type="number" class="opex-val-input" data-opex="${stream.id}" value="${stream.base.toFixed(2)}" onchange="updateTotalOpexPreview()"></div>`;
    }
    div.innerHTML = html + `</div>`;
    container.appendChild(div);
}

window.removeOpexStream = function(id) {
    opexStreams = opexStreams.filter(s => s.id !== id);
    const el = document.getElementById(`opex-${id}`);
    if(el) el.remove();
    updateTotalOpexPreview();
};

// --- HELPERS & PREVIEWS ---
function generateMatrixInputs(id, type, years, defVal) {
    let html = '';
    for(let i=0; i < years * 12; i++) {
        html += `<div class="matrix-cell"><label>M${i+1}</label><input type="number" class="cogs-val-input" data-parent="${id}" data-type="${type}" value="${defVal}" onchange="updateTotalCogsPreview()"></div>`;
    }
    return html;
}

function updateTotalRevenuePreview() {
    const years = parseInt(forecastYearsInput.value);
    const container = document.getElementById('annual-revenue-list');
    container.innerHTML = '';
    let annualTotals = new Array(years).fill(0);
    document.querySelectorAll('.stream-card:not(.cogs-card):not(.opex-card)').forEach(card => {
        card.querySelectorAll('.stream-val-input').forEach((inp, i) => {
            const y = Math.floor(i/12);
            if(y < years) annualTotals[y] += parseFloat(inp.value) || 0;
        });
    });
    renderPreviewItems(container, annualTotals);
}

function updateTotalCogsPreview() {
    const years = parseInt(forecastYearsInput.value);
    const container = document.getElementById('annual-cogs-list');
    container.innerHTML = '';
    let annualTotals = new Array(years).fill(0);
    const revCards = document.querySelectorAll('.stream-card:not(.cogs-card):not(.opex-card)');
    const cogsCards = document.querySelectorAll('.cogs-card');
    
    // Linked COGS
    revCards.forEach((rc, sIdx) => {
        const cogsCard = cogsCards[sIdx];
        if(!cogsCard) return;
        const revInps = rc.querySelectorAll('.stream-val-input');
        const cogsInps = cogsCard.querySelectorAll('.cogs-val-input');
        revInps.forEach((ri, mIdx) => {
            const y = Math.floor(mIdx/12);
            if(y < years) annualTotals[y] += (parseFloat(ri.value)||0) * (parseFloat(cogsInps[mIdx].value)/100);
        });
    });
    // Extra COGS
    document.querySelectorAll('.cogs-val-input[data-type="extra-cogs"]').forEach((inp, i) => {
        const y = Math.floor((i % (years*12)) / 12);
        if(y < years) annualTotals[y] += parseFloat(inp.value) || 0;
    });
    renderPreviewItems(container, annualTotals);
}

function updateTotalOpexPreview() {
    const years = parseInt(forecastYearsInput.value);
    const container = document.getElementById('annual-opex-list');
    container.innerHTML = '';
    let annualTotals = new Array(years).fill(0);
    document.querySelectorAll('.opex-val-input').forEach((inp, i) => {
        const y = Math.floor((i % (years*12)) / 12);
        if(y < years) annualTotals[y] += parseFloat(inp.value) || 0;
    });
    renderPreviewItems(container, annualTotals);
}

function renderPreviewItems(container, totals) {
    const cur = document.getElementById('currency_symbol').value;
    totals.forEach((v, i) => {
        const div = document.createElement('div');
        div.innerHTML = `<strong>Yr ${i+1}:</strong> <span>${cur}${v.toLocaleString(undefined,{maximumFractionDigits:0})}</span>`;
        container.appendChild(div);
    });
}

// --- FORM SUBMISSION ---
form.onsubmit = async (e) => {
    e.preventDefault();
    const data = collectInputData();
    try {
        const res = await fetch(API_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
        const result = await res.json();
        renderResults(result);
        resultsContainer.style.display = 'block';
    } catch(err) { errorMessage.textContent = "Error calculating forecast."; }
};

function collectInputData() {
    const years = parseInt(forecastYearsInput.value);
    const revData = [];
    document.querySelectorAll('.stream-card:not(.cogs-card):not(.opex-card)').forEach(card => {
        const name = card.querySelector('h4').textContent;
        const vals = Array.from(card.querySelectorAll('.stream-val-input')).map(i => parseFloat(i.value)||0);
        revData.push({name, values: vals});
    });

    const cogsData = [];
    document.querySelectorAll('.cogs-card').forEach(card => {
        const name = card.querySelector('h4').textContent;
        const type = card.querySelector('.cogs-val-input').dataset.type;
        const vals = Array.from(card.querySelectorAll('.cogs-val-input')).map(i => parseFloat(i.value)||0);
        cogsData.push({name, type, values: vals});
    });

    const opexData = [];
    document.querySelectorAll('.opex-card').forEach(card => {
        const name = card.querySelector('h4').textContent;
        const vals = Array.from(card.querySelectorAll('.opex-val-input')).map(i => parseFloat(i.value)||0);
        opexData.push({name, values: vals});
    });

    return {
        years,
        tax_rate: parseFloat(document.getElementById('tax_rate').value)/100,
        initial_cash: parseFloat(document.getElementById('initial_cash').value),
        initial_debt: parseFloat(document.getElementById('initial_debt').value),
        interest_rate: parseFloat(document.getElementById('interest_rate').value)/100,
        revenue_streams: revData,
        cogs_streams: cogsData,
        opex_streams: opexData,
        fixed_opex_rates: new Array(years).fill(parseFloat(document.getElementById('default_fixed_opex').value))
    };
}

function renderResults(data) {
    const labels = data.Display_Labels;
    const isTable = document.getElementById('incomeStatementTable');
    isTable.querySelector('thead').innerHTML = '<tr><th>Line Item</th>' + labels.map(l => `<th>${l}</th>`).join('') + '</tr>';
    
    let isHtml = '';
    for (const [key, row] of Object.entries(data.display_data)) {
        if (Array.isArray(row) && typeof row[0] !== 'object') {
            isHtml += `<tr><td>${key}</td>${row.map(v => `<td>${v.toLocaleString()}</td>`).join('')}</tr>`;
        } else if (key === 'Stream_Rows') {
            row.forEach(s => {
                isHtml += `<tr style="font-style:italic; font-size:0.9em;"><td>&nbsp;&nbsp;${s.name}</td>${s.values.map(v => `<td>${v.toLocaleString()}</td>`).join('')}</tr>`;
            });
        }
    }
    isTable.querySelector('tbody').innerHTML = isHtml;
}

function openTab(evt, tabName) {
    document.querySelectorAll(".tab-content").forEach(t => t.style.display = "none");
    document.querySelectorAll(".tab-link").forEach(t => t.classList.remove("active"));
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");
}
