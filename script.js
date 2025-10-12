// API URLs
const API_URL = 'https://financial-forecast-api-hyl3.onrender.com/api/forecast'; 
const EXPORT_API_URL = 'https://financial-forecast-api-hyl3.onrender.com/api/export'; 

// DOM Elements
const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const incomeStatementBody = document.querySelector('#incomeStatementTable tbody');
const balanceSheetBody = document.querySelector('#balanceSheetTable tbody');
const cashFlowBody = document.querySelector('#cashFlowTable tbody');
const errorMessage = document.getElementById('error-message');
const yearButtons = document.querySelectorAll('.year-select-btn');
const forecastYearsInput = document.getElementById('forecast_years');
const revenueGrowthContainer = document.getElementById('revenue-growth-container');
// NEW: COGS container element
const cogsPctContainer = document.getElementById('cogs-pct-container');

// Chart instances
let revenueChart = null;
let cashDebtChart = null;

/**
 * NEW: Shows/hides year-specific revenue growth inputs based on selected forecast duration.
 * Also updates the label of the last visible input to say "(and thereafter)".
 * @param {number} yearsToShow - The number of years to show inputs for (3, 5, or 10).
 */
function updateRevenueGrowthInputs(yearsToShow) {
    const allGrowthInputs = revenueGrowthContainer.querySelectorAll('.input-group');
    
    allGrowthInputs.forEach(inputDiv => {
        const year = parseInt(inputDiv.dataset.year, 10);
        const label = inputDiv.querySelector('label');
        
        // Reset label text first
        label.textContent = `Revenue Growth Year ${year} (%):`;
        
        if (year <= yearsToShow) {
            inputDiv.style.display = 'flex'; // Show the input
            if (year === yearsToShow) {
                // Add "(and thereafter)" to the last visible input's label
                label.textContent = `Revenue Growth Year ${year} (and thereafter) (%):`;
            }
        } else {
            inputDiv.style.display = 'none'; // Hide the input
        }
    });
}

/**
 * NEW: Generates and populates year-specific COGS inputs.
 * @param {number} years - The number of years to generate inputs for.
 */
function createGranularCogsInputs(years) {
    cogsPctContainer.innerHTML = ''; // Clear previous inputs
    
    // Use the default COGS value from the left pane
    const defaultCogs = parseFloat(document.getElementById('default_cogs_pct').value);

    for (let i = 1; i <= years; i++) {
        const inputDiv = document.createElement('div');
        inputDiv.className = 'input-group';
        
        // Use the initial default COGS for all years
        const initialValue = defaultCogs;
        
        const labelText = `COGS Year ${i} (%):`;

        inputDiv.innerHTML = `
            <label for="cogs_pct_y${i}">${labelText}</label>
            <input type="number" id="cogs_pct_y${i}" value="${initialValue}" step="0.1" required>
        `;
        cogsPctContainer.appendChild(inputDiv);
    }
}

// --- Event Listeners ---

// Handle clicks on 3, 5, 10 year duration buttons
yearButtons.forEach(button => {
    button.addEventListener('click', () => {
        yearButtons.forEach(btn => btn.classList.remove('selected-year-btn'));
        button.classList.add('selected-year-btn');
        
        const newYears = button.getAttribute('data-years');
        forecastYearsInput.value = newYears;
        
        // Call the new function to update the UI
        updateRevenueGrowthInputs(parseInt(newYears, 10));
        createGranularCogsInputs(parseInt(newYears, 10)); // NEW
    });
});

// NEW: Event listener to re-generate COGS inputs if the default value changes
document.getElementById('default_cogs_pct').addEventListener('change', () => {
    const years = parseInt(forecastYearsInput.value, 10);
    createGranularCogsInputs(years); // Call to refresh with new default value
});

// Main form submission for calculation
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await handleForecastRequest(API_URL);
});

// Export button click
document.getElementById('exportBtn').addEventListener('click', async () => {
    await handleForecastRequest(EXPORT_API_URL, true);
});

/**
 * Universal handler for both calculation and export requests.
 * @param {string} url - The API endpoint to call.
 * @param {boolean} isExport - Flag to determine if the request is for an Excel export.
 */
