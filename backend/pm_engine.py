from pm4py.objects.log.importer.xes import factory as xes_importer
from pm4py.algo.discovery.alpha import factory as alpha_miner

def analyze_event_log(file):
    log = xes_importer.apply(file)
    net, im, fm = alpha_miner.apply(log)
    return {
        "activities": [str(ev["concept:name"]) for trace in log for ev in trace]
    }
