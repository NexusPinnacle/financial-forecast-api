// API URLs
const API_URL = 'https://financial-forecast-api-hyl3.onrender.com/api/forecast'; 
const EXPORT_API_URL = 'https://financial-forecast-api-hyl3.onrender.com/api/export'; 

// --- DOM Elements ---
const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const errorMessage = document.getElementById('error-message');
const yearButtons = document.querySelectorAll('.year-select-btn');
const forecastYearsInput = document.getElementById('forecast_years');
const revGrowthContainer = document.getElementById('revenue-growth-container');
const cogsContainer = document.getElementById('cogs-container');
const opexContainer = document.getElementById('opex-container');

// --- Chart Instances ---
let revenueChart = null;
let cashDebtChart = null;

// --- Config for Dynamic Inputs ---
const dynamicInputConfigs = [
    { container: revGrowthContainer, idPrefix: 'revenue_growth_y', defaults: [10, 8, 5, 5, 4, 4, 4, 3, 3, 3] },
    { container: cogsContainer, idPrefix: 'cogs_pct_y', defaults: [40, 40, 41, 41, 42, 42, 42, 42, 42, 42] },
    { container: opexContainer, idPrefix: 'fixed_opex_y', defaults: [100, 105, 110, 115, 120, 125, 130, 135, 140, 145] }
];

/**
 * Creates the initial HTML for a set of year-specific inputs.
 * @param {object} config - The configuration object for the inputs.
 */
function createYearlyInputs(config) {
    let inputsHTML = '';
    for (let i = 1; i <= 10; i++) {
        inputsHTML += `
            <div class="year-input-group" data-year="${i}" style="display: none;">
                <label for="${config.idPrefix}${i}">Year ${i}</label>
                <input type="number" id="${config.idPrefix}${i}" value="${config.defaults[i-1]}" step="0.01" required>
            </div>`;
    }
    config.container.innerHTML = inputsHTML;
}

/**
 * Shows/hides year-specific inputs based on selected forecast duration.
 * @param {number} yearsToShow - The number of years to show inputs for.
 */
function updateVisibleInputs(yearsToShow) {
    dynamicInputConfigs.forEach(config => {
        const allInputs = config.container.querySelectorAll('.year-input-group');
        allInputs.forEach(inputDiv => {
            const year = parseInt(inputDiv.dataset.year, 10);
            const label = inputDiv.querySelector('label');
            label.textContent = `Year ${year}`; // Reset label
            
            if (year <= yearsToShow) {
                inputDiv.style.display = 'flex';
                if (year === yearsToShow) {
                    label.textContent = `Year ${year}+`; // Add '+' to the last visible input
                }
            } else {
                inputDiv.style.display = 'none';
            }
        });
    });
}

/**
 * Gathers all data from the form inputs.
 * @returns {object} The data object ready to be sent to the API.
 */
function collectInputData() {
    const data = { years: parseInt(forecastYearsInput.value, 10) };
    
    // Collect from dynamic inputs
    data.revenue_growth_rates = getYearlyValues('revenue_growth_y', data.years, 100);
    data.cogs_pcts = getYearlyValues('cogs_pct_y', data.years, 100);
    data.fixed_opex_list = getYearlyValues('fixed_opex_y', data.years);
    
    // Collect from static inputs
    const staticInputs = {
        initial_revenue: 1, initial_ppe: 1, capex: 1, depreciation_rate: 100, tax_rate: 100,
        dso_days: 1, dio_days: 1, dpo_days: 1, initial_cash: 1, initial_debt: 1,
        annual_debt_repayment: 1, interest_rate: 100
    };
    for (const [id, divisor] of Object.entries(staticInputs)) {
        data[id] = parseFloat(document.getElementById(id).value) / divisor;
    }
    
    // Validate all collected data
    for (const key in data) {
        if (Array.isArray(data[key]) ? data[key].some(isNaN) : isNaN(data[key])) {
            throw new Error(`Invalid value for ${key}. Please fill all fields correctly.`);
        }
    }
    return data;
}

