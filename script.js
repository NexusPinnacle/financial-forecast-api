// API URLs
const API_URL = '/api/forecast'; 
const EXPORT_API_URL = '/api/export'; 

// DOM Elements
const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const errorMessage = document.getElementById('error-message');

// Configuration Selects (The "Two-Step" Selection)
const totalYearsSelect = document.getElementById('total_years');
const monthlyYearsSelect = document.getElementById('monthly_years');

// Granular Containers Mapping
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

// Chart instances
let revenueChart = null;
let cashDebtChart = null;

/**
 * Tab Switching Logic
 */
function openTab(evt, tabName) {
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = "none";
    }
    const tabLinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].classList.remove("active");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.classList.add("active");
}
window.openTab = openTab;

/**
 * Generates assumption input fields based on total years selected.
 */
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
        
        // Use + for the final year if it represents a terminal state
        let labelText = `Y${i}${unit}:`;
        if (i === count && count < 10) labelText = `Y${i}+${unit}:`;

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

function createAllGranularInputs() {
    const numYears = parseInt(totalYearsSelect.value);
    
    createVerticalInputs(granularContainers.revenue_growth, 'revenue_growth', 'Revenue Growth', numYears, 'default_revenue_growth', '0.1', '%');
    createVerticalInputs(granularContainers.cogs_pct, 'cogs_pct', 'COGS %', numYears, 'default_cogs_pct', '0.1', '%');
    createVerticalInputs(granularContainers.fixed_opex, 'fixed_opex', 'Fixed Opex', numYears, 'default_fixed_opex', '0.01', '');
    createVerticalInputs(granularContainers.capex, 'capex', 'CapEx', numYears, 'default_capex', '0.01', '');
    createVerticalInputs(granularContainers.dso_days, 'dso_days', 'DSO', numYears, 'default_dso_days', '1', 'd');
    createVerticalInputs(granularContainers.dio_days, 'dio_days', 'DIO', numYears, 'default_dio_days', '1', 'd');
    createVerticalInputs(granularContainers.dpo_days, 'dpo_days', 'DPO', numYears, 'default_dpo_days', '1', 'd');
    createVerticalInputs(granularContainers.debt_repayment, 'debt_repayment', 'Debt Repay', numYears, 'default_annual_debt_repayment', '0.01', '');
}

/**
 * Event Listeners for Configuration
 */
[totalYearsSelect, monthlyYearsSelect].forEach(select => {
    select.addEventListener('change', createAllGranularInputs);
});

// Update inputs if baseline defaults change
const defaults = ['default_revenue_growth', 'default_cogs_pct', 'default_fixed_opex', 'default_capex', 'default_dso_days', 'default_dio_days', 'default_dpo_days', 'default_annual_debt_repayment'];
defaults.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', createAllGranularInputs);
});

/**
 * Submission Logic
 */
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleForecastRequest(API_URL);
});

async function handleForecastRequest(url, isExport = false) {
    errorMessage.textContent = '';
    try {
        const data = collectInputData();
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error("Server error during calculation.");

        const result = await response.json();
        renderResults(result);
        resultsContainer.style.display = 'block';
    } catch (error) {
        errorMessage.textContent = `Error: ${error.message}`;
    }
}

function collectInputData() {
    const totalYears = parseInt(totalYearsSelect.value);
    
    const collectList = (keyPrefix, factor, defaultId) => {
        const list = [];
        const defVal = parseFloat(document.getElementById(defaultId).value);
        for (let i = 1; i <= totalYears; i++) {
            const el = document.getElementById(`${keyPrefix}_y${i}`);
            const val = el ? parseFloat(el.value) : defVal;
            list.push(val / factor);
        }
        return list;
    };

    return {
        years: totalYears,
        monthly_years: parseInt(monthlyYearsSelect.value),
        initial_revenue: parseFloat(document.getElementById('initial_revenue').value),
        initial_ppe: parseFloat(document.getElementById('initial_ppe').value),
        initial_cash: parseFloat(document.getElementById('initial_cash').value),
        initial_debt: parseFloat(document.getElementById('initial_debt').value),
        tax_rate: parseFloat(document.getElementById('tax_rate').value) / 100,
        interest_rate: parseFloat(document.getElementById('interest_rate').value) / 100,
        depreciation_rate: parseFloat(document.getElementById('depreciation_rate').value) / 100,
        
        revenue_growth_rates: collectList('revenue_growth', 100, 'default_revenue_growth'),
        cogs_pct_rates: collectList('cogs_pct', 100, 'default_cogs_pct'),
        fixed_opex_rates: collectList('fixed_opex', 1, 'default_fixed_opex'),
        capex_rates: collectList('capex', 1, 'default_capex'),
        dso_days_list: collectList('dso_days', 1, 'default_dso_days'),
        dio_days_list: collectList('dio_days', 1, 'default_dio_days'),
        dpo_days_list: collectList('dpo_days', 1, 'default_dpo_days'),
        annual_debt_repayment_list: collectList('debt_repayment', 1, 'default_annual_debt_repayment'),
    };
}

/**
 * Result Rendering
 */
function renderResults(data) {
    const currency = document.getElementById('currency_symbol').value;
    const format = (v) => `${v < 0 ? '-' : ''}${currency}${Math.abs(v).toLocaleString(undefined, {maximumFractionDigits: 0})}`;

    const renderTable = (tableId, headCols, rows) => {
        const table = document.getElementById(tableId);
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        thead.innerHTML = `<tr><th>Line Item</th>${headCols.map(c => `<th>${c}</th>`).join('')}</tr>`;
        tbody.innerHTML = rows.map(row => `
            <tr>
                <td>${row.label}</td>
                ${row.data.map(v => `<td>${format(v)}</td>`).join('')}
            </tr>
        `).join('');
    };

    const labels = data.Labels; // ["Start", "M1", "M2"..., "Y2"]
    
    // P&L (Excludes "Start" column)
    renderTable('incomeStatementTable', labels.slice(1), [
        { label: "Revenue", data: data.excel_is.Revenue },
        { label: "Net Income", data: data.excel_is["Net Income"] }
    ]);

    // Balance Sheet (Includes "Start" column)
    renderTable('balanceSheetTable', labels, [
        { label: "Cash", data: data.excel_bs.Cash },
        { label: "Debt", data: data.excel_bs.Debt },
        { label: "Total Assets", data: data.excel_bs["Total Assets"] }
    ]);

    renderCharts(data);
}

function renderCharts(data) {
    const ctx = document.getElementById('revenueKpiChart').getContext('2d');
    if (revenueChart) revenueChart.destroy();
    
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.Labels.slice(1),
            datasets: [{
                label: 'Revenue Growth',
                data: data.Revenue.slice(1),
                borderColor: '#3b84f5',
                tension: 0.1
            }]
        },
        options: { responsive: true }
    });
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    createAllGranularInputs();
});
