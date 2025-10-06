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

// Global variables to hold the chart instances
let revenueChart = null;
let cashDebtChart = null;
let currencySymbol = document.getElementById('currency_symbol')?.value || '$';

// Helper function to format numbers as currency, rounded to 2 decimal places
const format = (value) => {
    // Check for non-numeric or extremely large values
    if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        return value; 
    }
    
    // Use Intl.NumberFormat for currency formatting
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD', // Placeholder, the symbol will be added later
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.round(value * 100) / 100); // Round to 2 decimal places
    
    // Replace the default currency symbol with the user-selected one
    return formatted.replace('$', currencySymbol);
};


form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    errorMessage.textContent = '';
    const data = {};
    // Get the selected currency symbol
    currencySymbol = document.getElementById('currency_symbol')?.value || '$';

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
        data.initial_cash = parseFloat(document.getElementById('initial_cash').value);
        data.initial_debt = parseFloat(document.getElementById('initial_debt').value);
        
        // Percentage inputs (converted to decimal for backend logic)
        data.revenue_growth = parseFloat(document.getElementById('revenue_growth').value) / 100;
        data.cogs_pct = parseFloat(document.getElementById('cogs_pct').value) / 100;
        data.depreciation_rate = parseFloat(document.getElementById('depreciation_rate').value) / 100;
        data.tax_rate = parseFloat(document.getElementById('tax_rate').value) / 100;
        data.interest_rate = parseFloat(document.getElementById('interest_rate').value) / 100;
        
        // Debt Repayment (this is not currently used in the backend but is a future input)
        data.annual_debt_repayment = parseFloat(document.getElementById('annual_debt_repayment').value);


        // 2. Call the backend API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to calculate forecast due to a server error.');
        }

        const result = await response.json();

        // 3. Render results
        renderTables(result);
        renderCharts(result);

    } catch (error) {
        console.error('Error fetching forecast:', error);
        errorMessage.textContent = `Error: ${error.message}`;
        resultsContainer.style.display = 'none';
    }
});