/**
 * Helper to read values from a series of yearly inputs.
 * @param {string} idPrefix - The prefix for the input IDs.
 * @param {number} years - The number of years to collect.
 * @param {number} [divisor=1] - Optional divisor for percentage values.
 * @returns {number[]} An array of the collected values.
 */
function getYearlyValues(idPrefix, years, divisor = 1) {
    const values = [];
    for (let i = 1; i <= years; i++) {
        values.push(parseFloat(document.getElementById(`${idPrefix}${i}`).value) / divisor);
    }
    return values;
}


// --- Event Handlers & API Calls ---
async function handleForecastRequest(url, isExport = false) {
    errorMessage.textContent = isExport ? 'Generating Excel file...' : 'Calculating...';
    try {
        const data = collectInputData();
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) throw new Error((await response.json()).error || 'API Error');
        
        if (isExport) {
            await handleFileDownload(response);
        } else {
            renderResults(await response.json(), document.getElementById('currency_symbol')?.value || '$');
            errorMessage.textContent = '';
        }
    } catch (error) {
        errorMessage.textContent = `Error: ${error.message}`;
    }
}

async function handleFileDownload(response) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: 'Financial_Forecast.xlsx' });
    document.body.appendChild(a).click();
    window.URL.revokeObjectURL(url);
    a.remove();
    errorMessage.textContent = 'Excel file downloaded successfully.';
}


// --- Event Listeners Setup ---
document.addEventListener('DOMContentLoaded', () => {
    dynamicInputConfigs.forEach(createYearlyInputs);
    updateVisibleInputs(3);

    yearButtons.forEach(button => {
        button.addEventListener('click', () => {
            yearButtons.forEach(btn => btn.classList.remove('selected-year-btn'));
            button.classList.add('selected-year-btn');
            const numYears = parseInt(button.dataset.years, 10);
            forecastYearsInput.value = numYears;
            updateVisibleInputs(numYears);
        });
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleForecastRequest('/api/forecast');
    });

    document.getElementById('exportBtn').addEventListener('click', () => handleForecastRequest('/api/export', true));
});


