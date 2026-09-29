"""Build a self-contained NetLogo 7 model from a cached public OSM extract."""
from pathlib import Path
import json, math, re, xml.etree.ElementTree as ET
from collections import defaultdict
ROOT = Path(__file__).resolve().parent
s,w,n,e = -37.823,144.950,-37.805,144.977
cx,cy=(w+e)/2,(s+n)/2
sx=111320*math.cos(math.radians(cy))/10
sy=111320/10
if (ROOT/'data/osm.xml').exists():
    raw=ET.parse(ROOT/'data/osm.xml').getroot()
    nodes={int(x.attrib['id']): (float(x.attrib['lon']),float(x.attrib['lat'])) for x in raw.findall('node')}
    ways=[{'id':int(x.attrib['id']), 'nodes':[int(y.attrib['ref']) for y in x.findall('nd')], 'tags':{t.attrib['k']:t.attrib['v'] for t in x.findall('tag')}} for x in raw.findall('way')]
else:
    raw=json.loads((ROOT/'data/osm.json').read_text())
    nodes={x['id']:(x['lon'],x['lat']) for x in raw['elements'] if x['type']=='node'}
    ways=[x for x in raw['elements'] if x['type']=='way']
xy={k:((lon-cx)*sx,(lat-cy)*sy) for k,(lon,lat) in nodes.items() if w<=lon<=e and s<=lat<=n}
allowed={'primary','secondary','tertiary','residential','unclassified','primary_link','secondary_link','tertiary_link','living_street'}
edges={}
for way in ways:
    tags=way['tags']
    if tags.get('highway') not in allowed: continue
    if any(tags.get(key) in ('no','private') for key in ('access','vehicle','motor_vehicle','motorcar')): continue
    ids=way['nodes']
    direction=tags.get('oneway','yes' if tags.get('junction')=='roundabout' else 'no')
    if direction=='-1': ids=ids[::-1]
    speed=re.match(r'^\d+', tags.get('maxspeed','40'))
    speed=float(speed[0]) if speed else 40
    name=tags.get('name','Unnamed road')
    for a,b in zip(ids,ids[1:]):
        if a not in xy or b not in xy or a==b: continue
        length=math.dist(xy[a],xy[b])*10
        if length<0.05: continue
        edges[a,b]=(name,length,speed)
        if direction not in ('yes','1','true','-1'): edges[b,a]=(name,length,speed)
# Keep largest strongly connected component: all initial OD pairs are routable.
adj=defaultdict(list); rev=defaultdict(list)
for a,b in edges: adj[a].append(b); rev[b].append(a)
allnodes=set(adj)|set(rev)
seen=set(); order=[]
for start in sorted(allnodes):
    if start in seen: continue
    stack=[(start,False)]
    while stack:
        a,done=stack.pop()
        if done: order.append(a); continue
        if a in seen: continue
        seen.add(a); stack.append((a,True))
        stack.extend((b,False) for b in adj[a] if b not in seen)
seen=set(); components=[]
for start in reversed(order):
    if start in seen: continue
    comp=set(); stack=[start]; seen.add(start)
    while stack:
        a=stack.pop(); comp.add(a)
        for b in rev[a]:
            if b not in seen: seen.add(b); stack.append(b)
    components.append(comp)
keep=max(components,key=len)
ids={k:i for i,k in enumerate(sorted(keep))}
node_rows=[[k,round(xy[k][0],5),round(xy[k][1],5)] for k in sorted(keep)]
edge_rows=[[ids[a],ids[b],name,round(length,4),speed] for (a,b),(name,length,speed) in edges.items() if a in keep and b in keep]
# One label per main street, staggered to avoid a single central label cluster.
label_names=['Flinders Street','Collins Street','Bourke Street','Lonsdale Street','La Trobe Street','Spencer Street','King Street','William Street','Queen Street','Elizabeth Street','Russell Street','Exhibition Street','Spring Street']
labels=[]
for i,name in enumerate(label_names):
    candidates=[a for (a,b),v in edges.items() if v[0]==name and a in keep]
    if candidates:
        candidates=sorted(set(candidates),key=lambda a:xy[a][0]+xy[a][1])
        a=candidates[int((0.25+(i%3)*0.22)*(len(candidates)-1))]
        labels.append([round(xy[a][0]+2,4),round(xy[a][1]+2,4),name])
def nl(v):
    if isinstance(v,list): return '['+' '.join(nl(x) for x in v)+']'
    if isinstance(v,str): return json.dumps(v)
    return str(v)
