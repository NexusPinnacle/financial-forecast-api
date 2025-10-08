// script.js

// URL for your Flask API running locally
// *** REMEMBER TO UPDATE THIS URL WHEN YOU DEPLOY! ***
const API_URL = 'https://financial-forecast-api-hyl3.onrender.com/api/forecast'; 
const EXPORT_API_URL = 'https://financial-forecast-api-hyl3.onrender.com/api/export'; 
const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const incomeStatementBody = document.querySelector('#incomeStatementTable tbody');
const balanceSheetBody = document.querySelector('#balanceSheetTable tbody');
const cashFlowBody = document.querySelector('#cashFlowTable tbody');
const errorMessage = document.getElementById('error-message');
const yearButtons = document.querySelectorAll('.year-select-btn');
const forecastYearsInput = document.getElementById('forecast_years');


// ----------------------------------------------------
// NEW: LOGIC TO HANDLE YEAR BUTTON CLICKS
// ----------------------------------------------------
yearButtons.forEach(button => {
    button.addEventListener('click', () => {
        // 1. Remove 'selected' class from all buttons
        yearButtons.forEach(btn => btn.classList.remove('selected-year-btn'));
        
        // 2. Add 'selected' class to the clicked button
        button.classList.add('selected-year-btn');
        
        // 3. Update the hidden input value
        const newYears = button.getAttribute('data-years');
        forecastYearsInput.value = newYears;
        
        // Optional: Clear results if forecast length changes
        // document.getElementById('results-container').innerHTML = '';
    });
});
// ----------------------------------------------------


// Global variable to hold the chart instance
let revenueChart = null;
let cashDebtChart = null;


form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    errorMessage.textContent = '';
    const data = {};
    // Default currency in case the input is not found (safe fallback)
    let currencySymbol = document.getElementById('currency_symbol')?.value || '$';

    try {
        // 1. Gather all inputs and convert values
        
        // Non-percentage inputs
        data.initial_revenue = parseFloat(document.getElementById('initial_revenue').value);
        data.fixed_opex = parseFloat(document.getElementById('fixed_opex').value);
        data.initial_ppe = parseFloat(document.getElementById('initial_ppe').value);
        data.capex = parseFloat(document.getElementById('capex').value);

        // Days & Initial Balance Inputs
        data.dso_days = parseFloat(document.getElementById('dso_days').value);
        data.dio_days = parseFloat(document.getElementById('dio_days').value);
        data.dpo_days = parseFloat(document.getElementById('dpo_days').value);
        data.initial_debt = parseFloat(document.getElementById('initial_debt').value);
        data.initial_cash = parseFloat(document.getElementById('initial_cash').value);
        data.annual_debt_repayment = parseFloat(document.getElementById('annual_debt_repayment').value); // <-- ADD THIS LINE
        
        
        // Percentage inputs
        data.revenue_growth = parseFloat(document.getElementById('revenue_growth').value) / 100;
        data.cogs_pct = parseFloat(document.getElementById('cogs_pct').value) / 100;
        data.depreciation_rate = parseFloat(document.getElementById('depreciation_rate').value) / 100;
        data.tax_rate = parseFloat(document.getElementById('tax_rate').value) / 100;
        data.interest_rate = parseFloat(document.getElementById('interest_rate').value) / 100;

        
        // CRITICAL CHECK: Ensure no field is NaN
        for (const key in data) {
            if (isNaN(data[key])) {
                throw new Error(`Invalid value for ${key}.`);
            }
        }


        // Append the selected number of years to the data object
        data.years = parseInt(forecastYearsInput.value, 10);

        
        // 2. Call the Python Backend API 
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        // 3. Handle the API Response
        const result = await response.json();
        
        if (!response.ok) {
            errorMessage.textContent = `API Error: ${result.error || response.statusText}`;
            resultsContainer.style.display = 'none';
            return;
        }

        // 4. Display the results - PASS THE CURRENCY SYMBOL   
        renderResults(result, currencySymbol);


        
    } catch (error) {
        // Consolidated error handling for all try blocks
        console.error("Client-side error:", error);
        
        if (error.message.includes('Invalid value')) {
            errorMessage.textContent = 'Please enter valid numerical data for all fields.';
        } else if (error.message.includes('fetch')) {
             errorMessage.textContent = 'Network error: Could not connect to the backend server. Is your Python app running?';
        } else {
             errorMessage.textContent = `An unexpected error occurred: ${error.message}`;
        }
        resultsContainer.style.display = 'none';
    }
});




