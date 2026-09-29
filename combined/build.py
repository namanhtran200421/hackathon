from pathlib import Path
import xml.etree.ElementTree as E
R=Path(__file__).resolve().parent
source=E.parse(R/'originals/Hoddle_Grid_Traffic.nlogox').getroot()
r=E.Element('model',version='NetLogo 7.0.4',snapToGrid='true')
E.SubElement(r,'code').text=(R/'combined.nls').read_text()
w=E.SubElement(r,'widgets')
def widget(tag,**kw):return E.SubElement(w,tag,{k:str(v) for k,v in kw.items()})
def button(text,code,x,y,width=145,forever=False):
 z=widget('button',x=x,y=y,width=width,height=36,forever=str(forever).lower(),kind='Observer',disableUntilTicks=str(code!='setup').lower(),display=text);z.text=code
button('Setup','setup',10,10)
button('Go / pause','go',165,10,forever=True)
button('Click roads','click-to-close',10,52,forever=True)
button('Step 1 second','go',165,52)
def slider(var,y,default,low,high,step):
 widget('slider',x=10,y=y,width=300,height=48,display=var,variable=var,min=low,max=high,step=step,default=default,direction='Horizontal')
for args in [('demand-veh-per-hour',100,2500,0,12000,250),('through-traffic-%',150,50,0,100,5),('informed-drivers-%',200,50,0,100,5),('speed-limit-kmh',250,40,20,60,5),('cycle-length',300,80,40,150,5),('ew-green-share',350,50,20,80,5),('warm-up-s',400,60,0,900,30),('measure-s',450,600,60,3600,60),('seed',500,42,1,100,1),('reroute-interval',550,60,10,300,10),('route-noise',600,.1,0,.5,.05)]:slider(*args)
def switch(var,x,y,on=False,width=145):widget('switch',x=x,y=y,width=width,height=38,display=var,variable=var,on=str(on).lower())
switch('fixed-seed?',10,655,True);switch('hook-turns?',165,655,False)
switch('close-whole-street?',10,698,True,300)
def chooser(var,choices,x,y,width=300):
 z=widget('chooser',x=x,y=y,width=width,height=58,display=var,variable=var,current=0)
 for value in choices:E.SubElement(z,'choice',type='string',value=value)
chooser('signal-coordination',['random offsets','green wave (east-west)'],10,742)
chooser('network-source',['Real OSM map','Schematic Hoddle grid'],330,10,290)
chooser('view-mode',['congestion','volume','change vs baseline'],630,10,270)
button('Save baseline','save-baseline',915,20,180)
button('Export CSV','export-link-results',1105,20,180)
widget('view',x=330,y=82,width=966,height=824,minPxcor=-120,maxPxcor=120,minPycor=-102,maxPycor=102,patchSize=4,fontSize=10,wrappingAllowedX='false',wrappingAllowedY='false',showTickCounter='true',tickCounterLabel='seconds',frameRate=30,updateMode=1)
button('Choose street','choose-street',10,816)
button('Choose section','choose-section',165,816)
chooser('closure-type',['Both directions','East / north direction','One lane each direction'],10,858)
button('Apply closure','close-selection',10,924)
button('Reopen selected','reopen-selection',165,924)
button('Reopen all','reopen-all',10,965,300)
switch('scheduled-closure?',10,1008,False,300)
slider('closure-start-min',1052,2,0,60,1)
def monitor(text,expr,x,y,width=150):
 z=widget('monitor',x=x,y=y,width=width,height=52,display=text,precision=1,fontSize=11);z.text=expr
