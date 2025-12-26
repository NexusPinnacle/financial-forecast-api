// API URLs
const API_URL = '/api/forecast'; 
const EXPORT_API_URL = '/api/export'; 

// DOM Elements
const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const errorMessage = document.getElementById('error-message');

// Mode & Duration Inputs
const modeButtons = document.querySelectorAll('.mode-btn');
const annualButtonsContainer = document.getElementById('annual-buttons');
const monthlyButtonsContainer = document.getElementById('monthly-buttons');
const annualButtons = document.querySelectorAll('.year-select-btn');
const monthlyButtons = document.querySelectorAll('.month-select-btn');
const forecastYearsInput = document.getElementById('forecast_years');
const periodModeInput = document.getElementById('period_mode');
const durationLabel = document.getElementById('duration-label');

// Containers
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

// --- Tab Switching Logic ---
function openTab(evt, tabName) {
    // Hide all tab content
    const tabContents = document.getElementsByClassName("tab-content");
    for (let i = 0; i < tabContents.length; i++) {
        tabContents[i].style.display = "none";
    }

    // Remove active class from buttons
    const tabLinks = document.getElementsByClassName("tab-link");
    for (let i = 0; i < tabLinks.length; i++) {
        tabLinks[i].className = tabLinks[i].className.replace(" active", "");
    }

    // Show current tab and add active class
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}
// Expose to window for HTML onClick
window.openTab = openTab;


// --- UI Helpers for Inputs ---

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
        if (idPrefix === 'revenue_growth' && i === count && count < 10) labelText = `Y${i}+`;

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
    // Even in monthly mode, we generate ANNUAL inputs for the user to fill (1, 2, 3...)
    // The backend expands these.
    // Calculate how many years we need based on total periods
    const mode = periodModeInput.value;
    let inputYears = numYears;
    
    if (mode === 'monthly') {
        // e.g. 12 months -> 1 year input, 24 -> 2, 36 -> 3.
        inputYears = Math.ceil(numYears / 12);
    }
    
    createVerticalInputs(granularContainers.revenue_growth, 'revenue_growth', 'Revenue Growth', inputYears, 'default_revenue_growth', '0.1', '(%)');
    createVerticalInputs(granularContainers.cogs_pct, 'cogs_pct', 'COGS %', inputYears, 'default_cogs_pct', '0.1', '(%)');
    createVerticalInputs(granularContainers.fixed_opex, 'fixed_opex', 'Fixed Opex', inputYears, 'default_fixed_opex', '0.01', '');
    createVerticalInputs(granularContainers.capex, 'capex', 'CapEx', inputYears, 'default_capex', '0.01', '');
    createVerticalInputs(granularContainers.dso_days, 'dso_days', 'DSO', inputYears, 'default_dso_days', '1', '(Days)');
    createVerticalInputs(granularContainers.dio_days, 'dio_days', 'DIO', inputYears, 'default_dio_days', '1', '(Days)');
    createVerticalInputs(granularContainers.dpo_days, 'dpo_days', 'DPO', inputYears, 'default_dpo_days', '1', '(Days)');
    createVerticalInputs(granularContainers.debt_repayment, 'debt_repayment', 'Debt Repay', inputYears, 'default_annual_debt_repayment', '0.01', '');
}

// --- Event Listeners: Mode & Duration ---

// 1. Toggle Mode (Annual vs Monthly)
modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const mode = btn.getAttribute('data-mode');
        periodModeInput.value = mode;

        if (mode === 'monthly') {
            annualButtonsContainer.style.display = 'none';
            monthlyButtonsContainer.style.display = 'flex';
            durationLabel.textContent = "Select Duration (Months):";
            // Default to 12 months if switching
            updateDuration(12, monthlyButtons);
        } else {
            annualButtonsContainer.style.display = 'flex';
            monthlyButtonsContainer.style.display = 'none';
            durationLabel.textContent = "Select Duration (Years):";
            // Default to 3 years
            updateDuration(3, annualButtons);
        }
    });
});

// 2. Duration Button Click Handlers
function updateDuration(value, btnNodeList) {
    btnNodeList.forEach(b => {
        b.classList.remove('selected-year-btn', 'active'); // clean both classes
        if (parseInt(b.getAttribute('data-value')) === value) {
            b.classList.add('selected-year-btn', 'active');
        }
    });
    
    forecastYearsInput.value = value;
    createAllGranularInputs(value);
}

annualButtons.forEach(btn => {
    btn.addEventListener('click', () => updateDuration(parseInt(btn.getAttribute('data-value')), annualButtons));
});

monthlyButtons.forEach(btn => {
    btn.addEventListener('click', () => updateDuration(parseInt(btn.getAttribute('data-value')), monthlyButtons));
});