async function handleForecastRequest(url, isExport = false) {
    errorMessage.textContent = isExport ? 'Generating Excel file...' : '';
    
    try {
        const data = collectInputData();
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || `API Error: ${response.statusText}`);
        }

        if (isExport) {
            await handleFileDownload(response);
        } else {
            const result = await response.json();
            renderResults(result, document.getElementById('currency_symbol')?.value || '$');
        }

    } catch (error) {
        console.error("Client-side error:", error);
        errorMessage.textContent = `Error: ${error.message}`;
        if (!isExport) {
            resultsContainer.style.display = 'none';
        }
    }
}

/**
 * Gathers all data from the form inputs. (MODIFIED)
 * @returns {object} The data object ready to be sent to the API.
 */
function collectInputData() {
    const data = {};
    const years = parseInt(forecastYearsInput.value, 10);
    
    // --- Collect year-specific revenue growth rates ---
    data.revenue_growth_rates = [];
    for (let i = 1; i <= years; i++) {
        const value = parseFloat(document.getElementById(`revenue_growth_y${i}`).value) / 100;
        data.revenue_growth_rates.push(value);
    }
    
    // --- NEW: Collect year-specific COGS rates ---
    data.cogs_pct_rates = [];
    for (let i = 1; i <= years; i++) {
        // Collect the granular value, or use the default if the granular field is missing
        const input = document.getElementById(`cogs_pct_y${i}`);
        const value = parseFloat(input?.value || document.getElementById('default_cogs_pct').value) / 100;
        data.cogs_pct_rates.push(value);
    }

    // Collect other inputs
    data.initial_revenue = parseFloat(document.getElementById('initial_revenue').value);
    data.fixed_opex = parseFloat(document.getElementById('fixed_opex').value);
    data.initial_ppe = parseFloat(document.getElementById('initial_ppe').value);
    data.capex = parseFloat(document.getElementById('capex').value);
    data.dso_days = parseFloat(document.getElementById('dso_days').value);
    data.dio_days = parseFloat(document.getElementById('dio_days').value);
    data.dpo_days = parseFloat(document.getElementById('dpo_days').value);
    data.initial_debt = parseFloat(document.getElementById('initial_debt').value);
    data.initial_cash = parseFloat(document.getElementById('initial_cash').value);
    data.annual_debt_repayment = parseFloat(document.getElementById('annual_debt_repayment').value);
    // REMOVED: data.cogs_pct (now handled via cogs_pct_rates list)
    data.depreciation_rate = parseFloat(document.getElementById('depreciation_rate').value) / 100;
    data.tax_rate = parseFloat(document.getElementById('tax_rate').value) / 100;
    data.interest_rate = parseFloat(document.getElementById('interest_rate').value) / 100;
    data.years = years;

    // Validate all collected data
    for (const key in data) {
        const value = data[key];
        if (Array.isArray(value)) {
            if (value.some(isNaN)) throw new Error(`Invalid value for ${key}.`);
        } else {
            if (isNaN(value)) throw new Error(`Invalid value for ${key}. Please fill all fields.`);
        }
    }
    
    return data;
}

/**
 * Handles the logic for triggering a file download from a response.
 * @param {Response} response The fetch response object.
 */
async function handleFileDownload(response) {
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'Financial_Forecast.xlsx'; 
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    errorMessage.textContent = 'Excel file downloaded successfully.';
}

/**
 * Renders the forecast results into HTML tables and charts.
 * @param {object} data The forecast results from the backend.
 * @param {string} currencySymbol The selected currency symbol.
 */
