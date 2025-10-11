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
    """Helper function to parse and convert inputs from request data."""
    
    # Parse all year-specific inputs into lists of floats
    revenue_growth_rates = [float(r) for r in data.get('revenue_growth_rates', [])]
    cogs_pcts = [float(c) for c in data.get('cogs_pcts', [])]
    fixed_opex_list = [float(o) for o in data.get('fixed_opex_list', [])]

    inputs = {
        "initial_revenue": float(data.get('initial_revenue')),
        "revenue_growth_rates": revenue_growth_rates,
        "cogs_pcts": cogs_pcts, # MODIFIED
        "fixed_opex_list": fixed_opex_list, # MODIFIED
        "tax_rate": float(data.get('tax_rate')),
        "initial_ppe": float(data.get('initial_ppe')),
        "capex": float(data.get('capex')),
        "depreciation_rate": float(data.get('depreciation_rate')),
        "dso_days": float(data.get('dso_days')), 
        "dio_days": float(data.get('dio_days')), 
        "dpo_days": float(data.get('dpo_days')), 
        "initial_debt": float(data.get('initial_debt')), 
        "initial_cash": float(data.get('initial_cash')),
        "interest_rate": float(data.get('interest_rate')),
        "annual_debt_repayment": float(data.get('annual_debt_repayment', 0.0)),
        "years": int(data.get('years', 3))
    }
    return inputs

@app.route('/api/forecast', methods=['POST'])
def forecast():
    try:
        inputs = get_inputs_from_request(request.json)
        forecast_results = generate_forecast(**inputs)
        return jsonify(forecast_results)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid number format received."}), 400

@app.route('/api/export', methods=['POST'])
def export_forecast():
    try:
        inputs = get_inputs_from_request(request.json)
        forecast_results = generate_forecast(**inputs)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid number format received."}), 400
    
    output = BytesIO()
    num_years = inputs['years'] 
    is_cfs_years = [f'Year {i}' for i in range(1, num_years + 1)]
    bs_years = ['Year 0'] + is_cfs_years

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Create and format Excel sheets
        df_is = pd.DataFrame(forecast_results['excel_is'])
        df_is.index = is_cfs_years
        df_is.T.to_excel(writer, sheet_name='Income Statement', index_label='Line Item', float_format='%.1f')
        
        df_bs = pd.DataFrame(forecast_results['excel_bs'])
        df_bs.index = bs_years
        df_bs.T.to_excel(writer, sheet_name='Balance Sheet', index_label='Line Item', float_format='%.1f')
        
        df_cfs = pd.DataFrame(forecast_results['excel_cfs'])
        df_cfs.index = is_cfs_years
        df_cfs.T.to_excel(writer, sheet_name='Cash Flow Statement', index_label='Line Item', float_format='%.1f')

        # Auto-fit column width
        for sheet_name, df in [('Income Statement', df_is), ('Balance Sheet', df_bs), ('Cash Flow Statement', df_cfs)]:
            worksheet = writer.sheets[sheet_name] 
            max_len = max(len(str(s)) for s in df.index) + 2
            worksheet.column_dimensions['A'].width = max_len

    output.seek(0)
    return send_file(output, as_attachment=True, download_name='Financial_Forecast.xlsx',
                     mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')

if __name__ == '__main__':
    app.run(debug=True, port=5000)

