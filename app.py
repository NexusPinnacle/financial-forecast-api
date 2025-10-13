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
        
        # --- FIX START: Explicitly set the index name to prevent TypeError in autofit logic ---
        df_is.index.name = 'Line Item'
        df_bs.index.name = 'Line Item'
        df_cfs.index.name = 'Line Item'
        # --- FIX END: The index name now matches the index_label used for export ---

        # Write DataFrames to Excel sheets
        df_is.to_excel(writer, sheet_name='Income Statement', startrow=0, header=True, 
            index_label='Line Item', float_format='%.1f')
        df_bs.to_excel(writer, sheet_name='Balance Sheet', startrow=0, header=True, 
            index_label='Line Item', float_format='%.1f')
        df_cfs.to_excel(writer, sheet_name='Cash Flow Statement', startrow=0, header=True, 
            index_label='Line Item', float_format='%.1f')
        
        # Autofit column logic
        for sheet_name, df in [('Income Statement', df_is), ('Balance Sheet', df_bs), ('Cash Flow Statement', df_cfs)]:
            # --- NEW: Safety check for empty dataframes ---
            if df.empty:
                continue # Skip autofitting if the sheet is empty

            worksheet = writer.sheets[sheet_name]
            
            # 1. Autofit the first column (A)
            max_index_len = df.index.to_series().astype(str).str.len().max()
            
            # This line caused the error when df.index.name was None
            # The error in the traceback was: col_a_width = max(df.index.to_series().astype(str).str.len().max(), len(df.index.name)) + 2
            # The current code is:
            col_a_width = max(max_index_len, len('Line Item')) + 2
            
            # NOTE: If your actual live code was the one from the traceback (which uses df.index.name), 
            # the index name must be set, which the fix above handles. 
            # If your live code is exactly what was attached (using 'Line Item'), the traceback 
            # must be from an older version. I'll proceed with the assumption that setting 
            # df.index.name is the correct fix based on the *error message*. 
            # In the code below, I'm using the fixed line which assumes df.index.name is set:
            col_a_width = max(max_index_len, len(df.index.name or 'Line Item')) + 2 
            # OR, using the value in the provided code snippet:
            col_a_width = max(max_index_len, len('Line Item')) + 2

            worksheet.set_column('A:A', col_a_width)

            # 2. Autofit the data columns (B, C, D...)
            for i, col in enumerate(df.columns):
                # Safely calculate max length for data, handling non-numeric types
                def get_len(val):
                    if pd.isna(val):
                        return 4 # for "N/A"
                    try:
                        return len(f"{val:,.1f}")
                    except TypeError:
                        return len(str(val))

                header_len = len(str(col))
                max_len_data = df[col].apply(get_len).max()
                column_width = max(header_len, max_len_data) + 2
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
