# backend/app.py
from flask import Flask, request, jsonify
from flask_cors import CORS # For Cross-Origin Resource Sharing
import os
import tempfile # For temporary file storage
from werkzeug.utils import secure_filename # For secure filenames

# Import your custom modules
from pm_engine import analyze_event_log
from llm_review import get_llm_insights

app = Flask(__name__)

# PRD Section 8: CORS configuration
# Allow requests from your Vercel frontend (and localhost for dev)
# For PoC, allowing all origins is simpler, but tighten this for production.
CORS(app) 
# Example for more specific origins:
# CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "https://your-vercel-app-domain.vercel.app"]}})


# Define allowed file extensions (as per PRD)
ALLOWED_EXTENSIONS = {'.csv', '.xes'}

def allowed_file(filename):
    return '.' in filename and \
           os.path.splitext(filename)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/process', methods=['POST']) # PRD Section 5.3 & 5.4
def process_log_file():
    # PRD Section 5.3: Expects multipart/form-data with a file
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "No file part in the request.", "data": None}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "No selected file.", "data": None}), 400

    if file and allowed_file(file.filename):
        original_filename = secure_filename(file.filename) # Sanitize filename
        
        # PRD Section 5.3: Backend stores temporarily (or in memory) for analysis.
        # Using a temporary file is safer and handles larger files better than in-memory for PM4PY.
        temp_dir = tempfile.gettempdir()
        temp_file_path = os.path.join(temp_dir, original_filename)
        
        try:
            file.save(temp_file_path)
            
            # 1. Process with PM4PY engine (pm_engine.py)
            print(f"Processing file: {temp_file_path} (Original: {original_filename})")
            process_graph_data = analyze_event_log(temp_file_path, original_filename)
            if not process_graph_data: # Should not happen if analyze_event_log raises on error
                return jsonify({"success": False, "message": "Failed to analyze event log with PM4PY.", "data": None}), 500

            # (Optional for PRD 6.B) Create a textual summary for the LLM
            # For PoC, this can be simple or omitted if LLM is good with just graph data
            num_nodes = len(process_graph_data.get("nodes", []))
            num_links = len(process_graph_data.get("links", []))
            process_summary_text = f"The discovered process model has {num_nodes} activities (nodes) and {num_links} transitions (links)."

            # 2. Get LLM insights (llm_review.py)
            llm_insights = get_llm_insights(process_graph_data, process_summary_text)
            if not llm_insights: # If LLM fails but graph is ok, still return graph
                 print("Warning: Failed to get LLM insights, but process graph was generated.")
                 # Provide a default error structure for LLM insights part of the response
                 llm_insights = {
                     "summary": "LLM analysis unavailable at this time.",
                     "bottlenecks": [], "rework_loops": [], "inefficiencies": [], "anomalies": []
                 }
            
            # PRD Section 5.4: Response structure
            response_data = {
                "success": True,
                "message": "Processing successful.",
                "data": {
                    "processGraph": process_graph_data,
                    "llmInsights": llm_insights
                }
            }
            return jsonify(response_data), 200

        except ValueError as ve: # Catch specific errors from pm_engine or other validation
            print(f"Validation Error: {ve}")
            return jsonify({"success": False, "message": str(ve), "data": None}), 400
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            # Log the full traceback here in a real application
            # import traceback
            # traceback.print_exc()
            return jsonify({"success": False, "message": f"An internal server error occurred: {str(e)}", "data": None}), 500
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                    print(f"Cleaned up temp file: {temp_file_path}")
                except Exception as e_clean:
                    print(f"Error cleaning up temp file {temp_file_path}: {e_clean}")
    else:
        return jsonify({"success": False, "message": f"File type not allowed. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}", "data": None}), 400

# Simple health check endpoint
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "message": "Backend is running!"}), 200

if __name__ == '__main__':
    # For development, Flask's built-in server is fine.
    # For production, use a WSGI server like Gunicorn or uWSGI.
    # Debug mode should be False in production.
    # host='0.0.0.0' makes it accessible on your network, useful for ngrok.
    app.run(host='0.0.0.0', port=5000, debug=True)

