import bpy,sys,math
sys.path.insert(0,'/data/v2/blender');import animlib
from mathutils import Vector
OUT=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else '/data/v2/out/thief.glb'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/data/v2/user/thief.glb')
sc=bpy.context.scene;sc.render.fps=30
for o in list(sc.objects):
    if o.name=='Icosphere': bpy.data.objects.remove(o)
arm=[o for o in sc.objects if o.type=='ARMATURE'][0]
walk=arm.animation_data.action;walk.name='Walk'
A=animlib.Animator(arm)
L1,L2,HIP,ANK=62.3,57.4,140.6,22.4
def leg(side,f,lift=0,drop=0,out=0,toe=0):
    # 2-bone IK in sagittal plane. f: ankle forward offset (+forward) ; returns semantic dict pair
    hz=HIP+drop; dz=hz-(ANK+lift); D=min(L1+L2-0.5,math.hypot(f,dz))
    base=math.atan2(f,dz)
    a=base+math.acos((L1*L1+D*D-L2*L2)/(2*L1*D))
    b=math.pi-math.acos((L1*L1+L2*L2-D*D)/(2*L1*L2))
    a,b=math.degrees(a),math.degrees(b)
    return {side+'UpLeg':{'fwd':a,'out':out},side+'Leg':{'bend':b},side+'Foot':{'up':b-a+toe}}
def merge(*ds):
    r={}
    for d in ds:
        for k,v in d.items(): r.setdefault(k,{}).update(v)
    return r
def key(frame,spec,hips=(0,0,0)):
    drop=hips[2]
    A.pose(frame,spec,hips=hips)
def push_nla(action,loop=True):
    tr=arm.animation_data.nla_tracks.new();tr.name=action.name
    st=tr.strips.new(action.name,int(action.frame_range[0]),action);st.name=action.name
    arm.animation_data.action=None
def S(t): return math.sin(t*2*math.pi)
def C(t): return math.cos(t*2*math.pi)
# keep original walk
push_nla(walk)
# ---------- IDLE (sneaky ready stance, breathing, glance) 72f
A.new_action('Idle')
for f in range(0,73,4):
    t=f/72; br=S(t*2); look=S(t)
    d=-8+br*1.5
    spec=merge(
      {'Spine':{'pitch':10+br*1.5},'Spine1':{'pitch':6+br},'Spine2':{'pitch':3},'Neck':{'pitch':-6},'Head':{'pitch':-8-br,'yaw':look*18},
       'LShoulder':{'down':6},'RShoulder':{'down':6},
       'LArm':{'down':66+br*2,'swing':14},'RArm':{'down':66+br*2,'swing':14},
       'LForeArm':{'bend':38+br*3},'RForeArm':{'bend':38+br*3},'LHand':{'down':10},'RHand':{'down':10}},
      leg('L',7,drop=d,out=4),leg('R',-5,drop=d,out=4))
    key(f+1,spec,hips=(0,0,d))
push_nla(bpy.data.actions['Idle'])
# ---------- STEAL (leaning over case, working hands) 36f loop
A.new_action('Steal')
for f in range(0,37,3):
    t=f/36; w=S(t*2); w2=C(t*2)
    d=-16+abs(w)*1.5
    spec=merge(
      {'Spine':{'pitch':22},'Spine1':{'pitch':12},'Spine2':{'pitch':6,'yaw':w*4},'Neck':{'pitch':-4},'Head':{'pitch':-2+w2*3,'roll':w*4},
       'LArm':{'down':28+w*10,'fwd':62},'RArm':{'down':28-w*10,'fwd':62},
       'LForeArm':{'bend':62+w*20},'RForeArm':{'bend':62-w*20},'LHand':{'down':-12+w2*14},'RHand':{'down':-12-w2*14}},
      leg('L',16,drop=d,out=5),leg('R',-14,drop=d,out=5))
    key(f+1,spec,hips=(0,-6,d))
push_nla(bpy.data.actions['Steal'])
# ---------- PUSH (wind-up + shove) 16f
A.new_action('Push')
P0=merge({'Spine':{'pitch':4,'yaw':10},'Spine1':{'pitch':0},'Head':{'pitch':-6},'LArm':{'down':55,'swing':-20},'RArm':{'down':55,'swing':-20},'LForeArm':{'bend':110},'RForeArm':{'bend':110}},leg('L',10,drop=-14),leg('R',-12,drop=-14))
P1=merge({'Spine':{'pitch':24,'yaw':-6},'Spine1':{'pitch':10},'Head':{'pitch':-22},'LArm':{'down':4,'fwd':84},'RArm':{'down':4,'fwd':84},'LForeArm':{'bend':6},'RForeArm':{'bend':6},'LHand':{'down':-40},'RHand':{'down':-40}},leg('L',34,drop=-20),leg('R',-30,drop=-20,toe=-20))
P2=merge({'Spine':{'pitch':16},'Spine1':{'pitch':6},'Head':{'pitch':-12},'LArm':{'down':30,'fwd':55},'RArm':{'down':30,'fwd':55},'LForeArm':{'bend':30},'RForeArm':{'bend':30}},leg('L',22,drop=-16),leg('R',-18,drop=-16))
key(1,P0,(0,6,-14));key(5,P1,(0,-20,-20));key(9,P1,(0,-22,-20));key(16,P2,(0,-10,-16))
push_nla(bpy.data.actions['Push'])
# ---------- DASH (low ninja lunge) 12f
A.new_action('Dash')
D0=merge({'Spine':{'pitch':30},'Spine1':{'pitch':14},'Spine2':{'pitch':6},'Neck':{'pitch':-12},'Head':{'pitch':-26},'LArm':{'down':72,'swing':-55},'RArm':{'down':72,'swing':-55},'LForeArm':{'bend':12},'RForeArm':{'bend':12},'LHand':{'down':20},'RHand':{'down':20}},leg('L',40,drop=-26,lift=4),leg('R',-38,drop=-26,toe=-25))
D1=merge(D0,leg('L',30,drop=-22),leg('R',-44,drop=-22,lift=12,toe=-30))
key(1,D0,(0,-8,-26));key(6,D1,(0,-14,-22));key(12,D0,(0,-8,-26))
push_nla(bpy.data.actions['Dash'])
# ---------- RUN (fast ninja run with bag) 18f loop
A.new_action('Run')
for f in range(0,19,2):
    t=f/18; s=S(t); c=C(t)
    d=-14+abs(c)*6
    spec=merge({'Spine':{'pitch':22,'yaw':s*6},'Spine1':{'pitch':8},'Head':{'pitch':-20,'yaw':-s*4},
      'LArm':{'down':70,'swing':-s*45},'RArm':{'down':70,'swing':s*45},'LForeArm':{'bend':70},'RForeArm':{'bend':70}},
      leg('L',s*34,lift=max(0,-c)*22*(1 if s<0.6 else 1),drop=d,toe=-10*max(0,c)),leg('R',-s*34,lift=max(0,c)*22,drop=d,toe=-10*max(0,-c)))
    key(f+1,spec,hips=(0,0,d))
