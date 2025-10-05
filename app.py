# app.py

# This is the "homepage" that serves your frontend
@app.route('/')
def home():
    # This now looks for index.html in the root directory (where app.py is)
    return render_template('index.html')

from flask import Flask, request, jsonify
from forecaster import generate_forecast
from flask_cors import CORS # Needed to allow your frontend to talk to your backend

app = Flask(__name__
            
            ,
    template_folder='.',    # Look for index.html in the current folder
    static_folder='.'       # Look for script.js and style.css in the current folder



            
)
# Enable CORS for all routes - IMPORTANT for deployment
CORS(app) 

# This is the "homepage" of your backend (optional, just for testing)
@app.route('/')
def home():
    return "Financial Forecast API is running!"

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
            "interest_rate": float(data.get('interest_rate'))
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
    
