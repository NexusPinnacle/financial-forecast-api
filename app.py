from flask import Flask, request, jsonify, render_template, send_file
import pandas as pd
from io import BytesIO
from forecaster import generate_forecast
from flask_cors import CORS

app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='/')
CORS(app)

@app.route('/')
def home():
    return render_template('index.html')    

def get_inputs_from_request(data):
    def get_list_float(key, default_val=0.0):
        val = data.get(key, [])
        if not val:
            years = int(data.get('years', 5))
            return [default_val] * years
        if isinstance(val, str): val = [val]
        return [float(x) for x in val if x is not None]

    return {
        "initial_revenue": float(data.get('initial_revenue') or 0.0),
        "revenue_growth_rates": get_list_float('revenue_growth_rates'),
        "tax_rate": float(data.get('tax_rate') or 0.0),
        "initial_ppe": float(data.get('initial_ppe') or 0.0),
        "depreciation_rate": float(data.get('depreciation_rate') or 0.0),
        "initial_debt": float(data.get('initial_debt') or 0.0),
        "initial_cash": float(data.get('initial_cash') or 0.0),
        "interest_rate": float(data.get('interest_rate') or 0.0),
        "years": int(data.get('years', 5)),
        "monthly_detail": int(data.get('monthly_detail', 0)),
        "cogs_pct_rates": get_list_float('cogs_pct_rates'),
        "fixed_opex_rates": get_list_float('fixed_opex_rates'),
        "capex_rates": get_list_float('capex_rates'),
        "dso_days_list": get_list_float('dso_days_list'),
        "dio_days_list": get_list_float('dio_days_list'),
        "dpo_days_list": get_list_float('dpo_days_list'),
        "annual_debt_repayment_list": get_list_float('annual_debt_repayment_list'),
        "revenue_streams": data.get('revenue_streams', []),
        "cogs_streams": data.get('cogs_streams', []),
        "opex_streams": data.get('opex_streams', []) # Task 2
    }

@app.route('/api/forecast', methods=['POST'])
def forecast():
    try:
        inputs = get_inputs_from_request(request.json)
        results = generate_forecast(**inputs)
        return jsonify(results)
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400

@app.route('/api/export', methods=['POST'])
def export_excel():
    try:
        inputs = get_inputs_from_request(request.json)
        results = generate_forecast(**inputs)
        
        d = results['display_data']
        labels_is = results['Display_Labels']
        labels_all = labels_is
        
        output = BytesIO()
        writer = pd.ExcelWriter(output, engine='xlsxwriter')

        # Build Income Statement DataFrame
        # 1. Start with Total Revenue
        is_rows = {"Total Revenue": d["Revenue"]}
        
        # 2. Add individual revenue streams if they exist
        for stream in d.get("Stream_Rows", []):
            if stream['type'] == 'Revenue':
                is_rows[f"  {stream['name']}"] = stream['values']
        
        # 3. Add individual COGS streams (Task 1 Fix)
        for stream in d.get("Stream_Rows", []):
            if stream['type'] == 'COGS':
                is_rows[f"  {stream['name']}"] = stream['values']
                
        is_rows["Total COGS"] = d["COGS"]
        is_rows["Gross Profit"] = d["Gross Profit"]

        # 4. Add individual OpEx streams (Task 2)
        for stream in d.get("Stream_Rows", []):
            if stream['type'] == 'OpEx':
                is_rows[f"  {stream['name']}"] = stream['values']

        is_rows["Total Operating Expenses"] = d["Fixed Opex"]
        is_rows["Depreciation"] = d["Depreciation"]
        is_rows["EBIT"] = d["EBIT"]
        is_rows["Interest"] = d["Interest"]
        is_rows["Taxes"] = d["Taxes"]
        is_rows["Net Income"] = d["Net Income"]

        df_is = pd.DataFrame(is_rows, index=labels_is).T
        df_is.to_excel(writer, sheet_name='Income Statement')
        
        # Balance Sheet
        bs_map = {k: d[k] for k in ["Cash", "AR", "Inventory", "PPE", "Total Assets", "AP", "Debt", "RE", "Total LiabEq"]}
        pd.DataFrame(bs_map, index=labels_all).T.to_excel(writer, sheet_name='Balance Sheet')
        
        # Cash Flow
        cf_map = { 
            "Net Income": d["CF_NI"], 
            "Depreciation": d["CF_Dep"], 
            "NWC Change": d["CF_NWC"], 
            "CFO": d["CFO"], 
            "CFI": d["CFI"], 
            "CFF": d["CFF"], 
            "Net Change": d["Net Cash Change"]
        }
        pd.DataFrame(cf_map, index=labels_is).T.to_excel(writer, sheet_name='Cash Flow')
        
        writer.close()
        output.seek(0)
        return send_file(output, 
                         download_name="financial_forecast.xlsx", 
                         as_attachment=True,
                         mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5001)