push_nla(bpy.data.actions['Run'])
# ---------- STUNNED (dizzy wobble) 40f loop
A.new_action('Stunned')
for f in range(0,41,4):
    t=f/40; s=S(t); c=C(t)
    d=-20+s*3
    spec=merge({'Spine':{'pitch':14+c*5,'roll':s*9},'Spine1':{'roll':s*6,'pitch':6},'Neck':{'roll':c*12},'Head':{'roll':s*16,'pitch':-4+c*10,'yaw':c*12},
      'LArm':{'down':78+s*6,'swing':10+c*12},'RArm':{'down':78-s*6,'swing':10-c*12},'LForeArm':{'bend':20},'RForeArm':{'bend':20},'LHand':{'down':20},'RHand':{'down':20}},
      leg('L',8+s*4,drop=d,out=8),leg('R',-6+s*4,drop=d,out=8))
    key(f+1,spec,hips=(s*6,0,d))
push_nla(bpy.data.actions['Stunned'])
# ---------- HIDE (squeeze/crouch into cabinet) 18f
A.new_action('Hide')
H0=merge({'Spine':{'pitch':12},'Head':{'pitch':-6},'LArm':{'down':66,'swing':14},'RArm':{'down':66,'swing':14},'LForeArm':{'bend':38},'RForeArm':{'bend':38}},leg('L',6,drop=-8),leg('R',-5,drop=-8))
H1=merge({'Spine':{'pitch':32},'Spine1':{'pitch':14},'Neck':{'pitch':-6},'Head':{'pitch':-10,'yaw':20},'LArm':{'down':72,'fwd':40},'RArm':{'down':72,'fwd':40},'LForeArm':{'bend':120},'RForeArm':{'bend':120},'LHand':{'down':10},'RHand':{'down':10}},leg('L',22,drop=-46),leg('R',-6,drop=-46,toe=-10))
key(1,H0,(0,0,-8));key(10,H1,(0,4,-46));key(18,merge(H1,{'Head':{'pitch':-14,'yaw':-18}}),(0,4,-48))
push_nla(bpy.data.actions['Hide'])
# ---------- CHEER (jump, fists up) 24f loop
A.new_action('Cheer')
for f in range(0,25,3):
    t=f/24; up=max(0,S(t)); c=C(t)
    z=up*34-10*(1-up)
    spec=merge({'Spine':{'pitch':-6},'Spine1':{'pitch':-4},'Head':{'pitch':-14},
      'LArm':{'down':-58-up*12,'fwd':18},'RArm':{'down':-58-up*12,'fwd':18},'LForeArm':{'bend':50-up*30},'RForeArm':{'bend':50-up*30}},
      leg('L',4,drop=-10*(1-up),lift=0),leg('R',-4,drop=-10*(1-up)))
    key(f+1,spec,hips=(0,0,z))
push_nla(bpy.data.actions['Cheer'])
# ---------- CAUGHT (knocked down, sit back) 20f
A.new_action('Caught')
C0=merge({'Spine':{'pitch':-18},'Spine1':{'pitch':-8},'Head':{'pitch':14,'roll':10},'LArm':{'down':40,'swing':-30},'RArm':{'down':40,'swing':-30},'LForeArm':{'bend':20},'RForeArm':{'bend':20}},{'LUpLeg':{'fwd':80,'out':10},'LLeg':{'bend':40},'RUpLeg':{'fwd':70,'out':10},'RLeg':{'bend':60}})
key(1,merge(H0),(0,0,-8));key(8,C0,(0,24,-92));key(20,merge(C0,{'Head':{'roll':-10,'pitch':6}}),(0,26,-94))
push_nla(bpy.data.actions['Caught'])
for a in bpy.data.actions:
    for fc in a.fcurves:
        for k in fc.keyframe_points: k.interpolation='BEZIER'
arm.animation_data.action=None
if '--render' in sys.argv:
    bpy.ops.wm.save_as_mainfile(filepath='/data/v2/blender/thief_anim.blend')
else:
    bpy.ops.object.select_all(action='SELECT')
    import os;os.makedirs(os.path.dirname(OUT),exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_skins=True,export_force_sampling=True,export_frame_step=1,export_optimize_animation_size=True)
    bpy.ops.wm.save_as_mainfile(filepath='/data/v2/blender/thief_anim.blend')
