# backend/llm_review.py
import requests
import json
import os
from dotenv import load_dotenv
import hashlib # For caching key

load_dotenv() # Load environment variables from .env

OLLAMA_API_BASE_URL = os.getenv("OLLAMA_API_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:8b-instruct") # As per PRD Section 1 & 6.B

# Simple in-memory cache for PoC (PRD Section 6.B - Caching)
# For production, consider Redis, memcached, or diskcache (e.g., joblib.Memory)
LLM_CACHE = {}

def get_llm_insights(process_graph_data, process_summary_text=None):
    """
    Sends process graph data to a local LLaMA 3 model via Ollama API for review.

    Args:
        process_graph_data: Dictionary containing 'nodes' and 'links' of the process graph.
        process_summary_text (optional): A concise textual summary of the process.

    Returns:
        A dictionary containing LLM-generated insights, or None if an error occurs.
        Example structure from PRD Section 5.4:
        {
          "summary": "...",
          "bottlenecks": [ { "activity": "...", "reason": "..." } ],
          ...
        }
    """
    if not process_graph_data or not process_graph_data.get('nodes') or not process_graph_data.get('links'):
        print("LLM Review: Invalid or empty process_graph_data provided.")
        return None # Or raise an error

    # Caching mechanism (PRD Section 6.B)
    cache_key_input = {
        "graph": process_graph_data,
        "summary_text": process_summary_text or ""
    }
    # Sort keys for consistent hashing
    cache_key_string = json.dumps(cache_key_input, sort_keys=True)
    cache_key = hashlib.md5(cache_key_string.encode('utf-8')).hexdigest()

    if cache_key in LLM_CACHE:
        print(f"LLM Review: Returning cached response for key {cache_key}")
        return LLM_CACHE[cache_key]

    # PRD Section 6.B: Construct Prompt Template
    # Ensure nodes and links are serializable to JSON for the prompt
    try:
        nodes_json_str = json.dumps(process_graph_data.get('nodes', []), indent=2)
        links_json_str = json.dumps(process_graph_data.get('links', []), indent=2)
    except TypeError as te:
        print(f"LLM Review: Error serializing process_graph_data to JSON: {te}")
        # Potentially handle non-serializable data or raise
        return None


    prompt_template = f"""
You are an expert process mining analyst. Analyze the following discovered process model:

**Process Model Data:**
Nodes (Activities):
{nodes_json_str}

Edges (Transitions):
{links_json_str}

**Process Summary (if provided):**
{process_summary_text if process_summary_text else "No additional summary provided."}

**Your Task:**
Based *only* on the provided data, identify and describe:
1.  **Summary:** A brief (1-2 sentences) overall assessment of the process.
2.  **Potential Bottlenecks:** Activities that might be bottlenecks due to high frequency, long duration (if available in data), or being a convergence point with many incoming high-frequency paths. List up to 3.
3.  **Significant Rework Loops/Repeated Sequences:** Identify sequences of activities that indicate rework (e.g., A -> B -> A, or A -> B -> C -> A based on the provided links). List up to 2.
4.  **Key Inefficiencies/Observations:** Other notable patterns, like very low-frequency paths that might be exceptions, or high-frequency paths that represent the "happy path". List up to 3.
5.  **Anomalies:** Any unusual patterns or transitions that stand out. List up to 2.

**Output Format:**
Return your analysis *only* as a single, minified JSON object matching this structure:
{{
  "summary": "string",
  "bottlenecks": [{{ "activity": "string", "reason": "string" }}],
  "rework_loops": [{{ "loop": ["string", ...], "impact": "string" }}],
  "inefficiencies": [{{ "observation": "string", "suggestion": "string (optional)" }}],
  "anomalies": [{{ "item": "string (e.g., activity name or path A->B)", "description": "string" }}]
}}
Ensure the output is valid JSON. Do not include any explanations or text outside this JSON structure.
"""

    ollama_endpoint = f"{OLLAMA_API_BASE_URL}/api/generate"
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt_template,
        "format": "json", # Ollama can directly output JSON if the model/prompt supports it
        "stream": False   # We want the full response
    }

    try:
        print(f"LLM Review: Sending request to Ollama model {OLLAMA_MODEL}...")
        response = requests.post(ollama_endpoint, json=payload, timeout=60) # 60s timeout
        response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)

        # Ollama with format="json" should return a JSON object where 'response' key holds the JSON string
        response_data = response.json()
        
        if "response" in response_data:
            llm_json_output_str = response_data["response"]
            try:
                insights = json.loads(llm_json_output_str)
                LLM_CACHE[cache_key] = insights # Store in cache
                print("LLM Review: Successfully parsed insights from Ollama.")
                return insights
            except json.JSONDecodeError as jde:
                print(f"LLM Review: Failed to decode JSON from LLM response: {jde}")
                print(f"LLM Raw Response String: {llm_json_output_str}")
                return {"summary": "Error: LLM returned malformed JSON.", "bottlenecks": [], "rework_loops": [], "inefficiencies": [], "anomalies": []}
        elif "error" in response_data:
             print(f"LLM Review: Ollama API returned an error: {response_data['error']}")
             return {"summary": f"Error: Ollama API error - {response_data['error']}", "bottlenecks": [], "rework_loops": [], "inefficiencies": [], "anomalies": []}
        else:
            print(f"LLM Review: Unexpected response structure from Ollama: {response_data}")
            return {"summary": "Error: Unexpected response from LLM.", "bottlenecks": [], "rework_loops": [], "inefficiencies": [], "anomalies": []}


    except requests.exceptions.RequestException as e:
        print(f"LLM Review: Request to Ollama API failed: {e}")
        return None # Or an error structure
    except Exception as e:
        print(f"LLM Review: An unexpected error occurred: {e}")
        raise

if __name__ == '__main__':
    # Example Usage
    dummy_graph_data = {
        "nodes": [
            {"id": "Start", "label": "Start", "frequency": 10},
            {"id": "Activity A", "label": "Activity A", "frequency": 100},
            {"id": "Activity B", "label": "Activity B", "frequency": 80},
            {"id": "Activity C", "label": "Activity C", "frequency": 90, "avg_duration_sec": 120},
            {"id": "End", "label": "End", "frequency": 10}
        ],
        "links": [
            {"source": "Start", "target": "Activity A", "count": 10},
            {"source": "Activity A", "target": "Activity B", "count": 70},
            {"source": "Activity A", "target": "Activity C", "count": 30},
            {"source": "Activity B", "target": "Activity C", "count": 60},
            {"source": "Activity B", "target": "End", "count": 20},
            {"source": "Activity C", "target": "End", "count": 90},
            {"source": "Activity C", "target": "Activity A", "count": 5} # Rework loop
        ]
    }
    dummy_summary = "This is a sample process with 3 main activities."
    
    print("--- Testing LLM Review ---")
    # Ensure Ollama is running with llama3:8b-instruct model
    # `ollama serve` and `ollama pull llama3:8b-instruct`
    insights = get_llm_insights(dummy_graph_data, dummy_summary)
    if insights:
        print("LLM Insights Received:")
        print(json.dumps(insights, indent=2))
    else:
        print("Failed to get LLM insights.")

    # Test caching
    print("\n--- Testing LLM Review (should be cached) ---")
    insights_cached = get_llm_insights(dummy_graph_data, dummy_summary)
    if insights_cached:
        print("LLM Insights (Cached):")
        print(json.dumps(insights_cached, indent=2))