// --- Rendering Functions (No changes below this line) ---
function renderResults(data, currencySymbol) {
    const format = (v) => `${v < 0 ? '-' : ''}${currencySymbol}${Math.abs(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    const allYears = data.Years, is_cfs_years = allYears.slice(1), bs_years = allYears;

    const renderTable = (tableId, years, dataRows) => {
        const table = document.getElementById(tableId);
        const thead = table.querySelector('thead');
        const tbody = table.querySelector('tbody');
        thead.innerHTML = `<tr><th>Line Item</th>${years.map(y => `<th>${y === 0 ? 'Year 0' : `Year ${y}`}</th>`).join('')}</tr>`;
        tbody.innerHTML = dataRows.map(rowConfig => {
            const rowData = rowConfig.calc ? rowConfig.calc(data) : data[rowConfig.key];
            const cells = rowData.slice(rowConfig.startIdx).map(val => `<td>${format(rowConfig.rev ? -val : val)}</td>`).join('');
            return `<tr class="${rowConfig.bold ? 'heavy-total-row' : ''}"><td>${rowConfig.label}</td>${cells}</tr>`;
        }).join('');
    };

    renderTable('incomeStatementTable', is_cfs_years, [
        { label: "Revenue", key: "Revenue", startIdx: 1, bold: true }, { label: "COGS", key: "COGS", startIdx: 1 },
        { label: "Gross Profit", key: "Gross Profit", startIdx: 1, bold: true }, { label: "Fixed Operating Expenses", key: "Fixed Opex", startIdx: 1 },
        { label: "Depreciation", key: "Depreciation", startIdx: 1 }, { label: "EBIT", key: "EBIT", startIdx: 1, bold: true },
        { label: "Interest Expense", key: "Interest Expense", startIdx: 1 }, { label: "EBT", key: "EBT", startIdx: 1 },
        { label: "Taxes", key: "Taxes", startIdx: 1 }, { label: "Net Income", key: "Net Income", startIdx: 1, bold: true }
    ]);
    renderTable('balanceSheetTable', bs_years, [
        { label: "Cash", key: "Closing Cash", startIdx: 0 }, { label: "Accounts Receivable", key: "Closing AR", startIdx: 0 },
        { label: "Inventory", key: "Closing Inventory", startIdx: 0 }, { label: "Net PP&E", key: "Closing PP&E", startIdx: 0 },
        { label: "Total Assets", calc: d => d.ClosingCash.map((c, i) => c + d.ClosingAR[i] + d.ClosingInventory[i] + d.ClosingPPE[i]), startIdx: 0, bold: true },
        { label: "Accounts Payable", key: "Closing AP", startIdx: 0 }, { label: "Debt", key: "Closing Debt", startIdx: 0 },
        { label: "Retained Earnings", key: "Closing RE", startIdx: 0 },
        { label: "Total Liab. & Equity", calc: d => d.ClosingAP.map((ap, i) => ap + d.ClosingDebt[i] + d.ClosingRE[i]), startIdx: 0, bold: true }
    ]);
    renderTable('cashFlowTable', is_cfs_years, [
        { label: "Net Income", key: "Net Income", startIdx: 1 }, { label: "Add: Depreciation", key: "Depreciation", startIdx: 1 },
        { label: "Less: Change in NWC", key: "Change in NWC", startIdx: 1, rev: true },
        { label: "Cash Flow from Ops.", calc: d => d.NetIncome.slice(1).map((ni, i) => ni + d.Depreciation[i+1] - d.ChangeinNWC[i+1]), startIdx: 0, bold: true },
        { label: "Cash Flow from Inv.", calc: d => Array(d.Years.length - 1).fill(-d.excel_cfs["Cash Flow from Investing (CapEx)"][0]), startIdx: 0, bold: true },
        { label: "Cash Flow from Fin.", key: "Cash Flow from Financing", startIdx: 1, bold: true },
        { label: "Net Change in Cash", key: "Net Change in Cash", startIdx: 1, bold: true }
    ]);

    renderCharts(data);
    resultsContainer.style.display = 'block';
}

function renderCharts(data) {
    const years = data.Years.slice(1).map(y => `Year ${y}`);
    const chartConfigs = {
        revenueKpiChart: {
            type: 'bar',
            data: { labels: years, datasets: [
                { label: 'Revenue', data: data.Revenue.slice(1), backgroundColor: 'rgba(54, 162, 235, 0.7)', yAxisID: 'y' },
                { label: 'Net Income', data: data.NetIncome.slice(1), backgroundColor: 'rgba(75, 192, 192, 0.7)', yAxisID: 'y' },
                { type: 'line', label: 'EBIT %', data: data.Revenue.slice(1).map((r, i) => r === 0 ? 0 : (data.EBIT[i+1] / r) * 100), borderColor: 'rgb(255, 99, 132)', yAxisID: 'y1' }
            ]},
            options: { scales: { y: { title: { text: 'Amount' } }, y1: { position: 'right', grid: { drawOnChartArea: false }, title: { text: 'Percentage (%)' } } }, plugins: { title: { text: 'Profitability Trends' } } }
        },
        cashDebtChart: {
            type: 'bar',
            data: { labels: years, datasets: [
                { label: 'Closing Cash', data: data.ClosingCash.slice(1), backgroundColor: 'rgba(255, 159, 64, 0.7)' },
                { label: 'Closing Debt', data: data.ClosingDebt.slice(1), backgroundColor: 'rgba(255, 99, 132, 0.7)' }
            ]},
            options: { plugins: { title: { text: 'Liquidity & Capital Structure' } } }
        }
    };
    [revenueChart, cashDebtChart] = ['revenueKpiChart', 'cashDebtChart'].map(id => {
        const chartInstance = Chart.getChart(id);
        if (chartInstance) chartInstance.destroy();
        return new Chart(document.getElementById(id), { ...chartConfigs[id], options: { ...chartConfigs[id].options, responsive: true }});
    });
}