// 3. Default Input Changes -> Regenerate Granular
const defaults = ['default_revenue_growth', 'default_cogs_pct', 'default_fixed_opex', 'default_capex', 'default_dso_days', 'default_dio_days', 'default_dpo_days', 'default_annual_debt_repayment'];
defaults.forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        createAllGranularInputs(parseInt(forecastYearsInput.value));
    });
});

// 4. Collapse Toggle
document.querySelector('.right-pane').addEventListener('click', (e) => {
    let header = e.target.closest('.collapsible-header');
    if (header) {
        const targetId = header.getAttribute('data-target');
        header.classList.toggle('collapsed');
        document.getElementById(targetId).classList.toggle('expanded-content');
    }
});


// --- Submission & Calculation ---

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
        console.error(error);
        errorMessage.textContent = `Error: ${error.message}`;
    }
}

function collectInputData() {
    const yearsOrMonths = parseInt(forecastYearsInput.value, 10);
    const mode = periodModeInput.value;
    
    // Determine how many inputs are currently visible on screen (Years)
    // If mode is monthly (e.g. 24), we have 2 year inputs.
    const inputCount = (mode === 'monthly') ? Math.ceil(yearsOrMonths / 12) : yearsOrMonths;

    const collectList = (keyPrefix, isPct, defaultId) => {
        const list = [];
        const factor = isPct ? 100 : 1;
        const defVal = parseFloat(document.getElementById(defaultId).value);
        
        for (let i = 1; i <= inputCount; i++) {
            const el = document.getElementById(`${keyPrefix}_y${i}`);
            const val = el ? parseFloat(el.value) : defVal;
            list.push((isNaN(val) ? defVal : val) / factor);
        }
        return list;
    };

    return {
        initial_revenue: parseFloat(document.getElementById('initial_revenue').value),
        tax_rate: parseFloat(document.getElementById('tax_rate').value) / 100,
        initial_ppe: parseFloat(document.getElementById('initial_ppe').value),
        depreciation_rate: parseFloat(document.getElementById('depreciation_rate').value) / 100,
        initial_debt: parseFloat(document.getElementById('initial_debt').value),
        initial_cash: parseFloat(document.getElementById('initial_cash').value),
        interest_rate: parseFloat(document.getElementById('interest_rate').value) / 100,
        years: yearsOrMonths,
        period_mode: mode,
        
        revenue_growth_rates: collectList('revenue_growth', true, 'default_revenue_growth'),
        cogs_pct_rates: collectList('cogs_pct', true, 'default_cogs_pct'),
        fixed_opex_rates: collectList('fixed_opex', false, 'default_fixed_opex'),
        capex_rates: collectList('capex', false, 'default_capex'),
        dso_days_list: collectList('dso_days', false, 'default_dso_days'),
        dio_days_list: collectList('dio_days', false, 'default_dio_days'),
        dpo_days_list: collectList('dpo_days', false, 'default_dpo_days'),
        annual_debt_repayment_list: collectList('debt_repayment', false, 'default_annual_debt_repayment'),
    };
}

async function handleFileDownload(response) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Financial_Forecast.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    errorMessage.textContent = '';
}

