import numpy as np

def generate_forecast(
    initial_revenue, revenue_growth_rates, cogs_pct_rates, fixed_opex_rates,
    tax_rate, initial_ppe, capex_rates, depreciation_rate,
    dso_days_list, dio_days_list, dpo_days_list,
    initial_debt, initial_cash, interest_rate,
    annual_debt_repayment_list, years=5, monthly_detail=0,
    revenue_streams=None, cogs_streams=None, opex_streams=None, **kwargs
):
    num_months = years * 12
    L = num_months + 1
    revenue = [0.0] * L
    cogs = [0.0] * L
    opex_total = [0.0] * L
    stream_display_data = []

    # 1. REVENUE
    if revenue_streams:
        for s in revenue_streams:
            vals = s.get('values', [])[:num_months]
            vals += [0.0] * (num_months - len(vals))
            for i, v in enumerate(vals): revenue[i+1] += v
            stream_display_data.append({'name': s['name'], 'values': [round(v,2) for v in vals]})

    # 2. COGS (Fix Task 1: Tracking Extra COGS as Display Rows)
    if cogs_streams:
        for s in cogs_streams:
            vals = s.get('values', [])[:num_months]
            vals += [0.0] * (num_months - len(vals))
            
            # If linked %, calculate $ amounts
            if s.get('type') == 'stream-cogs':
                # Find matching revenue stream if possible, or use total
                rev_source = revenue # Default to total if specific mapping isn't passed
                final_vals = [rev_source[i+1] * (v/100) for i, v in enumerate(vals)]
            else:
                final_vals = vals
                
            for i, v in enumerate(final_vals): cogs[i+1] += v
            stream_display_data.append({'name': f"COGS: {s['name']}", 'values': [round(v,2) for v in final_vals]})

    # 3. OPEX (Task 2: Granular OpEx Builder Integration)
    if opex_streams and len(opex_streams) > 0:
        for s in opex_streams:
            vals = s.get('values', [])[:num_months]
            vals += [0.0] * (num_months - len(vals))
            for i, v in enumerate(vals): opex_total[i+1] += v
            stream_display_data.append({'name': f"OpEx: {s['name']}", 'values': [round(v,2) for v in vals]})
    else:
        # Fallback to annual rates
        for y, rate in enumerate(fixed_opex_rates):
            for m in range(12):
                idx = (y * 12) + m + 1
                if idx < L: opex_total[idx] = rate / 12.0

    # 4. P&L CALCULATIONS
    gp = [revenue[i] - cogs[i] for i in range(L)]
    ebit = [gp[i] - opex_total[i] for i in range(L)]
    
    # Simple Interest/Tax/Cash logic for demonstration
    cash = [0.0] * L
    cash[0] = initial_cash
    ni = [0.0] * L
    
    for i in range(1, L):
        interest = initial_debt * (interest_rate / 12.0)
        tax = max(0, (ebit[i] - interest) * tax_rate)
        ni[i] = ebit[i] - interest - tax
        cash[i] = cash[i-1] + ni[i] # Simplified CF

    # Formatting for Frontend
    labels = [f"Yr {i+1}" for i in range(years)]
    def annualize(vec):
        return [sum(vec[1+i*12:1+(i+1)*12]) for i in range(years)]

    return {
        "Display_Labels": labels,
        "display_data": {
            "Stream_Rows": [{'name': s['name'], 'values': annualize([0.0]+s['values'])} for s in stream_display_data],
            "Total Revenue": annualize(revenue),
            "Total COGS": annualize(cogs),
            "Gross Profit": annualize(gp),
            "Fixed Opex": annualize(opex_total),
            "EBIT": annualize(ebit),
            "Net Income": annualize(ni),
            "Ending Cash": [cash[12], cash[24], cash[36], cash[48], cash[60]][:years]
        }
    }
