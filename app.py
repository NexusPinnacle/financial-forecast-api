# app.py

# 1. Update Imports
from flask import Flask, request, jsonify, render_template  # <-- ADD render_template
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
            "annual_debt_repayment": float(data.get('annual_debt_repayment'))
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
    
