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

        output = BytesIO()
        writer = pd.ExcelWriter(output, engine='xlsxwriter')
        
        # Prepare DataFrames for Excel
        is_cfs_years = [f"Year {y}" for y in forecast_results['Years'][1:]]
        bs_years = [f"Year {y}" for y in forecast_results['Years']]
        bs_years[0] = 'Year 0 (Initial)'
        
        # Transpose DataFrames for correct orientation in Excel
        df_is = pd.DataFrame(forecast_results['excel_is'], index=is_cfs_years).T
        df_bs = pd.DataFrame(forecast_results['excel_bs'], index=bs_years).T
        df_cfs = pd.DataFrame(forecast_results['excel_cfs'], index=is_cfs_years).T
        
        # Write DataFrames to Excel sheets
        df_is.to_excel(writer, sheet_name='Income Statement', startrow=0, header=True, 
            index_label='Line Item', float_format='%.1f')
        df_bs.to_excel(writer, sheet_name='Balance Sheet', startrow=0, header=True, 
            index_label='Line Item', float_format='%.1f')
        df_cfs.to_excel(writer, sheet_name='Cash Flow Statement', startrow=0, header=True, 
            index_label='Line Item', float_format='%.1f')
        
        # --- FIX & AUTO FIT LOGIC ---
        # Loop through each sheet to set column widths
        for sheet_name, df in [('Income Statement', df_is), ('Balance Sheet', df_bs), ('Cash Flow Statement', df_cfs)]:
            worksheet = writer.sheets[sheet_name]
            
            # 1. Autofit the first column (A) based on the length of the line items
            # Add 2 for padding
            col_a_width = max(df.index.to_series().astype(str).str.len().max(), len(df.index.name)) + 2
            worksheet.set_column('A:A', col_a_width)

            # 2. Autofit the other columns (B, C, D...) based on data and header length
            for i, col in enumerate(df.columns):
                # Find length of header and the longest formatted number in the column
                # Add 2 for padding
                header_len = len(str(col))
                # Format numbers like '1,234.5' to get their string length
                max_len_data = df[col].apply(lambda x: len(f"{x:,.1f}")).max()
                column_width = max(header_len, max_len_data) + 2
                # Set column width for B, C, D... (offset by 1 because of the index column)
                worksheet.set_column(i + 1, i + 1, column_width)

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
        import traceback
        app.logger.error(f"An internal error occurred during export: {e}\n{traceback.format_exc()}")
        return jsonify({"error": f"Internal Server Error during export: {e}"}), 500