function renderResults(data, currency) {
    const isBody = document.querySelector('#incomeStatementTable tbody');
    const bsBody = document.querySelector('#balanceSheetTable tbody');
    const cfBody = document.querySelector('#cashFlowTable tbody');
    const isHead = document.querySelector('#incomeStatementTable thead');
    const bsHead = document.querySelector('#balanceSheetTable thead');
    const cfHead = document.querySelector('#cashFlowTable thead');

    [isBody, bsBody, cfBody, isHead, bsHead, cfHead].forEach(el => el.innerHTML = '');

    const format = (v) => `${v < 0 ? '-' : ''}${currency}${Math.abs(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    
    // Headers
    // data["Years"] contains mixed types ["Start", "Month 1"...] or [0, 1, 2...]
    const bsCols = data["Years"];
    const isCols = data["Years"].slice(1);

    const createHeader = (thead, cols) => {
        const row = thead.insertRow();
        row.insertCell().textContent = 'Line Item';
        cols.forEach(c => {
            let txt = c;
            if (typeof c === 'number') txt = (c === 0) ? 'Year 0' : `Year ${c}`;
            row.insertCell().textContent = txt;
        });
    };

    createHeader(isHead, isCols);
    createHeader(bsHead, bsCols);
    createHeader(cfHead, isCols);

    const insertRow = (body, label, rowData, isBold=false, isReversed=false) => {
        const row = body.insertRow();
        if (isBold) row.className = 'heavy-total-row';
        row.insertCell().textContent = label;
        rowData.forEach(val => {
            const cell = row.insertCell();
            cell.textContent = format(isReversed ? -val : val);
            cell.className = 'data-cell';
        });
    };

    // Income Statement
    insertRow(isBody, "Revenue", data["excel_is"]["Revenue"], true);
    insertRow(isBody, "COGS", data["excel_is"]["COGS"]);
    insertRow(isBody, "Gross Profit", data["excel_is"]["Gross Profit"], true);
    insertRow(isBody, "Fixed Opex", data["excel_is"]["Fixed Operating Expenses"]);
    insertRow(isBody, "Depreciation", data["excel_is"]["Depreciation"]);
    insertRow(isBody, "EBIT", data["excel_is"]["EBIT"], true);
    insertRow(isBody, "Interest", data["excel_is"]["Interest Expense"]);
    insertRow(isBody, "Taxes", data["excel_is"]["Taxes"]);
    insertRow(isBody, "Net Income", data["excel_is"]["Net Income"], true);

    // Balance Sheet
    insertRow(bsBody, "Cash", data["excel_bs"]["Cash"]);
    insertRow(bsBody, "Accounts Receivable", data["excel_bs"]["Accounts Receivable"]);
    insertRow(bsBody, "Inventory", data["excel_bs"]["Inventory"]);
    insertRow(bsBody, "Net PP&E", data["excel_bs"]["Net PP&E"]);
    insertRow(bsBody, "Total Assets", data["excel_bs"]["Total Assets"], true);
    insertRow(bsBody, "Accounts Payable", data["excel_bs"]["Accounts Payable"]);
    insertRow(bsBody, "Debt", data["excel_bs"]["Debt"]);
    insertRow(bsBody, "Retained Earnings", data["excel_bs"]["Retained Earnings"]);
    insertRow(bsBody, "Total Liab & Eq", data["excel_bs"]["Total Liabilities & Equity"], true);

    // Cash Flow
    // Note: The excel_cfs dict in backend is aligned to forecast periods
    insertRow(cfBody, "Net Income", data["excel_cfs"]["Net Income"]);
    insertRow(cfBody, "Add: Depreciation", data["excel_cfs"]["Add: Depreciation"]);
    insertRow(cfBody, "Less: Change in NWC", data["excel_cfs"]["Less: Change in NWC"], false, true); // Already negative in data? check logic. 
    // Logic in forecaster: change_in_nwc_cfs = [-x ...]. So it's negative. format handles sign. 
    // Wait, the backend sends negative numbers for "Less...". 
    // If we format -(-100) we get 100. If we format -100 we get -100.
    // Let's stick to standard display: (100)
    // Actually, in `excel_cfs` dict, I manually negated them in python? 
    // Python: "Less: Change in NWC": [-x for x in change_in_nwc[1:]]
    // So if NWC increased by 10, data is -10. Display should be -10.
    // My insertRow `isReversed` param flips sign. I should NOT use isReversed here if data is already neg.
    // The previous JS code used `isReversed` on the RAW `Change in NWC` list. Now we use `excel_cfs` processed list.
    // Let's rely on data values directly.
    
    // Manually handle CFS to ensure order
    const cfData = data["excel_cfs"];
    insertRow(cfBody, "Cash Flow Operations", cfData["Cash Flow from Operations"], true);
    insertRow(cfBody, "Cash Flow Investing", cfData["Cash Flow from Investing (CapEx)"], true);
    insertRow(cfBody, "Cash Flow Financing", cfData["Cash Flow from Financing"], true);
    insertRow(cfBody, "Net Change in Cash", cfData["Net Change in Cash"], true);

    renderCharts(data);
    resultsContainer.style.display = 'block';
    
    // Auto switch to Income tab
    document.querySelector('.tab-link').click();
}

function renderCharts(data) {
    const labels = data["Years"].slice(1).map(x => typeof x === 'number' ? `Year ${x}` : x);
    
    // Simple Chart Data
    const rev = data["Revenue"].slice(1);
    const ni = data["Net Income"].slice(1);
    const cash = data["Closing Cash"].slice(1);
    
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(document.getElementById('revenueKpiChart'), {
        type: 'bar',
        data: { labels: labels, datasets: [
            { label: 'Revenue', data: rev, backgroundColor: '#36a2eb' },
            { label: 'Net Income', data: ni, backgroundColor: '#4bc0c0' }
        ]},
        options: { responsive: true, plugins: { title: { display: true, text: 'Profitability' } } }
    });

    if (cashDebtChart) cashDebtChart.destroy();
    cashDebtChart = new Chart(document.getElementById('cashDebtChart'), {
        type: 'line',
        data: { labels: labels, datasets: [
            { label: 'Cash Balance', data: cash, borderColor: '#ff9f40', fill: true }
        ]},
        options: { responsive: true, plugins: { title: { display: true, text: 'Cash Position' } } }
    });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    createAllGranularInputs(3);
});
