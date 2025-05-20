# backend/pm_engine.py
import pandas as pd
import pm4py
from pm4py.objects.log.util import dataframe_utils
from pm4py.objects.conversion.log import converter as log_converter
import os # For file extension

# PRD Section 5.1: CSV Column Names
CASE_ID_COL = 'case_id'
ACTIVITY_COL = 'activity'
TIMESTAMP_COL = 'timestamp'
RESOURCE_COL = 'resource' # Optional

# PM4PY Standard Column Names
PM4PY_CASE_ID_COL = 'case:concept:name'
PM4PY_ACTIVITY_COL = 'concept:name'
PM4PY_TIMESTAMP_COL = 'time:timestamp'
PM4PY_RESOURCE_COL = 'org:resource' # Optional

def analyze_event_log(file_path_or_stream, original_filename):
    """
    Analyzes an event log file (CSV or XES) and discovers a Directly Follows Graph (DFG).
    Outputs structured nodes and links for visualization and LLM review.

    Args:
        file_path_or_stream: Path to the uploaded event log file or an in-memory file stream.
        original_filename: The original name of the uploaded file (to determine type).

    Returns:
        A dictionary containing 'nodes' and 'links' for the DFG, or None if an error occurs.
        Example:
        {
          "nodes": [
            { "id": "Activity A", "label": "Activity A", "frequency": 120, "avg_duration_sec": 3600 }
          ],
          "links": [
            { "source": "Activity A", "target": "Activity B", "count": 95, "avg_lead_time_sec": 1800 }
          ]
        }
    """
    _, file_extension = os.path.splitext(original_filename)
    file_type = file_extension.lower()

    try:
        if file_type == '.csv':
            # PRD Section 6.A: Parse CSV
            # Assuming file_path_or_stream is a path for CSV for simplicity in PoC
            # If it's a stream, pandas can read it directly: pd.read_csv(file_path_or_stream)
            df = pd.read_csv(file_path_or_stream)
            
            # Validate required columns (PRD Section 5.1)
            required_cols = [CASE_ID_COL, ACTIVITY_COL, TIMESTAMP_COL]
            if not all(col in df.columns for col in required_cols):
                missing = [col for col in required_cols if col not in df.columns]
                raise ValueError(f"CSV file is missing required columns: {', '.join(missing)}. Expected: {', '.join(required_cols)}")

            df = dataframe_utils.convert_timestamp_columns_in_df(df, timest_columns=[TIMESTAMP_COL])
            
            # Rename columns to PM4PY standard format
            rename_map = {
                CASE_ID_COL: PM4PY_CASE_ID_COL,
                ACTIVITY_COL: PM4PY_ACTIVITY_COL,
                TIMESTAMP_COL: PM4PY_TIMESTAMP_COL
            }
            if RESOURCE_COL in df.columns: # Optional resource column
                rename_map[RESOURCE_COL] = PM4PY_RESOURCE_COL

            df.rename(columns=rename_map, inplace=True)
            
            event_log = log_converter.apply(df, variant=log_converter.Variants.TO_EVENT_LOG)
        
        elif file_type == '.xes':
            # PRD Section 6.A: Parse XES
            # Assuming file_path_or_stream is a path for XES for simplicity
            # If it's a stream, pm4py.read_xes might need a path-like object or saved file
            event_log = pm4py.read_xes(file_path_or_stream)
        
        else:
            raise ValueError(f"Unsupported file type: {file_type}. Please upload .csv or .xes.")

        # PRD Section 6.A: Discover Directly Follows Graph (DFG)
        dfg, start_activities, end_activities = pm4py.discover_dfg(event_log)
        
        # --- Format Output (PRD Section 5.4 & 6.A) ---
        nodes_map = {} # To store node data and ensure unique nodes
        
        # Collect all unique activities from DFG for nodes
        all_activities_in_dfg = set()
        for (source, target) in dfg:
            all_activities_in_dfg.add(source)
            all_activities_in_dfg.add(target)
        
        # Add start/end activities that might not be in DFG edges (e.g., single activity traces)
        for act in start_activities: all_activities_in_dfg.add(act)
        for act in end_activities: all_activities_in_dfg.add(act)

        # Calculate activity frequencies (occurrence in the log)
        activity_stats = pm4py.get_event_attribute_values(event_log, PM4PY_ACTIVITY_COL, attribute_type=" διάρκ") # Uses 'concept:name'
        
        nodes = []
        for activity_name in all_activities_in_dfg:
            if activity_name not in nodes_map:
                node_data = {
                    "id": activity_name,
                    "label": activity_name,
                    "frequency": activity_stats.get(activity_name, 0), # Get frequency from activity_stats
                    "avg_duration_sec": None # Placeholder; requires more complex calculation if needed
                }
                nodes.append(node_data)
                nodes_map[activity_name] = node_data
        
        links = []
        for (source, target), count in dfg.items():
            links.append({
                "source": source,
                "target": target,
                "count": count,
                "avg_lead_time_sec": None # Placeholder; requires event-level timestamp analysis
            })
            
        # (Optional for PoC) Add start/end "pseudo" nodes if desired for visualization
        # For now, focusing on DFG of actual activities

        return {"nodes": nodes, "links": links}

    except Exception as e:
        print(f"Error in pm_engine: {e}")
        # In a real app, you might want to raise a custom exception or return an error structure
        raise # Re-raise for app.py to catch and format

if __name__ == '__main__':
    # Example Usage (for testing this module directly)
    # Create a dummy CSV for testing
    dummy_csv_path = "dummy_log.csv"
    dummy_data = {
        'case_id': [1, 1, 1, 2, 2, 3, 3, 3, 3],
        'activity': ['A', 'B', 'C', 'A', 'D', 'X', 'Y', 'Z', 'Y'],
        'timestamp': ['2023-01-01 10:00:00', '2023-01-01 10:05:00', '2023-01-01 10:10:00',
                      '2023-01-01 11:00:00', '2023-01-01 11:05:00', '2023-01-02 09:00:00',
                      '2023-01-02 09:03:00', '2023-01-02 09:06:00', '2023-01-02 09:09:00'],
        'resource': ['R1', 'R2', 'R1', 'R3', 'R1', 'R2', 'R3', 'R1', 'R2']
    }
    pd.DataFrame(dummy_data).to_csv(dummy_csv_path, index=False)

    try:
        print(f"--- Testing with {dummy_csv_path} ---")
        graph_data_csv = analyze_event_log(dummy_csv_path, "dummy_log.csv")
        if graph_data_csv:
            print("CSV Process Graph Data:")
            import json
            print(json.dumps(graph_data_csv, indent=2))
    except Exception as e:
        print(f"Error during CSV test: {e}")
    finally:
        if os.path.exists(dummy_csv_path):
            os.remove(dummy_csv_path)

    # You would need a sample .xes file for XES testing
    # sample_xes_path = "path_to_your_sample.xes"
    # if os.path.exists(sample_xes_path):
    #     try:
    #         print(f"--- Testing with {sample_xes_path} ---")
    #         graph_data_xes = analyze_event_log(sample_xes_path, "sample.xes")
    #         if graph_data_xes:
    #             print("\nXES Process Graph Data:")
    #             print(json.dumps(graph_data_xes, indent=2))
    #     except Exception as e:
    #         print(f"Error during XES test: {e}")
