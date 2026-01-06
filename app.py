from flask import Flask, request, jsonify, render_template
from forecaster import generate_forecast
from flask_cors import CORS

app = Flask(__name__, template_folder='.', static_folder='.', static_url_path='/')
CORS(app)

@app.route('/')
def home():
    return render_template('index.html')    

@app.route('/api/forecast', methods=['POST'])
def forecast():
    data = request.json
    try:
        results = generate_forecast(
            initial_revenue=0.0,
            revenue_growth_rates=[],
            cogs_pct_rates=[],
            fixed_opex_rates=data.get('fixed_opex_rates', []),
            tax_rate=data.get('tax_rate', 0.25),
            initial_ppe=0.0,
            capex_rates=[],
            depreciation_rate=0.0,
            dso_days_list=[30]*10,
            dio_days_list=[30]*10,
            dpo_days_list=[30]*10,
            initial_debt=data.get('initial_debt', 0.0),
            initial_cash=data.get('initial_cash', 0.0),
            interest_rate=data.get('interest_rate', 0.05),
            annual_debt_repayment_list=[0.0]*10,
            years=data.get('years', 5),
            revenue_streams=data.get('revenue_streams', []),
            cogs_streams=data.get('cogs_streams', []),
            opex_streams=data.get('opex_streams', [])
        )
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)
    
