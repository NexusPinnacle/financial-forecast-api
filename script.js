const API_URL = '/api/forecast'; 
const EXPORT_API_URL = '/api/export'; 

const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const errorMessage = document.getElementById('error-message');

const annualButtons = document.querySelectorAll('.year-select-btn');
const monthlyDetailSelect = document.getElementById('monthly_detail_select');
const forecastYearsInput = document.getElementById('forecast_years');
const monthlyDetailInput = document.getElementById('monthly_detail');

// Revenue Builder Elements
const streamList = document.getElementById('revenue-streams-list');
const addStreamBtn = document.getElementById('add-revenue-stream-btn');
const streamTemplate = document.getElementById('revenue-stream-template');
const totalRevenueSumDisplay = document.getElementById('total-revenue-sum');

const granularContainers = {
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

// --- REVENUE BUILDER LOGIC ---

function calculateTotalBuiltRevenue() {
    let total = 0;
    document.querySelectorAll('.matrix-input').forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    if (totalRevenueSumDisplay) {
        totalRevenueSumDisplay.textContent = total.toLocaleString(undefined, { minimumFractionDigits: 2 });
    }
}

function generateMatrixBody(card, years) {
    const body = card.querySelector('.matrix-body');
    const head = card.querySelector('.matrix-head');
    
    // Set Header
    let headHtml = '<tr><th>Year</th>';
    for (let m = 1; m <= 12; m++) headHtml += `<th>M${m}</th>`;
    head.innerHTML = headHtml + '</tr>';

    // Preserve existing data if resizing
    const existingValues = {};
    card.querySelectorAll('.matrix-input').forEach(input => {
        existingValues[`${input.dataset.y}_${input.dataset.m}`] = input.value;
    });

    body.innerHTML = ''; 
    for (let y = 1; y <= years; y++) {
        let row = body.insertRow();
        row.insertCell().textContent = `Y${y}`;
        for (let m = 1; m <= 12; m++) {
            let cell = row.insertCell();
            const val = existingValues[`${y}_${m}`] || "0";
            cell.innerHTML = `<input type="number" class="matrix-input" data-y="${y}" data-m="${m}" value="${val}" style="width:60px;">`;
            cell.querySelector('input').addEventListener('input', calculateTotalBuiltRevenue);
        }
    }
}

addStreamBtn.addEventListener('click', () => {
    const years = parseInt(forecastYearsInput.value);
    const clone = streamTemplate.content.cloneNode(true);
    const card = clone.querySelector('.revenue-stream-card');
    
    generateMatrixBody(card, years);

    card.querySelector('.remove-stream-btn').onclick = () => {
        card.remove();
        calculateTotalBuiltRevenue();
    };
    
    streamList.appendChild(card);
});

// --- UI & TABS ---

function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) tabContents[i].style.display = "none";
    const tabLinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tabLinks.length; i++) tabLinks[i].className = tabLinks[i].className.replace(" active", "");
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}
window.openTab = openTab;

function createVerticalInputs(container, idPrefix, labelBase, count, defaultValueId, step, unit) {
    if (!container) return;
    container.innerHTML = ''; 
    const wrapper = document.createElement('div');
    wrapper.className = 'granular-input-row';
    const defaultElement = document.getElementById(defaultValueId);
    let defaultVal = defaultElement ? parseFloat(defaultElement.value) : 0; 
    
    for (let i = 1; i <= count; i++) {
        const inputDiv = document.createElement('div');
        inputDiv.className = 'granular-year-input';
        let labelText = `Y${i}${unit.replace(/[\(\)]/g, '')}:`;
        inputDiv.innerHTML = `
            <label for="${idPrefix}_y${i}">${labelText}</label>
            <input type="number" id="${idPrefix}_y${i}" value="${defaultVal}" step="${step}" required>
        `;
        wrapper.appendChild(inputDiv);
    }
    const header = document.createElement('p');
    header.className = 'granular-row-label';
    header.textContent = labelBase;
    container.appendChild(header);
    container.appendChild(wrapper);
}

function createAllGranularInputs(numYears) {
    createVerticalInputs(granularContainers.cogs_pct, 'cogs_pct', 'COGS %', numYears, 'default_cogs_pct', '0.1', '(%)');
    createVerticalInputs(granularContainers.fixed_opex, 'fixed_opex', 'Fixed Opex', numYears, 'default_fixed_opex', '0.01', '');
    createVerticalInputs(granularContainers.capex, 'capex', 'CapEx', numYears, 'default_capex', '0.01', '');
    createVerticalInputs(granularContainers.dso_days, 'dso_days', 'DSO', numYears, 'default_dso_days', '1', '(Days)');
    createVerticalInputs(granularContainers.dio_days, 'dio_days', 'DIO', numYears, 'default_dio_days', '1', '(Days)');
    createVerticalInputs(granularContainers.dpo_days, 'dpo_days', 'DPO', numYears, 'default_dpo_days', '1', '(Days)');
    createVerticalInputs(granularContainers.debt_repayment, 'debt_repayment', 'Debt Repay', numYears, 'default_annual_debt_repayment', '0.01', '');
}

annualButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        annualButtons.forEach(b => b.classList.remove('active', 'selected-year-btn'));
        btn.classList.add('active', 'selected-year-btn');

        const val = parseInt(btn.getAttribute('data-value'));
        forecastYearsInput.value = val;
        createAllGranularInputs(val);

        // Update all existing revenue matrices to match new year count
        document.querySelectorAll('.revenue-stream-card').forEach(card => {
            generateMatrixBody(card, val);
        });
        calculateTotalBuiltRevenue();
    });
});

// --- DATA HANDLING ---

function collectInputData() {
    const years = parseInt(forecastYearsInput.value, 10);
    
    // Collect Revenue Streams Data
    const revenueStreams = [];
    document.querySelectorAll('.revenue-stream-card').forEach(card => {
        const matrixData = [];
        card.querySelectorAll('.matrix-input').forEach(input => {
            matrixData.push({
                y: parseInt(input.dataset.y),
                m: parseInt(input.dataset.m),
                val: parseFloat(input.value) || 0
            });
        });

        revenueStreams.push({
            name: card.querySelector('.rev-name').value,
            type: card.querySelector('.rev-type').value,
            description: card.querySelector('.rev-description').value,
            start_date: card.querySelector('.rev-start').value,
            annual_index: parseFloat(card.querySelector('.rev-index').value) || 0,
            matrix: matrixData
        });
    });

    const collectList = (keyPrefix, isPct, defaultId) => {
        const list = [];
        const factor = isPct ? 100 : 1;
        const defVal = parseFloat(document.getElementById(defaultId).value);
        for (let i = 1; i <= years; i++) {
            const el = document.getElementById(`${keyPrefix}_y${i}`);
            const val = el ? parseFloat(el.value) : defVal;
            list.push((isNaN(val) ? defVal : val) / factor);
        }
        return list;
    };

    return {
        revenue_streams: revenueStreams,
        tax_rate: parseFloat(document.getElementById('tax_rate').value) / 100,
        initial_ppe: parseFloat(document.getElementById('initial_ppe').value),
        depreciation_rate: parseFloat(document.getElementById('depreciation_rate').value) / 100,
        initial_debt: parseFloat(document.getElementById('initial_debt').value),
        initial_cash: parseFloat(document.getElementById('initial_cash').value),
        interest_rate: parseFloat(document.getElementById('interest_rate').value) / 100,
        years: years,
        monthly_detail: parseInt(monthlyDetailInput.value),
        cogs_pct_rates: collectList('cogs_pct', true, 'default_cogs_pct'),
        fixed_opex_rates: collectList('fixed_opex', false, 'default_fixed_opex'),
        capex_rates: collectList('capex', false, 'default_capex'),
        dso_days_list: collectList('dso_days', false, 'default_dso_days'),
        dio_days_list: collectList('dio_days', false, 'default_dio_days'),
        dpo_days_list: collectList('dpo_days', false, 'default_dpo_days'),
        annual_debt_repayment_list: collectList('debt_repayment', false, 'default_annual_debt_repayment'),
    };
}

// ... (Rest of script remains same: handleForecastRequest, handleFileDownload, renderResults, renderCharts)

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleForecastRequest(API_URL);
});

document.getElementById('exportBtn').addEventListener('click', async () => {
    await handleForecastRequest(EXPORT_API_URL, true);
});

async function handleForecastRequest(url, isExport = false) {
    errorMessage.textContent = isExport ? 'Generating Excel...' : '';
    try {
        const data = collectInputData();
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || response.statusText);
        }
        if (isExport) {
            await handleFileDownload(response);
        } else {
            const result = await response.json();
            renderResults(result, document.getElementById('currency_symbol').value);
        }
    } catch (error) {
        errorMessage.textContent = `Error: ${error.message}`;
    }
}

function renderResults(data, currency) {
    // [Keep your existing renderResults logic here]
}

function renderCharts(data) {
    // [Keep your existing renderCharts logic here]
}

document.addEventListener('DOMContentLoaded', () => { 
    const defaultYears = 5; 
    forecastYearsInput.value = defaultYears;
    createAllGranularInputs(defaultYears); 

    const defaultBtn = document.querySelector(`.year-select-btn[data-value="${defaultYears}"]`);
    if (defaultBtn) {
        defaultBtn.classList.add('active', 'selected-year-btn');
    }
});
