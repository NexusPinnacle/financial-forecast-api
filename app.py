# app.py

# 1. Update Imports
from flask import Flask, request, jsonify, render_template, send_file 
# ALSO ADD THESE:
import pandas as pd 
from io import BytesIO 

from forecaster import generate_forecast
from flask_cors import CORS 


# 2. Custom App Initialization for Root Directory
# Tells Flask to look for index.html (template) and script/style (static) in the current folder ('.')
app = Flask(
    __name__,
    template_folder='.',    
    static_folder='.',      
    static_url_path='/'     
)

# Enable CORS for all routes
CORS(app) 

# 3. Change the Home Route to Render HTML
@app.route('/')
def home():

    
    # This line tells Flask to load and send your index.html file
    return render_template('index.html')   



# This is the API endpoint the frontend will talk to
@app.route('/api/forecast', methods=['POST'])
def forecast():
    # 1. Get user data (assumptions) from the frontend request
    data = request.json
    
    # 2. Convert string/JSON data into numbers for the function
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
            
            # --- NEW NWC INPUTS (Days) ---
            "dso_days": float(data.get('dso_days')), 
            "dio_days": float(data.get('dio_days')), 
            "dpo_days": float(data.get('dpo_days')), 
            
            # --- NEW FINANCING INPUTS ---
            "initial_debt": float(data.get('initial_debt')), 
            "initial_cash": float(data.get('initial_cash')),
            "interest_rate": float(data.get('interest_rate')),
            # FIX: Use a default value (0.0) if 'annual_debt_repayment' is missing
            "annual_debt_repayment": float(data.get('annual_debt_repayment', 0.0)) 
        }
    except ValueError:
        return jsonify({"error": "Invalid number format received."}), 400

    # 3. Run the core financial logic
    forecast_results = generate_forecast(**inputs)
    
    # 4. Return the results back to the frontend as JSON
    return jsonify(forecast_results)

if __name__ == '__main__':
    # Add flask_cors if not installed
    # pip install flask_cors 
    app.run(debug=True, port=5000)



# New route to handle the Excel export
@app.route('/api/export', methods=['POST'])
def export_forecast():
    # 1. Get user data (assumptions) from the frontend request
    data = request.json
    
    # 2. Convert string/JSON data into numbers for the function (Same as /api/forecast)
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
            "interest_rate": float(data.get('interest_rate')),
            "annual_debt_repayment": float(data.get('annual_debt_repayment', 0.0))
        }
    except ValueError:
        return jsonify({"error": "Invalid number format received."}), 400
    
    # 3. Run the core financial logic
    forecast_results = generate_forecast(**inputs)
    
    # 4. Use pandas to create the Excel file in memory
    output = BytesIO()
    
    # Use pandas ExcelWriter to create multiple sheets
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        
        # --- Income Statement Sheet ---
        df_is = pd.DataFrame(forecast_results['excel_is'])
        df_is.index = ['Year 1', 'Year 2', 'Year 3']
        df_is = df_is.T # Transpose for line items as rows
        df_is.to_excel(writer, sheet_name='Income Statement', startrow=1, header=True)
        
        # --- Balance Sheet Sheet ---
        df_bs = pd.DataFrame(forecast_results['excel_bs'])
        df_bs.index = ['Year 0', 'Year 1', 'Year 2', 'Year 3']
        df_bs = df_bs.T # Transpose for line items as rows
        df_bs.to_excel(writer, sheet_name='Balance Sheet', startrow=1, header=True)
        
        # --- Cash Flow Statement Sheet ---
        df_cfs = pd.DataFrame(forecast_results['excel_cfs'])
        df_cfs.index = ['Year 1', 'Year 2', 'Year 3']
        df_cfs = df_cfs.T # Transpose for line items as rows
        df_cfs.to_excel(writer, sheet_name='Cash Flow Statement', startrow=1, header=True)

    # Move buffer position to the start and send the file
    output.seek(0)
    
    return send_file(
        output,
        as_attachment=True,
        download_name='Financial_Forecast.xlsx',
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    
