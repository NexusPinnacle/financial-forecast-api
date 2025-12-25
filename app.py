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
    
    def get_list_float(key):
        list_str = data.get(key, [])
        if isinstance(list_str, str):
            list_str = [list_str]
        return [float(rate) for rate in list_str if rate is not None]

    inputs = {
        "initial_revenue": float(data.get('initial_revenue') or 0.0),
        "tax_rate": float(data.get('tax_rate') or 0.0),
        "initial_ppe": float(data.get('initial_ppe') or 0.0),
        "depreciation_rate": float(data.get('depreciation_rate') or 0.0),
        "initial_debt": float(data.get('initial_debt') or 0.0),
        "initial_cash": float(data.get('initial_cash') or 0.0),
        "interest_rate": float(data.get('interest_rate') or 0.0),
        "years": int(data.get('years', 3) or 3),
        
        # NEW: Period Mode
        "period_mode": data.get('period_mode', 'annual'),
        
        # GRANULAR LISTS
        "revenue_growth_rates": get_list_float('revenue_growth_rates'),
        "cogs_pct_rates": get_list_float('cogs_pct_rates'),
        "fixed_opex_rates": get_list_float('fixed_opex_rates'),
        "capex_rates": get_list_float('capex_rates'),
        "dso_days_list": get_list_float('dso_days_list'),
        "dio_days_list": get_list_float('dio_days_list'),
        "dpo_days_list": get_list_float('dpo_days_list'),
        "annual_debt_repayment_list": get_list_float('annual_debt_repayment_list'),
    }
    
    required_keys = ["initial_revenue", "tax_rate", "initial_ppe", "years"]
    for key in required_keys:
        if inputs[key] is None:
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
        import traceback
        app.logger.error(f"An internal error occurred: {e}\n{traceback.format_exc()}")
        return jsonify({"error": f"Internal Server Error: {e}"}), 500

@app.route('/api/export', methods=['POST'])
def export_to_excel():
    try:
        data = request.json
        inputs = get_inputs_from_request(data)
        forecast_results = generate_forecast(**inputs)

        output = BytesIO()
        writer = pd.ExcelWriter(output, engine='xlsxwriter')
        
        # Determine labels based on mode
        is_monthly = inputs.get('period_mode') == 'monthly'
        
        if is_monthly:
            # forecast_results['Years'] looks like ['Start', 'Month 1', 'Month 2'...]
            bs_years = forecast_results['Years']
            is_cfs_years = forecast_results['Years'][1:]
        else:
            bs_years = [f"Year {y}" for y in forecast_results['Years']]
            bs_years[0] = 'Year 0 (Initial)'
            is_cfs_years = [f"Year {y}" for y in forecast_results['Years'][1:]]
        
        df_is = pd.DataFrame(forecast_results['excel_is'], index=is_cfs_years).T
        df_bs = pd.DataFrame(forecast_results['excel_bs'], index=bs_years).T
        df_cfs = pd.DataFrame(forecast_results['excel_cfs'], index=is_cfs_years).T
        
        df_is.index.name = 'Line Item'
        df_bs.index.name = 'Line Item'
        df_cfs.index.name = 'Line Item'
        
        df_is.to_excel(writer, sheet_name='Income Statement', startrow=0, header=True, float_format='%.1f')
        df_bs.to_excel(writer, sheet_name='Balance Sheet', startrow=0, header=True, float_format='%.1f')
        df_cfs.to_excel(writer, sheet_name='Cash Flow Statement', startrow=0, header=True, float_format='%.1f')
        
        def get_data_len(val):
            if pd.isna(val) or val is None: return 0
            return len(f"{val:.1f}")
            
        for sheet_name, df in [('Income Statement', df_is), ('Balance Sheet', df_bs), ('Cash Flow Statement', df_cfs)]:
            if df.empty: continue
            worksheet = writer.sheets[sheet_name]
            col_a_width = max(df.index.to_series().astype(str).str.len().max(), len(df.index.name)) + 2
            worksheet.set_column('A:A', col_a_width)

            for i, col in enumerate(df.columns):
                header_len = len(str(col))
                max_len_data = df[col].apply(get_data_len).max()
                column_width = max(header_len, max_len_data) + 1 
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
        app.logger.error(f"Error during export: {e}\n{traceback.format_exc()}")
        return jsonify({"error": f"Internal Server Error: {e}"}), 500

if __name__ == '__main__':
    app.run(debug=True)
