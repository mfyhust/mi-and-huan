#!/usr/bin/env python3
"""Read only local synthetic model reports, summarize without network/model requests."""
import argparse
import json
from pathlib import Path

parser = argparse.ArgumentParser(description='本机统计合成模型评测；不访问网络，不读取业务库。')
parser.add_argument('reports', nargs='*', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
paths = args.reports or sorted((root / '.offline-evaluations').glob('*.json'))
rows = []
for path in paths:
    report = json.loads(path.read_text())
    if report.get('kind') != 'local-model-small-evaluation' or report.get('fixtureOnly') is not False:
        raise SystemExit('拒绝把模拟或未知报告统计为真实模型评测：' + str(path))
    failed = [{'id': c['id'], 'error': c.get('error'),
               'tools': [t['tool'] for turn in c.get('turns', []) for t in turn.get('tools', [])]}
              for c in report['cases'] if not c['passed']]
    rows.append({'file': path.name, 'model': report['model'], 'suite': report['suite'],
                 'requests': report['requests'], 'elapsedMs': report['elapsedMs'],
                 **report['summary'], 'failures': failed})
print(json.dumps({'localOnly': True, 'reports': rows,
                  'note': '逐次保留失败与复测；小样本重复场景不合并为泛化准确率，不代表断网验收。'},
                 ensure_ascii=False, indent=2))
