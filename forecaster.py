import pandas as pd
import numpy as np

def generate_forecast(
    initial_revenue,
    revenue_growth_rates, 
    cogs_pct_rates, 
    fixed_opex_rates,
    tax_rate,
    initial_ppe,
    capex_rates,
    depreciation_rate,
    dso_days_list,
    dio_days_list,
    dpo_days_list,
    initial_debt,       
    initial_cash,       
    interest_rate,
    annual_debt_repayment_list,
    years=3,
    monthly_years=1  # Number of years to break down into monthly periods
):
    """
    Calculates a hybrid financial forecast.
    Example: years=3, monthly_years=1 creates 12 months (Year 1) + 2 annual steps (Year 2, 3).
    """

    # --- 1. TIMELINE CONSTRUCTION ---
    # Define the structure of each period to ensure calculations match the time-scale
    timeline = []
    
    # Generate Monthly slots
    for y in range(monthly_years):
        for m in range(1, 13):
            timeline.append({
                'label': f"M{m + (y*12)}", 
                'type': 'month', 
                'year_idx': y,
                'days': 365.0 / 12.0
            })
            
    # Generate remaining Annual slots
    for y in range(monthly_years, years):
        timeline.append({
            'label': f"Y{y+1}", 
            'type': 'year', 
            'year_idx': y,
            'days': 365.0
        })

    num_periods = len(timeline)
    L = num_periods + 1 # Include Period 0 (Baseline)

    # --- 2. INPUT EXPANSION LOGIC ---
    # We expand the user's annual assumptions to match the timeline.
    # We also handle 'Flow' vs 'Rate' conversions.
    def expand_assumptions(annual_list, is_flow_item=False):
        expanded = []
        # Pad the list if user provided fewer years than the total forecast
        vals = annual_list + [annual_list[-1]] * (years - len(annual_list))
        
        for period in timeline:
            val = vals[period['year_idx']]
            if period['type'] == 'month':
                if is_flow_item:
                    # Revenue/Opex/CapEx: Divide annual target by 12
                    expanded.append(val / 12.0)
                elif annual_list is revenue_growth_rates:
                    # Growth: Convert annual rate to monthly compounding: (1+r)^(1/12) - 1
                    expanded.append((1 + val)**(1/12) - 1)
                else:
                    # Ratios (COGS%, DSO): Stay the same
                    expanded.append(val)
            else:
                expanded.append(val)
        return expanded

    # Map the lists
    calc_rev_growth = expand_assumptions(revenue_growth_rates)
    calc_cogs_pct = expand_assumptions(cogs_pct_rates)
    calc_fixed_opex = expand_assumptions(fixed_opex_rates, is_flow_item=True)
    calc_capex = expand_assumptions(capex_rates, is_flow_item=True)
    calc_dso = expand_assumptions(dso_days_list)
    calc_dio = expand_assumptions(dio_days_list)
    calc_dpo = expand_assumptions(dpo_days_list)
    calc_debt_repay = expand_assumptions(annual_debt_repayment_list, is_flow_item=True)

    # --- 3. INITIALIZATION ---
    revenue = [0.0] * L
    cogs = [0.0] * L
    gross_profit = [0.0] * L
    fixed_opex_list = [0.0] * L
    depreciation = [0.0] * L
    ebit = [0.0] * L
    interest_expense = [0.0] * L
    ebt = [0.0] * L
    taxes = [0.0] * L
    net_income = [0.0] * L

    ar_closing = [0.0] * L
    inventory_closing = [0.0] * L
    ppe_closing = [0.0] * L
    ap_closing = [0.0] * L
    debt_closing = [0.0] * L
    retained_earnings = [0.0] * L
    cash_closing = [0.0] * L
    total_assets = [0.0] * L
    total_liabilities_equity = [0.0] * L
    
    change_in_nwc = [0.0] * L
    cash_flow_from_financing = [0.0] * L
    net_change_in_cash = [0.0] * L

    # --- 4. PERIOD 0 (BASELINE SETUP) ---
    revenue[0] = initial_revenue 
    ppe_closing[0] = initial_ppe
    debt_closing[0] = initial_debt
    cash_closing[0] = initial_cash
    
    # Calculate initial Working Capital based on initial Revenue
    ar_closing[0] = (initial_revenue / 365.0) * calc_dso[0]
    inventory_closing[0] = (initial_revenue * calc_cogs_pct[0] / 365.0) * calc_dio[0]
    ap_closing[0] = (initial_revenue * calc_cogs_pct[0] / 365.0) * calc_dpo[0]
    
    retained_earnings[0] = (cash_closing[0] + ar_closing[0] + inventory_closing[0] + ppe_closing[0]) - \
                           (ap_closing[0] + debt_closing[0])
    total_assets[0] = cash_closing[0] + ar_closing[0] + inventory_closing[0] + ppe_closing[0]
    total_liabilities_equity[0] = ap_closing[0] + debt_closing[0] + retained_earnings[0]

    # --- 5. RECURSIVE CALCULATION LOOP ---
    for i in range(1, L):
        idx = i - 1
        p = timeline[idx]
        
        # Determine Period Rates (Depreciation/Interest)
        period_factor = 12.0 if p['type'] == 'month' else 1.0
        p_depr_rate = depreciation_rate / period_factor
        p_int_rate = interest_rate / period_factor

        # Income Statement
        revenue[i] = revenue[i-1] * (1 + calc_rev_growth[idx])
        cogs[i] = revenue[i] * calc_cogs_pct[idx]
        gross_profit[i] = revenue[i] - cogs[i]
        fixed_opex_list[i] = calc_fixed_opex[idx]
        depreciation[i] = ppe_closing[i-1] * p_depr_rate
        
        ebit[i] = gross_profit[i] - fixed_opex_list[i] - depreciation[i]
        interest_expense[i] = debt_closing[i-1] * p_int_rate
        ebt[i] = ebit[i] - interest_expense[i]
        taxes[i] = max(0, ebt[i]) * tax_rate
        net_income[i] = ebt[i] - taxes[i]
        
        # Balance Sheet (Working Capital)
        # Using 365 as the annualizer regardless of period type for consistent DSO logic
        ar_closing[i] = (revenue[i] * (12 if p['type'] == 'month' else 1) / 365.0) * calc_dso[idx]
        inventory_closing[i] = (cogs[i] * (12 if p['type'] == 'month' else 1) / 365.0) * calc_dio[idx]
        ap_closing[i] = (cogs[i] * (12 if p['type'] == 'month' else 1) / 365.0) * calc_dpo[idx]
        
        change_in_nwc[i] = (ar_closing[i] + inventory_closing[i] - ap_closing[i]) - \
                           (ar_closing[i-1] + inventory_closing[i-1] - ap_closing[i-1])
        
        # Balance Sheet (Long Term)
        ppe_closing[i] = ppe_closing[i-1] + calc_capex[idx] - depreciation[i]
        debt_repaid = min(calc_debt_repay[idx], debt_closing[i-1])
        debt_closing[i] = debt_closing[i-1] - debt_repaid
        retained_earnings[i] = retained_earnings[i-1] + net_income[i]
        
        # Cash Flow Statement
        cash_flow_from_financing[i] = -debt_repaid
        cfo = net_income[i] + depreciation[i] - change_in_nwc[i]
        cfi = -calc_capex[idx]
        net_change_in_cash[i] = cfo + cfi + cash_flow_from_financing[i]
        cash_closing[i] = cash_closing[i-1] + net_change_in_cash[i]
        
        # Integrity Check
        total_assets[i] = cash_closing[i] + ar_closing[i] + inventory_closing[i] + ppe_closing[i]
        total_liabilities_equity[i] = ap_closing[i] + debt_closing[i] + retained_earnings[i]

    # --- 6. DATA PACKAGING ---
    labels = ["Start"] + [p['label'] for p in timeline]
    
    return {
        "Labels": labels,
        "Revenue": revenue,
        "Net Income": net_income,
        "Closing Cash": cash_closing,
        "excel_is": {
            "Revenue": revenue[1:], "COGS": cogs[1:], "Gross Profit": gross_profit[1:],
            "Fixed Operating Expenses": fixed_opex_list[1:], "Depreciation": depreciation[1:], 
            "EBIT": ebit[1:], "Interest Expense": interest_expense[1:], "Net Income": net_income[1:]
        },
        "excel_bs": {
            "Cash": cash_closing, "Accounts Receivable": ar_closing, "Inventory": inventory_closing,
            "Net PP&E": ppe_closing, "Total Assets": total_assets, "Accounts Payable": ap_closing,
            "Debt": debt_closing, "Retained Earnings": retained_earnings, "Total Liabilities & Equity": total_liabilities_equity
        },
        "excel_cfs": {
            "Net Income": net_income[1:], "Add: Depreciation": depreciation[1:],
            "Less: Change in NWC": [-x for x in change_in_nwc[1:]],
            "Cash Flow from Operations": [net_income[i] + depreciation[i] - change_in_nwc[i] for i in range(1, L)],
            "Cash Flow from Investing (CapEx)": [-x for x in calc_capex],
            "Cash Flow from Financing": cash_flow_from_financing[1:],
            "Net Change in Cash": net_change_in_cash[1:]
        }
    }
