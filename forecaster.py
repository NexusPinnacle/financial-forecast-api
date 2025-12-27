import numpy as np

def generate_forecast(
    initial_revenue, revenue_growth_rates, cogs_pct_rates, fixed_opex_rates,
    tax_rate, initial_ppe, capex_rates, depreciation_rate,
    dso_days_list, dio_days_list, dpo_days_list,
    initial_debt, initial_cash, interest_rate,
    annual_debt_repayment_list, years=5, monthly_detail=0
):
    # --- 1. SETUP PERIODS ---
    num_months = years * 12
    L = num_months + 1
    
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
    revenue = [0.0] * L
    cogs, gp, opex, dep, ebit, int_exp, taxes, ni = [[0.0]*L for _ in range(8)]
    ar, inv, ppe, ap, debt, re, cash, assets, liab_eq = [[0.0]*L for _ in range(9)]
    nwc, change_nwc, cff, net_cash = [[0.0]*L for _ in range(4)]

    # Year 0
    revenue[0] = initial_revenue 
    ppe[0] = initial_ppe
    debt[0] = initial_debt
    cash[0] = initial_cash
    
    daily_f = 30.4 # Avg days in month
    initial_cogs = initial_revenue * cogs_pct_m[0]
    ar[0] = (initial_revenue / daily_f) * dso_m[0]
    inv[0] = (initial_cogs / daily_f) * dio_m[0]
    ap[0] = (initial_cogs / daily_f) * dpo_m[0]
    re[0] = (cash[0] + ar[0] + inv[0] + ppe[0]) - (ap[0] + debt[0])

    # --- 3. MAIN MONTHLY LOOP ---
    for i in range(1, L):
        idx = i - 1
        revenue[i] = revenue[i-1] * (1 + rev_growth_monthly[idx])
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
        change_nwc[i] = (ar[i]+inv[i]-ap[i]) - (ar[i-1]+inv[i-1]-ap[i-1])
        
        ppe[i] = ppe[i-1] + capex_monthly[idx] - dep[i]
        repaid = min(debt[i-1], debt_repayment_monthly[idx])
        debt[i] = debt[i-1] - repaid
        re[i] = re[i-1] + ni[i]
        
        cfo = ni[i] + dep[i] - change_nwc[i]
        cfi = -capex_monthly[idx]
        cff[i] = -repaid
        net_cash[i] = cfo + cfi + cff[i]
        cash[i] = cash[i-1] + net_cash[i]
        
        assets[i] = cash[i] + ar[i] + inv[i] + ppe[i]
        liab_eq[i] = ap[i] + debt[i] + re[i]

    # --- 4. AGGREGATION ---
    labels = ["Start"]
    start_year = (monthly_detail // 12) + 1
    for m in range(1, monthly_detail + 1): labels.append(f"M{m}")
    for y in range(start_year, years + 1): labels.append(f"Year {y}")

    def get_display(arr, is_bs=False):
        res = [arr[0]]
        for m in range(1, monthly_detail + 1): res.append(arr[m])
        for y in range(start_year, years + 1):
            if is_bs: res.append(arr[y*12])
            else: res.append(sum(arr[(y-1)*12+1 : y*12+1]))
        return res

    d_rev = get_display(revenue)[1:]
    d_ni = get_display(ni)[1:]

    return {
        "Display_Labels": labels,
        "display_data": {
            "Revenue": d_rev, "COGS": get_display(cogs)[1:], "Gross Profit": get_display(gp)[1:],
            "Fixed Opex": get_display(opex)[1:], "Depreciation": get_display(dep)[1:],
            "EBIT": get_display(ebit)[1:], "Interest": get_display(int_exp)[1:],
            "Taxes": get_display(taxes)[1:], "Net Income": d_ni,
            "Cash": get_display(cash, True), "AR": get_display(ar, True),
            "Inventory": get_display(inv, True), "PPE": get_display(ppe, True),
            "Total Assets": get_display(assets, True), "AP": get_display(ap, True),
            "Debt": get_display(debt, True), "RE": get_display(re, True),
            "Total LiabEq": get_display(liab_eq, True),
            "CF_NI": d_ni, "CF_Dep": get_display(dep)[1:], "CF_NWC": [-x for x in get_display(change_nwc)[1:]],
            "CFO": get_display(net_cash)[1:], "CFI": [-x for x in get_display(capex_monthly)[1:]],
            "CFF": get_display(cff)[1:], "Net Cash Change": get_display(net_cash)[1:]
        }
    }
