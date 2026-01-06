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
    opex_streams=None, # Task 2: New Parameter
    **kwargs 
):
    # --- 1. SETUP PERIODS (Always Monthly internally) ---
    num_months = years * 12
    days_in_period = 365.0 / 12.0
    
    def expand_to_months(annual_list):
        ml = []
        for val in annual_list:
            ml.extend([val] * 12)
        return ml[:num_months]

    # Convert annual rates to monthly
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

    # --- 2. INITIALIZATION ---
    L = num_months + 1
    
    # REVENUE LOGIC
    revenue = [0.0] * L
    cogs = [0.0] * L
    opex_total = [0.0] * L # Task 2: Internal OpEx tracker

    revenue_display_data = [] 
    cogs_display_data = [] # Task 1: For COGS breakdown
    opex_display_data = [] # Task 2: For OpEx breakdown

    # A. Revenue Streams
    if revenue_streams and len(revenue_streams) > 0:
        revenue[0] = 0 
        for stream in revenue_streams:
            vals = stream.get('values', [])
            formatted_vals = vals[:num_months]
            if len(formatted_vals) < num_months:
                 formatted_vals.extend([0.0] * (num_months - len(formatted_vals)))
            
            for i in range(len(formatted_vals)):
                revenue[i+1] += formatted_vals[i]
                
            revenue_display_data.append({
                'name': stream.get('name', 'Stream'),
                'type': 'Revenue',
                'raw_values': [0.0] + formatted_vals
            })
    else:
        revenue[0] = initial_revenue
        for i in range(1, L):
            revenue[i] = revenue[i-1] * (1 + rev_growth_monthly[i-1])

    # B. COGS Streams (Task 1 Fix)
    if cogs_streams and len(cogs_streams) > 0:
        for stream in cogs_streams:
            vals = stream.get('values', [])
            formatted_vals = vals[:num_months]
            if len(formatted_vals) < num_months:
                 formatted_vals.extend([0.0] * (num_months - len(formatted_vals)))
            
            for i in range(len(formatted_vals)):
                cogs[i+1] += formatted_vals[i]
            
            # Store for individual display in P&L
            cogs_display_data.append({
                'name': stream.get('name', 'Direct Cost'),
                'type': 'COGS',
                'raw_values': [0.0] + formatted_vals
            })
    else:
        for i in range(1, L):
            cogs[i] = revenue[i] * cogs_pct_m[i-1]

    # C. OpEx Streams (Task 2)
    # Start with base annual rates
    for i in range(1, L):
        opex_total[i] = fixed_opex_monthly[i-1]

    if opex_streams and len(opex_streams) > 0:
        # If user provides granular streams, we reset and use those primarily
        # but to keep it safe, we ADD them to any existing base rates if both exist.
        # Requirement says "primary driver", so we clear the base if streams exist:
        opex_total = [0.0] * L 
        for stream in opex_streams:
            vals = stream.get('values', [])
            formatted_vals = vals[:num_months]
            if len(formatted_vals) < num_months:
                 formatted_vals.extend([0.0] * (num_months - len(formatted_vals)))
            
            for i in range(len(formatted_vals)):
                opex_total[i+1] += formatted_vals[i]
            
            opex_display_data.append({
                'name': stream.get('name', 'OpEx'),
                'type': 'OpEx',
                'raw_values': [0.0] + formatted_vals
            })

    # Other Vectors
    gp, opex, dep, ebit, int_exp, taxes, ni = [[0.0]*L for _ in range(7)]
    ar, inv, ppe, ap, debt, re, cash, assets, liab_eq = [[0.0]*L for _ in range(9)]
    nwc, change_nwc, cff, net_cash = [[0.0]*L for _ in range(4)]

    ppe[0] = initial_ppe
    debt[0] = initial_debt
    cash[0] = initial_cash

    # Initial Working Cap
    if revenue[0] > 0:
        initial_cogs = revenue[0] * cogs_pct_m[0]
        ar[0] = revenue[0] / days_in_period * dso_m[0]
        inv[0] = initial_cogs / days_in_period * dio_m[0]
        ap[0] = initial_cogs / days_in_period * dpo_m[0]
        re[0] = (cash[0] + ar[0] + inv[0] + ppe[0]) - (ap[0] + debt[0])

    # --- 3. CORE CALCULATION LOOP ---
    for i in range(1, L):
        idx = i - 1
        
        # Income Statement
        gp[i] = revenue[i] - cogs[i]
        opex[i] = opex_total[i] # Uses combined or granular logic from above
        dep[i] = ppe[i-1] * m_dep_rate
        ebit[i] = gp[i] - opex[i] - dep[i]
        int_exp[i] = debt[i-1] * m_int_rate
        taxes[i] = max(0, (ebit[i] - int_exp[i]) * tax_rate)
        ni[i] = ebit[i] - int_exp[i] - taxes[i]
        
        # Balance Sheet
        ppe[i] = ppe[i-1] + capex_monthly[idx] - dep[i]
        ar[i] = (revenue[i] / days_in_period) * dso_m[idx]
        inv[i] = (cogs[i] / days_in_period) * dio_m[idx]
        ap[i] = (cogs[i] / days_in_period) * dpo_m[idx]
        
        # Debt management
        repayment = min(debt[i-1], debt_repayment_monthly[idx])
        debt[i] = debt[i-1] - repayment
        
        # Cash Flow & NWC
        nwc[i] = ar[i] + inv[i] - ap[i]
        change_nwc[i] = nwc[i] - nwc[i-1]
        
        cfo = ni[i] + dep[i] - change_nwc[i]
        cfi = -capex_monthly[idx]
        cff_val = -repayment
        
        cash[i] = cash[i-1] + cfo + cfi + cff_val
        re[i] = re[i-1] + ni[i]
        
        assets[i] = cash[i] + ar[i] + inv[i] + ppe[i]
        liab_eq[i] = ap[i] + debt[i] + re[i]

    # --- 4. DATA PACKAGING ---
    def get_display_val(arr, is_is=True):
        if monthly_detail > 0:
            m_slice = arr[1:monthly_detail+1]
            # Annualize remaining
            remaining_months = arr[monthly_detail+1:]
            annual_slices = [sum(remaining_months[i:i+12]) for i in range(0, len(remaining_months), 12)]
            return m_slice + annual_slices
        else:
            return [sum(arr[i:i+12]) for i in range(1, L, 12)]

    labels = []
    if monthly_detail > 0:
        labels += [f"Month {i}" for i in range(1, monthly_detail + 1)]
        start_year = (monthly_detail // 12) + 1
        labels += [f"Year {i}" for i in range(start_year, years + 1)]
    else:
        labels = [f"Year {i}" for i in range(1, years + 1)]

    # Structure line items for the P&L
    final_stream_rows = []
    for s in revenue_display_data:
        final_stream_rows.append({'name': s['name'], 'type': 'Revenue', 'values': get_display_val(s['raw_values'])})
    for s in cogs_display_data:
        final_stream_rows.append({'name': s['name'], 'type': 'COGS', 'values': get_display_val(s['raw_values'])})
    for s in opex_display_data:
        final_stream_rows.append({'name': s['name'], 'type': 'OpEx', 'values': get_display_val(s['raw_values'])})

    d_rev = get_display_val(revenue)
    d_ni = get_display_val(ni)
    d_cash = get_display_val(cash, False)

    return {
        "Display_Labels": labels,
        "display_data": {
            "Stream_Rows": final_stream_rows,
            "Revenue": d_rev,
            "COGS": get_display_val(cogs),
            "Gross Profit": get_display_val(gp),
            "Fixed Opex": get_display_val(opex),
            "Depreciation": get_display_val(dep),
            "EBIT": get_display_val(ebit),
            "Interest": get_display_val(int_exp),
            "Taxes": get_display_val(taxes),
            "Net Income": d_ni,
            "Cash": d_cash,
            "AR": get_display_val(ar, False),
            "Inventory": get_display_val(inv, False),
            "PPE": get_display_val(ppe, False),
            "Total Assets": get_display_val(assets, False),
            "AP": get_display_val(ap, False),
            "Debt": get_display_val(debt, False),
            "RE": get_display_val(re, False),
            "Total LiabEq": get_display_val(liab_eq, False),
            "CF_NI": d_ni,
            "CF_Dep": get_display_val(dep),
            "CF_NWC": [-x for x in get_display_val(change_nwc)],
            "CFO": [d_ni[i] + get_display_val(dep)[i] - get_display_val(change_nwc)[i] for i in range(len(d_ni))],
            "CFI": [-x for x in get_display_val(expand_to_months(capex_rates))],
            "CFF": [-x for x in get_display_val(expand_to_months(annual_debt_repayment_list))],
            "Net Cash Change": [get_display_val(cash, False)[i] - (get_display_val(cash, False)[i-1] if i>0 else initial_cash) for i in range(len(d_rev))]
        }
    }
