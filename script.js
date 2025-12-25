const API_URL = '/api/forecast';
const EXPORT_URL = '/api/export';

// Page Navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    const activeBtn = Array.from(document.querySelectorAll('.nav-btn')).find(b => b.getAttribute('onclick').includes(pageId));
    if (activeBtn) activeBtn.classList.add('active');

    // Auto-calculate if moving to an output page with empty data
    if (pageId !== 'page-assumptions' && !document.querySelector('#incomeStatementTable tbody').innerHTML) {
        handleForecast(API_URL);
    }
}
window.showPage = showPage;

// Period/Duration Toggle
document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.dataset.mode;
        document.getElementById('period_mode').value = mode;
        
        document.getElementById('annual-buttons').style.display = mode === 'annual' ? 'flex' : 'none';
        document.getElementById('monthly-buttons').style.display = mode === 'monthly' ? 'flex' : 'none';
        
        const defaultVal = mode === 'annual' ? 3 : 12;
        updateDuration(defaultVal);
    });
});

function updateDuration(val) {
    document.getElementById('forecast_years').value = val;
    document.querySelectorAll('.year-select-btn, .month-select-btn').forEach(b => {
        b.classList.toggle('selected-year-btn', b.dataset.value == val);
    });
    renderGranularInputs(val);
}

// Injected helpers for granular inputs
function renderGranularInputs(val) {
    const container = document.getElementById('revenue-growth-container');
    const inputCount = document.getElementById('period_mode').value === 'monthly' ? Math.ceil(val/12) : val;
    container.innerHTML = '<div class="granular-input-row"></div>';
    const row = container.querySelector('.granular-input-row');
    for(let i=1; i<=inputCount; i++) {
        row.innerHTML += `<div style="text-align:center">Y${i}<br><input type="number" id="growth_y${i}" value="${document.getElementById('default_revenue_growth').value}" style="width:50px"></div>`;
    }
}

// Calculate logic
document.getElementById('forecastForm').addEventListener('submit', (e) => {
    e.preventDefault();
    handleForecast(API_URL).then(() => showPage('page-pl'));
});

document.getElementById('exportBtn').addEventListener('click', () => handleForecast(EXPORT_URL, true));

async function handleForecast(url, isExport=false) {
    const data = collectData(); // Logic to gather all input values
    const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    });
    
    if (isExport) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl; a.download = 'Forecast.xlsx';
        a.click();
    } else {
        const result = await response.json();
        updateTables(result); // Logic to populate the HTML tables
        renderCharts(result);
    }
}

// ... include collectData, updateTables, and renderCharts logic from previous turns ...
