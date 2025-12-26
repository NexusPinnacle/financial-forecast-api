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
    def get_list_float(key):
        val = data.get(key, [])
        if isinstance(val, str): val = [val]
        return [float(x) for x in val if x is not None]

    return {
        "initial_revenue": float(data.get('initial_revenue') or 0.0),
        "tax_rate": float(data.get('tax_rate') or 0.0),
        "initial_ppe": float(data.get('initial_ppe') or 0.0),
        "depreciation_rate": float(data.get('depreciation_rate') or 0.0),
        "initial_debt": float(data.get('initial_debt') or 0.0),
        "initial_cash": float(data.get('initial_cash') or 0.0),
        "interest_rate": float(data.get('interest_rate') or 0.0),
        "years": int(data.get('years', 3)),
        "monthly_detail": int(data.get('monthly_detail', 0)),
        "revenue_growth_rates": get_list_float('revenue_growth_rates'),
        "cogs_pct_rates": get_list_float('cogs_pct_rates'),
        "fixed_opex_rates": get_list_float('fixed_opex_rates'),
        "capex_rates": get_list_float('capex_rates'),
        "dso_days_list": get_list_float('dso_days_list'),
        "dio_days_list": get_list_float('dio_days_list'),
        "dpo_days_list": get_list_float('dpo_days_list'),
        "annual_debt_repayment_list": get_list_float('annual_debt_repayment_list'),
    }

@app.route('/api/forecast', methods=['POST'])
def forecast():
    try:
        inputs = get_inputs_from_request(request.json)
        return jsonify(generate_forecast(**inputs))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/export', methods=['POST'])
def export_to_excel():
    try:
        inputs = get_inputs_from_request(request.json)
        results = generate_forecast(**inputs)
        output = BytesIO()
        writer = pd.ExcelWriter(output, engine='xlsxwriter')
        
        labels_all = results['Display_Labels']
        labels_is = labels_all[1:]
        
        # Prepare DataFrames based on display_data
        d = results['display_data']
        is_map = {k: d[k] for k in ["Revenue", "COGS", "Gross Profit", "Fixed Opex", "Depreciation", "EBIT", "Interest", "Taxes", "Net Income"]}
        bs_map = {k: d[k] for k in ["Cash", "AR", "Inventory", "PPE", "Total Assets", "AP", "Debt", "RE", "Total LiabEq"]}
        cf_map = { "Net Income": d["CF_NI"], "Depreciation": d["CF_Dep"], "NWC Change": d["CF_NWC"], "CFO": d["CFO"], "CFI": d["CFI"], "CFF": d["CFF"], "Net Change": d["Net Cash Change"]}

        pd.DataFrame(is_map, index=labels_is).T.to_excel(writer, sheet_name='Income Statement')
        pd.DataFrame(bs_map, index=labels_all).T.to_excel(writer, sheet_name='Balance Sheet')
        pd.DataFrame(cf_map, index=labels_is).T.to_excel(writer, sheet_name='Cash Flow')
        
        writer.close()
        output.seek(0)
        return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', as_attachment=True, download_name='Forecast.xlsx')
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
