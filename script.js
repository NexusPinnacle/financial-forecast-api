const API_URL = '/api/forecast';
const EXPORT_API_URL = '/api/export';

const form = document.getElementById('forecastForm');
const streamList = document.getElementById('revenue-streams-list');
const addStreamBtn = document.getElementById('add-revenue-stream-btn');
const streamTemplate = document.getElementById('revenue-stream-template');
const totalRevenueSumDisplay = document.getElementById('total-revenue-sum');
const forecastYearsInput = document.getElementById('forecast_years');
const monthlyDetailInput = document.getElementById('monthly_detail');

// --- REVENUE BUILDER ---
function calculateTotalBuiltRevenue() {
    let total = 0;
    document.querySelectorAll('.matrix-input').forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    totalRevenueSumDisplay.textContent = total.toLocaleString(undefined, {minimumFractionDigits: 2});
}

function generateMatrix(card, years) {
    const head = card.querySelector('.matrix-head');
    const body = card.querySelector('.matrix-body');
    
    let headHtml = '<tr><th>Year</th>';
    for(let m=1; m<=12; m++) headHtml += `<th>M${m}</th>`;
    head.innerHTML = headHtml + '</tr>';

    body.innerHTML = '';
    for(let y=1; y<=years; y++) {
        let row = body.insertRow();
        row.insertCell().textContent = `Y${y}`;
        for(let m=1; m<=12; m++) {
            let cell = row.insertCell();
            cell.innerHTML = `<input type="number" class="matrix-input" data-y="${y}" data-m="${m}" value="0">`;
            cell.querySelector('input').addEventListener('input', calculateTotalBuiltRevenue);
        }
    }
}

addStreamBtn.addEventListener('click', () => {
    const years = parseInt(forecastYearsInput.value);
    const clone = streamTemplate.content.cloneNode(true);
    const card = clone.querySelector('.revenue-stream-card');
    generateMatrix(card, years);
    card.querySelector('.remove-stream-btn').onclick = () => { card.remove(); calculateTotalBuiltRevenue(); };
    streamList.appendChild(card);
});

// --- UI & TABS ---
window.openTab = function(evt, tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab-link').forEach(l => l.classList.remove('active'));
    document.getElementById(tabName).style.display = 'block';
    evt.currentTarget.classList.add('active');
};

function createVerticalInputs(containerId, idPrefix, label, count, defaultId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.innerHTML = `<p class="granular-row-label">${label}</p><div class="granular-input-row"></div>`;
    const row = container.querySelector('.granular-input-row');
    const defVal = document.getElementById(defaultId).value;

    for(let i=1; i<=count; i++) {
        row.innerHTML += `
            <div class="granular-year-input">
                <label>Y${i}</label>
                <input type="number" id="${idPrefix}_y${i}" value="${defVal}">
            </div>`;
    }
}

function updateAllUI(years) {
    createVerticalInputs('cogs-pct-container', 'cogs', 'COGS %', years, 'default_cogs_pct');
    createVerticalInputs('fixed-opex-container', 'opex', 'Fixed Opex', years, 'default_fixed_opex');
    createVerticalInputs('capex-container', 'capex', 'CapEx', years, 'default_capex');
    createVerticalInputs('dso-days-container', 'dso', 'DSO', years, 'default_dso_days');
    createVerticalInputs('dio_days-container', 'dio', 'DIO', years, 'default_dio_days');
    createVerticalInputs('dpo_days-container', 'dpo', 'DPO', years, 'default_dpo_days');
    createVerticalInputs('debt-repayment-container', 'debt', 'Debt Repay', years, 'default_annual_debt_repayment');
    
    document.querySelectorAll('.revenue-stream-card').forEach(card => generateMatrix(card, years));
}

document.querySelectorAll('.year-select-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.year-select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        forecastYearsInput.value = btn.dataset.value;
        updateAllUI(parseInt(btn.dataset.value));
    };
});

document.getElementById('monthly_detail_select').onchange = (e) => {
    monthlyDetailInput.value = e.target.value;
};

// --- DATA SUBMISSION ---
function collectData() {
    const years = parseInt(forecastYearsInput.value);
    const getList = (prefix) => {
        let list = [];
        for(let i=1; i<=years; i++) list.push(parseFloat(document.getElementById(`${prefix}_y${i}`).value) || 0);
        return list;
    };

    const streams = [];
    document.querySelectorAll('.revenue-stream-card').forEach(card => {
        const matrix = [];
        card.querySelectorAll('.matrix-input').forEach(i => {
            matrix.push({ y: i.dataset.y, m: i.dataset.m, val: i.value });
        });
        streams.push({ name: card.querySelector('.rev-name').value, matrix: matrix });
    });

    return {
        revenue_streams: streams,
        years: years,
        monthly_detail: parseInt(monthlyDetailInput.value),
        tax_rate: parseFloat(document.getElementById('tax_rate').value) / 100,
        initial_ppe: parseFloat(document.getElementById('initial_ppe').value),
        depreciation_rate: parseFloat(document.getElementById('depreciation_rate').value) / 100,
        initial_debt: parseFloat(document.getElementById('initial_debt').value),
        initial_cash: parseFloat(document.getElementById('initial_cash').value),
        interest_rate: parseFloat(document.getElementById('interest_rate').value) / 100,
        cogs_pct_rates: getList('cogs').map(v => v/100),
        fixed_opex_rates: getList('opex'),
        capex_rates: getList('capex'),
        dso_days_list: getList('dso'),
        dio_days_list: getList('dio'),
        dpo_days_list: getList('dpo'),
        annual_debt_repayment_list: getList('debt')
    };
}

form.onsubmit = async (e) => {
    e.preventDefault();
    const resp = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(collectData())});
    const data = await resp.json();
    renderResults(data);
};

// (Include your existing renderResults and renderCharts functions here)
