import pandas as pd
import numpy as np

DAYS = 365 # Constant for converting days to percentage of a year

def generate_forecast(
    initial_revenue,
    revenue_growth_rates,
    cogs_pcts,          # CHANGED: Now a list
    fixed_opex_list,    # CHANGED: Now a list
    tax_rate,
    initial_ppe,
    capex,
    depreciation_rate,
    dso_days,           
    dio_days,           
    dpo_days,           
    initial_debt,       
    initial_cash,       
    interest_rate,
    annual_debt_repayment,
    years=3
):
    """Calculates the integrated financial forecast using year-specific assumptions."""

    # Initialize lists
    revenue = [0.0] * (years + 1)
    cogs = [0.0] * (years + 1)
    gross_profit = [0.0] * (years + 1)
    depreciation = [0.0] * (years + 1)
    ebit = [0.0] * (years + 1)
    interest_expense = [0.0] * (years + 1)
    ebt = [0.0] * (years + 1)
    taxes = [0.0] * (years + 1)
    net_income = [0.0] * (years + 1)
    ar_closing = [0.0] * (years + 1)
    inventory_closing = [0.0] * (years + 1)
    ppe_closing = [0.0] * (years + 1)
    ap_closing = [0.0] * (years + 1)
    debt_closing = [0.0] * (years + 1)
    retained_earnings = [0.0] * (years + 1)
    cash_closing = [0.0] * (years + 1)
    change_in_nwc = [0.0] * (years + 1)
    net_change_in_cash = [0.0] * (years + 1)
    cash_flow_from_financing = [0.0] * (years + 1)
    
    # Year 0 Setup
    revenue[0] = initial_revenue
    ppe_closing[0] = initial_ppe
    debt_closing[0] = initial_debt
    cash_closing[0] = initial_cash
    
    # Use the first COGS percentage for Year 0 NWC calculation
    initial_cogs_pct = cogs_pcts[0] if cogs_pcts else 0
    ar_closing[0] = initial_revenue * (dso_days / DAYS)
    inventory_closing[0] = (initial_revenue * initial_cogs_pct) * (dio_days / DAYS)
    ap_closing[0] = (initial_revenue * initial_cogs_pct) * (dpo_days / DAYS)

    total_assets_0 = cash_closing[0] + ar_closing[0] + inventory_closing[0] + ppe_closing[0]
    total_liabilities_0 = ap_closing[0] + debt_closing[0]
    retained_earnings[0] = total_assets_0 - total_liabilities_0
    
    # Forecast loop
    for i in range(1, years + 1):
        
        # --- DYNAMIC ASSUMPTIONS ---
        # Get the assumption for the current year, or use the last available one
        growth_rate = revenue_growth_rates[min(i - 1, len(revenue_growth_rates) - 1)]
        cogs_pct = cogs_pcts[min(i - 1, len(cogs_pcts) - 1)]
        fixed_opex = fixed_opex_list[min(i - 1, len(fixed_opex_list) - 1)]

        # --- INCOME STATEMENT ---
        revenue[i] = revenue[i-1] * (1 + growth_rate)
        cogs[i] = revenue[i] * cogs_pct
        gross_profit[i] = revenue[i] - cogs[i] 
        interest_expense[i] = debt_closing[i-1] * interest_rate
        opening_ppe = ppe_closing[i-1]
        depreciation[i] = opening_ppe * depreciation_rate
        ebit[i] = gross_profit[i] - fixed_opex - depreciation[i] 
        ebt[i] = ebit[i] - interest_expense[i] 
        taxes[i] = max(0, ebt[i]) * tax_rate 
        net_income[i] = ebt[i] - taxes[i]
        
        # --- BALANCE SHEET & CASH FLOW ---
        ar_closing[i] = revenue[i] * (dso_days / DAYS)
        inventory_closing[i] = cogs[i] * (dio_days / DAYS)
        ap_closing[i] = cogs[i] * (dpo_days / DAYS)
        
        change_in_nwc[i] = (ar_closing[i] - ar_closing[i-1]) + \
                           (inventory_closing[i] - inventory_closing[i-1]) - \
                           (ap_closing[i] - ap_closing[i-1])
        
        ppe_closing[i] = opening_ppe + capex - depreciation[i]
        debt_closing[i] = max(0, debt_closing[i-1] - annual_debt_repayment)
        retained_earnings[i] = retained_earnings[i-1] + net_income[i]
        
        cfo = net_income[i] + depreciation[i] - change_in_nwc[i]
        cfi = -capex
        cff = -min(debt_closing[i-1], annual_debt_repayment)
        cash_flow_from_financing[i] = cff
        net_change_in_cash[i] = cfo + cfi + cff
        cash_closing[i] = cash_closing[i-1] + net_change_in_cash[i]

    # Format Output
    is_data = {"Revenue": revenue[1:], "COGS": cogs[1:], "Gross Profit": gross_profit[1:],
               "Fixed Operating Expenses": fixed_opex_list, "Depreciation": depreciation[1:],
               "EBIT": ebit[1:], "Interest Expense": interest_expense[1:], "EBT": ebt[1:],
               "Taxes": taxes[1:], "Net Income": net_income[1:]}

    bs_data = {"Cash": cash_closing, "Accounts Receivable": ar_closing, "Inventory": inventory_closing,
               "Net PP&E": ppe_closing, "Accounts Payable": ap_closing, "Debt": debt_closing,
               "Retained Earnings": retained_earnings}
    
    cfs_data = {"Net Income": net_income[1:], "Add: Depreciation": depreciation[1:],
                "Less: Change in NWC": [-x for x in change_in_nwc[1:]], 
                "Cash Flow from Operations": [net_income[i] + depreciation[i] - change_in_nwc[i] for i in range(1, years + 1)],
                "Cash Flow from Investing (CapEx)": [-capex] * years,
                "Cash Flow from Financing": cash_flow_from_financing[1:],
                "Net Change in Cash": net_change_in_cash[1:]}
    
    results = {
        "Years": list(range(years + 1)), "Revenue": revenue, "COGS": cogs, "Gross Profit": gross_profit, 
        "Fixed Opex": [0] + fixed_opex_list, "Depreciation": depreciation, "EBIT": ebit, 
        "Interest Expense": interest_expense, "EBT": ebt, "Taxes": taxes, "Net Income": net_income,
        "Closing Cash": cash_closing, "Closing AR": ar_closing, "Closing Inventory": inventory_closing,
        "Closing PP&E": ppe_closing, "Closing AP": ap_closing, "Closing Debt": debt_closing,
        "Closing RE": retained_earnings, "Change in NWC": change_in_nwc, 
        "Cash Flow from Financing": cash_flow_from_financing, "Net Change in Cash": net_change_in_cash,
        "excel_is": is_data, "excel_bs": bs_data, "excel_cfs": cfs_data}

    return results

