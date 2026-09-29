"""Build offline SCATS time-of-day profiles and conservative signal-node matches.

Inputs: official cached DTP CSV/ZIP; output contains no inferred OD or entry totals.
The retained detector-day CSV is sufficient to rebuild profiles without the ZIP.
"""
from pathlib import Path
from collections import defaultdict, Counter
from datetime import date
import csv, io, json, math, re, zipfile, hashlib, sys

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'netlogo/data/observed'
RUNTIME = ROOT / 'runtime'


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def normalise(text):
    text = text.upper().replace('STREET', '').replace('ROAD', '').replace('LANE', '')
    return re.sub(r'\b(ST|RD|LN)\b', '', text).strip()


def main():
    with (DATA / 'signals.csv').open(encoding='utf-8-sig') as stream:
        sites = []
        for row in csv.DictReader(stream):
            try:
                lat, lon = float(row['LATITUDE']), float(row['LONGITUDE'])
            except ValueError:
                continue
            if -37.823 < lat < -37.805 and 144.950 < lon < 144.977:
                sites.append(row)
    site_ids = {row['SITE_NO'] for row in sites}
    retained_file = DATA / 'cbd-detector-days.csv'
    audit_path = DATA / 'quality-audit.json'
    archive = DATA / 'scats-august-2026.zip'
    fields = ['site', 'detector', 'date'] + [f'v{i:02}' for i in range(96)]
    if archive.exists() and "--retained-only" not in sys.argv:
        audit = Counter()
        retained = []
        with zipfile.ZipFile(archive) as bundle:
            for filename in sorted(bundle.namelist()):
                if not filename.lower().endswith('.csv'):
                    continue
                with bundle.open(filename) as binary:
                    reader = csv.DictReader(io.TextIOWrapper(binary, encoding='utf-8-sig'))
                    for row in reader:
                        if row['NB_SCATS_SITE'] not in site_ids:
                            continue
                        audit['cbd_rows'] += 1
                        try:
                            values = [int(row[f'V{i:02}']) for i in range(96)]
                            day = date.fromisoformat(row['QT_INTERVAL_COUNT'][:10])
                            valid = (int(row['CT_RECORDS']) == 96 and int(row['CT_ALARM_24HOUR']) == 0
                                     and min(values) >= 0 and max(values) <= 900
                                     and sum(values) > 0 and sum(values) == int(row['QT_VOLUME_24HOUR']))
                        except (ValueError, KeyError):
                            audit['malformed_rows'] += 1
                            continue
                        if not valid:
                            audit['quality_rejected'] += 1
                            continue
                        retained.append([row['NB_SCATS_SITE'], row['NB_DETECTOR'], day.isoformat(), *values])
        # Reject conflicting duplicate records rather than counting them twice.
        keyed = defaultdict(list)
        for row in retained:
            keyed[tuple(row[:3])].append(row)
        clean = []
        for rows in keyed.values():
            if all(row == rows[0] for row in rows):
                clean.append(rows[0])
                audit['identical_duplicates_removed'] += len(rows) - 1
            else:
                audit['conflicting_duplicates_rejected'] += len(rows)
        clean.sort(key=lambda row: (row[2], int(row[0]), int(row[1])))
        with retained_file.open('w', newline='') as out:
            writer = csv.writer(out)
            writer.writerow(fields)
            writer.writerows(clean)
        audit['quality_passed'] = len(clean)
        payload = dict(audit)
        payload['archive_sha256'] = digest(archive)
        audit_path.write_text(json.dumps(payload, indent=2) + '\n')
        print('Filtered raw month:', dict(audit), flush=True)
    audit = json.loads(audit_path.read_text())
    with retained_file.open() as stream:
        records = list(csv.DictReader(stream))
    days = {'weekday': set(), 'weekend': set()}
    by_detector = defaultdict(lambda: {'weekday': {}, 'weekend': {}})
    for row in records:
        day = date.fromisoformat(row['date'])
        group = 'weekday' if day.weekday() < 5 else 'weekend'
        days[group].add(row['date'])
        by_detector[(row['site'], row['detector'])][group][row['date']] = [int(row[f'v{i:02}']) for i in range(96)]
    # Same detector cohort in both profiles, with at least 80% available days in each group.
    cohort = {key: groups for key, groups in by_detector.items()
              if all(len(groups[group]) >= math.ceil(0.8 * len(days[group])) for group in days)}
    assert cohort and all(days.values()), 'Insufficient observations'
    profiles = {}
    for group in days:
        # Equal detector weighting prevents missing days from changing the cohort mix.
        averages = [[sum(v[i] for v in groups[group].values()) / len(groups[group])
                     for i in range(96)] for groups in cohort.values()]
        profiles[group] = [sum(v[i] for v in averages) / len(averages) for i in range(96)]
    peak = max(value for values in profiles.values() for value in values)
    factors = {group: [round(value / peak, 8) for value in values] for group, values in profiles.items()}
    # Match only named intersections, within 45 m AND two matching street names.
    world = json.loads((RUNTIME / 'network-osm.json').read_text())
    nodes = {}
    for road in world['roads']:
        if road['kind'] in ('gate', 'access'):
            continue
        for key, point in [(road['from'], road['geometry'][0]), (road['to'], road['geometry'][-1])]:
            nodes.setdefault(key, {'point': point, 'streets': set()})['streets'].add(normalise(road['street']))
    matches = []
    for row in sites:
        if row['TYPE'] != 'INT':
            continue
        x = (float(row['LONGITUDE']) - 144.9635) * 11132 * math.cos(math.radians(-37.814))
        y = (float(row['LATITUDE']) + 37.814) * 11132
        names = {normalise(text) for text in row['SITE_NAME'].split('/')}
        candidates = [(math.dist(node['point'], [x, y]) * 10, key, node) for key, node in nodes.items()
                      if len(names & node['streets']) >= 2]
        if candidates:
            distance, key, node = min(candidates, key=lambda item: (item[0], item[1]))
            if distance <= 45:
                matches.append({'site': row['SITE_NO'], 'name': row['SITE_NAME'], 'node': key,
                                'x': node['point'][0], 'y': node['point'][1], 'distanceMetres': round(distance, 2)})
    metadata = {
        'version': 'dtp-cbd-aug2026-v1', 'retrieved': '2026-09-30', 'timezone': 'Australia/Melbourne (AEST, UTC+10 in August)',
        'periodStart': min(records, key=lambda row: row['date'])['date'],
        'periodEnd': max(records, key=lambda row: row['date'])['date'],
        'source': 'Department of Transport and Planning, Victoria', 'licence': 'CC BY 4.0',
        'countsUrl': 'https://opendata.transport.vic.gov.au/dataset/traffic-signal-volume-data',
        'signalsUrl': 'https://opendata.transport.vic.gov.au/dataset/victorian-traffic-signals',
        'inventorySitesInBounds': len(sites), 'cohortSites': len({key[0] for key in cohort}),
        'cohortDetectors': len(cohort), 'days': {group: len(values) for group, values in days.items()},
        'quality': audit, 'matchedSignalSites': len(matches), 'matchedNodes': len({item['node'] for item in matches}),
        'method': 'Same detector cohort; at least 80% valid days in each day group. Mean each detector across days, then mean across detectors. Divide both profiles by their shared maximum 15-minute mean. Counts are detector activations, not unique CBD arrivals.',
        'filters': '96 intervals, zero alarms, non-negative integer values, <=900 activations per interval, non-zero daily total matching supplied sum; conflicting duplicates excluded. Missing/zero-total days are excluded, not filled with zeros.',
        'limitations': 'No detector-direction mapping or OD estimation. Peak entry scale is user-assumed. Timing remains synthetic. Signal matches supplement inferred junctions; unmapped sites do not prove absence. Month includes events/weather and has not been classified as incident-free.',
        'factors': factors, 'signalMatches': matches,
        'signalsSha256': digest(DATA / 'signals.csv'), 'retainedSha256': digest(retained_file)
    }
    (DATA / 'summary.json').write_text(json.dumps(metadata, indent=2) + '\n')
    (RUNTIME / 'observed-data.json').write_text(json.dumps(metadata, indent=2) + '\n')
    def nl(value):
        if isinstance(value, list):
            return '[' + ' '.join(nl(item) for item in value) + ']'
        return json.dumps(value)
    (DATA / 'profiles.txt').write_text('\n'.join([
        nl(factors['weekday']), nl(factors['weekend']),
        nl([[item['x'], item['y']] for item in matches]), nl(metadata['version'])]) + '\n')
    print('Cohort:',metadata['cohortSites'],'sites,',metadata['cohortDetectors'],'detectors;',metadata['days'])
    print('Signal matches:',len(matches),'sites;',metadata['matchedNodes'],'model nodes')


if __name__ == '__main__':
    main()
