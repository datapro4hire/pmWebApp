from flask import Flask, request, jsonify
from pm_engine import analyze_event_log
from llm_review import review_process

app = Flask(__name__)

@app.route('/analyze', methods=['POST'])
def analyze():
    file = request.files['file']
    process_map = analyze_event_log(file)
    insights = review_process(process_map)
    return jsonify({'process_map': process_map, 'insights': insights})

if __name__ == '__main__':
    app.run(debug=True)

