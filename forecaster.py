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
    period_mode='annual'
):
    # Setup Periods
    if period_mode == 'monthly':
        num_periods = years  # years here is actually month count (e.g., 36)
        days_in_period = 365.0 / 12.0
        
        def expand(annual_list):
            """Repeats annual assumption for each of the 12 months in that year."""
            monthly = []
            for val in annual_list:
                monthly.extend([val] * 12)
            # Ensure we match num_periods exactly
            return monthly[:num_periods]

        # Convert Annual assumptions to Monthly
        # Growth is compounded: (1+r)^(1/12)-1
        rev_growth = [((1 + r)**(1/12) - 1) for r in expand(revenue_growth_rates)]
        cogs_pct = expand(cogs_pct_rates)
        # Amounts are divided by 12
        fixed_opex_list = [x / 12.0 for x in expand(fixed_opex_rates)]
        capex_list = [x / 12.0 for x in expand(capex_rates)]
        debt_repayment_list = [x / 12.0 for x in expand(annual_debt_repayment_list)]
        
        dep_rate_period = (depreciation_rate / 100.0) / 12.0
        int_rate_period = (interest_rate / 100.0) / 12.0
        tax_r = tax_rate / 100.0
        
        dso_list = expand(dso_days_list)
        dio_list = expand(dio_days_list)
        dpo_list = expand(dpo_days_list)
        
        labels = ["Initial"] + [f"M{i+1}" for i in range(num_periods)]
    else:
        num_periods = years
        days_in_period = 365.0
        rev_growth = revenue_growth_rates
        cogs_pct = cogs_pct_rates
        fixed_opex_list = fixed_opex_rates
        capex_list = capex_rates
        debt_repayment_list = annual_debt_repayment_list
        dep_rate_period = depreciation_rate / 100.0
        int_rate_period = interest_rate / 100.0
        tax_r = tax_rate / 100.0
        dso_list = dso_days_list
        dio_list = dio_days_list
        dpo_list = dpo_days_list
        labels = ["Initial"] + [f"Year {i+1}" for i in range(num_periods)]

    # --- Financial Logic Loop ---
    revenue = [initial_revenue]
    cogs = [0.0]
    gross_profit = [0.0]
    ebit = [0.0]
    net_income = [0.0]
    
    cash_closing = [initial_cash]
    ar_closing = [0.0] # Will calc in loop
    inventory_closing = [0.0]
    ppe_closing = [initial_ppe]
    ap_closing = [0.0]
    debt_closing = [initial_debt]
    retained_earnings = [0.0]

    # Initialize AR/Inv/AP based on initial revenue/cogs assumptions for Day 0
    ar_closing[0] = (initial_revenue / 365.0) * dso_list[0]
    # Estimate initial COGS for NWC starting point
    init_cogs = initial_revenue * cogs_pct[0]
    inventory_closing[0] = (init_cogs / 365.0) * dio_list[0]
    ap_closing[0] = (init_cogs / 365.0) * dpo_list[0]

    depreciation = [0.0]
    interest_expense = [0.0]
    taxes = [0.0]
    ebt = [0.0]

    for i in range(num_periods):
        # IS
        rev = revenue[-1] * (1 + rev_growth[i])
        revenue.append(rev)
        
        c = rev * cogs_pct[i]
        cogs.append(c)
        gross_profit.append(rev - c)
        
        op_ex = fixed_opex_list[i]
        dep = ppe_closing[-1] * dep_rate_period
        depreciation.append(dep)
        
        this_ebit = rev - c - op_ex - dep
        ebit.append(this_ebit)
        
        inte = debt_closing[-1] * int_rate_period
        interest_expense.append(inte)
        
        this_ebt = this_ebit - inte
        ebt.append(this_ebt)
        
        t = max(0, this_ebt * tax_r)
        taxes.append(t)
        
        ni = this_ebt - t
        net_income.append(ni)
        
        # BS
        new_ppe = ppe_closing[-1] + capex_list[i] - dep
        ppe_closing.append(new_ppe)
        
        new_debt = max(0, debt_closing[-1] - debt_repayment_list[i])
        debt_closing.append(new_debt)
        
        ar = (rev / days_in_period) * dso_list[i]
        ar_closing.append(ar)
        
        inv = (c / days_in_period) * dio_list[i]
        inventory_closing.append(inv)
        
        ap = (c / days_in_period) * dpo_list[i]
        ap_closing.append(ap)
        
        re = retained_earnings[-1] + ni
        retained_earnings.append(re)
        
        # Cash Flow / Plug
        assets_ex_cash = ar + inv + new_ppe
        liabs_equity = ap + new_debt + re
        cash_closing.append(liabs_equity - assets_ex_cash)

    # Calculate Cash Flow steps for the table
    cash_flow_from_ops = [0.0]
    for i in range(1, len(net_income)):
        # Simple CFO: NI + Dep - Delta AR - Delta Inv + Delta AP
        delta_ar = ar_closing[i] - ar_closing[i-1]
        delta_inv = inventory_closing[i] - inventory_closing[i-1]
        delta_ap = ap_closing[i] - ap_closing[i-1]
        cfo = net_income[i] + depreciation[i] - delta_ar - delta_inv + delta_ap
        cash_flow_from_ops.append(cfo)

    return {
        "Years": labels,
        "Revenue": revenue,
        "Net Income": net_income,
        "Closing Cash": cash_closing,
        "excel_is": {
            "Revenue": revenue, "COGS": cogs, "EBIT": ebit, "Net Income": net_income
        },
        "excel_bs": {
            "Cash": cash_closing, "AR": ar_closing, "Inventory": inventory_closing, 
            "PP&E": ppe_closing, "AP": ap_closing, "Debt": debt_closing, "RE": retained_earnings
        },
        "excel_cfs": {
            "Cash From Operations": cash_flow_from_ops,
            "CapEx": [0] + [-x for x in capex_list],
            "Debt Repayment": [0] + [-x for x in debt_repayment_list],
            "Net Change in Cash": [0] + [cash_closing[i] - cash_closing[i-1] for i in range(1, len(cash_closing))]
        }
    }
