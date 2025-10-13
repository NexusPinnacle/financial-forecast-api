from flask import Flask, request, jsonify, render_template, send_file 
import pandas as pd 
from io import BytesIO 
from forecaster import generate_forecast
from flask_cors import CORS 

app = Flask(
    __name__,
    template_folder='.',    
    static_folder='.',      
    static_url_path='/'     
)
CORS(app) 

@app.route('/')
def home():
    return render_template('index.html')   

def get_inputs_from_request(data):
    """Helper function to parse and convert inputs from request data."""
    # Handle the list of revenue growth rates
    revenue_growth_rates_str = data.get('revenue_growth_rates', [])
    revenue_growth_rates = [float(rate) for rate in revenue_growth_rates_str]

    # NEW: Handle the list of COGS percentage rates
    cogs_pct_rates_str = data.get('cogs_pct_rates', [])
    cogs_pct_rates = [float(rate) for rate in cogs_pct_rates_str]

    inputs = {
        "initial_revenue": float(data.get('initial_revenue')),
        "revenue_growth_rates": revenue_growth_rates, 
        "cogs_pct_rates": cogs_pct_rates, # MODIFIED: Pass the list of COGS rates
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
        "interest_rate": float(data.get('interest_rate')),
        "annual_debt_repayment": float(data.get('annual_debt_repayment', 0.0)),
        "years": int(data.get('years', 3))
    }
    return inputs

@app.route('/api/forecast', methods=['POST'])
def forecast():
    data = request.json
    try:
        inputs = get_inputs_from_request(data)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid number format received."}), 400

    forecast_results = generate_forecast(**inputs)
    return jsonify(forecast_results)

@app.route('/api/export', methods=['POST'])
def export_forecast():
    data = request.json
    try:
        inputs = get_inputs_from_request(data)
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid number format received."}), 400
    
    forecast_results = generate_forecast(**inputs)
    
    output = BytesIO()
    num_years = inputs['years'] 
    is_cfs_years = [f'Year {i}' for i in range(1, num_years + 1)]
    bs_years = ['Year 0'] + is_cfs_years

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        
        # --- FIX 1: Income Statement ---
        # Initialize DataFrame with the Line Item data, setting years as the index.
        # This makes Line Items the columns. Transposing (df_is.T) fixes the format.
        df_is = pd.DataFrame(forecast_results['excel_is'], index=is_cfs_years) 
        df_is.T.to_excel(writer, sheet_name='Income Statement', startrow=1, header=True, 
            index_label='Line Item', float_format='%.1f')
        
        # --- FIX 2: Balance Sheet ---
        df_bs = pd.DataFrame(forecast_results['excel_bs'], index=bs_years) 
        df_bs.T.to_excel(writer, sheet_name='Balance Sheet', startrow=1, header=True, 
            index_label='Line Item', float_format='%.1f')
        
        # --- FIX 3: Cash Flow Statement ---
        df_cfs = pd.DataFrame(forecast_results['excel_cfs'], index=is_cfs_years) 
        df_cfs.T.to_excel(writer, sheet_name='Cash Flow Statement', startrow=1, header=True, 
            index_label='Line Item', float_format='%.1f')

        # FIX 4: Correct logic for column width based on line item length
        line_items_is = list(forecast_results['excel_is'].keys())
        line_items_bs = list(forecast_results['excel_bs'].keys())
        line_items_cfs = list(forecast_results['excel_cfs'].keys())
        
        sheet_index_map_for_width = {
            'Income Statement': line_items_is, 
            'Balance Sheet': line_items_bs,
            'Cash Flow Statement': line_items_cfs
        }

        for sheet_name, index_labels in sheet_index_map_for_width.items():
            worksheet = writer.sheets[sheet_name] 
            # Calculate width based on line item names, plus a buffer
            max_len = max(len(str(s)) for s in index_labels) + 2 
            header_len = len('Line Item') + 2
            column_width = max(max_len, header_len)
            worksheet.column_dimensions['A'].width = column_width

    output.seek(0)
    
    return send_file(
        output,
        as_attachment=True,
        download_name='Financial_Forecast.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

if __name__ == '__main__':
    app.run(debug=True, port=5000)
