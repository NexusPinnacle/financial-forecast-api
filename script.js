const API_URL = '/api/forecast'; 
const EXPORT_API_URL = '/api/export'; 

const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const errorMessage = document.getElementById('error-message');

const annualButtons = document.querySelectorAll('.year-select-btn');
const monthlyDetailSelect = document.getElementById('monthly_detail_select');
const forecastYearsInput = document.getElementById('forecast_years');
const monthlyDetailInput = document.getElementById('monthly_detail');

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
    createVerticalInputs(granularContainers.revenue_growth, 'revenue_growth', 'Revenue Growth', numYears, 'default_revenue_growth', '0.1', '(%)');
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
        // 1. Remove BOTH potential active classes from all buttons
        annualButtons.forEach(b => {
            b.classList.remove('active');
            b.classList.remove('selected-year-btn');
        });

        // 2. Add BOTH classes to the clicked button
        btn.classList.add('active');
        btn.classList.add('selected-year-btn');

        // 3. Update the values
        const val = parseInt(btn.getAttribute('data-value'));
        forecastYearsInput.value = val;
        createAllGranularInputs(val);
    });
});

monthlyDetailSelect.addEventListener('change', (e) => {
    monthlyDetailInput.value = e.target.value;
});

const defaults = ['default_revenue_growth', 'default_cogs_pct', 'default_fixed_opex', 'default_capex', 'default_dso_days', 'default_dio_days', 'default_dpo_days', 'default_annual_debt_repayment'];
defaults.forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
        createAllGranularInputs(parseInt(forecastYearsInput.value));
    });
});

document.querySelector('.right-pane').addEventListener('click', (e) => {
    let header = e.target.closest('.collapsible-header');
    if (header) {
        const targetId = header.getAttribute('data-target');
        header.classList.toggle('collapsed');
        document.getElementById(targetId).classList.toggle('expanded-content');
    }
});

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

function collectInputData() {
    const years = parseInt(forecastYearsInput.value, 10);
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
        initial_revenue: parseFloat(document.getElementById('initial_revenue').value),
        tax_rate: parseFloat(document.getElementById('tax_rate').value) / 100,
        initial_ppe: parseFloat(document.getElementById('initial_ppe').value),
        depreciation_rate: parseFloat(document.getElementById('depreciation_rate').value) / 100,
        initial_debt: parseFloat(document.getElementById('initial_debt').value),
        initial_cash: parseFloat(document.getElementById('initial_cash').value),
        interest_rate: parseFloat(document.getElementById('interest_rate').value) / 100,
        years: years,
        monthly_detail: parseInt(monthlyDetailInput.value),
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
    
    const bsCols = data["Display_Labels"];
    const isCols = data["Display_Labels"].slice(1);

    const createHeader = (thead, cols) => {
        const row = thead.insertRow();
        row.insertCell().textContent = 'Line Item';
        cols.forEach(c => { row.insertCell().textContent = c; });
    };

    createHeader(isHead, isCols);
    createHeader(bsHead, bsCols);
    createHeader(cfHead, isCols);

    const insertRow = (body, label, rowData, isBold=false) => {
        const row = body.insertRow();
        if (isBold) row.className = 'heavy-total-row';
        row.insertCell().textContent = label;
        rowData.forEach(val => {
            const cell = row.insertCell();
            cell.textContent = format(val);
            cell.className = 'data-cell';
        });
    };

    // Mapping keys from display_data
    const d = data["display_data"];
    insertRow(isBody, "Revenue", d["Revenue"], true);
    insertRow(isBody, "COGS", d["COGS"]);
    insertRow(isBody, "Gross Profit", d["Gross Profit"], true);
    insertRow(isBody, "Fixed Opex", d["Fixed Opex"]);
    insertRow(isBody, "Depreciation", d["Depreciation"]);
    insertRow(isBody, "EBIT", d["EBIT"], true);
    insertRow(isBody, "Interest", d["Interest"]);
    insertRow(isBody, "Taxes", d["Taxes"]);
    insertRow(isBody, "Net Income", d["Net Income"], true);

    insertRow(bsBody, "Cash", d["Cash"]);
    insertRow(bsBody, "Accounts Receivable", d["AR"]);
    insertRow(bsBody, "Inventory", d["Inventory"]);
    insertRow(bsBody, "Net PP&E", d["PPE"]);
    insertRow(bsBody, "Total Assets", d["Total Assets"], true);
    insertRow(bsBody, "Accounts Payable", d["AP"]);
    insertRow(bsBody, "Debt", d["Debt"]);
    insertRow(bsBody, "Retained Earnings", d["RE"]);
    insertRow(bsBody, "Total Liab & Eq", d["Total LiabEq"], true);

    insertRow(cfBody, "Net Income", d["CF_NI"]);
    insertRow(cfBody, "Add: Depreciation", d["CF_Dep"]);
    insertRow(cfBody, "Less: Change in NWC", d["CF_NWC"]);
    insertRow(cfBody, "Cash Flow Operations", d["CFO"], true);
    insertRow(cfBody, "Cash Flow Investing", d["CFI"], true);
    insertRow(cfBody, "Cash Flow Financing", d["CFF"], true);
    insertRow(cfBody, "Net Change in Cash", d["Net Cash Change"], true);

    renderCharts(data);
    resultsContainer.style.display = 'block';
    document.querySelector('.tab-link').click();
}

function renderCharts(data) {
    const labels = data["Display_Labels"].slice(1);
    const d = data["display_data"];
    
    if (revenueChart) revenueChart.destroy();
    revenueChart = new Chart(document.getElementById('revenueKpiChart'), {
        type: 'bar',
        data: { labels: labels, datasets: [
            { label: 'Revenue', data: d["Revenue"], backgroundColor: '#36a2eb' },
            { label: 'Net Income', data: d["Net Income"], backgroundColor: '#4bc0c0' }
        ]},
        options: { responsive: true, plugins: { title: { display: true, text: 'Profitability' } } }
    });

    if (cashDebtChart) cashDebtChart.destroy();
    cashDebtChart = new Chart(document.getElementById('cashDebtChart'), {
        type: 'line',
        data: { labels: labels, datasets: [
            { label: 'Cash Balance', data: d["Cash"].slice(1), borderColor: '#ff9f40', fill: true }
        ]},
        options: { responsive: true, plugins: { title: { display: true, text: 'Cash Position' } } }
    });
}

document.addEventListener('DOMContentLoaded', (3) => { 
    const defaultYears = 5; // Updated default
    createAllGranularInputs(defaultYears); 