(ROOT/'data/network.txt').write_text('\n'.join(nl(x) for x in [node_rows,edge_rows,labels])+'\n')
base=ET.parse('/Applications/NetLogo 7.0.4/models/Sample Models/Social Science/Traffic Basic.nlogox').getroot()
model=ET.Element('model',version='NetLogo 7.0.4',snapToGrid='true')
ET.SubElement(model,'code').text=(ROOT/'traffic.nls').read_text()
widgets=ET.SubElement(model,'widgets')
def widget(tag,**attrs): return ET.SubElement(widgets,tag,{k:str(v) for k,v in attrs.items()})
widget('view',x=280,y=90,width=966,height=818,minPxcor=-120,maxPxcor=120,minPycor=-102,maxPycor=102,patchSize=4,fontSize=10,wrappingAllowedX='false',wrappingAllowedY='false',showTickCounter='true',tickCounterLabel='seconds',frameRate=30,updateMode=1)
def button(text,code,x,y,width=120,forever=False):
    z=widget('button',x=x,y=y,width=width,height=38,forever=str(forever).lower(),kind='Observer',disableUntilTicks='false',display=text); z.text=code
button('Setup','setup',10,10)
button('Go / pause','go',140,10,forever=True)
button('Click to close','inspect-map',10,56,250,True)
button('Reopen all','reopen-all',10,102)
button('List closures','list-closures',140,102)
button('Choose a street','choose-street',280,20,150)
selection=widget('monitor',x=440,y=10,width=260,height=60,display='Selected street',precision=0,fontSize=11)
selection.text='selected-street'
button('Close street','close-selected-street',710,20)
button('Reopen street','reopen-selected-street',840,20)
status=widget('monitor',x=980,y=10,width=265,height=60,display='Selected street status',precision=0,fontSize=11)
status.text='selected-street-status' 
def slider(name,y,default,low,high,step):
    widget('slider',x=10,y=y,width=250,height=50,display=name,variable=name,min=low,max=high,step=step,default=default,direction='Horizontal')
slider('initial-cars',154,100,0,500,10)
slider('arrivals-per-minute',212,30,0,180,5)
slider('signal-seconds',270,30,10,90,5)
slider('seed-value',328,42,1,100,1)
# Inspect a sample switch's XML format if changing NetLogo versions.
widget('switch',x=10,y=388,width=250,height=35,display='signals?',variable='signals?',on='true')
widget('switch',x=10,y=430,width=250,height=35,display='close-whole-street?',variable='close-whole-street?',on='false')
for y,title,expr in [(480,'Cars on map','count cars'),(540,'Completed trips','completed'),(600,'Mean trip (seconds)','average-trip-seconds'),(660,'Stopped cars','count cars with [speed-ms < 0.1]'),(720,'Unroutable trips','failed-trips')]:
    z=widget('monitor',x=10,y=y,width=250,height=50,display=title,precision=1,fontSize=11);z.text=expr
info='''## MELBOURNE CBD TRAFFIC SANDBOX
Click Setup, then Go / pause. Enable Click to close, then click a street segment to close/reopen it. Red means closed. Close-whole-street? applies the edit to every segment with that street name. Disable Click to close after editing. Use Choose a street, then Close street or Reopen street to edit any named street in the loaded graph. Multiple closures remain active. Selected street status shows Open, Partly closed or Closed. List closures shows all streets with closed segments. These controls work while paused or running. Unnamed roads can be closed using the map.

The map is real OpenStreetMap road geometry, projected locally at 10 metres per world unit. North is up. One tick is one second. Cars keep left, follow directed roads, queue, and reroute when their next edge is closed. Cars already on a closed segment finish it. Change initial-cars and seed-value before Setup; other controls work live.

Traffic demand, signals and driving behaviour are illustrative. Signals are inferred from road branching, not real signal records. Routes minimise distance, not congestion. No lane changing, turn restrictions, hook-turn rules, trams, buses, pedestrians, collision/conflict resolution or live traffic feeds. Access filtering is basic and does not interpret conditional restrictions. The largest strongly connected road component is retained. Trip origins/destinations are sampled from geometry nodes, not measured boundary demand. Closure-stranded trips are removed and counted as unroutable. Compare scenarios using the same seed and demand, and track failures as well as completed trips. This is an educational sandbox, not a calibrated traffic forecast.

## MAP CREDIT
© OpenStreetMap contributors. https://www.openstreetmap.org/copyright
Map data available under the Open Database License (ODbL). Cached public extract downloaded 2026-09-29. No network access is used by the simulation.
'''
ET.SubElement(model,'info').text=info
for tag in ('turtleShapes','linkShapes'):
    element = base.find(tag)
    if tag == 'linkShapes':
        for indicator in element.findall('.//indicator/shape'):
            for child in list(indicator): indicator.remove(child)
    model.append(element)
ET.SubElement(model,'previewCommands').text='setup\nrepeat 120 [go]'
ET.indent(model)
ET.ElementTree(model).write(ROOT/'Melbourne CBD Traffic.nlogox',encoding='utf-8',xml_declaration=True)
summary={'nodes':len(node_rows),'directed_edges':len(edge_rows),'street_names':len({x[2] for x in edge_rows}),'discarded_nodes':len(allnodes)-len(keep),'bbox':[w,s,e,n]}
(ROOT/'data/summary.json').write_text(json.dumps(summary,indent=2))
print(summary)