const exportBtn = document.getElementById('exportBtn');

exportBtn.addEventListener('click', async () => {
    // Prevent default form action, although it's a button, good practice
    // Collect all input data, similar to the main submission
    const data = {};
    let allInputsValid = true;
    const errorMessage = document.getElementById('error-message'); // Ensure error message element is accessible

    try {
        // Collect all input values (Same logic as the main form submission)
        // Non-percentage inputs
        data.initial_revenue = parseFloat(document.getElementById('initial_revenue').value);
        data.fixed_opex = parseFloat(document.getElementById('fixed_opex').value);
        data.initial_ppe = parseFloat(document.getElementById('initial_ppe').value);
        data.capex = parseFloat(document.getElementById('capex').value);

        // Days & Initial Balance Inputs
        data.dso_days = parseFloat(document.getElementById('dso_days').value);
        data.dio_days = parseFloat(document.getElementById('dio_days').value);
        data.dpo_days = parseFloat(document.getElementById('dpo_days').value);
        data.initial_debt = parseFloat(document.getElementById('initial_debt').value);
        data.initial_cash = parseFloat(document.getElementById('initial_cash').value);
        data.annual_debt_repayment = parseFloat(document.getElementById('annual_debt_repayment').value);
        
        // Percentage inputs (converted to decimal for backend)
        data.revenue_growth = parseFloat(document.getElementById('revenue_growth').value) / 100;
        data.cogs_pct = parseFloat(document.getElementById('cogs_pct').value) / 100;
        data.depreciation_rate = parseFloat(document.getElementById('depreciation_rate').value) / 100;
        data.tax_rate = parseFloat(document.getElementById('tax_rate').value) / 100;
        data.interest_rate = parseFloat(document.getElementById('interest_rate').value) / 100;

        // CRITICAL CHECK: Ensure no required field is NaN
        for (const key in data) {
             // Only check for fields that are typically not zeroed out by default, but check for NaN across the board
             // A quick check that relies on the user running the forecast first
            if (isNaN(data[key])) {
                allInputsValid = false;
                break;
            }
        }

        if (!allInputsValid) {
            errorMessage.textContent = 'Please run the forecast and ensure all fields have valid numbers before exporting.';
            return;
        }
        
        errorMessage.textContent = 'Generating Excel file... This may take a moment.';
        
        data.years = parseInt(forecastYearsInput.value, 10); 
        
        // 2. Call the new Python Backend Export API
        const response = await fetch(EXPORT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        // 3. Handle the file download response
        if (response.ok) {
            errorMessage.textContent = 'Excel file downloaded successfully.';
            
            // Get the suggested filename from the backend's header
            const disposition = response.headers.get('Content-Disposition');
            let filename = 'Financial_Forecast.xlsx';
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    // Remove quotes from filename if present
                    filename = matches[1].replace(/['"]/g, '');
                }
            }

            // Create a temporary link element to trigger the download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename; 
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } else {
            // Read the error message if the response is not a file
            const errorText = await response.text();
            errorMessage.textContent = `Export Error: ${errorText || response.statusText}`;
        }

    } catch (error) {
        console.error("Export error:", error);
        errorMessage.textContent = `An unexpected export error occurred: ${error.message}`;
    }
});






/**
 * Takes the JSON data from the backend and renders it into the HTML tables.
 * @param {object} data - The forecast results from the backend.
 * @param {string} currencySymbol - The selected currency symbol (e.g., '$', '€', '£').
 */
function renderResults(data, currencySymbol) {
    // Clear previous results
    incomeStatementBody.innerHTML = '';
    balanceSheetBody.innerHTML = '';
    cashFlowBody.innerHTML = ''; 
    
    // Helper function to format numbers using the selected currencySymbol
    const format = (value) => {
        const sign = value < 0 ? '-' : '';
        const absoluteValue = Math.abs(value);
        
        // Use the dynamic currencySymbol
        return sign + currencySymbol + absoluteValue.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    };

    const years = data["Years"].slice(1); // [1, 2, 3] or [1, 2, 3, 4, 5], etc.

    // ----------------------------------------------------
    // CHANGE: DYNAMICALLY CREATE TABLE HEADERS
    // ----------------------------------------------------
    
    const tableIds = ['incomeStatementTable', 'balanceSheetTable', 'cashFlowTable'];
    tableIds.forEach(id => {
        const table = document.getElementById(id);
        const thead = table.querySelector('thead');
        
        // 1. Clear existing header
        thead.innerHTML = ''; 
        
        // 2. Create the new row
        const headerRow = thead.insertRow();
        const headerCell = document.createElement('th');
        headerCell.textContent = 'Line Item';
        headerRow.appendChild(headerCell);

        // 3. Add year headers dynamically
        years.forEach(year => {
            const yearCell = document.createElement('th');
            yearCell.textContent = `Year ${year}`;
            headerRow.appendChild(yearCell);
        });
        
    });
    
    // Read the static CapEx value ONCE before the loop
    const capExValue = -parseFloat(document.getElementById('capex').value);


    // --- RENDER INCOME STATEMENT ---
    
    const isItems = [
        { label: "Revenue", dataKey: "Revenue", isBold: true },
        { label: "Cost of Goods Sold", dataKey: "COGS" }, 
        { label: "Gross Profit", dataKey: "Gross Profit", isBold: true },
        { label: "Fixed Operating Expenses", dataKey: "Fixed Opex" }, 
        { label: "Depreciation", dataKey: "Depreciation" },
        { label: "EBIT", dataKey: "EBIT", isBold: true },
        { label: "Interest Expense", dataKey: "Interest Expense" },
        { label: "EBT", dataKey: "EBT", isBold: true }, 
        { label: "Taxes", dataKey: "Taxes" }, 
        { label: "Net Income", dataKey: "Net Income", isBold: true }
    ];

    isItems.forEach(item => {
        const row = incomeStatementBody.insertRow();
        
        if (item.isBold) {
            row.classList.add('is-bold-row');
        }
        
        row.insertCell().textContent = item.label;

        // FIX: Use .slice(1) to skip Year 0
        data[item.dataKey].slice(1).forEach(value => {
            // Updated to use the format function which includes the currencySymbol
            row.insertCell().textContent = format(value); 
        });
    });

    // --- RENDER BALANCE SHEET (Processes ALL 4 years, i=0 to i=3) ---

    const nwc = [];
    const capitalEmployed = [];
    const totalAssets = [];
    const totalLiabilitiesAndEquity = [];
    
    // 1. Calculate the new total metrics for ALL years (i=0 to 3)
    for (let i = 0; i < years; i++) { 
        // NWC = AR + Inventory - AP
        const currentNWC = (data["Closing AR"][i] + data["Closing Inventory"][i]) - data["Closing AP"][i];
        nwc.push(currentNWC);
        
        // Capital Employed = NWC + Net PP&E
        const currentCE = currentNWC + data["Closing PP&E"][i];
        capitalEmployed.push(currentCE);

        // TOTAL ASSETS = Cash + AR + Inventory + PP&E
        const currentAssets = data["Closing Cash"][i] + data["Closing AR"][i] + data["Closing Inventory"][i] + data["Closing PP&E"][i];
        totalAssets.push(currentAssets);
        
        // TOTAL LIABILITIES & EQUITY = AP + Debt + RE
        const currentL_E = data["Closing AP"][i] + data["Closing Debt"][i] + data["Closing RE"][i];
        totalLiabilitiesAndEquity.push(currentL_E);
    }

    // 2. Define the Balance Sheet items
    const bsItems = [
        // --- Current Operating Assets ---
        { label: "Cash", dataKey: "Closing Cash" }, 
        { label: "Accounts Receivable", dataKey: "Closing AR" }, 
        { label: "Inventory", dataKey: "Closing Inventory" }, 

        // --- Non-Current Assets ---
        { label: "Net PP&E", dataKey: "Closing PP&E" },
        
        // --- Total Assets Line ---
        { label: "TOTAL ASSETS", dataKey: "Total Assets", values: totalAssets, isTotal: true, isHeavyTotal: true }, 
        
        // --- Liabilities & Equity ---
        { label: "Accounts Payable", dataKey: "Closing AP" }, 
        { label: "Debt", dataKey: "Closing Debt" }, 
        { label: "Retained Earnings", dataKey: "Closing RE" },

        // --- Final Subtotal: Liabilities & Equity ---
        { label: "TOTAL LIABILITIES & EQUITY", dataKey: "Total L&E", values: totalLiabilitiesAndEquity, isTotal: true, isHeavyTotal: true },

        // --- Subtotal: Net Working Capital ---
        { label: "Net Working Capital (NWC)", dataKey: "NWC", values: nwc, isTotal: true },
        { label: "Capital Employed", dataKey: "CapitalEmployed", values: capitalEmployed, isTotal: true }
    ];

    // 3. Render the table
    bsItems.forEach(item => {
        const row = balanceSheetBody.insertRow();
        row.insertCell().textContent = item.label;

        // Determine which list to use: 'values' for calculated items, 'dataKey' for API data
        const listToRender = item.values || data[item.dataKey];
        
        // NO .slice(1) HERE
        listToRender.forEach(value => {
            const cell = row.insertCell();
            // Updated to use the format function which includes the currencySymbol
            cell.textContent = format(value);
            
            if (item.isTotal) { 
                cell.classList.add('total-cell'); 
                row.classList.add('total-row');
            }
            if (item.isHeavyTotal) {
                row.classList.add('heavy-total-row');
            }
        });
    });
    
// --- RENDER CASH FLOW STATEMENT (Starts loop at i=1 to skip Year 0) ---

    const netChangeInCash = data["Net Change in Cash"]; 
    const cffResults = data["Cash Flow from Financing"]; // <-- GET NEW CFF DATA
    
    // Start loop at i=1
    for (let i = 1; i < years; i++) { // i goes 1, 2, 3
        
        // Calculate the core components for the CFS display for the current year
        const cfo = data["Net Income"][i] + data["Depreciation"][i] - data["Change in NWC"][i];
        
        // Create the Cash Flow items with calculated values for YEAR i
        const cfsLineItems = [
            { label: "Net Income", value: data["Net Income"][i] },
            { label: "Add: Depreciation", value: data["Depreciation"][i] },
            { label: "Less: Change in NWC", value: -data["Change in NWC"][i] }, 
            { label: "Cash Flow from Operations", value: cfo, isTotal: true, isBold: true }, 
            { label: "Cash Flow from Investing (CapEx)", value: capExValue, isBold: true }, 
            { label: "Cash Flow from Financing", value: cffResults[i], isBold: true }, // <-- USE THE BACKEND'S CFF VALUE
            { label: "Net Change in Cash", value: netChangeInCash[i], isTotal: true, isBold: true }
        ];
        
        // Ensure the table has rows for all line items across all years
        cfsLineItems.forEach((item, rowIndex) => {
            // Only insert the line item row once when i is 1
            if (i === 1) { 
                const newRow = cashFlowBody.insertRow(rowIndex);
                newRow.insertCell().textContent = item.label;
                if (item.isTotal) { newRow.classList.add('total-row'); }
                
                // Apply the bold class
                if (item.isBold) {
                    newRow.classList.add('is-bold-row');
                }
            }
            
            // Get the row created in the step above
            const yearRow = cashFlowBody.rows[rowIndex];
            
            // Insert the cell into column 'i'. (i=1 is the first data column after the label)
            if (yearRow) {
                const newCell = yearRow.insertCell(i); 
                // Updated to use the format function which includes the currencySymbol
                newCell.textContent = format(item.value);
                if (item.isTotal) { newCell.classList.add('total-cell'); }
            }
        });
    }
    // *** CRITICAL ADDITION: CALL THE CHART FUNCTION HERE ***
    renderCharts(data);
    
    // Show the results section
    resultsContainer.style.display = 'block';

}

// New function to handle Chart.js rendering (REPLACE THE EXISTING renderCharts FUNCTION)
function renderCharts(data) {
    const years = data["Years"].slice(1).map(y => `Year ${y}`); // Use Year 1, 2, 3 for x-axis

    // --- 1. Calculate the required KPI for the line chart (EBIT %) ---
    const ebitPct = [];
    // Start at i=1 to skip Year 0
    for (let i = 1; i < data["EBIT"].length; i++) {
        // EBIT% = EBIT / Revenue
        const revenue = data["Revenue"][i];
        const ebit = data["EBIT"][i];
        // Calculate percentage, default to 0 if revenue is zero
        const pct = revenue === 0 ? 0 : ebit / revenue;
        ebitPct.push(pct * 100); // Convert to percentage
    }

    // --- CHART 1: REVENUE, NET INCOME (Bars) and EBIT % (Line) ---
    // NOTE: This assumes you use the new canvas ID: 'revenueKpiChart'
    const ctx1 = document.getElementById('revenueKpiChart').getContext('2d');

    // Destroy the old instance if it exists
    if (revenueChart) {
        revenueChart.destroy();
    }

    revenueChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Revenue',
                    data: data["Revenue"].slice(1), 
                    backgroundColor: 'rgba(54, 162, 235, 0.7)', // Blue Bar
                    yAxisID: 'y'
                },
                {
                    label: 'Net Income',
                    data: data["Net Income"].slice(1), 
                    backgroundColor: 'rgba(75, 192, 192, 0.7)', // Green Bar
                    yAxisID: 'y'
                },
                {
                    type: 'line', // Mixed type
                    label: 'EBIT % (Line)',
                    data: ebitPct, 
                    borderColor: 'rgb(255, 99, 132)', // Red Line
                    borderWidth: 3,
                    fill: false,
                    yAxisID: 'y1' // Use secondary Y-axis for percentage
                }
            ]
        },
        options: {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Amount' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false }, // Only draw the grid for the primary axis
                    title: { display: true, text: 'Percentage (%)' },
                    min: 0,
                    // Dynamic max setting for a nice scale
                    max: Math.max(100, ...ebitPct.filter(val => !isNaN(val))) > 0 ? Math.ceil(Math.max(100, ...ebitPct.filter(val => !isNaN(val))) / 10) * 10 : 100 
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Profitability Trends (Revenue, Net Income, EBIT %)'
                }
            }
        }
    });

    // --- CHART 2: CASH and DEBT (Bar Chart) ---
    // NOTE: This assumes you use the new canvas ID: 'cashDebtChart'
    const ctx2 = document.getElementById('cashDebtChart').getContext('2d');

    // Destroy the old instance if it exists
    if (cashDebtChart) {
        cashDebtChart.destroy();
    }

    cashDebtChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Closing Cash',
                    data: data["Closing Cash"].slice(1), 
                    backgroundColor: 'rgba(255, 159, 64, 0.7)' // Orange Bar
                },
                {
                    label: 'Closing Debt',
                    data: data["Closing Debt"].slice(1), 
                    backgroundColor: 'rgba(255, 99, 132, 0.7)' // Red Bar
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                x: { stacked: false },
                y: { stacked: false, beginAtZero: true }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Liquidity & Capital Structure (Cash vs. Debt)'
                }
            }
        }
    });
}
