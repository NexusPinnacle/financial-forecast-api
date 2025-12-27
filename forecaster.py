def generate_forecast(
    revenue_streams, cogs_pct_rates, fixed_opex_rates,
    tax_rate, initial_ppe, capex_rates, depreciation_rate,
    dso_days_list, dio_days_list, dpo_days_list,
    initial_debt, initial_cash, interest_rate,
    annual_debt_repayment_list, years=5, monthly_detail=0
):
    num_months = years * 12
    L = num_months + 1
    
    def expand(annual_list):
        ml = []
        for v in annual_list: ml.extend([v] * 12)
        return ml[:num_months]

    # Initialize Arrays
    revenue = [0.0] * L
    # Aggregate matrix data
    for stream in revenue_streams:
        for entry in stream.get('matrix', []):
            m_idx = ((int(entry['y']) - 1) * 12) + int(entry['m'])
            if 0 < m_idx < L:
                revenue[m_idx] += float(entry['val'] or 0)

    # Use Month 1 as proxy for Y0 baseline if needed for ratios
    revenue[0] = revenue[1] if L > 1 else 0.0

    # Assumptions
    opex_m = [x/12 for x in expand(fixed_opex_rates)]
    capex_m = [x/12 for x in expand(capex_rates)]
    repay_m = [x/12 for x in expand(annual_debt_repayment_list)]
    cogs_p = expand(cogs_pct_rates)
    dso = expand(dso_days_list)
    dio = expand(dio_days_list)
    dpo = expand(dpo_days_list)
    
    # Financial State
    cash, ar, inv, ppe, ap, debt, re = [[0.0]*L for _ in range(7)]
    ni, dep, cogs = [[0.0]*L for _ in range(3)]

    # Year 0
    ppe[0], debt[0], cash[0] = initial_ppe, initial_debt, initial_cash
    ar[0] = (revenue[0]/30) * dso[0]
    inv[0] = (revenue[0]*cogs_p[0]/30) * dio[0]
    ap[0] = (revenue[0]*cogs_p[0]/30) * dpo[0]
    re[0] = (cash[0]+ar[0]+inv[0]+ppe[0]) - (ap[0]+debt[0])

    for i in range(1, L):
        idx = i-1
        cogs[i] = revenue[i] * cogs_p[idx]
        dep[i] = ppe[i-1] * (depreciation_rate/12)
        ebit = (revenue[i] - cogs[i]) - opex_m[idx] - dep[i]
        interest = debt[i-1] * (interest_rate/12)
        ni[i] = (ebit - interest) - max(0, (ebit-interest)*tax_rate)
        
        ppe[i] = ppe[i-1] + capex_m[idx] - dep[i]
        ar[i] = (revenue[i]/30.4) * dso[idx]
        inv[i] = (cogs[i]/30.4) * dio[idx]
        ap[i] = (cogs[i]/30.4) * dpo[idx]
        
        repaid = min(debt[i-1], repay_m[idx])
        debt[i] = debt[i-1] - repaid
        re[i] = re[i-1] + ni[i]
        
        # Cash Flow logic... (CFO + CFI + CFF)
        nwc_change = (ar[i]+inv[i]-ap[i]) - (ar[i-1]+inv[i-1]-ap[i-1])
        cash[i] = cash[i-1] + ni[i] + dep[i] - nwc_change - capex_m[idx] - repaid

    # Return display_data dictionary... (Aggregation logic here)
