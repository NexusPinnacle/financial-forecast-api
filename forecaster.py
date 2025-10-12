import pandas as pd
import numpy as np

DAYS = 365 # Constant for converting days to percentage of a year

def generate_forecast(
    initial_revenue,
    revenue_growth_rates, 
    cogs_pct_rates,
    # NEW: Granular assumption lists
    fixed_opex_rates,       # New list for Fixed Opex
    tax_rate,
    initial_ppe,
    capex_rates,            # New list for CapEx
    depreciation_rate,
    dso_days_list,          # New list for DSO
    dio_days_list,          # New list for DIO
    dpo_days_list,          # New list for DPO
    initial_debt,       
    initial_cash,       
    interest_rate,
    annual_debt_repayment_list, # New list for Debt Repayment
    years=3
):
    """Calculates the integrated financial forecast using year-specific growth rates."""
    
    # Helper to get the correct rate/value for the current year, defaulting to the last one provided
    def get_rate(rate_list, year_index, default_val=0):
        if not rate_list:
            return default_val
        index = min(year_index - 1, len(rate_list) - 1)
        return rate_list[index]

    # 1. Initialize ALL lists (years + 1 to include Year 0)
    revenue = [0.0] * (years + 1)
    cogs = [0.0] * (years + 1)
    
    # Income Statement Lists
    gross_profit = [0.0] * (years + 1)
    depreciation = [0.0] * (years + 1)
    ebit = [0.0] * (years + 1)
    interest_expense = [0.0] * (years + 1)
    ebt = [0.0] * (years + 1)
    taxes = [0.0] * (years + 1)
    net_income = [0.0] * (years + 1)

    # Balance Sheet Lists
    ar_closing = [0.0] * (years + 1)
    inventory_closing = [0.0] * (years + 1)
    ppe_closing = [0.0] * (years + 1)
    ap_closing = [0.0] * (years + 1)
    debt_closing = [0.0] * (years + 1)
    retained_earnings = [0.0] * (years + 1)
    cash_closing = [0.0] * (years + 1)

    # Cash Flow Statement Components
    change_in_nwc = [0.0] * (years + 1)
    net_change_in_cash = [0.0] * (years + 1)
    cash_flow_from_financing = [0.0] * (years + 1)
    
    # Fixed Opex List (Needed for JS display)
    # NEW: Prepare the full list of fixed opex for output
    fixed_opex_full_list = [0.0] * (years + 1)

    # Set Year 0 (Base Case)
    revenue[0] = initial_revenue
    ppe_closing[0] = initial_ppe
    debt_closing[0] = initial_debt
    cash_closing[0] = initial_cash
    
    # Calculate Year 0 NWC Accounts (Uses the Year 1 rates/days)
    current_dso_days = get_rate(dso_days_list, 1) # Use Year 1 rates for Year 0 calculation
    current_dio_days = get_rate(dio_days_list, 1)
    current_dpo_days = get_rate(dpo_days_list, 1)
    
    cogs_0 = initial_revenue * cogs_pct_rates[0]
    ar_closing[0] = initial_revenue * (current_dso_days / DAYS)
    inventory_closing[0] = cogs_0 * (current_dio_days / DAYS)
    ap_closing[0] = cogs_0 * (current_dpo_days / DAYS)

    # Calculate Retained Earnings (The Year 0 Balancing Plug)
    total_assets_0 = cash_closing[0] + ar_closing[0] + inventory_closing[0] + ppe_closing[0]
    total_liabilities_0 = ap_closing[0] + debt_closing[0]
    retained_earnings[0] = total_assets_0 - total_liabilities_0
    
    # 2. Run the forecast loop for each year
    for i in range(1, years + 1):
        
        # --- GRANULAR ASSUMPTIONS FOR YEAR i ---
        current_growth_rate = get_rate(revenue_growth_rates, i)
        current_cogs_pct = get_rate(cogs_pct_rates, i)
        
        current_fixed_opex = get_rate(fixed_opex_rates, i) # NEW
        current_capex = get_rate(capex_rates, i)           # NEW
        current_dso_days = get_rate(dso_days_list, i)      # NEW
        current_dio_days = get_rate(dio_days_list, i)      # NEW
        current_dpo_days = get_rate(dpo_days_list, i)      # NEW
        current_debt_repayment = get_rate(annual_debt_repayment_list, i) # NEW
        
        fixed_opex_full_list[i] = current_fixed_opex # Store for output
        
        # --- INCOME STATEMENT ---
        revenue[i] = revenue[i-1] * (1 + current_growth_rate)
        
        cogs[i] = revenue[i] * current_cogs_pct
        gross_profit[i] = revenue[i] - cogs[i] 
        
        interest_expense[i] = debt_closing[i-1] * interest_rate

        opening_ppe = ppe_closing[i-1]
        depreciation[i] = opening_ppe * depreciation_rate
        
        ebit[i] = gross_profit[i] - current_fixed_opex - depreciation[i] # MODIFIED
        ebt[i] = ebit[i] - interest_expense[i] 
        taxes[i] = max(0, ebt[i]) * tax_rate 
        net_income[i] = ebt[i] - taxes[i]
        
        # --- BALANCE SHEET & CASH FLOW ACCOUNTS ---
        ar_opening, inventory_opening, ap_opening = ar_closing[i-1], inventory_closing[i-1], ap_closing[i-1]

        # MODIFIED: Use year-specific days
        ar_closing[i] = revenue[i] * (current_dso_days / DAYS)
        inventory_closing[i] = cogs[i] * (current_dio_days / DAYS)
        ap_closing[i] = cogs[i] * (current_dpo_days / DAYS)

        change_in_ar = ar_closing[i] - ar_opening
        change_in_inventory = inventory_closing[i] - inventory_opening
        change_in_ap = ap_closing[i] - ap_opening
        
        change_in_nwc[i] = (change_in_ar + change_in_inventory) - change_in_ap
        
        # MODIFIED: Use year-specific capex
        ppe_closing[i] = opening_ppe + current_capex - depreciation[i]
        
        # --- DEBT & RE CALCULATION ---
        # MODIFIED: Use year-specific debt repayment
        debt_closing[i] = max(0, debt_closing[i-1] - current_debt_repayment)
        retained_earnings[i] = retained_earnings[i-1] + net_income[i]
        
        # --- CASH FLOW STATEMENT (The Link) ---
        cfo = net_income[i] + depreciation[i] - change_in_nwc[i]
        cfi = -current_capex # MODIFIED
        
        current_repayment = min(debt_closing[i-1], current_debt_repayment) # MODIFIED
        cff = -current_repayment
        
        cash_flow_from_financing[i] = cff
        
        net_change_in_cash[i] = cfo + cfi + cff
        cash_closing[i] = cash_closing[i-1] + net_change_in_cash[i]

    # 3. Format Output
    is_data = {
        "Revenue": revenue[1:], "COGS": cogs[1:], "Gross Profit": gross_profit[1:],
        "Fixed Operating Expenses": fixed_opex_full_list[1:], "Depreciation": depreciation[1:], # MODIFIED
        "EBIT": ebit[1:], "Interest Expense": interest_expense[1:], "EBT": ebt[1:],
        "Taxes": taxes[1:], "Net Income": net_income[1:],
    }

    bs_data = {
        "Cash": cash_closing, "Accounts Receivable": ar_closing, "Inventory": inventory_closing,
        "Net PP&E": ppe_closing, "Accounts Payable": ap_closing, "Debt": debt_closing,
        "Retained Earnings": retained_earnings,
    }
    
    change_in_nwc_cfs = [-x for x in change_in_nwc[1:]] 
    
    # NEW: Store capex for the CFS output
    capex_cfs = [get_rate(capex_rates, i) for i in range(1, years + 1)]

    cfs_data = {
        "Net Income": net_income[1:], "Add: Depreciation": depreciation[1:],
        "Less: Change in NWC": change_in_nwc_cfs, 
        "Cash Flow from Operations": [net_income[i] + depreciation[i] - change_in_nwc[i] for i in range(1, years + 1)],
        "Cash Flow from Investing (CapEx)": [-x for x in capex_cfs], # MODIFIED
        "Cash Flow from Financing": cash_flow_from_financing[1:],
        "Net Change in Cash": net_change_in_cash[1:],
    }
    
    results = {
        "Years": list(range(years + 1)),
        "Revenue": revenue, "COGS": cogs, "Gross Profit": gross_profit, "Fixed Opex": fixed_opex_full_list, # MODIFIED
        "Depreciation": depreciation, "EBIT": ebit, "Interest Expense": interest_expense,
        "EBT": ebt, "Taxes": taxes, "Net Income": net_income,
        "Closing Cash": cash_closing, "Closing AR": ar_closing, "Closing Inventory": inventory_closing,
        "Closing PP&E": ppe_closing, "Closing AP": ap_closing, "Closing Debt": debt_closing,
        "Closing RE": retained_earnings,
        "Change in NWC": change_in_nwc, "Cash Flow from Financing": cash_flow_from_financing,
        "Net Change in Cash": net_change_in_cash,
        "excel_is": is_data, "excel_bs": bs_data, "excel_cfs": cfs_data,
    }

    return results
