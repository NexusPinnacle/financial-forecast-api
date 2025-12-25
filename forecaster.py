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
    period_mode='annual'  # NEW: 'annual' or 'monthly'
):
    """
    Calculates the integrated financial forecast.
    If period_mode is 'monthly', 'years' input is treated as the total duration in months 
    (e.g., 12, 24, 36), but the lists (revenue_growth_rates etc.) are still expected 
    to be per-year assumptions.
    """

    # --- 1. SETUP PERIODS & CONVERSIONS ---
    if period_mode == 'monthly':
        num_periods = years # In monthly mode, 'years' param carries the month count (12, 24, 36)
        days_in_period = 365.0 / 12.0
        
        # Helper: Expand an annual list (e.g. [Year1_Rate, Year2_Rate]) to a monthly list
        # We repeat the Year 1 rate for months 0-11, Year 2 for 12-23, etc.
        def expand_to_months(annual_list):
            monthly_list = []
            # Calculate how many full years we need to cover the requested months
            needed_years = (num_periods // 12) + (1 if num_periods % 12 != 0 else 0)
            
            # Extend the input list if it's shorter than needed (just repeat last val)
            extended_input = annual_list[:]
            if len(extended_input) < needed_years:
                extended_input += [extended_input[-1]] * (needed_years - len(extended_input))

            for y in range(needed_years):
                val = extended_input[y]
                # Add this value 12 times
                monthly_list.extend([val] * 12)
            
            return monthly_list[:num_periods]

        # Convert/Expand Inputs
        # 1. Growth: Convert Annual Growth to Monthly Compound Growth: (1+r)^(1/12) - 1
        rev_growth_monthly = [((1 + r)**(1/12) - 1) for r in expand_to_months(revenue_growth_rates)]
        
        # 2. Fixed Opex & CapEx & Debt Repayment: Simply divide Annual amount by 12
        fixed_opex_monthly = [x / 12.0 for x in expand_to_months(fixed_opex_rates)]
        capex_monthly = [x / 12.0 for x in expand_to_months(capex_rates)]
        debt_repayment_monthly = [x / 12.0 for x in expand_to_months(annual_debt_repayment_list)]
        
        # 3. Ratios that stay the same (COGS %, Tax Rate) or are Days-based
        cogs_pct_monthly = expand_to_months(cogs_pct_rates)
        dso_monthly = expand_to_months(dso_days_list)
        dio_monthly = expand_to_months(dio_days_list)
        dpo_monthly = expand_to_months(dpo_days_list)
        
        # 4. Rates: Interest and Depreciation (Annual -> Monthly simple division)
        # Note: Depreciation is often calculated on Gross PP&E, here simplified to Net for the model
        period_depreciation_rate = depreciation_rate / 12.0 
        period_interest_rate = interest_rate / 12.0
        
        # Assign to the variables used in loop
        calc_rev_growth = rev_growth_monthly
        calc_cogs_pct = cogs_pct_monthly
        calc_fixed_opex = fixed_opex_monthly
        calc_capex = capex_monthly
        calc_dso = dso_monthly
        calc_dio = dio_monthly
        calc_dpo = dpo_monthly
        calc_debt_repay = debt_repayment_monthly
        
    else:
        # ANNUAL MODE (Standard)
        num_periods = years
        days_in_period = 365.0
        
        calc_rev_growth = revenue_growth_rates
        calc_cogs_pct = cogs_pct_rates
        calc_fixed_opex = fixed_opex_rates
        calc_capex = capex_rates
        calc_dso = dso_days_list
        calc_dio = dio_days_list
        calc_dpo = dpo_days_list
        calc_debt_repay = annual_debt_repayment_list
        
        period_depreciation_rate = depreciation_rate
        period_interest_rate = interest_rate


    # --- 2. INITIALIZATION ---
    # Lists size is periods + 1 (for Year 0 / Month 0)
    L = num_periods + 1
    
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
    
    nwc_closing = [0.0] * L
    change_in_nwc = [0.0] * L
    cash_flow_from_financing = [0.0] * L
    net_change_in_cash = [0.0] * L

    # --- 3. YEAR/MONTH 0 SETUP ---
    revenue[0] = initial_revenue 
    ppe_closing[0] = initial_ppe
    debt_closing[0] = initial_debt
    cash_closing[0] = initial_cash
    
    # Use index 0 of the calculator lists for initial balance checks
    initial_cogs = initial_revenue * calc_cogs_pct[0]
    
    # Days formula: (Balance / Flow) * Days_in_Period  => Balance = Flow * (Days / Days_in_Period)
    # Note: Using 365 for the 'days' input standard (DSO is usually expressed in annual terms)
    # If mode is monthly, days_in_period is ~30.4.
    # Standard formula: AR = (AnnualSales / 365) * DSO. 
    # In Monthly step: AR = (MonthlySales / 30.4) * DSO? No, usually AR = MonthlySales * (DSO / 30).
    # To keep it consistent: Balance = Flow * (DSO_Days / DAYS_IN_YEAR) * (YEAR_FRACTION)?
    # Let's stick to the standard: Balance = (Revenue / DaysInPeriod) * DSO.
    # WAIT: The input DSO is e.g. "45 Days".
    # Annual: Rev=1000. DailyRev = 1000/365. AR = 2.74 * 45 = 123.
    # Monthly: Rev=83.3. DailyRev = 83.3/30.4 = 2.74. AR = 2.74 * 45 = 123. 
    # So the formula `Revenue * (DSO / 365)` works for Annual.
    # For Monthly, it is `Revenue * (DSO / Days_in_This_Period)`. 
    # But strictly, `Revenue` in the monthly array is 1/12th of annual. 
    # So `(MonthlyRevenue / (365/12)) * DSO` = `MonthlyRevenue * 12 / 365 * DSO`.
    
    if period_mode == 'monthly':
        # Conversion factor to get daily flow from period flow
        daily_factor = 365.0 / 12.0
    else:
        daily_factor = 365.0

    ar_closing[0] = initial_revenue / daily_factor * calc_dso[0]
    inventory_closing[0] = initial_cogs / daily_factor * calc_dio[0]
    ap_closing[0] = initial_cogs / daily_factor * calc_dpo[0]
    
    nwc_closing[0] = ar_closing[0] + inventory_closing[0] - ap_closing[0]
    retained_earnings[0] = (cash_closing[0] + ar_closing[0] + inventory_closing[0] + ppe_closing[0]) - \
                           (ap_closing[0] + debt_closing[0])
    total_assets[0] = cash_closing[0] + ar_closing[0] + inventory_closing[0] + ppe_closing[0]
    total_liabilities_equity[0] = ap_closing[0] + debt_closing[0] + retained_earnings[0]

    
    # --- 4. MAIN LOOP ---
    for i in range(1, num_periods + 1):
        idx = i - 1
        
        # Income Statement
        revenue[i] = revenue[i-1] * (1 + calc_rev_growth[idx])
        cogs[i] = revenue[i] * calc_cogs_pct[idx]
        gross_profit[i] = revenue[i] - cogs[i]
        fixed_opex_list[i] = calc_fixed_opex[idx]
        depreciation[i] = ppe_closing[i-1] * period_depreciation_rate
        
        ebit[i] = gross_profit[i] - fixed_opex_list[i] - depreciation[i]
        interest_expense[i] = debt_closing[i-1] * period_interest_rate
        ebt[i] = ebit[i] - interest_expense[i]
        taxes[i] = max(0, ebt[i]) * tax_rate
        net_income[i] = ebt[i] - taxes[i]
        
        # Balance Sheet
        # Working Capital Balances
        ar_closing[i] = (revenue[i] / daily_factor) * calc_dso[idx]
        inventory_closing[i] = (cogs[i] / daily_factor) * calc_dio[idx]
        ap_closing[i] = (cogs[i] / daily_factor) * calc_dpo[idx]
        
        nwc_closing[i] = ar_closing[i] + inventory_closing[i] - ap_closing[i]
        change_in_nwc[i] = nwc_closing[i] - nwc_closing[i-1]
        
        # Long Term
        ppe_closing[i] = ppe_closing[i-1] + calc_capex[idx] - depreciation[i]
        
        debt_repaid = min(calc_debt_repay[idx], debt_closing[i-1])
        debt_closing[i] = debt_closing[i-1] - debt_repaid
        
        retained_earnings[i] = retained_earnings[i-1] + net_income[i]
        
        # Cash Flow
        cash_flow_from_financing[i] = -debt_repaid
        cfo = net_income[i] + depreciation[i] - change_in_nwc[i]
        cfi = -calc_capex[idx]
        net_change_in_cash[i] = cfo + cfi + cash_flow_from_financing[i]
        
        cash_closing[i] = cash_closing[i-1] + net_change_in_cash[i]
        
        total_assets[i] = cash_closing[i] + ar_closing[i] + inventory_closing[i] + ppe_closing[i]
        total_liabilities_equity[i] = ap_closing[i] + debt_closing[i] + retained_earnings[i]

    # --- 5. RESULTS PACKAGING ---
    
    change_in_nwc_cfs = [-x for x in change_in_nwc[1:]] 
    
    # For Excel/Display labels
    if period_mode == 'monthly':
        time_labels = [f"Month {m}" for m in range(1, num_periods + 1)]
        excel_labels = time_labels
        bs_labels = ["Start"] + time_labels
    else:
        time_labels = list(range(1, num_periods + 1)) # 1, 2, 3
        excel_labels = time_labels
        bs_labels = [0] + time_labels

    cfs_data = {
        "Net Income": net_income[1:], 
        "Add: Depreciation": depreciation[1:],
        "Less: Change in NWC": change_in_nwc_cfs, 
        "Cash Flow from Operations": [net_income[i] + depreciation[i] - change_in_nwc[i] for i in range(1, num_periods + 1)],
        "Cash Flow from Investing (CapEx)": [-x for x in calc_capex], 
        "Cash Flow from Financing": cash_flow_from_financing[1:],
        "Net Change in Cash": net_change_in_cash[1:],
    }
    
    results = {
        "Years": bs_labels, # Used for column headers (mix of int and str now)
        "Revenue": revenue, "COGS": cogs, "Gross Profit": gross_profit, "Fixed Opex": fixed_opex_list, 
        "Depreciation": depreciation, "EBIT": ebit, "Interest Expense": interest_expense,
        "EBT": ebt, "Taxes": taxes, "Net Income": net_income,
        "Closing Cash": cash_closing, "Closing AR": ar_closing, "Closing Inventory": inventory_closing,
        "Closing PP&E": ppe_closing, "Closing AP": ap_closing,
        "Closing Debt": debt_closing, "Closing RE": retained_earnings,
        "NWC": nwc_closing, "Change in NWC": change_in_nwc,
        
        # Data for Excel export
        "excel_is": {
            "Revenue": revenue[1:], "COGS": cogs[1:], "Gross Profit": gross_profit[1:],
            "Fixed Operating Expenses": fixed_opex_list[1:], "Depreciation": depreciation[1:], "EBIT": ebit[1:], 
            "Interest Expense": interest_expense[1:], "EBT": ebt[1:], "Taxes": taxes[1:], "Net Income": net_income[1:],
        },
       "excel_bs": {
            "Cash": cash_closing, "Accounts Receivable": ar_closing, "Inventory": inventory_closing, 
            "Net PP&E": ppe_closing, "Total Assets": total_assets,
            "Accounts Payable": ap_closing, "Debt": debt_closing,
            "Retained Earnings": retained_earnings, "Total Liabilities & Equity": total_liabilities_equity,
        },
        "excel_cfs": cfs_data,
        "Cash Flow from Financing Forecast": cash_flow_from_financing[1:], 
        "Net Change in Cash Forecast": net_change_in_cash[1:], 
    }
    
    return results
