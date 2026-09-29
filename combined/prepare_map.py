"""Collapse degree-two OSM geometry chains; preserve every shape point for drawing."""
from pathlib import Path
import json, math, xml.etree.ElementTree as E
from collections import defaultdict
R=Path(__file__).resolve().parent
raw=E.parse(R.parent/'data/osm.xml').getroot()
coords={int(n.attrib['id']):((float(n.attrib['lon'])-144.9635)*11132*math.cos(math.radians(-37.814)),(float(n.attrib['lat'])+37.814)*11132) for n in raw.findall('node')}
inside={i for i,(x,y) in coords.items() if -118.8<x<118.8 and -100.2<y<100.2}
allowed={'primary','secondary','tertiary','residential','unclassified','primary_link','secondary_link','tertiary_link','living_street'}
def short(s):
 return s.replace(' Street',' St').replace(' Lane',' Ln')
edges={}
for way in raw.findall('way'):
 t={z.attrib['k']:z.attrib['v'] for z in way.findall('tag')}
 if t.get('highway') not in allowed or any(t.get(k) in ('no','private') for k in ('access','vehicle','motor_vehicle','motorcar')):continue
 ns=[int(n.attrib['ref']) for n in way.findall('nd')]
 direction=t.get('oneway','yes' if t.get('junction')=='roundabout' else 'no')
 if direction=='-1':ns.reverse()
 one=direction in ('yes','1','true','-1')
 try:speed=float(t.get('maxspeed','40'))
 except ValueError:speed=40
 for a,b in zip(ns,ns[1:]):
  if a not in inside or b not in inside or a==b or math.dist(coords[a],coords[b])<.05:continue
  def lane_count(reverse):
   key='lanes:backward' if reverse else 'lanes:forward'
   try:return max(1,min(4,int(t.get(key,t.get('lanes','1' if one else '2')))//(1 if key in t or one else 2)))
   except ValueError:return 1
  attrs=(short(t.get('name','Unnamed road')),speed,lane_count(False),t.get('highway'))
  edges[a,b]=attrs
  if not one:edges[b,a]=(attrs[0],speed,lane_count(True),attrs[3])
# Restrict to largest strongly connected component.
adj=defaultdict(set);rev=defaultdict(set)
for a,b in edges:adj[a].add(b);rev[b].add(a)
seen=set();order=[]
for start in sorted(set(adj)|set(rev)):
 stack=[(start,False)]
 while stack:
  a,done=stack.pop()
  if done:order.append(a);continue
  if a in seen:continue
  seen.add(a);stack.append((a,True));stack.extend((b,False) for b in sorted(adj[a]) if b not in seen)
seen=set();cs=[]
for start in reversed(order):
 if start in seen:continue
 stack=[start];seen.add(start);comp=set()
 while stack:
  a=stack.pop();comp.add(a)
  for b in rev[a]:
   if b not in seen:seen.add(b);stack.append(b)
 cs.append(comp)
keep=max(cs,key=len);edges={ab:v for ab,v in edges.items() if set(ab)<=keep}
neighbours=defaultdict(set)
for a,b in edges:neighbours[a].add(b);neighbours[b].add(a)
anchors={a for a,ns in neighbours.items() if len(ns)!=2}
# Preserve points where direction, name, speed or lane count changes.
for a,ns in neighbours.items():
 if len(ns)==2:
  b,c=sorted(ns)
  if edges.get((b,a))!=edges.get((a,c)) or edges.get((c,a))!=edges.get((a,b)):anchors.add(a)
# Break very long chains to keep polyline lookup and straight-link topology useful.
compressed=[]
for a in sorted(anchors):
 for b in sorted(adj[a]):
  if (a,b) not in edges:continue
  path=[a,b];prev=a;cur=b
  while cur not in anchors:
   nxt=next(x for x in neighbours[cur] if x!=prev)
   if (cur,nxt) not in edges:raise ValueError('Broken chain')
   path.append(nxt);prev,cur=cur,nxt
   if cur==a:break
  if a!=cur:compressed.append((a,cur,edges[a,b],path))
# NetLogo has one directed link for a node pair. Keep parallel routes by splitting each at an internal point.
counts=defaultdict(int)
for a,b,_,_ in compressed:counts[a,b]+=1
for a,b,_,path in compressed:
 if counts[a,b]>1 and len(path)>2:anchors.add(path[len(path)//2])
result={}
for a,b,attrs,path in compressed:
 chunk=[path[0]]
 for k in path[1:]:
  chunk.append(k)
  if k in anchors:
   result[chunk[0],k]=(attrs,chunk);chunk=[k]
used=sorted({a for pair in result for a in pair});ids={a:i for i,a in enumerate(used)}
node_rows=[[a,*[round(v,6) for v in coords[a]]] for a in used]
rows=[]
for (a,b),(attrs,path) in sorted(result.items()):
 name,speed,lanes,kind=attrs
 pts=[[round(v,6) for v in coords[k]] for k in path]
 length=sum(math.dist(coords[x],coords[y])*10 for x,y in zip(path,path[1:]))
 rows.append([ids[a],ids[b],name,round(length,6),speed,lanes,pts])
def nl(v):
 if isinstance(v,list):return '['+' '.join(nl(x) for x in v)+']'
 if isinstance(v,str):return json.dumps(v)
 return str(v)
(R/'data').mkdir(exist_ok=True)
(R/'data/map.txt').write_text(nl(node_rows)+'\n'+nl(rows)+'\n')
(R/'data/map-summary.json').write_text(json.dumps({'source':'OpenStreetMap contributors; ODbL','downloaded':'2026-09-29','nodes':len(used),'directed_links':len(rows),'preserved_geometry_points':sum(len(x[-1]) for x in rows)},indent=2))
print(len(used),'nodes',len(rows),'links')
