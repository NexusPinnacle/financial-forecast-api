const form = document.getElementById('forecastForm');
let years = 5;

function createInputs(containerId, label, idPrefix, def) {
    const cont = document.getElementById(containerId);
    cont.innerHTML = `<strong>${label}</strong><div class="granular-row"></div>`;
    const row = cont.querySelector('.granular-row');
    for(let i=1; i<=years; i++) {
        row.innerHTML += `<div class="year-block"><label>Y${i}</label><input type="number" class="${idPrefix}-in" value="${def}"></div>`;
    }
}

function updateUI() {
    createInputs('rev-growth-container', 'Revenue Growth %', 'rev', 10);
    createInputs('cogs-container', 'COGS %', 'cogs', 40);
    createInputs('opex-container', 'Fixed Opex', 'opex', 50000);
    createInputs('capex-container', 'CapEx', 'capex', 10000);
}

document.querySelectorAll('.year-select-btn').forEach(btn => {
    btn.onclick = () => {
        years = parseInt(btn.dataset.val);
        document.querySelectorAll('.year-select-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        updateUI();
    };
});

form.onsubmit = async (e) => {
    e.preventDefault();
    const getVals = (cls) => Array.from(document.querySelectorAll('.'+cls+'-in')).map(i => i.value);
    
    const payload = {
        initial_revenue: document.getElementById('initial_revenue').value,
        rev_growth: getVals('rev'),
        cogs_pct: getVals('cogs'),
        fixed_opex: getVals('opex'),
        capex: getVals('capex'),
        tax_rate: document.getElementById('tax_rate').value,
        initial_cash: document.getElementById('initial_cash').value,
        initial_debt: document.getElementById('initial_debt').value,
        years: years,
        monthly_detail: document.getElementById('monthly_detail_select').value,
        // Fill defaults for NWC and Debt repay to avoid errors
        dso: Array(years).fill(30), dio: Array(years).fill(30), dpo: Array(years).fill(30), debt_repay: Array(years).fill(0),
        depreciation_rate: 10, interest_rate: 5, initial_ppe: 500000
    };

    const res = await fetch('/api/forecast', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    });
    renderResults(await res.json());
};

function renderResults(data) {
    document.getElementById('results-container').style.display = 'block';
    const labels = data.Display_Labels;
    const d = data.display_data;

    const fillTable = (headId, bodyId, rowData, labelList) => {
        document.getElementById(headId).innerHTML = `<tr><th>Metric</th>${labelList.map(l => `<th>${l}</th>`).join('')}</tr>`;
        let html = '';
        for(let key in rowData) {
            html += `<tr><td>${key}</td>${rowData[key].map(v => `<td>${v.toLocaleString()}</td>`).join('')}</tr>`;
        }
        document.getElementById(bodyId).innerHTML = html;
    };

    fillTable('is-head', 'is-body', {
        "Revenue": d.Revenue, "COGS": d.COGS, "Net Income": d["Net Income"]
    }, labels.slice(1));

    fillTable('bs-head', 'bs-body', {
        "Cash": d.Cash, "Assets": d["Total Assets"], "Debt": d.Debt
    }, labels);
    
    // Simple Chart
    new Chart(document.getElementById('revChart'), {
        type: 'line',
        data: { labels: labels.slice(1), datasets: [{ label: 'Revenue', data: d.Revenue, borderColor: 'blue' }] }
    });
}

window.openTab = (e, name) => {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display='none');
    document.getElementById(name).style.display='block';
};

updateUI();
