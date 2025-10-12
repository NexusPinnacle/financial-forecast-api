import pandas as pd
import numpy as np

DAYS = 365 # Constant for converting days to percentage of a year

def generate_forecast(
    initial_revenue,
    revenue_growth_rates, 
    cogs_pct_rates, 
    fixed_opex_rates,       # CHANGED: Now a list
    tax_rate,
    initial_ppe,
    capex_rates,            # CHANGED: Now a list
    depreciation_rate,
    dso_days_list,          # CHANGED: Now a list
    dio_days_list,          # CHANGED: Now a list
    dpo_days_list,          # CHANGED: Now a list
    initial_debt,       
    initial_cash,       
    interest_rate,
    annual_debt_repayment_list, # CHANGED: Now a list
    years=3
):
    """Calculates the integrated financial forecast using year-specific growth rates."""

    # 1. Initialize ALL lists (years + 1 to include Year 0)
    revenue = [0.0] * (years + 1)
    cogs = [0.0] * (years + 1)
    
    # Income Statement Lists
    gross_profit = [0.0] * (years + 1)
    fixed_opex_list = [0.0] * (years + 1) # Must initialize list for IS
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
    
    # Cash Flow Components
    nwc_closing = [0.0] * (years + 1)
    change_in_nwc = [0.0] * (years + 1)
    cash_flow_from_financing = [0.0] * (years + 1)
    net_change_in_cash = [0.0] * (years + 1)

    # 2. Set Year 0 Balances
    revenue[0] = initial_revenue # Revenue in Year 0 is used for AR/Inventory calculation
    ppe_closing[0] = initial_ppe
    debt_closing[0] = initial_debt
    cash_closing[0] = initial_cash
    
    # Use the Year 1 list values for initial calculations (list index 0)
    initial_cogs_pct = cogs_pct_rates[0] 
    initial_cogs = initial_revenue * initial_cogs_pct 
    
    initial_dso = dso_days_list[0] 
    initial_dio = dio_days_list[0]
    initial_dpo = dpo_days_list[0] 
    
    ar_closing[0] = initial_revenue * (initial_dso / DAYS)
    inventory_closing[0] = initial_cogs * (initial_dio / DAYS)
    ap_closing[0] = initial_cogs * (initial_dpo / DAYS)
    
    nwc_closing[0] = ar_closing[0] + inventory_closing[0] - ap_closing[0]
    
    # To balance: RE = Assets - Liabilities
    retained_earnings[0] = (cash_closing[0] + ar_closing[0] + inventory_closing[0] + ppe_closing[0]) - \
                           (ap_closing[0] + debt_closing[0])
                           
    # 3. Main Forecast Loop
    for i in range(1, years + 1):
        # --- Rates for Current Year i (using 0-based list indexing) ---
        idx = i - 1
        current_rev_growth = revenue_growth_rates[idx]
        current_cogs_pct = cogs_pct_rates[idx]
        current_fixed_opex = fixed_opex_rates[idx]
        current_capex = capex_rates[idx]
        current_dso = dso_days_list[idx]
        current_dio = dio_days_list[idx]
        current_dpo = dpo_days_list[idx]
        current_debt_repayment = annual_debt_repayment_list[idx]
        
        # 4. Income Statement (IS)
        # Revenue
        revenue[i] = revenue[i-1] * (1 + current_rev_growth)
        
        # COGS
        cogs[i] = revenue[i] * current_cogs_pct
        gross_profit[i] = revenue[i] - cogs[i]
        
        # Fixed Opex
        fixed_opex_list[i] = current_fixed_opex
        
        # Depreciation (Uses *beginning* of year PP&E)
        depreciation[i] = ppe_closing[i-1] * depreciation_rate
        
        # EBIT
        ebit[i] = gross_profit[i] - fixed_opex_list[i] - depreciation[i]
        
        # Interest Expense (Uses *beginning* of year Debt)
        interest_expense[i] = debt_closing[i-1] * interest_rate
        
        # EBT & Taxes
        ebt[i] = ebit[i] - interest_expense[i]
        taxes[i] = max(0, ebt[i]) * tax_rate # Only pay taxes on positive EBT
        
        # Net Income
        net_income[i] = ebt[i] - taxes[i]
        
        # 5. Balance Sheet (BS) - Working Capital
        # Accounts Receivable (Uses Revenue)
        ar_closing[i] = revenue[i] * (current_dso / DAYS)
        
        # Inventory (Uses COGS)
        inventory_closing[i] = cogs[i] * (current_dio / DAYS)
        
        # Accounts Payable (Uses COGS)
        ap_closing[i] = cogs[i] * (current_dpo / DAYS)
        
        # Net Working Capital (NWC)
        nwc_closing[i] = ar_closing[i] + inventory_closing[i] - ap_closing[i]
        
        # Change in NWC (for CFS)
        change_in_nwc[i] = nwc_closing[i] - nwc_closing[i-1]
        
        # 6. Balance Sheet (BS) - Long-term & Equity
        
        # Net PP&E
        ppe_closing[i] = ppe_closing[i-1] + current_capex - depreciation[i]
        
        # Debt
        # Debt Repayment is subtracted from beginning debt
        debt_repaid = min(current_debt_repayment, debt_closing[i-1]) 
        debt_closing[i] = debt_closing[i-1] - debt_repaid
        
        # Retained Earnings
        retained_earnings[i] = retained_earnings[i-1] + net_income[i]
        
        # Cash Flow from Financing (for CFS)
        cash_flow_from_financing[i] = -debt_repaid
        
        # 7. Cash Flow Statement (CFS) & Cash Balancing
        
        # Cash Flow from Operations (CFO)
        cfo = net_income[i] + depreciation[i] - change_in_nwc[i]
        
        # Cash Flow from Investing (CFI)
        cfi = -current_capex
        
        # Net Change in Cash
        net_change_in_cash[i] = cfo + cfi + cash_flow_from_financing[i]
        
        # Cash (Closing)
        cash_closing[i] = cash_closing[i-1] + net_change_in_cash[i]

    # 8. Prepare Results (Using the calculated lists)
    
    change_in_nwc_cfs = [-x for x in change_in_nwc[1:]] 
    
    cfs_data = {
        "Net Income": net_income[1:], "Add: Depreciation": depreciation[1:],
        "Less: Change in NWC": change_in_nwc_cfs, 
        "Cash Flow from Operations": [net_income[i] + depreciation[i] - change_in_nwc[i] for i in range(1, years + 1)],
        "Cash Flow from Investing (CapEx)": [-x for x in capex_rates], # Corrected to use the list
        "Cash Flow from Financing": cash_flow_from_financing[1:],
        "Net Change in Cash": net_change_in_cash[1:],
    }
    
    results = {
        "Years": list(range(years + 1)),
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
            "Net PP&E": ppe_closing, "Accounts Payable": ap_closing, "Debt": debt_closing,
            "Retained Earnings": retained_earnings,
        },
        "excel_cfs": cfs_data,
        "Cash Flow from Financing": cash_flow_from_financing, 
        "Net Change in Cash": net_change_in_cash, 
    }
    
    return results