function renderResults(data, currencySymbol) {
    [incomeStatementBody, balanceSheetBody, cashFlowBody].forEach(body => body.innerHTML = '');

    const format = (value) => `${value < 0 ? '-' : ''}${currencySymbol}${Math.abs(value).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

    const allYears = data["Years"]; 
    const is_cfs_years = allYears.slice(1); 
    const bs_years = allYears; 
    
    // Dynamically create table headers
    const tableConfigs = [
        { id: 'incomeStatementTable', years: is_cfs_years },
        { id: 'balanceSheetTable', years: bs_years },
        { id: 'cashFlowTable', years: is_cfs_years } 
    ];

    tableConfigs.forEach(config => {
        const thead = document.querySelector(`#${config.id} thead`);
        thead.innerHTML = ''; 
        const headerRow = thead.insertRow();
        headerRow.insertCell().textContent = 'Line Item';
        config.years.forEach(year => {
            const cell = headerRow.insertCell();
            cell.textContent = (config.id === 'balanceSheetTable' && year === 0) ? 'Year 0 (Initial)' : `Year ${year}`;
        });
    });

    const insertDataRow = (config) => {
        const row = config.tableBody.insertRow();
        if (config.customClass) row.className = config.customClass;
        if (config.isBold) row.style.fontWeight = 'bold';
        row.insertCell().textContent = config.label;
        
        let rowData = config.dataKey ? (data[config.dataKey] || []) : config.calculation(data);
        const yearsToRender = (config.tableBody === balanceSheetBody) ? bs_years : is_cfs_years;
        const slicedData = rowData.slice(config.startIdx);
        
        yearsToRender.forEach((_, index) => {
            const value = slicedData[index];
            const cell = row.insertCell();
            cell.textContent = (typeof value === 'number') ? format(config.isReversed ? -value : value) : '-';
            cell.classList.add('data-cell');
        });
    };
    
    // Data definitions for rendering tables
    const forecastData = [
        // Income Statement
        { label: "Revenue", dataKey: "Revenue", tableBody: incomeStatementBody, startIdx: 1, isBold: true, customClass: 'heavy-total-row' },
        { label: "COGS", dataKey: "COGS", tableBody: incomeStatementBody, startIdx: 1 },
        { label: "Gross Profit", dataKey: "Gross Profit", tableBody: incomeStatementBody, startIdx: 1, isBold: true, customClass: 'heavy-total-row' },
        { label: "Fixed Operating Expenses", dataKey: "Fixed Opex", tableBody: incomeStatementBody, startIdx: 1 },
        { label: "Depreciation", dataKey: "Depreciation", tableBody: incomeStatementBody, startIdx: 1 },
        { label: "EBIT", dataKey: "EBIT", tableBody: incomeStatementBody, startIdx: 1, isBold: true, customClass: 'heavy-total-row' },
        { label: "Interest Expense", dataKey: "Interest Expense", tableBody: incomeStatementBody, startIdx: 1 },
        { label: "EBT", dataKey: "EBT", tableBody: incomeStatementBody, startIdx: 1 },
        { label: "Taxes", dataKey: "Taxes", tableBody: incomeStatementBody, startIdx: 1 },
        { label: "Net Income", dataKey: "Net Income", tableBody: incomeStatementBody, startIdx: 1, isBold: true, customClass: 'heavy-total-row' },

        // Balance Sheet
        { label: "Cash", dataKey: "Closing Cash", tableBody: balanceSheetBody, startIdx: 0 },
        { label: "Accounts Receivable", dataKey: "Closing AR", tableBody: balanceSheetBody, startIdx: 0 },
        { label: "Inventory", dataKey: "Closing Inventory", tableBody: balanceSheetBody, startIdx: 0 },
        { label: "Net PP&E", dataKey: "Closing PP&E", tableBody: balanceSheetBody, startIdx: 0 },
        { label: "Total Assets", calculation: (d) => d["Closing Cash"].map((_, i) => d["Closing Cash"][i] + d["Closing AR"][i] + d["Closing Inventory"][i] + d["Closing PP&E"][i]), tableBody: balanceSheetBody, startIdx: 0, isBold: true, customClass: 'heavy-total-row' },
        { label: "Accounts Payable", dataKey: "Closing AP", tableBody: balanceSheetBody, startIdx: 0 },
        { label: "Debt", dataKey: "Closing Debt", tableBody: balanceSheetBody, startIdx: 0 },
        { label: "Retained Earnings", dataKey: "Closing RE", tableBody: balanceSheetBody, startIdx: 0 },
        { label: "Total Liabilities & Equity", calculation: (d) => d["Closing AP"].map((_, i) => d["Closing AP"][i] + d["Closing Debt"][i] + d["Closing RE"][i]), tableBody: balanceSheetBody, startIdx: 0, isBold: true, customClass: 'heavy-total-row' },

        // Cash Flow Statement
        { label: "Net Income", dataKey: "Net Income", tableBody: cashFlowBody, startIdx: 1 },
        { label: "Add: Depreciation", dataKey: "Depreciation", tableBody: cashFlowBody, startIdx: 1 },
        { label: "Less: Change in NWC", dataKey: "Change in NWC", tableBody: cashFlowBody, startIdx: 1, isReversed: true },
        { label: "Cash Flow from Operations", calculation: (d) => d["Net Income"].slice(1).map((val, i) => val + d["Depreciation"].slice(1)[i] - d["Change in NWC"].slice(1)[i]), tableBody: cashFlowBody, startIdx: 0, isBold: true, customClass: 'heavy-total-row' },
        { label: "Cash Flow from Investing (CapEx)", calculation: () => is_cfs_years.map(() => -parseFloat(document.getElementById('capex').value)), tableBody: cashFlowBody, startIdx: 0, isBold: true, customClass: 'heavy-total-row' },
        { label: "Cash Flow from Financing", dataKey: "Cash Flow from Financing", tableBody: cashFlowBody, startIdx: 1, isBold: true, customClass: 'heavy-total-row' },
        { label: "Net Change in Cash", dataKey: "Net Change in Cash", tableBody: cashFlowBody, startIdx: 1, isBold: true, customClass: 'heavy-total-row' },
    ];
    
    forecastData.forEach(insertDataRow); 
    
    renderCharts(data);
    resultsContainer.style.display = 'block';
}

