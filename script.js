// API URLs
// Using relative paths for better deployment flexibility
const API_URL = '/api/forecast'; 
const EXPORT_API_URL = '/api/export'; 

// DOM Elements
const form = document.getElementById('forecastForm');
const resultsContainer = document.getElementById('results-container');
const incomeStatementBody = document.querySelector('#incomeStatementTable tbody');
const balanceSheetBody = document.querySelector('#balanceSheetTable tbody');
const cashFlowBody = document.querySelector('#cashFlowTable tbody');
const errorMessage = document.getElementById('error-message');
const yearButtons = document.querySelectorAll('.year-select-btn');
const forecastYearsInput = document.getElementById('forecast_years');

// Granular assumption containers
const revenueGrowthContainer = document.getElementById('revenue-growth-container');
const cogsPctContainer = document.getElementById('cogs-pct-container');
const fixedOpexContainer = document.getElementById('fixed-opex-container');
const capexContainer = document.getElementById('capex-container');
const dsoDaysContainer = document.getElementById('dso-days-container');
const dioDaysContainer = document.getElementById('dio-days-container');
const dpoDaysContainer = document.getElementById('dpo-days-container');
const debtRepaymentContainer = document.getElementById('debt-repayment-container');

// Chart instances
let revenueChart = null;
let cashDebtChart = null;

// NEW Modal Elements
const modal = document.getElementById('confirmationModal');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalCloseBtn = document.querySelector('.close-btn');

// Helper array to manage all default/granular input pairs
const assumptionMap = [
    { defaultId: 'default_revenue_growth', containerId: 'revenue-growth-container', label: 'Revenue Growth', inputKey: 'rev_growth_rates' },
    { defaultId: 'default_cogs_pct', containerId: 'cogs-pct-container', label: 'COGS %', inputKey: 'cogs_pct_rates' },
    { defaultId: 'default_fixed_opex', containerId: 'fixed-opex-container', label: 'Fixed Opex', inputKey: 'fixed_opex_rates' },
    { defaultId: 'default_capex_rate', containerId: 'capex-container', label: 'CapEx Rate', inputKey: 'capex_rates' },
    { defaultId: 'default_dso_days', containerId: 'dso-days-container', label: 'DSO Days', inputKey: 'dso_days_list' },
    { defaultId: 'default_dio_days', containerId: 'dio-days-container', label: 'DIO Days', inputKey: 'dio_days_list' },
    { defaultId: 'default_dpo_days', containerId: 'dpo-days-container', label: 'DPO Days', inputKey: 'dpo_days_list' },
    { defaultId: 'default_debt_repayment', containerId: 'debt-repayment-container', label: 'Debt Repayment', inputKey: 'annual_debt_repayment_list' },
];


/**
 * Creates and populates year-specific vertical inputs within a container.
 * @param {string} containerId - The ID of the container div.
 * @param {string} label - The label for the input set (e.g., 'Revenue Growth').
 * @param {string} inputName - The name attribute for the input fields.
 * @param {number} defaultValue - The default value for each year's input.
 */
function createVerticalInputs(containerId, label, inputName, defaultValue) {
    const container = document.getElementById(containerId);
    const years = parseInt(forecastYearsInput.value);

    // Clear existing content
    container.innerHTML = '';
    
    // Add the top-level label for the row
    const rowLabel = document.createElement('div');
    rowLabel.className = 'granular-row-label';
    rowLabel.textContent = label;
    container.appendChild(rowLabel);

    const inputRow = document.createElement('div');
    inputRow.className = 'granular-input-row';

    for (let i = 1; i <= years; i++) {
        const yearBlock = document.createElement('div');
        yearBlock.className = 'granular-year-input';

        const yearLabel = document.createElement('label');
        yearLabel.textContent = `Year ${i}`;
        yearLabel.setAttribute('for', `${inputName}_${i}`);
        
        const inputField = document.createElement('input');
        inputField.type = 'number';
        inputField.name = inputName;
        inputField.id = `${inputName}_${i}`;
        inputField.value = defaultValue.toFixed(2);
        inputField.step = '0.01';
        
        yearBlock.appendChild(yearLabel);
        yearBlock.appendChild(inputField);
        inputRow.appendChild(yearBlock);
    }

    container.appendChild(inputRow);
}

/**
 * Regenerates all granular inputs based on the current year count and default values.
 */
