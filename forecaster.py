import pandas as pd
import numpy as np

DAYS = 365 # Constant for converting days to percentage of a year

def generate_forecast(
    initial_revenue,
    revenue_growth,
    cogs_pct,
    fixed_opex,
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
    years=3
):
    """Calculates the 3-year integrated financial forecast, including Year 0."""

    # 1. Initialize ALL lists (4 years: Year 0 to Year 3)
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
    
    # Fixed Opex List (Needed for JS display)
    fixed_opex_list = [fixed_opex] * (years + 1)


    # Set Year 0 (Base Case)
    revenue[0] = initial_revenue
    ppe_closing[0] = initial_ppe
    debt_closing[0] = initial_debt
    cash_closing[0] = initial_cash
    # retained_earnings[0] will be calculated as the plug (next)
    
    # Calculate Year 0 NWC Accounts based on initial revenue/cogs and days inputs
    ar_closing[0] = initial_revenue * (dso_days / DAYS)         # Asset
    inventory_closing[0] = (initial_revenue * cogs_pct) * (dio_days / DAYS) # Asset
    ap_closing[0] = (initial_revenue * cogs_pct) * (dpo_days / DAYS)        # Liability

    # -----------------------------------------------------------
    # FIX: Calculate Retained Earnings (The Year 0 Balancing Plug)
    # Total Assets = Cash + AR + Inventory + PP&E
    total_assets_0 = cash_closing[0] + ar_closing[0] + inventory_closing[0] + ppe_closing[0]
    
    # Total Liabilities = AP + Debt
    total_liabilities_0 = ap_closing[0] + debt_closing[0]
    
    # Retained Earnings [Year 0] = Total Assets - Total Liabilities
    retained_earnings[0] = total_assets_0 - total_liabilities_0
    # -----------------------------------------------------------
    

    # 2. Run the forecast loop (Years 1, 2, 3)
    for i in range(1, years + 1):
        
        # --- INCOME STATEMENT ---
        revenue[i] = revenue[i-1] * (1 + revenue_growth)
        cogs[i] = revenue[i] * cogs_pct
        gross_profit[i] = revenue[i] - cogs[i] 
        
        interest_expense[i] = debt_closing[i-1] * interest_rate

        opening_ppe = ppe_closing[i-1]
        depreciation[i] = opening_ppe * depreciation_rate
        
        # EBIT
        ebit[i] = gross_profit[i] - fixed_opex - depreciation[i] 
        
        # EBT (Earnings Before Tax)
        ebt[i] = ebit[i] - interest_expense[i] 
        
        # Taxes
        taxes[i] = max(0, ebt[i]) * tax_rate 
        
        # Net Income
        net_income[i] = ebt[i] - taxes[i]
        
        # --- BALANCE SHEET & CASH FLOW ACCOUNTS ---
        ar_opening = ar_closing[i-1]
        inventory_opening = inventory_closing[i-1]
        ap_opening = ap_closing[i-1]

        ar_closing[i] = revenue[i] * (dso_days / DAYS)
        inventory_closing[i] = cogs[i] * (dio_days / DAYS)
        ap_closing[i] = cogs[i] * (dpo_days / DAYS)

        change_in_ar = ar_closing[i] - ar_opening
        change_in_inventory = inventory_closing[i] - inventory_opening
        change_in_ap = ap_closing[i] - ap_opening
        
        change_in_nwc[i] = (change_in_ar + change_in_inventory) - change_in_ap
        
        ppe_closing[i] = opening_ppe + capex - depreciation[i]
        
        debt_closing[i] = initial_debt # Static debt model
        
        re_opening = retained_earnings[i-1]
        retained_earnings[i] = re_opening + net_income[i]
        
        # --- CASH FLOW STATEMENT (The Link) ---
        cfo = net_income[i] + depreciation[i] - change_in_nwc[i]
        cfi = -capex
        cff = 0.0
        
        net_change_in_cash[i] = cfo + cfi + cff
        cash_closing[i] = cash_closing[i-1] + net_change_in_cash[i]


    # 3. Format Output: Slice all lists to INCLUDE Year 0 ([0:])
    results = {
        "Years": list(range(years + 1)), # [0, 1, 2, 3]
        # IS Items
        "Revenue": revenue[0:],
        "COGS": cogs[0:],
        "Gross Profit": gross_profit[0:],
        "Fixed Opex": fixed_opex_list[0:],
        "Depreciation": depreciation[0:],
        "EBIT": ebit[0:],
        "Interest Expense": interest_expense[0:],
        "EBT": ebt[0:],
        "Taxes": taxes[0:],
        "Net Income": net_income[0:],
        # BS Items
        "Closing Cash": cash_closing[0:],
        "Closing AR": ar_closing[0:],
        "Closing Inventory": inventory_closing[0:],
        "Closing PP&E": ppe_closing[0:],
        "Closing AP": ap_closing[0:],
        "Closing Debt": debt_closing[0:],
        "Closing RE": retained_earnings[0:],
        # CFS Items
        "Change in NWC": change_in_nwc[0:],
        "Net Change in Cash": net_change_in_cash[0:]
    }
    
    return results