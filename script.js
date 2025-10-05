// script.js

// URL for your Flask API running locally
// *** REMEMBER TO UPDATE THIS URL WHEN YOU DEPLOY! ***
const API_URL = 'https://financial-forecast-api-hyl3.onrender.com/api/forecast'; 

const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const incomeStatementBody = document.querySelector('#incomeStatementTable tbody');
const balanceSheetBody = document.querySelector('#balanceSheetTable tbody');
const cashFlowBody = document.querySelector('#cashFlowTable tbody');
const errorMessage = document.getElementById('error-message');


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

    const years = data.Years.length; // Will be 4 (Year 0 to Year 3)
    
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
            { label: "Cash Flow from Financing", value: 0.0, isBold: true }, 
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
    
    // Show the results section
    resultsContainer.style.display = 'block';
}
