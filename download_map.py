"""One-time public map download. Simulation itself has no network dependency."""
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET
root=Path(__file__).resolve().parent/'data'
root.mkdir(exist_ok=True)
merged=ET.Element('osm',version='0.6',attribution='© OpenStreetMap contributors',license='https://opendatacommons.org/licenses/odbl/1-0/')
seen=set()
for i,(w,s,e,n) in enumerate([(144.950,-37.823,144.9635,-37.814),(144.9635,-37.823,144.977,-37.814),(144.950,-37.814,144.9635,-37.805),(144.9635,-37.814,144.977,-37.805)]):
    path=root/f'tile-{i}.osm'
    if not path.exists():
        url=f'https://api.openstreetmap.org/api/0.6/map?bbox={w},{s},{e},{n}'
        data=subprocess.check_output(['curl','-fsS','--max-time','40','--user-agent','MelbourneTrafficEducationalPrototype/1.0',url])
        ET.fromstring(data)
        path.write_bytes(data)
    tile=ET.parse(path).getroot()
    for element in tile:
        if element.tag not in ('node','way','relation'):continue
        key=(element.tag,element.attrib['id'])
        if key not in seen: seen.add(key);merged.append(element)
    print(f'Loaded tile {i+1}/4',flush=True)
ET.ElementTree(merged).write(root/'osm.xml',encoding='utf-8',xml_declaration=True)
print('Combined public map saved.',flush=True)
