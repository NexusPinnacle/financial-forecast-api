// --- Constants & State ---
const API_URL = '/api/forecast';
const EXPORT_API_URL = '/api/export';

let revenueChart = null;
let cashDebtChart = null;
let currentForecastData = null;

// --- DOM Elements ---
const yearButtons = document.querySelectorAll('.year-select-btn');
const modeButtons = document.querySelectorAll('.mode-btn');
const totalYearsInput = document.getElementById('total_years_val');
const periodModeInput = document.getElementById('period_mode');
const forecastForm = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    updateUIState();
});

// --- Settings Logic ---
yearButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        yearButtons.forEach(b => b.classList.remove('selected-year-btn'));
        btn.classList.add('selected-year-btn');
        totalYearsInput.value = btn.getAttribute('data-value');
        updateUIState();
    });
});

modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        periodModeInput.value = btn.getAttribute('data-mode');
        updateUIState();
    });
});

function updateUIState() {
    const years = parseInt(totalYearsInput.value);
    createAllGranularInputs(years);
}

function createAllGranularInputs(years) {
    const containers = {
        revenue_growth: 'revenue-growth-container',
        cogs_pct: 'cogs-pct-container',
        fixed_opex: 'fixed-opex-container',
        capex: 'capex-container',
        dso_days: 'dso-days-container',
        dio_days: 'dio-days-container',
        dpo_days: 'dpo-days-container',
        debt_repayment: 'debt-repayment-container'
    };

    for (const [key, containerId] of Object.entries(containers)) {
        const container = document.getElementById(containerId);
        const defaultValue = document.getElementById(`default_${key}`)?.value || 0;
        
        // Preserve existing values if possible
        const existingValues = Array.from(container.querySelectorAll('input')).map(i => i.value);
        container.innerHTML = '';

        for (let i = 1; i <= years; i++) {
            const div = document.createElement('div');
            div.className = 'granular-item';
            const val = existingValues[i-1] !== undefined ? existingValues[i-1] : defaultValue;
            div.innerHTML = `<label>Y${i}</label><input type="number" id="${key}_y${i}" value="${val}" step="any">`;
            container.appendChild(div);
        }
    }
}

// --- Data Collection & API ---
forecastForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = collectInputData();
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        currentForecastData = data;
        displayResults(data);
    } catch (err) {
        document.getElementById('error-message').textContent = err.message;
    }
});

function collectInputData() {
    const years = parseInt(totalYearsInput.value);
    const mode = periodModeInput.value;
    
    // In "Monthly Split" mode, we want years * 12 periods
    const calculatedPeriods = (mode === 'monthly') ? years * 12 : years;

    const getList = (idPrefix) => {
        const list = [];
        for (let i = 1; i <= years; i++) {
            list.push(parseFloat(document.getElementById(`${idPrefix}_y${i}`).value) || 0);
        }
        return list;
    };

    return {
        initial_revenue: parseFloat(document.getElementById('initial_revenue').value),
        tax_rate: parseFloat(document.getElementById('tax_rate').value),
        initial_ppe: parseFloat(document.getElementById('initial_ppe').value),
        depreciation_rate: parseFloat(document.getElementById('depreciation_rate').value),
        initial_debt: parseFloat(document.getElementById('initial_debt').value),
        initial_cash: parseFloat(document.getElementById('initial_cash').value),
        interest_rate: parseFloat(document.getElementById('interest_rate').value),
        
        // Logical "years" for the backend
        years: calculatedPeriods, 
        period_mode: mode,
        
        revenue_growth_rates: getList('revenue_growth').map(v => v/100),
        cogs_pct_rates: getList('cogs_pct').map(v => v/100),
        fixed_opex_rates: getList('fixed_opex'),
        capex_rates: getList('capex'),
        dso_days_list: getList('dso_days'),
        dio_days_list: getList('dio_days'),
        dpo_days_list: getList('dpo_days'),
        annual_debt_repayment_list: getList('debt_repayment')
    };
}

// --- Table & Chart Rendering ---
function displayResults(data) {
    resultsContainer.style.display = 'block';
    populateTable('incomeStatementTable', data.excel_is, data.Years);
    populateTable('balanceSheetTable', data.excel_bs, data.Years);
    populateTable('cashFlowTable', data.excel_cfs, data.Years);
    renderCharts(data);
}

function populateTable(tableId, sectionData, years) {
    const table = document.getElementById(tableId);
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    thead.innerHTML = `<tr><th>Item</th>${years.map(y => `<th>${y}</th>`).join('')}</tr>`;
    tbody.innerHTML = '';

    for (const [rowName, values] of Object.entries(sectionData)) {
        const tr = document.createElement('tr');
        // If monthly, values already include the 'Initial' column (index 0)
        tr.innerHTML = `<td>${rowName}</td>${values.map(v => `<td>${Number(v).toLocaleString(undefined, {maximumFractionDigits:0})}</td>`).join('')}`;
        tbody.appendChild(tr);
    }
}

function renderCharts(data) {
    const labels = data.Years.slice(1);
    const revData = data.Revenue.slice(1);
    const niData = data["Net Income"].slice(1);

    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(document.getElementById('revenueKpiChart'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                { label: 'Revenue', data: revData, borderColor: '#3b84f5', tension: 0.1 },
                { label: 'Net Income', data: niData, borderColor: '#28a745', tension: 0.1 }
            ]
        }
    });
}

function openTab(evt, tabId) {
    const contents = document.getElementsByClassName("tab-content");
    for (let c of contents) c.style.display = "none";
    const links = document.getElementsByClassName("tab-link");
    for (let l of links) l.classList.remove("active");
    document.getElementById(tabId).style.display = "block";
    evt.currentTarget.classList.add("active");
}

document.getElementById('exportBtn').addEventListener('click', async () => {
    if (!currentForecastData) return;
    const response = await fetch(EXPORT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentForecastData)
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Forecast.xlsx';
    a.click();
});