for i,(title,expr) in enumerate([('Cars','count cars'),('Waiting at gates','queued-at-gates'),('Completed','trips-done'),('Mean trip / min','mean-trip-time-min'),('Stranded','stranded-count'),('Elapsed / sec','ticks')]):monitor(title,expr,330+i*161,916)
monitor('Selected extent','selection-label',330,978,475)
monitor('Closures','closure-desc',820,978,475)
widget('output',x=330,y=1040,width=965,height=110,fontSize=11)
info='''## COMBINED MELBOURNE TRAFFIC LAB
Combines the supplied Hoddle Grid lane-based traffic engine with our cached real OpenStreetMap map, polyline rendering and reliable street/map selection. Both source models are preserved in originals/.

## QUICK START
Leave network-source = Real OSM map. Click Setup, then Go / pause. Click Choose street (Collins St is the initial selection) and Apply closure, or enable Click roads and click a road. Closed directions are red; reduced lanes magenta. Reopen selected or Reopen all restores capacity, including lanes. Change network-source and press Setup to use the original schematic grid. Geometry, topology, ordinary OSM one-way tags and available numeric speed/lane tags are real; traffic demand, signals and destination sites are synthetic. Hook turns are an optional schematic-only heuristic, off by default; no real hook-turn locations are claimed.

All closures accumulate. Choose section narrows the scope; section 0 means whole street. In OSM mode section numbers identify collapsed geometry chains between topology/attribute changes, not city block numbers. Clicking chooses the nearest polyline, not its straight chord. East / north applies to links with heading in [315,360) or [0,135). A lane reduction on a one-lane road fully closes that direction. Existing vehicles drain out; new vehicles avoid closed directions. Closed lanes drain; lanes do not merge mid-link.

## BASELINE
Run with no closures, wait through warm-up plus at least 60 seconds of measurement, Save baseline, then Setup and apply closures. The baseline survives Setup only with matching configuration; changing network or demand/signal/measurement settings clears it. Change-vs-baseline is grey until a baseline is saved. Demand generation uses an independent tick-seeded random stream, so baseline and closure runs receive the same arrivals and OD requests with the same seed. Travel-time averages include trips completed in the measurement window, even if they started in warm-up. Always compare waiting, stranded, active and completed counts together. CSV is written beside the model as combined-link-results.csv.

## LIMITS
This is an exploratory traffic simulation, not a calibrated forecast or safety assessment. No actual SCATS counts, turn restrictions, time-dependent access, real parking capacities, trams, buses or pedestrians. Signals are inferred/synthetic and turn conflicts simplified. Geometry-chain compression retains all OSM shape points; movement carries overshoot to the next link but advances at most one link per second. Destination gates D are illustrative, not real car parks. Continuous congestion-based route choice may produce loops; road closures can strand trips. Green-wave offsets in OSM mode are an approximation. Setup is required after changing controls that affect speed, signal plans, random seed, demand comparison or network source.

## CREDITS
Hoddle Grid Traffic prototype supplied by the user's groupmate; its Info tab credits Wilensky (2003), NetLogo Traffic Grid. Original files are preserved. Real-map data © OpenStreetMap contributors, https://www.openstreetmap.org/copyright ; ODbL https://opendatacommons.org/licenses/odbl/1-0/ . Public extract downloaded 2026-09-29. Runtime is offline.
'''
# Keep all everyday controls within a laptop-sized interface.
positions={
 'Choose street':(330,82,145), 'Choose section':(485,82,145),
 'Apply closure':(640,82,145), 'Reopen selected':(795,82,145),
 'Reopen all':(950,82,125),
}
for z in w:
 if z.tag=='button' and z.get('display') in positions:
  x,y,width=positions[z.get('display')]; z.set('x',str(x)); z.set('y',str(y)); z.set('width',str(width))
 if z.tag=='chooser' and z.get('variable')=='closure-type':
  z.set('x','1085'); z.set('y','76'); z.set('width','210')
 if z.tag=='view':
  z.set('y','184'); z.set('patchSize','3'); z.set('width','725'); z.set('height','617')
 if z.tag=='monitor':
  title=z.get('display')
  if title=='Selected extent':
   z.set('x','330'); z.set('y','124'); z.set('width','730')
  elif title=='Closures':
   z.set('x','1070'); z.set('y','486'); z.set('width','225')
  else:
   i=['Cars','Waiting at gates','Completed','Mean trip / min','Stranded','Elapsed / sec'].index(title)
   z.set('x','1070'); z.set('y',str(140+i*57)); z.set('width','225')
 if z.tag=='output':
  z.set('x','1070'); z.set('y','546'); z.set('width','225'); z.set('height','252')
 if z.get('variable')=='scheduled-closure?':z.set('x','330'); z.set('y','812'); z.set('width','220')
 if z.get('variable')=='closure-start-min':z.set('x','565'); z.set('y','806'); z.set('width','235')
legend=widget('note',x=815,y=806,width=480,height=65,fontSize=11,markdown='false',textColorLight=-16777216,textColorDark=-1,backgroundLight=0,backgroundDark=0)
legend.text='Red thick = closed | Magenta = lane reduced\nD = synthetic destination | Signals/demand are illustrative\nChoose a map, then Setup. Closures can be changed live.'
E.SubElement(r,'info').text=info
for name in ['turtleShapes','linkShapes']:r.append(source.find(name))
E.SubElement(r,'previewCommands').text='setup\nrepeat 120 [go]'
E.indent(r)
E.ElementTree(r).write(R/'Melbourne Traffic Combined.nlogox',encoding='utf-8',xml_declaration=True)
(R/'README.md').write_text(info.replace('## COMBINED','# COMBINED',1))
print('Built combined model')
