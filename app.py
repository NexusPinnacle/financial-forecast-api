from flask import Flask, request, jsonify, render_template, send_file 
import pandas as pd 
from io import BytesIO 
from forecaster import generate_forecast
from flask_cors import CORS 

app = Flask(
    __name__,\
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
    
    # Helper to safely get and convert a list of strings to floats
    def get_list_float(key):
        list_str = data.get(key, [])
        return [float(rate) for rate in list_str]

    inputs = {
        "initial_revenue": float(data.get('initial_revenue')),
        "tax_rate": float(data.get('tax_rate')),
        "initial_ppe": float(data.get('initial_ppe')),
        "depreciation_rate": float(data.get('depreciation_rate')),
        "initial_debt": float(data.get('initial_debt')),
        "initial_cash": float(data.get('initial_cash')),
        "interest_rate": float(data.get('interest_rate')),
        "years": int(data.get('years', 3)),
        
        # GRANULAR LISTS - New inputs matching the updated forecaster.py
        "revenue_growth_rates": get_list_float('revenue_growth_rates'),
        "cogs_pct_rates": get_list_float('cogs_pct_rates'),
        "fixed_opex_rates": get_list_float('fixed_opex_rates'),
        "capex_rates": get_list_float('capex_rates'),
        "dso_days_list": get_list_float('dso_days_list'),
        "dio_days_list": get_list_float('dio_days_list'),
        "dpo_days_list": get_list_float('dpo_days_list'),
        "annual_debt_repayment_list": get_list_float('annual_debt_repayment_list'),
    }
    
    # Validation to catch missing data early
    for key, value in inputs.items():
        if value is None or (isinstance(value, list) and not value):
             raise ValueError(f"Missing or invalid input data for: {key}")

    return inputs

@app.route('/api/forecast', methods=['POST'])
def forecast():
    try:
        data = request.json
        inputs = get_inputs_from_request(data)
        
        forecast_results = generate_forecast(**inputs)
        
        return jsonify(forecast_results)
    
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Log the full traceback for better debugging on the server side
        import traceback
        app.logger.error(f"An internal error occurred: {e}\n{traceback.format_exc()}")
        return jsonify({"error": f"Internal Server Error during calculation: {e}"}), 500

@app.route('/api/export', methods=['POST'])
def export_to_excel():
    try:
        data = request.json
        inputs = get_inputs_from_request(data)
        
        forecast_results = generate_forecast(**inputs)

        # File Export Logic... (remains unchanged as it uses the same results structure)
        output = BytesIO()
        writer = pd.ExcelWriter(output, engine='xlsxwriter')
        
        # Prepare DataFrames for Excel (using 1-based year indexing for IS/CFS headers, 0-based for BS)
        is_cfs_years = [f"Year {y}" for y in forecast_results['Years'][1:]]
        bs_years = [f"Year {y}" for y in forecast_results['Years']]
        bs_years[0] = 'Year 0 (Initial)'
        
        df_is = pd.DataFrame(forecast_results['excel_is'])
        df_is.index = is_cfs_years
        df_is.T.to_excel(writer, sheet_name='Income Statement', startrow=1, header=True, 
            index_label='Line Item', float_format='%.1f')
        
        df_bs = pd.DataFrame(forecast_results['excel_bs'])
        df_bs.index = bs_years
        df_bs.T.to_excel(writer, sheet_name='Balance Sheet', startrow=1, header=True, 
            index_label='Line Item', float_format='%.1f')
        
        df_cfs = pd.DataFrame(forecast_results['excel_cfs'])
        df_cfs.index = is_cfs_years
        df_cfs.T.to_excel(writer, sheet_name='Cash Flow Statement', startrow=1, header=True, 
            index_label='Line Item', float_format='%.1f')

        sheet_index_map = {
            'Income Statement': df_is.index, 'Balance Sheet': df_bs.index,
            'Cash Flow Statement': df_cfs.index
        }

        for sheet_name, index_labels in sheet_index_map.items():
            worksheet = writer.sheets[sheet_name] 
            max_len = max(len(str(s)) for s in index_labels) + 2 
            header_len = len('Line Item') + 2
            column_width = max(max_len, header_len)
            worksheet.column_dimensions['A'].width = column_width

        writer.close()
        output.seek(0)
        
        return send_file(
            output, 
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name='Financial_Forecast.xlsx'
        )

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        # Log the full traceback for better debugging on the server side
        import traceback
        app.logger.error(f"An internal error occurred during export: {e}\n{traceback.format_exc()}")
        return jsonify({"error": f"Internal Server Error during export: {e}"}), 500
