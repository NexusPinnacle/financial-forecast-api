# app.py

# --- IMPORTS ---
# Add send_file for sending files and io for in-memory operations
from flask import Flask, request, jsonify, send_file
import io
import pandas as pd
# --- END IMPORTS ---

from forecaster import generate_forecast
from flask_cors import CORS

app = Flask(__name__)
CORS(app) 

@app.route('/')
def home():
    return "Financial Forecast API is running!"

@app.route('/api/forecast', methods=['POST'])
def forecast():
    # ... (this function remains exactly the same) ...
    data = request.json
    
    try:
        inputs = {
            "initial_revenue": float(data.get('initial_revenue')),
            "revenue_growth": float(data.get('revenue_growth')),
            "cogs_pct": float(data.get('cogs_pct')),
            "fixed_opex": float(data.get('fixed_opex')),
            "tax_rate": float(data.get('tax_rate')),
            "initial_ppe": float(data.get('initial_ppe')),
            "capex": float(data.get('capex')),
            "depreciation_rate": float(data.get('depreciation_rate')),
            "dso_days": float(data.get('dso_days')), 
            "dio_days": float(data.get('dio_days')), 
            "dpo_days": float(data.get('dpo_days')), 
            "initial_debt": float(data.get('initial_debt')), 
            "initial_cash": float(data.get('initial_cash')),
            "annual_debt_repayment": float(data.get('annual_debt_repayment')),
            "interest_rate": float(data.get('interest_rate'))
        }
    except ValueError:
        return jsonify({"error": "Invalid number format received."}), 400

    forecast_results = generate_forecast(**inputs)
    
    return jsonify(forecast_results)


# --- NEW EXPORT ENDPOINT ---
@app.route('/api/export', methods=['POST'])
def export_forecast():
    # 1. Get user data from the request (same as the forecast endpoint)
    data = request.json
    try:
        inputs = {
            "initial_revenue": float(data.get('initial_revenue')),
            "revenue_growth": float(data.get('revenue_growth')),
            "cogs_pct": float(data.get('cogs_pct')),
            "fixed_opex": float(data.get('fixed_opex')),
            "tax_rate": float(data.get('tax_rate')),
            "initial_ppe": float(data.get('initial_ppe')),
            "capex": float(data.get('capex')),
            "depreciation_rate": float(data.get('depreciation_rate')),
            "dso_days": float(data.get('dso_days')),
            "dio_days": float(data.get('dio_days')),
            "dpo_days": float(data.get('dpo_days')),
            "initial_debt": float(data.get('initial_debt')),
            "initial_cash": float(data.get('initial_cash')),
            "annual_debt_repayment": float(data.get('annual_debt_repayment')),
            "interest_rate": float(data.get('interest_rate'))
        }
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid number format received."}), 400

    # 2. Run the forecast logic to get the data
    results = generate_forecast(**inputs)

    # 3. Create an in-memory Excel file
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # --- Income Statement Sheet ---
        is_df = pd.DataFrame({
            'Line Item': ["Revenue", "Cost of Goods Sold", "Gross Profit", "Fixed Operating Expenses", "Depreciation", "EBIT", "Interest Expense", "EBT", "Taxes", "Net Income"],
            'Year 1': [results[key][1] for key in ["Revenue", "COGS", "Gross Profit", "Fixed Opex", "Depreciation", "EBIT", "Interest Expense", "EBT", "Taxes", "Net Income"]],
            'Year 2': [results[key][2] for key in ["Revenue", "COGS", "Gross Profit", "Fixed Opex", "Depreciation", "EBIT", "Interest Expense", "EBT", "Taxes", "Net Income"]],
            'Year 3': [results[key][3] for key in ["Revenue", "COGS", "Gross Profit", "Fixed Opex", "Depreciation", "EBIT", "Interest Expense", "EBT", "Taxes", "Net Income"]]
        }).set_index('Line Item')
        is_df.to_excel(writer, sheet_name='Income Statement')

        # --- Balance Sheet Sheet ---
        bs_df = pd.DataFrame({
            'Line Item': ["Cash", "Accounts Receivable", "Inventory", "Net PP&E", "Accounts Payable", "Debt", "Retained Earnings"],
            'Year 0': [results[key][0] for key in ["Closing Cash", "Closing AR", "Closing Inventory", "Closing PP&E", "Closing AP", "Closing Debt", "Closing RE"]],
            'Year 1': [results[key][1] for key in ["Closing Cash", "Closing AR", "Closing Inventory", "Closing PP&E", "Closing AP", "Closing Debt", "Closing RE"]],
            'Year 2': [results[key][2] for key in ["Closing Cash", "Closing AR", "Closing Inventory", "Closing PP&E", "Closing AP", "Closing Debt", "Closing RE"]],
            'Year 3': [results[key][3] for key in ["Closing Cash", "Closing AR", "Closing Inventory", "Closing PP&E", "Closing AP", "Closing Debt", "Closing RE"]]
        }).set_index('Line Item')
        bs_df.to_excel(writer, sheet_name='Balance Sheet')
        
        # --- Cash Flow Statement Sheet ---
        cfs_df = pd.DataFrame({
            'Line Item': ["Net Income", "Add: Depreciation", "Less: Change in NWC", "Cash Flow from Investing (CapEx)", "Net Change in Cash"],
            'Year 1': [results["Net Income"][1], results["Depreciation"][1], -results["Change in NWC"][1], -inputs['capex'], results["Net Change in Cash"][1]],
            'Year 2': [results["Net Income"][2], results["Depreciation"][2], -results["Change in NWC"][2], -inputs['capex'], results["Net Change in Cash"][2]],
            'Year 3': [results["Net Income"][3], results["Depreciation"][3], -results["Change in NWC"][3], -inputs['capex'], results["Net Change in Cash"][3]]
        }).set_index('Line Item')
        cfs_df.to_excel(writer, sheet_name='Cash Flow Statement')

    output.seek(0) # Go back to the beginning of the in-memory file

    # 4. Send the file back to the user for download
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name='financial_forecast.xlsx'
    )


if __name__ == '__main__':
    app.run(debug=True, port=5000)