/**
 * Renders/updates the charts with new forecast data.
 * @param {object} data The forecast results from the backend.
 */
function renderCharts(data) {
    const years = data["Years"].slice(1).map(y => `Year ${y}`);
    const ebitPct = data["Revenue"].slice(1).map((rev, i) => rev === 0 ? 0 : (data["EBIT"].slice(1)[i] / rev) * 100);

    const chartConfigs = [{
        chartVar: 'revenueChart', canvasId: 'revenueKpiChart', config: {
            type: 'bar',
            data: { labels: years, datasets: [
                { label: 'Revenue', data: data["Revenue"].slice(1), backgroundColor: 'rgba(54, 162, 235, 0.7)', yAxisID: 'y' },
                { label: 'Net Income', data: data["Net Income"].slice(1), backgroundColor: 'rgba(75, 192, 192, 0.7)', yAxisID: 'y' },
                { type: 'line', label: 'EBIT %', data: ebitPct, borderColor: 'rgb(255, 99, 132)', borderWidth: 3, fill: false, yAxisID: 'y1' }
            ]},
            options: { responsive: true, interaction: { mode: 'index', intersect: false }, scales: {
                y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Amount' } },
                y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Percentage (%)' } }
            }, plugins: { title: { display: true, text: 'Profitability Trends' } } }
        }
    }, {
        chartVar: 'cashDebtChart', canvasId: 'cashDebtChart', config: {
            type: 'bar',
            data: { labels: years, datasets: [
                { label: 'Closing Cash', data: data["Closing Cash"].slice(1), backgroundColor: 'rgba(255, 159, 64, 0.7)' },
                { label: 'Closing Debt', data: data["Closing Debt"].slice(1), backgroundColor: 'rgba(255, 99, 132, 0.7)' }
            ]},
            options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { title: { display: true, text: 'Liquidity & Capital Structure' } } }
        }
    }];

    // Using a map to hold chart instances { 'revenueChart': chartInstance }
    const charts = { revenueChart, cashDebtChart };

    chartConfigs.forEach(cfg => {
        if (charts[cfg.chartVar]) charts[cfg.chartVar].destroy();
        charts[cfg.chartVar] = new Chart(document.getElementById(cfg.canvasId).getContext('2d'), cfg.config);
    });

    // Re-assign global variables
    revenueChart = charts.revenueChart;
    cashDebtChart = charts.cashDebtChart;
}


// --- Initial Setup ---
// Set the initial visibility of revenue growth inputs when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const years = 3;
    updateRevenueGrowthInputs(years); // Default to 3 years
    createGranularCogsInputs(years);   // NEW: Initialize granular COGS inputs
});
