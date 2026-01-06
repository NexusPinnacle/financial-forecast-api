import pandas as pd
import numpy as np

def generate_forecast(
    initial_revenue, revenue_growth_rates, cogs_pct_rates, fixed_opex_rates,
    tax_rate, initial_ppe, capex_rates, depreciation_rate,
    dso_days_list, dio_days_list, dpo_days_list,
    initial_debt, initial_cash, interest_rate,
    annual_debt_repayment_list, years=5, monthly_detail=0,
    revenue_streams=None,
    cogs_streams=None,
    opex_streams=None,
    **kwargs 
):
    num_months = years * 12
    days_in_period = 365.0 / 12.0
    
    def expand_to_months(annual_list):
        ml = []
        for val in annual_list:
            ml.extend([val] * 12)
        return ml[:num_months]

    rev_growth_monthly = [((1 + r)**(1/12) - 1) for r in expand_to_months(revenue_growth_rates)]
    fixed_opex_monthly = [x / 12.0 for x in expand_to_months(fixed_opex_rates)]
    capex_monthly = [x / 12.0 for x in expand_to_months(capex_rates)]
    debt_repayment_monthly = [x / 12.0 for x in expand_to_months(annual_debt_repayment_list)]
    cogs_pct_m = expand_to_months(cogs_pct_rates)
    dso_m = expand_to_months(dso_days_list)
    dio_m = expand_to_months(dio_days_list)
    dpo_m = expand_to_months(dpo_days_list)
    
    m_dep_rate = depreciation_rate / 12.0 
    m_int_rate = interest_rate / 12.0

    L = num_months + 1
    revenue, cogs, opex_total = [[0.0] * L for _ in range(3)]
    revenue_display_data, cogs_display_data, opex_display_data = [], [], []

    # 1. Revenue Setup
    if revenue_streams:
        for stream in revenue_streams:
            vals = (stream.get('values', []) + [0.0]*num_months)[:num_months]
            for i in range(num_months): revenue[i+1] += vals[i]
            revenue_display_data.append({'name': stream.get('name'), 'type': 'Revenue', 'raw_values': [0.0] + vals})
    else:
        revenue[0] = initial_revenue
        for i in range(1, L): revenue[i] = revenue[i-1] * (1 + rev_growth_monthly[i-1])

    # 2. COGS Setup
    if cogs_streams:
        for stream in cogs_streams:
            vals = (stream.get('values', []) + [0.0]*num_months)[:num_months]
            for i in range(num_months): cogs[i+1] += vals[i]
            cogs_display_data.append({'name': stream.get('name'), 'type': 'COGS', 'raw_values': [0.0] + vals})
    else:
        for i in range(1, L): cogs[i] = revenue[i] * cogs_pct_m[i-1]

    # 3. OpEx Setup
    for i in range(1, L): opex_total[i] = fixed_opex_monthly[i-1]
    if opex_streams:
        opex_total = [0.0] * L
        for stream in opex_streams:
            vals = (stream.get('values', []) + [0.0]*num_months)[:num_months]
            for i in range(num_months): opex_total[i+1] += vals[i]
            opex_display_data.append({'name': stream.get('name'), 'type': 'OpEx', 'raw_values': [0.0] + vals})

    gp, opex, dep, ebit, int_exp, taxes, ni = [[0.0]*L for _ in range(7)]
    ar, inv, ppe, ap, debt, re, cash, assets, liab_eq = [[0.0]*L for _ in range(9)]
    nwc, change_nwc = [[0.0]*L for _ in range(2)]

    # --- YEAR 0 BALANCING ---
    ppe[0] = initial_ppe
    debt[0] = initial_debt
    cash[0] = initial_cash
    if revenue[0] > 0:
        ar[0] = (revenue[0] / days_in_period) * dso_m[0]
        inv[0] = (revenue[0] * cogs_pct_m[0] / days_in_period) * dio_m[0]
        ap[0] = (revenue[0] * cogs_pct_m[0] / days_in_period) * dpo_m[0]
    
    # Mathematical Plug for Retained Earnings
    re[0] = (cash[0] + ar[0] + inv[0] + ppe[0]) - (ap[0] + debt[0])
    assets[0] = cash[0] + ar[0] + inv[0] + ppe[0]
    liab_eq[0] = ap[0] + debt[0] + re[0]

    for i in range(1, L):
        idx = i - 1
        gp[i] = revenue[i] - cogs[i]
        opex[i] = opex_total[i]
        dep[i] = ppe[i-1] * m_dep_rate
        ebit[i] = gp[i] - opex[i] - dep[i]
        int_exp[i] = debt[i-1] * m_int_rate
        taxes[i] = max(0, (ebit[i] - int_exp[i]) * tax_rate)
        ni[i] = ebit[i] - int_exp[i] - taxes[i]
        
        ppe[i] = ppe[i-1] + capex_monthly[idx] - dep[i]
        ar[i] = (revenue[i] / days_in_period) * dso_m[idx]
        inv[i] = (cogs[i] / days_in_period) * dio_m[idx]
        ap[i] = (cogs[i] / days_in_period) * dpo_m[idx]
        
        repayment = min(debt[i-1], debt_repayment_monthly[idx])
        debt[i] = debt[i-1] - repayment
        
        nwc[i] = ar[i] + inv[i] - ap[i]
        change_nwc[i] = nwc[i] - (nwc[i-1] if i > 0 else (ar[0]+inv[0]-ap[0]))
        
        cfo = ni[i] + dep[i] - change_nwc[i]
        cash[i] = cash[i-1] + cfo - capex_monthly[idx] - repayment
        re[i] = re[i-1] + ni[i]
        assets[i] = cash[i] + ar[i] + inv[i] + ppe[i]
        liab_eq[i] = ap[i] + debt[i] + re[i]

    def get_display_val(arr, is_is=True):
        if monthly_detail > 0:
            return arr[1:monthly_detail+1] + [sum(arr[i:i+12]) for i in range(monthly_detail+1, L, 12)]
        return [sum(arr[i:i+12]) for i in range(1, L, 12)]

    labels = [f"Month {i}" for i in range(1, monthly_detail+1)] + [f"Year {i}" for i in range((monthly_detail//12)+1, years+1)] if monthly_detail > 0 else [f"Year {i}" for i in range(1, years+1)]

    final_stream_rows = []
    for s in revenue_display_data + cogs_display_data + opex_display_data:
        final_stream_rows.append({'name': s['name'], 'type': s['type'], 'values': get_display_val(s['raw_values'])})

    return {
        "Display_Labels": labels,
        "display_data": {
            "Stream_Rows": final_stream_rows,
            "Revenue": get_display_val(revenue),
            "COGS": get_display_val(cogs),
            "Gross Profit": get_display_val(gp),
            "Fixed Opex": get_display_val(opex),
            "Depreciation": get_display_val(dep),
            "EBIT": get_display_val(ebit),
            "Interest": get_display_val(int_exp),
            "Taxes": get_display_val(taxes),
            "Net Income": get_display_val(ni),
            "Cash": get_display_val(cash, False),
            "AR": get_display_val(ar, False),
            "Inventory": get_display_val(inv, False),
            "PPE": get_display_val(ppe, False),
            "Total Assets": get_display_val(assets, False),
            "AP": get_display_val(ap, False),
            "Debt": get_display_val(debt, False),
            "RE": get_display_val(re, False),
            "Total LiabEq": get_display_val(liab_eq, False),
            "CF_NI": get_display_val(ni),
            "CF_Dep": get_display_val(dep),
            "CF_NWC": [-x for x in get_display_val(change_nwc)],
            "CFO": [get_display_val(ni)[i] + get_display_val(dep)[i] - get_display_val(change_nwc)[i] for i in range(len(labels))],
            "CFI": [-x for x in get_display_val(expand_to_months(capex_rates))],
            "CFF": [-x for x in get_display_val(expand_to_months(annual_debt_repayment_list))],
            "Net Cash Change": [get_display_val(cash, False)[i] - (get_display_val(cash, False)[i-1] if i>0 else initial_cash) for i in range(len(labels))]
        }
    }