function regenerateAllGranularInputs() {
    // List of all granular input definitions
    const granularInputs = [
        { containerId: 'revenue-growth-container', label: 'Revenue Growth (%)', inputName: 'rev_growth_rates', defaultId: 'default_revenue_growth' },
        { containerId: 'cogs-pct-container', label: 'COGS %', inputName: 'cogs_pct_rates', defaultId: 'default_cogs_pct' },
        { containerId: 'fixed-opex-container', label: 'Fixed Opex ($)', inputName: 'fixed_opex_rates', defaultId: 'default_fixed_opex' },
        { containerId: 'capex-container', label: 'CapEx Rate (%)', inputName: 'capex_rates', defaultId: 'default_capex_rate' },
        { containerId: 'dso-days-container', label: 'DSO Days', inputName: 'dso_days_list', defaultId: 'default_dso_days' },
        { containerId: 'dio-days-container', label: 'DIO Days', inputName: 'dio_days_list', defaultId: 'default_dio_days' },
        { containerId: 'dpo-days-container', label: 'DPO Days', inputName: 'dpo_days_list', defaultId: 'default_dpo_days' },
        { containerId: 'debt-repayment-container', label: 'Debt Repayment ($)', inputName: 'annual_debt_repayment_list', defaultId: 'default_debt_repayment' }
    ];

    granularInputs.forEach(item => {
        // Only regenerate if the container is open (i.e. if children > 0)
        const container = document.getElementById(item.containerId);
        if (container.children.length > 0) {
            const defaultValue = parseFloat(document.getElementById(item.defaultId).value) || 0;
            createVerticalInputs(item.containerId, item.label, item.inputName, defaultValue);
        }
    });
}

/**
 * Collects all form data, separating single values and lists.
 * @returns {object} - Object containing all parsed input data.
 */
function collectInputData() {
    const formData = new FormData(form);
    const data = {};
    const listKeys = assumptionMap.map(a => a.inputKey);
    
    // Convert FormData to a regular object, handling list items
    for (const [key, value] of formData.entries()) {
        const floatValue = parseFloat(value);
        const finalValue = isNaN(floatValue) ? 0.0 : floatValue;
        
        if (listKeys.includes(key)) {
            // Group list items
            if (!data[key]) {
                data[key] = [];
            }
            data[key].push(finalValue);
        } else {
            // Single values (initials, taxes, etc.)
            data[key] = finalValue;
        }
    }
    
    // Add non-form-data inputs
    data.years = parseInt(forecastYearsInput.value);
    data.currency_symbol = document.getElementById('currency_symbol').value || '$';

    // Get single rate inputs (which were not part of the granular loop)
    data.tax_rate = parseFloat(document.getElementById('tax_rate').value) || 0;
    data.depreciation_rate = parseFloat(document.getElementById('depreciation_rate').value) || 0;
    data.interest_rate = parseFloat(document.getElementById('interest_rate').value) || 0;

    return data;
}

/**
 * Populates a table (IS, BS, or CFS) with data.
 * @param {HTMLTableElement} tableBody - The <tbody> element to populate.
 * @param {object} data - The data object for the statement.
 * @param {number} years - The number of forecast years.
 * @param {string} currencySymbol - The currency symbol to use for formatting.
 */
