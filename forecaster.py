import pandas as pd
import numpy as np

def generate_forecast(
    revenue_streams, # Updated: Now receives the list of stream objects
    cogs_pct_rates, fixed_opex_rates,
    tax_rate, initial_ppe, capex_rates, depreciation_rate,
    dso_days_list, dio_days_list, dpo_days_list,
    initial_debt, initial_cash, interest_rate,
    annual_debt_repayment_list, years=5, monthly_detail=0
):
    # --- 1. SETUP PERIODS ---
    num_months = years * 12
    days_in_period = 365.0 / 12.0
    
    def expand_to_months(annual_list):
        ml = []
        for val in annual_list:
            ml.extend([val] * 12)
        return ml[:num_months]

    # Convert annual assumptions to monthly
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
    revenue = [0.0] * L
    cogs, gp, opex, dep, ebit, int_exp, taxes, ni = [[0.0]*L for _ in range(8)]
    ar, inv, ppe, ap, debt, re, cash, assets, liab_eq = [[0.0]*L for _ in range(9)]
    nwc, change_nwc, cff, net_cash = [[0.0]*L for _ in range(4)]

    # AGGREGATE REVENUE FROM STREAMS
    # matrix is a list of {'y': 1, 'm': 5, 'val': 100}
    for stream in revenue_streams:
        for entry in stream.get('matrix', []):
            m_idx = ((int(entry['y']) - 1) * 12) + int(entry['m'])
            if 0 < m_idx < L:
                revenue[m_idx] += float(entry['val'])

    # Year 0 Baseline (Used for initial Balance Sheet ratios)
    # If no Month 1 revenue is provided, we use the average or first month as a proxy for Y0
    revenue[0] = revenue[1] if L > 1 else 0.0 
    
    ppe[0] = initial_ppe
    debt[0] = initial_debt
    cash[0] = initial_cash
    
    daily_f = 365.0 / 12.0
    initial_cogs = revenue[0] * cogs_pct_m[0]
    ar[0] = (revenue[0] / daily_f) * dso_m[0]
    inv[0] = (initial_cogs / daily_f) * dio_m[0]
    ap[0] = (initial_cogs / daily_f) * dpo_m[0]
    re[0] = (cash[0] + ar[0] + inv[0] + ppe[0]) - (ap[0] + debt[0])
    assets[0] = cash[0] + ar[0] + inv[0] + ppe[0]
    liab_eq[0] = ap[0] + debt[0] + re[0]

    # --- 3. MAIN MONTHLY LOOP ---
    for i in range(1, L):
        idx = i - 1
        # revenue[i] is already populated from the streams matrix
        cogs[i] = revenue[i] * cogs_pct_m[idx]
        gp[i] = revenue[i] - cogs[i]
        opex[i] = fixed_opex_monthly[idx]
        dep[i] = ppe[i-1] * m_dep_rate
        ebit[i] = gp[i] - opex[i] - dep[i]
        int_exp[i] = debt[i-1] * m_int_rate
        
        pre_tax = ebit[i] - int_exp[i]
        taxes[i] = max(0, pre_tax * tax_rate)
        ni[i] = pre_tax - taxes[i]
        
        ar[i] = (revenue[i] / daily_f) * dso_m[idx]
        inv[i] = (cogs[i] / daily_f) * dio_m[idx]
        ap[i] = (cogs[i] / daily_f) * dpo_m[idx]
        
        change_nwc[i] = (ar[i] + inv[i] - ap[i]) - (ar[i-1] + inv[i-1] - ap[i-1])
        ppe[i] = ppe[i-1] + capex_monthly[idx] - dep[i]
        
        debt_repaid = min(debt_repayment_monthly[idx], debt[i-1])
        debt[i] = debt[i-1] - debt_repaid
        re[i] = re[i-1] + ni[i]
        
        cfo = ni[i] + dep[i] - change_nwc[i]
        cfi = -capex_monthly[idx]
        cff[i] = -debt_repaid
        net_cash[i] = cfo + cfi + cff[i]
        cash[i] = cash[i-1] + net_cash[i]
        
        assets[i] = cash[i] + ar[i] + inv[i] + ppe[i]
        liab_eq[i] = ap[i] + debt[i] + re[i]

    # --- 4. HYBRID AGGREGATION ---
    labels = ["Start"]
    start_year = (monthly_detail // 12) + 1
    
    for m in range(1, monthly_detail + 1):
        labels.append(f"M{m}")
    for y in range(start_year, years + 1):
        labels.append(f"Year {y}")

    def get_display_val(arr, is_is=True):
        res_start = arr[0]
        res = []
        for m in range(1, monthly_detail + 1):
            res.append(arr[m])
        for y in range(start_year, years + 1):
            m_end = y * 12
            m_start = (y-1) * 12 + 1
            if is_is:
                res.append(sum(arr[m_start : m_end+1]))
            else:
                res.append(arr[m_end])
        return [res_start] + res

    d_rev = get_display_val(revenue)[1:]
    d_ni = get_display_val(ni)[1:]
    
    return {
        "Display_Labels": labels,
        "display_data": {
            "Revenue": d_rev,
            "COGS": get_display_val(cogs)[1:],
            "Gross Profit": get_display_val(gp)[1:],
            "Fixed Opex": get_display_val(opex)[1:],
            "Depreciation": get_display_val(dep)[1:],
            "EBIT": get_display_val(ebit)[1:],
            "Interest": get_display_val(int_exp)[1:],
            "Taxes": get_display_val(taxes)[1:],
            "Net Income": d_ni,
            "Cash": get_display_val(cash, False),
            "AR": get_display_val(ar, False),
            "Inventory": get_display_val(inv, False),
            "PPE": get_display_val(ppe, False),
            "Total Assets": get_display_val(assets, False),
            "AP": get_display_val(ap, False),
            "Debt": get_display_val(debt, False),
            "RE": get_display_val(re, False),
            "Total LiabEq": get_display_val(liab_eq, False),
            "CF_NI": d_ni,
            "CF_Dep": get_display_val(dep)[1:],
            "CF_NWC": [-x for x in get_display_val(change_nwc)[1:]],
            "CFO": [ (d_ni[i] + get_display_val(dep)[1:][i] - get_display_val(change_nwc)[1:][i]) for i in range(len(d_ni))],
            "CFI": [-x for x in get_display_val(capex_monthly)[1:]],
            "CFF": get_display_val(cff)[1:],
            "Net Cash Change": get_display_val(net_cash)[1:]
        }
    }
