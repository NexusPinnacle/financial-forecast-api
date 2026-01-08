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
            # If the frontend sent nothing, create a list of zeros 
            # based on the number of years requested
            years = int(data.get('years', 5))
            return [default_val] * years
        if isinstance(val, str): val = [val]
        return [float(x) for x in val if x is not None]

    # This ensures that even if 'initial_revenue' is missing, it becomes 0.0
    return {
        "initial_revenue": float(data.get('initial_revenue') or 0.0),
        "revenue_growth_rates": get_list_float('revenue_growth_rates'), # Safe default
        "tax_rate": float(data.get('tax_rate') or 0.0),
        "initial_ppe": float(data.get('initial_ppe') or 0.0),
        "depreciation_rate": float(data.get('depreciation_rate') or 0.0),
        "initial_debt": float(data.get('initial_debt') or 0.0),
        "initial_cash": float(data.get('initial_cash') or 0.0),
        "interest_rate": float(data.get('interest_rate') or 0.0),
        "years": int(data.get('years', 5)),
        "monthly_detail": int(data.get('monthly_detail', 0)),
        "revenue_streams": data.get('revenue_streams', []),
        
        "cogs_streams": data.get('cogs_streams', []), # ADD THIS LINE

        "opex_streams": data.get('opex_streams', []), # ADD THIS LINE
        
        "cogs_pct_rates": get_list_float('cogs_pct_rates', 0.4), # Default 40% if missing
        "fixed_opex_rates": data.get('fixed_opex_rates') if not data.get('opex_streams') else None,
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
        
        d = results['display_data']
        
        # Build Income Statement Dict
        # Add granular streams first
        is_map = {}
        if d.get("Stream_Rows"):
            for s in d["Stream_Rows"]:
                is_map[s['name']] = s['values']
                
        # Add standard IS lines
        is_map.update({
            "Total Revenue": d["Revenue"],
            "COGS": d["COGS"],
            "Gross Profit": d["Gross Profit"],
            "Fixed Opex": d["Fixed Opex"],
            "Depreciation": d["Depreciation"],
            "EBIT": d["EBIT"],
            "Interest": d["Interest"],
            "Taxes": d["Taxes"],
            "Net Income": d["Net Income"]
        })
        
        bs_map = {k: d[k] for k in ["Cash", "AR", "Inventory", "PPE", "Total Assets", "AP", "Debt", "RE", "Total LiabEq"]}
        cf_map = { 
            "Net Income": d["CF_NI"], 
            "Depreciation": d["CF_Dep"], 
            "NWC Change": d["CF_NWC"], 
            "CFO": d["CFO"], 
            "CFI": d["CFI"] if len(d["CFI"]) == len(labels_is) else d["CFI"][1:], 
            "CFF": d["CFF"], 
            "Net Change": d["Net Cash Change"]
        }

        pd.DataFrame(is_map, index=labels_is).T.to_excel(writer, sheet_name='Income Statement')
        pd.DataFrame(bs_map, index=labels_all).T.to_excel(writer, sheet_name='Balance Sheet')
        pd.DataFrame(cf_map, index=labels_is).T.to_excel(writer, sheet_name='Cash Flow')
        
        writer.close()
        output.seek(0)
        return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', as_attachment=True, download_name='Forecast.xlsx')
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