function renderTables(data) {
    // Clear previous results
    incomeStatementBody.innerHTML = '';
    balanceSheetBody.innerHTML = '';
    cashFlowBody.innerHTML = '';

    // --- RENDER INCOME STATEMENT ---
    const isLineItems = [
        { label: "Revenue", dataKey: "Revenue", isTotal: false, isBold: false },
        { label: "COGS", dataKey: "COGS", isTotal: false, isBold: false },
        { label: "Gross Profit", dataKey: "Gross Profit", isTotal: true, isBold: true },
        { label: "Fixed Opex", dataKey: "Fixed Opex", isTotal: false, isBold: false },
        { label: "Depreciation", dataKey: "Depreciation", isTotal: false, isBold: false },
        { label: "EBIT", dataKey: "EBIT", isTotal: true, isBold: true },
        { label: "Interest Expense", dataKey: "Interest Expense", isTotal: false, isBold: false },
        { label: "EBT", dataKey: "EBT", isTotal: true, isBold: true },
        { label: "Taxes", dataKey: "Taxes", isTotal: false, isBold: false },
        { label: "Net Income", dataKey: "Net Income", isTotal: true, isBold: true }
    ];

    isLineItems.forEach((item, rowIndex) => {
        const newRow = incomeStatementBody.insertRow(rowIndex);
        newRow.insertCell().textContent = item.label; // Label cell
        if (item.isTotal) { newRow.classList.add('total-row'); }
        if (item.isBold) { newRow.classList.add('is-bold-row'); }

        // Loop through years 1 to 3 (data indices 1, 2, 3)
        for (let i = 1; i <= 3; i++) {
            const cell = newRow.insertCell();
            // Use the data[item.dataKey] array and the current year index i
            cell.textContent = format(data[item.dataKey][i] || 0.0);
            if (item.isTotal) { cell.classList.add('total-cell'); }
        }
    });

    // --- RENDER BALANCE SHEET ---
    const bsLineItems = [
        { label: "Closing Cash", dataKey: "Closing Cash" },
        { label: "Accounts Receivable", dataKey: "Closing AR" },
        { label: "Inventory", dataKey: "Closing Inventory" },
        { label: "Net PP&E", dataKey: "Closing PP&E", isBold: true },
        { label: "Total Assets", dataKey: "Total Assets", isHeavyTotal: true },

        { label: "Accounts Payable", dataKey: "Closing AP" },
        { label: "Closing Debt", dataKey: "Closing Debt", isBold: true },
        { label: "Retained Earnings", dataKey: "Retained Earnings", isBold: true },
        { label: "Total Liabilities & Equity", dataKey: "Total L&E", isHeavyTotal: true }
    ];
    
    bsLineItems.forEach((item, rowIndex) => {
        const newRow = balanceSheetBody.insertRow(rowIndex);
        newRow.insertCell().textContent = item.label; // Label cell
        
        if (item.isBold) { newRow.classList.add('is-bold-row'); }
        if (item.isHeavyTotal) { newRow.classList.add('heavy-total-row'); }

        // Loop through years 0 to 3 (data indices 0, 1, 2, 3)
        for (let i = 0; i <= 3; i++) {
            const cell = newRow.insertCell();
            cell.textContent = format(data[item.dataKey][i] || 0.0);
            if (item.isHeavyTotal) { cell.classList.add('total-cell'); }
        }
    });
    
    // --- RENDER CASH FLOW STATEMENT ---
    // Note: CF items are calculated for periods 1-3, so they start at index 1
    // We will use a structure that aligns with the balance sheet, but only displays Years 1, 2, 3
    
    // We need to calculate the Change in NWC items and CapEx for display in the table
    const changeInAR = data["Closing AR"].slice(1).map((val, i) => val - data["Closing AR"][i]);
    const changeInInventory = data["Closing Inventory"].slice(1).map((val, i) => val - data["Closing Inventory"][i]);
    const changeInAP = data["Closing AP"].slice(1).map((val, i) => val - data["Closing AP"][i]);
    
    // CapEx is constant, but presented as a negative number for Cash Flow from Investing (CFI)
    const capExValue = data["CapEx"][1]; // CapEx is the same for all years (at index 1)

    // CFS structure and data keys for display
    const cfsLineItemsTemplate = [
        { label: "Net Income", data: data["Net Income"].slice(1), isBold: true },
        { label: "Depreciation & Amortization", data: data["Depreciation"].slice(1), isBold: false },
        
        { label: "Change in Accounts Receivable", data: changeInAR.map(val => -val), isBold: false }, // AR Increase = Cash Decrease (-)
        { label: "Change in Inventory", data: changeInInventory.map(val => -val), isBold: false }, // Inv Increase = Cash Decrease (-)
        { label: "Change in Accounts Payable", data: changeInAP, isBold: false }, // AP Increase = Cash Increase (+)
        
        // CFO is the sum of items above this line: Net Income + D&A - Chg AR - Chg Inv + Chg AP
        { label: "Cash Flow from Operations", data: data["CFO"].slice(1), isTotal: true, isBold: true }, 

        { label: "Change in PP&E (CapEx)", data: data["CapEx"].slice(1).map(val => -val), isBold: true }, // CFI
        { label: "Cash Flow from Investing", data: data["CFI"].slice(1), isTotal: true, isBold: true }, 

        { label: "Debt Repayment", data: data["Debt Repayment"].slice(1).map(val => -val), isBold: true },
        { label: "Cash Flow from Financing", data: data["CFF"].slice(1), isTotal: true, isBold: true }, 

        { label: "Net Change in Cash", data: data["Net Change in Cash"].slice(1), isTotal: true, isBold: true }
    ];

    // Populate Cash Flow Statement Table
    cfsLineItemsTemplate.forEach((item, rowIndex) => {
        const newRow = cashFlowBody.insertRow(rowIndex);
        newRow.insertCell().textContent = item.label;
        if (item.isTotal) { newRow.classList.add('total-row'); }
        if (item.isBold) { newRow.classList.add('is-bold-row'); }

        // Loop through the data for years 1, 2, 3
        item.data.forEach((value, colIndex) => {
            const cell = newRow.insertCell();
            cell.textContent = format(value);
            if (item.isTotal) { cell.classList.add('total-cell'); }
        });
    });

    
    // Show the results section
    resultsContainer.style.display = 'block';
}


// --- NEW CHARTING LOGIC ---
function renderCharts(data) {
    // Labels for Years 1, 2, 3
    const years = data["Years"].slice(1).map(y => `Year ${y}`); 

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
                    label: `Revenue (${currencySymbol})`,
                    data: data["Revenue"].slice(1), 
                    backgroundColor: 'rgba(54, 162, 235, 0.7)', // Blue Bar
                    yAxisID: 'y'
                },
                {
                    label: `Net Income (${currencySymbol})`,
                    data: data["Net Income"].slice(1), 
                    backgroundColor: 'rgba(75, 192, 192, 0.7)', // Green Bar
                    yAxisID: 'y'
                },
                {
                    type: 'line', // Mixed type
                    label: 'EBIT %',
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
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: `Amount (${currencySymbol})` }
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
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';

                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                if (context.dataset.yAxisID === 'y1') {
                                    // Format percentage with '%'
                                    label += context.parsed.y.toFixed(2) + '%';
                                } else {
                                    // Format currency
                                    label += format(context.parsed.y);
                                }
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });

    // --- CHART 2: CASH and DEBT (Bar Chart) ---
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
                    label: `Closing Cash (${currencySymbol})`,
                    data: data["Closing Cash"].slice(1), 
                    backgroundColor: 'rgba(255, 159, 64, 0.7)' // Orange Bar
                },
                {
                    label: `Closing Debt (${currencySymbol})`,
                    data: data["Closing Debt"].slice(1), 
                    backgroundColor: 'rgba(255, 99, 132, 0.7)' // Red Bar
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: false },
                y: { 
                    stacked: false, 
                    beginAtZero: true,
                    title: { display: true, text: `Amount (${currencySymbol})` }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Liquidity & Capital Structure (Cash vs. Debt)'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}