function populateTable(tableBody, data, years, currencySymbol) {
    const tableHead = tableBody.parentElement.querySelector('thead');
    const yearsArr = Array.from({ length: years }, (_, i) => `Year ${i + 1}`);

    // Create Table Header (Year 0 + Forecast Years)
    let headerHtml = `<tr><th style="text-align: left;">Line Item</th><th>Year 0</th>`;
    yearsArr.forEach(year => {
        headerHtml += `<th>${year}</th>`;
    });
    headerHtml += `</tr>`;
    tableHead.innerHTML = headerHtml;

    // Clear old body
    tableBody.innerHTML = '';

    // Create Table Body
    for (const [lineItem, values] of Object.entries(data)) {
        // Skip keys that aren't meant for display
        if (lineItem === 'excel_is' || lineItem === 'excel_bs' || lineItem === 'excel_cfs') continue;

        const row = tableBody.insertRow();
        row.insertCell().textContent = lineItem;
        
        // Ensure values is an array for safety
        const displayValues = Array.isArray(values) ? values : [values]; 

        // Populate cells (starting from Year 0)
        displayValues.forEach((value, index) => {
            const cell = row.insertCell();
            
            // Apply formatting: Currency for most
            let formattedValue = `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            cell.textContent = formattedValue;
            
            // Apply bold styling for key lines (Total/Net)
            if (lineItem.includes('Net') || lineItem.includes('Total') || lineItem.includes('EBIT') || lineItem.includes('Gross Profit')) {
                row.classList.add('total-row');
            }
        });
    }
}

/**
 * Shows the confirmation modal and sets up the pending action callbacks.
 * @param {string} message - The message to display in the modal.
 * @param {function} onConfirm - Function to execute if the user confirms.
 * @param {function} onCancel - Function to execute if the user cancels.
 */
function showConfirmation(message, onConfirm, onCancel) {
    modalMessage.innerHTML = message; // Use innerHTML to allow for bolding/formatting
    
    // Remove previous listeners
    modalConfirmBtn.onclick = null;
    modalCancelBtn.onclick = null;
    modalCloseBtn.onclick = null;

    // Set new listeners
    modalConfirmBtn.onclick = () => {
        modal.style.display = 'none';
        onConfirm();
    };
    
    const closeModal = () => {
        modal.style.display = 'none';
        onCancel();
    };

    modalCancelBtn.onclick = closeModal;
    modalCloseBtn.onclick = closeModal;
    
    modal.style.display = 'block';

    // Close modal if user clicks outside of it
    window.onclick = (event) => {
        if (event.target === modal) {
            closeModal();
        }
    };
}


// --- Event Listeners ---

// 1. Year Buttons (NEW LOGIC WITH MODAL)
yearButtons.forEach(button => {
    button.addEventListener('click', function() {
        const newYears = parseInt(this.getAttribute('data-years'));
        const currentYears = parseInt(forecastYearsInput.value);
        
        if (newYears === currentYears) return; // No change

        const granularInputsExist = revenueGrowthContainer.children.length > 0; // Check if any granular inputs have been opened/created
        
        if (granularInputsExist) {
            const message = `Changing the forecast duration from ${currentYears} to ${newYears} years will **clear all year-specific granular inputs**. Are you sure you want to proceed?`;
            
            showConfirmation(message, 
                // onConfirm (The original logic)
                () => {
                    yearButtons.forEach(btn => btn.classList.remove('selected-year-btn'));
                    this.classList.add('selected-year-btn');
                    
                    forecastYearsInput.value = newYears;
                    regenerateAllGranularInputs();
                },
                // onCancel (Do nothing)
                () => {}
            );
        } else {
            // No granular inputs created yet, safe to change
            yearButtons.forEach(btn => btn.classList.remove('selected-year-btn'));
            this.classList.add('selected-year-btn');
            forecastYearsInput.value = newYears;
            regenerateAllGranularInputs(); // Still need to regenerate based on new year count
        }
    });
});

// 2. Granular Input Generation (Initial click on collapsible)
document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', function() {
        // Toggle the active state
        this.classList.toggle('active');
        const content = this.nextElementSibling;
        
        // If content is about to be displayed and it's empty, populate it
        if (this.classList.contains('active') && content.children.length === 0) {
            // Get the ID of the collapsible content to find the corresponding input data
            const containerId = content.id;
            const assumption = assumptionMap.find(a => a.containerId === containerId);
            
            if (assumption) {
                const defaultValue = parseFloat(document.getElementById(assumption.defaultId).value) || 0;
                createVerticalInputs(containerId, assumption.label, assumption.inputKey, defaultValue);
            }
        }
        
        // Toggle visibility
        content.style.maxHeight = this.classList.contains('active') ? content.scrollHeight + "px" : null;
    });
});


// 3. Default Input Change (NEW LOGIC WITH MODAL)
assumptionMap.forEach(assumption => {
    const defaultInput = document.getElementById(assumption.defaultId);
    
    if (defaultInput) {
        // Initialize the dataset.oldValue on load
        defaultInput.dataset.oldValue = defaultInput.value;

        defaultInput.addEventListener('change', function() {
            const granularContainer = document.getElementById(assumption.containerId);
            
            const granularInputsExist = granularContainer.children.length > 0;
            const newValue = parseFloat(this.value) || 0;
            const oldValue = this.dataset.oldValue; 
            
            // If the value hasn't actually changed, do nothing
            if (newValue.toFixed(2) === parseFloat(oldValue).toFixed(2)) return;

            if (granularInputsExist) {
                const message = `Changing the **Default ${assumption.label}** will overwrite any custom year-specific values you have entered for this assumption. Are you sure you want to proceed?`;
                
                showConfirmation(message,
                    // onConfirm (The original regeneration logic)
                    () => {
                        createVerticalInputs(
                            assumption.containerId, 
                            `${assumption.label} (%)`, 
                            assumption.inputKey, 
                            newValue
                        );
                        this.dataset.oldValue = this.value; // Store the new value
                    },
                    // onCancel (Revert the input value to its previous state)
                    () => {
                        this.value = oldValue;
                    }
                );
            } else {
                 // No granular inputs visible: just store the new value
                this.dataset.oldValue = this.value; 
            }
        });
    }
});


// 4. Form Submission
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    errorMessage.textContent = '';
    resultsContainer.style.display = 'none';
    
    const data = collectInputData();

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        
        // Clear and populate the tables
        populateTable(incomeStatementBody, result.excel_is, data.years, data.currency_symbol);
        populateTable(balanceSheetBody, result.excel_bs, data.years, data.currency_symbol);
        populateTable(cashFlowBody, result.excel_cfs, data.years, data.currency_symbol);
        
        // Render charts
        renderCharts(result, data.years);

        resultsContainer.style.display = 'block';

    } catch (error) {
        errorMessage.textContent = `Error: ${error.message}`;
        console.error('Forecast error:', error);
    }
});


// 5. Export Button
document.getElementById('exportBtn').addEventListener('click', async () => {
    errorMessage.textContent = '';
    const data = collectInputData();

    try {
        const response = await fetch(EXPORT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
        }

        // Get the file blob from the response
        const blob = await response.blob();
        
        // Create a temporary link to trigger the download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'Financial_Forecast.xlsx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        errorMessage.textContent = `Error during export: ${error.message}`;
        console.error('Export error:', error);
    }
});


/**
 * Renders the two Chart.js graphs.
 * @param {object} data - The forecast data object.
 * @param {number} years - The number of forecast years.
 */
function renderCharts(data, years) {
    const yearsArr = Array.from({ length: years }, (_, i) => `Year ${i + 1}`);

    // Data for Profitability Trends (EBIT Margin)
    // Calculate EBIT Margin (EBIT / Revenue)
    const revenue = data["Revenue"]; // Includes Year 0
    const ebit = data["EBIT"]; // Includes Year 0
    
    // We only want forecast years (slice(1))
    const ebitMarginData = ebit.slice(1).map((e, i) => {
        const r = revenue.slice(1)[i];
        // Handle division by zero
        return r === 0 ? 0 : (e / r) * 100; // Return as a percentage
    });

    const chartConfigs = [{
        chartVar: 'revenueKpiChart', canvasId: 'revenueKpiChart', config: {
            type: 'line',
            data: { 
                labels: yearsArr, 
                datasets: [
                    { 
                        label: 'Revenue', 
                        data: data["Revenue"].slice(1), 
                        borderColor: 'rgba(59, 130, 246, 1)', 
                        backgroundColor: 'rgba(59, 130, 246, 0.2)', 
                        yAxisID: 'y' 
                    },
                    { 
                        label: 'EBIT Margin', 
                        data: ebitMarginData, 
                        borderColor: 'rgba(245, 158, 11, 1)', 
                        backgroundColor: 'rgba(245, 158, 11, 0.2)', 
                        yAxisID: 'y1',
                        fill: false
                    }
                ]
            },
            options: { 
                responsive: true, 
                interaction: { mode: 'index', intersect: false },
                scales: { 
                    y: { type: 'linear', display: true, position: 'left', beginAtZero: true, title: { display: true, text: 'Revenue ($)' } },
                    y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Percentage (%)' } }
                }, 
                plugins: { title: { display: true, text: 'Revenue & Profitability Trends' } } 
            }
        }
    }, {
        chartVar: 'cashDebtChart', canvasId: 'cashDebtChart', config: {
            type: 'bar',
            data: { labels: yearsArr, datasets: [
                { label: 'Closing Cash', data: data["Closing Cash"].slice(1), backgroundColor: 'rgba(255, 159, 64, 0.7)' },
                { label: 'Closing Debt', data: data["Closing Debt"].slice(1), backgroundColor: 'rgba(59, 130, 246, 0.7)' }
            ]},
            options: { responsive: true, scales: { y: { beginAtZero: true } }, plugins: { title: { display: true, text: 'Liquidity & Capital Structure' } } }
        }
    }];

    // Get chart context references
    const revenueCanvas = document.getElementById('revenueKpiChart').getContext('2d');
    const cashDebtCanvas = document.getElementById('cashDebtChart').getContext('2d');
    
    // Destroy existing charts if they exist
    if (revenueChart) revenueChart.destroy();
    if (cashDebtChart) cashDebtChart.destroy();
    
    // Create new chart instances
    revenueChart = new Chart(revenueCanvas, chartConfigs[0].config);
    cashDebtChart = new Chart(cashDebtCanvas, chartConfigs[1].config);
}


// --- Initial Setup ---
// Set initial year value to match the selected button on load
forecastYearsInput.value = document.querySelector('.selected-year-btn').getAttribute('data-years');

// Initial setup of old values for default inputs
assumptionMap.forEach(assumption => {
    const defaultInput = document.getElementById(assumption.defaultId);
    if (defaultInput) {
        defaultInput.dataset.oldValue = defaultInput.value;
    }
});
