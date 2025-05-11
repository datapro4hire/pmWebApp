from llama_cpp import Llama

llm = Llama(model_path="models/llama-3.gguf")

def review_process(process_data):
    prompt = f"Review this process map and identify bottlenecks: {process_data}"
    response = llm(prompt)
    return response
''