import pandas as pd
import numpy as np

DAYS = 365 

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
    breakdown_months=0 
):
    """Calculates the integrated financial forecast with optional monthly breakdown."""

    # 1. Determine Timeline and Labels
    # If breakdown_months > 0, we replace the first few years with months.
    # Example: Years=3, Breakdown=12. 
    # Steps: M1...M12 (Year 1), Year 2, Year 3.
    
    # Calculate how many full years are "consumed" by the monthly breakdown
    years_in_breakdown = 0
    if breakdown_months > 0:
        years_in_breakdown = (breakdown_months // 12)
        if breakdown_months % 12 != 0:
            years_in_breakdown += 1 # Handle partial years if needed, though UI sends 12/24/36
            
    remaining_years = years - years_in_breakdown
    
    # Generate Labels
    labels = []
    if breakdown_months > 0:
        for m in range(1, breakdown_months + 1):
            labels.append(f"M{m}")
    
    start_year_idx = years_in_breakdown + 1
    for y in range(start_year_idx, years + 1):
        labels.append(f"Year {y}")
        
    total_steps = len(labels)
    size = total_steps + 1 # +1 for Initial (Year 0)

    # 2. Initialize Arrays
    revenue = [0.0] * size
    cogs = [0.0] * size
    gross_profit = [0.0] * size
    fixed_opex_list = [0.0] * size 
    depreciation = [0.0] * size
    ebit = [0.0] * size
    interest_expense = [0.0] * size
    ebt = [0.0] * size
    taxes = [0.0] * size
    net_income = [0.0] * size

    ar_closing = [0.0] * size
    inventory_closing = [0.0] * size
    ppe_closing = [0.0] * size
    ap_closing = [0.0] * size
    debt_closing = [0.0] * size
    retained_earnings = [0.0] * size
    cash_closing = [0.0] * size
    total_assets = [0.0] * size
    total_liabilities_equity = [0.0] * size
    
    nwc_closing = [0.0] * size
    change_in_nwc = [0.0] * size
    cash_flow_from_financing = [0.0] * size
    net_change_in_cash = [0.0] * size
    
    # Lists for export to match length
    export_capex = [0.0] * size

    # 3. Set Year 0 Balances
    revenue[0] = initial_revenue
    ppe_closing[0] = initial_ppe
    debt_closing[0] = initial_debt
    cash_closing[0] = initial_cash
    
    # Initial NWC Calc
    # Use Year 1 assumptions (index 0) for Year 0 NWC baseline
    init_cogs = initial_revenue * cogs_pct_rates[0]
    ar_closing[0] = initial_revenue * (dso_days_list[0] / DAYS)
    inventory_closing[0] = init_cogs * (dio_days_list[0] / DAYS)
    ap_closing[0] = init_cogs * (dpo_days_list[0] / DAYS)
    nwc_closing[0] = ar_closing[0] + inventory_closing[0] - ap_closing[0]
    
    retained_earnings[0] = (cash_closing[0] + ar_closing[0] + inventory_closing[0] + ppe_closing[0]) - \
                           (ap_closing[0] + debt_closing[0])
                           
    total_assets[0] = cash_closing[0] + ar_closing[0] + inventory_closing[0] + ppe_closing[0]
    total_liabilities_equity[0] = ap_closing[0] + debt_closing[0] + retained_earnings[0]

    # 4. Main Forecast Loop
    for i in range(1, size):
        # Determine if current step is a Month or a Year
        is_month = i <= breakdown_months
        
        # Determine which "Annual Assumption Year" corresponds to this step
        if is_month:
            # i=1..12 -> Year 1 (idx 0), i=13..24 -> Year 2 (idx 1)
            assumption_year_idx = (i - 1) // 12
        else:
            # If we passed the breakdown months, map to remaining years
            # Logic: We consumed `years_in_breakdown` years. 
            # The current loop index i represents a step.
            # We need to map this back to the user's input lists.
            years_passed = years_in_breakdown + (i - breakdown_months - 1)
            assumption_year_idx = years_passed

        # Safety check for index
        idx = min(assumption_year_idx, len(revenue_growth_rates) - 1)
        
        # Time Factor (1/12 for months, 1.0 for years)
        tf = (1/12) if is_month else 1.0
        
        # --- INCOME STATEMENT ---
        
        # Revenue Growth
        # If month: we need a monthly growth rate that compounds to the annual rate, 
        # OR simply apply growth over previous month. 
        # Simplified approach: Distribute the Annual Revenue Target? 
        # Better approach for forecasting:
        # If it's a month, we calculate the revenue based on the annualized run rate or simple growth.
        # Let's use simple compounding: Monthly Rate = (1 + Annual_Rate)^(1/12) - 1
        
        annual_growth = revenue_growth_rates[idx]
        
        if is_month:
            # To smooth seasonality, we can assume even distribution of the *Annualized* revenue for that year,
            # but that's complex because we are building sequentially.
            # Let's apply monthly growth relative to prev month.
            # Rate per step
            step_growth = (1 + annual_growth)**tf - 1
            revenue[i] = revenue[i-1] * (1 + step_growth)
        else:
            # It's a full year step.
            # If the previous step was a Month (e.g., M12), revenue[i-1] is Monthly Revenue.
            # We need to be careful. If switching from Monthly to Annual, we need to compare Annual to Annual.
            
            # If previous step was month, revenue[i-1] is small. 
            # We need to extrapolate the "Run Rate" or just calculate based on previous *Year's* total.
            # SIMPLIFICATION: If switching context, calculate based on projected year logic.
            # But simplest math: Revenue[i] = Revenue[Year_Prior] * (1+Growth).
            
            # Since our lists are sequential, let's keep it simple: 
            # If i is the first Year step after months, calculate based on the Sum of previous 12 months?
            # Or just assume the standard growth curve holds.
            
            # Let's use the assumption that `revenue[i-1]` represents the revenue of the *previous period*.
            # If prev period was Month, and now is Year, we have a scale issue.
            
            # FIX: Maintain an "Annualized Run Rate".
            if i == breakdown_months + 1 and breakdown_months > 0:
                # Transition Step (M12 -> Year 2)
                # Calculate Year 1 Total
                y1_total = sum(revenue[1:breakdown_months+1])
                revenue[i] = y1_total * (1 + annual_growth)
            else:
                revenue[i] = revenue[i-1] * (1 + annual_growth)

        # COGS
        cogs[i] = revenue[i] * cogs_pct_rates[idx]
        gross_profit[i] = revenue[i] - cogs[i]
        
        # Fixed Opex (Absolute Amount inputs are usually Annual)
        # So we scale them down for months
        fixed_opex_list[i] = fixed_opex_rates[idx] * tf
        
        # Depreciation
        # Rate is annual. 
        depreciation[i] = ppe_closing[i-1] * (depreciation_rate * tf)
        
        ebit[i] = gross_profit[i] - fixed_opex_list[i] - depreciation[i]
        
        # Interest
        interest_expense[i] = debt_closing[i-1] * (interest_rate * tf)
        
        ebt[i] = ebit[i] - interest_expense[i]
        taxes[i] = max(0, ebt[i]) * tax_rate
        net_income[i] = ebt[i] - taxes[i]
        
        # --- BALANCE SHEET ---
        
        # AR / Inventory / AP are based on Balance at specific point in time
        # The formulas (Revenue * Days / 365) yield the *Balance* needed.
        # However, for a monthly view, Revenue * (DSO/365) might be too low if Revenue is monthly.
        # Standard Formula: AR = (Annualized Revenue / 365) * DSO
        # If Revenue[i] is monthly, Annualized = Revenue[i] * 12
        # If Revenue[i] is yearly, Annualized = Revenue[i]
        
        annualized_rev = revenue[i] * (12 if is_month else 1)
        annualized_cogs = cogs[i] * (12 if is_month else 1)
        
        ar_closing[i] = annualized_rev * (dso_days_list[idx] / DAYS)
        inventory_closing[i] = annualized_cogs * (dio_days_list[idx] / DAYS)
        ap_closing[i] = annualized_cogs * (dpo_days_list[idx] / DAYS)
        
        nwc_closing[i] = ar_closing[i] + inventory_closing[i] - ap_closing[i]
        change_in_nwc[i] = nwc_closing[i] - nwc_closing[i-1]
        
        # PP&E
        # Capex Input is Annual Amount. Scale for months.
        step_capex = capex_rates[idx] * tf
        export_capex[i] = step_capex
        ppe_closing[i] = ppe_closing[i-1] + step_capex - depreciation[i]
        
        # Debt
        # Repayment is Annual Amount. Scale for months.
        step_repayment = min(annual_debt_repayment_list[idx] * tf, debt_closing[i-1])
        debt_closing[i] = debt_closing[i-1] - step_repayment
        
        retained_earnings[i] = retained_earnings[i-1] + net_income[i]
        
        # --- CASH FLOW ---
        cash_flow_from_financing[i] = -step_repayment
        
        cfo = net_income[i] + depreciation[i] - change_in_nwc[i]
        cfi = -step_capex
        
        net_change_in_cash[i] = cfo + cfi + cash_flow_from_financing[i]
        cash_closing[i] = cash_closing[i-1] + net_change_in_cash[i]
        
        # Totals
        total_assets[i] = cash_closing[i] + ar_closing[i] + inventory_closing[i] + ppe_closing[i]
        total_liabilities_equity[i] = ap_closing[i] + debt_closing[i] + retained_earnings[i]

    # 5. Prepare Output
    
    # Slicing [1:] to remove Year 0 from Flow statements (IS/CFS)
    # Balance Sheet keeps Year 0
    
    # Export dictionaries
    excel_is = {
        "Revenue": revenue[1:], "COGS": cogs[1:], "Gross Profit": gross_profit[1:],
        "Fixed Operating Expenses": fixed_opex_list[1:], "Depreciation": depreciation[1:], "EBIT": ebit[1:], 
        "Interest Expense": interest_expense[1:], "EBT": ebt[1:], "Taxes": taxes[1:], "Net Income": net_income[1:],
    }
    
    excel_bs = {
        "Cash": cash_closing, "Accounts Receivable": ar_closing, "Inventory": inventory_closing, 
        "Net PP&E": ppe_closing, "Total Assets": total_assets,
        "Accounts Payable": ap_closing, "Debt": debt_closing,
        "Retained Earnings": retained_earnings, "Total Liabilities & Equity": total_liabilities_equity,
    }
    
    excel_cfs = {
        "Net Income": net_income[1:], "Add: Depreciation": depreciation[1:],
        "Less: Change in NWC": [-x for x in change_in_nwc[1:]], 
        "Cash Flow from Operations": [net_income[i] + depreciation[i] - change_in_nwc[i] for i in range(1, size)],
        "Cash Flow from Investing (CapEx)": [-x for x in export_capex[1:]], 
        "Cash Flow from Financing": cash_flow_from_financing[1:],
        "Net Change in Cash": net_change_in_cash[1:],
    }

    results = {
        "Labels": labels, # List of "M1", "M2", ... "Year 2"
        "Full_Labels": ["Initial"] + labels,
        # Raw Lists
        "Revenue": revenue, "COGS": cogs, "Gross Profit": gross_profit, "Fixed Opex": fixed_opex_list, 
        "Depreciation": depreciation, "EBIT": ebit, "Interest Expense": interest_expense,
        "EBT": ebt, "Taxes": taxes, "Net Income": net_income,
        "Closing Cash": cash_closing, "Closing AR": ar_closing, "Closing Inventory": inventory_closing,
        "Closing PP&E": ppe_closing, "Closing AP": ap_closing,
        "Closing Debt": debt_closing, "Closing RE": retained_earnings,
        "Change in NWC": change_in_nwc,
        "excel_is": excel_is,
        "excel_bs": excel_bs,
        "excel_cfs": excel_cfs,
        
        # Specific keys used by JS rendering
        "Cash Flow from Financing Forecast": cash_flow_from_financing[1:], 
        "Net Change in Cash Forecast": net_change_in_cash[1:], 
        "CapEx Forecast": export_capex[1:]
    }
    
    return results
