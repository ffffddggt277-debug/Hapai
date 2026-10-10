import bpy,bmesh,math,os,sys,mathutils
from mathutils import Vector
OUT='/data/v2/out/models';os.makedirs(OUT,exist_ok=True)
PH='/data/v2/ph';US='/data/v2/user';KN='/data/v2/dl'
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
def imp(path):
    before=set(bpy.data.objects)
    if path.endswith('.gltf') or path.endswith('.glb'): bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]
def bbox(objs):
    mn=Vector((1e9,)*3);mx=Vector((-1e9,)*3)
    for o in objs:
        if o.type!='MESH':continue
        for c in o.bound_box:
            w=o.matrix_world@Vector(c);mn=Vector(map(min,mn,w));mx=Vector(map(max,mx,w))
    return mn,mx
def flatten(objs):
    # bake hierarchy transforms into meshes, remove empties
    bpy.context.view_layer.update()
    meshes=[o for o in objs if o.type=='MESH']
    for o in meshes:
        mw=o.matrix_world.copy();o.parent=None;o.matrix_world=mw
    for o in objs:
        if o.type!='MESH' and o.name in bpy.data.objects: bpy.data.objects.remove(o)
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0]
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    return meshes
def decimate(meshes,maxtris):
    tot=sum(len(o.data.polygons) for o in meshes)*1.6
    if tot<=maxtris: return
    r=max(0.05,maxtris/tot)
    for o in meshes:
        if o.data.shape_keys:
            bpy.context.view_layer.objects.active=o;o.shape_key_clear()
        m=o.modifiers.new('dec','DECIMATE');m.ratio=r
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier='dec')
def fit(meshes,height=None,width=None,depth=None,zscale=None):
    mn,mx=bbox(meshes);size=mx-mn
    s=height/size.z if height else width/size.x if width else depth/size.y
    for o in meshes:
        for v in o.data.vertices:
            v.co=Vector(((v.co.x-(mn.x+mx.x)/2)*s,(v.co.y-(mn.y+mx.y)/2)*s,(v.co.z-mn.z)*s*(zscale or 1)))
        o.data.update()
    return s
def textures(size=512):
    for img in bpy.data.images:
        if img.size[0]>size: img.scale(size,size)
def export(name,anim=False,sel=None):
    bpy.ops.object.select_all(action='DESELECT')
    objs=sel or [o for o in bpy.context.scene.objects]
    for o in objs: o.select_set(True)
    textures_done=True
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/{name}.glb',export_format='GLB',use_selection=True,export_animations=anim,export_image_format='JPEG',export_jpeg_quality=82,export_apply=True)
    print('EXPORT',name,os.path.getsize(f'{OUT}/{name}.glb')//1024,'KB')
def join(meshes,name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();meshes[0].name=name;return meshes[0]
def mat(name,color,metal=0,rough=.5,emit=None,alpha=1):
    m=bpy.data.materials.new(name);m.use_nodes=True;n=m.node_tree.nodes['Principled BSDF']
    n.inputs['Base Color'].default_value=(*color,1);n.inputs['Metallic'].default_value=metal;n.inputs['Roughness'].default_value=rough
    if emit: n.inputs['Emission Color'].default_value=(*emit,1);n.inputs['Emission Strength'].default_value=2
    if alpha<1: n.inputs['Alpha'].default_value=alpha;m.blend_method='BLEND'
    return m
# ---------- simple prop pipeline
def prop(src,name,maxtris=4000,tex=512,rot=None,**kw):
    reset();objs=imp(src);ms=flatten(objs)
    if rot:
        R=mathutils.Euler(rot).to_matrix().to_4x4()
        for o in ms: o.data.transform(R)
    decimate(ms,maxtris);fit(ms,**kw);textures(tex);o=join(ms,name) if len(ms)>1 else ms[0]
    export(name)
ITEMS={ # display items (fit inside case top)
 'bust':(f'{PH}/marble_bust_01/marble_bust_01.gltf',dict(height=.5)),
 'horse':(f'{PH}/horse_statue_01/horse_statue_01.gltf',dict(height=.5)),
 'lion':(f'{PH}/lion_head/lion_head.gltf',dict(height=.48)),
 'whale':(f'{PH}/bronze_whale_statue/bronze_whale_statue.gltf',dict(height=.5)),
 'vase_blue':(f'{PH}/antique_ceramic_vase_01/antique_ceramic_vase_01.gltf',dict(height=.5)),
 'vase_white':(f'{PH}/ceramic_vase_02/ceramic_vase_02.gltf',dict(height=.42)),
 'vase_brass':(f'{PH}/brass_vase_01/brass_vase_01.gltf',dict(height=.52)),
 'lantern':(f'{PH}/Lantern_01/Lantern_01.gltf',dict(height=.45)),
 'clock':(f'{PH}/mantel_clock_01/mantel_clock_01.gltf',dict(width=.55)),
 'painting1':(f'{PH}/fancy_picture_frame_01/fancy_picture_frame_01.gltf',dict(width=1.3)),
 'painting2':(f'{PH}/fancy_picture_frame_02/fancy_picture_frame_02.gltf',dict(width=1.1)),
 'chest':(f'{PH}/treasure_chest/treasure_chest.gltf',dict(width=.95)),
 'katana':(f'{PH}/antique_katana_01/antique_katana_01.gltf',dict(width=.82,rot=(0,math.pi/2,0))),
}
DECOR={
 'statue':(f'{PH}/gothic_statue/gothic_statue.gltf',dict(height=1.9),6000),
 'bench':(f'{PH}/painted_wooden_bench/painted_wooden_bench.gltf',dict(width=1.5),2000),
 'grandclock':(f'{PH}/vintage_grandfather_clock_01/vintage_grandfather_clock_01.gltf',dict(height=1.9),4000),
 'chandelier':(f'{PH}/lantern_chandelier_01/lantern_chandelier_01.gltf',dict(height=.9),3000),
 'camera':(f'{PH}/security_camera_01/security_camera_01.gltf',dict(depth=.45),2500),
 'cupboard':(f'{PH}/vintage_cabinet_01/vintage_cabinet_01.gltf',dict(width=1.7),6000),
 'chair':(f'{US}/chair.glb',dict(height=.85),3000),
 'van':(f'{KN}/car/'+'%s',dict(depth=4.4),6000),
 'coin':(f'{KN}/kenney_mini-dungeon/'+'%s',dict(width=.32),800),
 'lasergate':(f'{KN}/kenney_modular-space-kit_1.0/'+'%s',dict(width=2.6),3000),
}
def find(root,name):
    for r,_,fs in os.walk(root):
        for f in fs:
            if f==name and r.endswith('GLB format') or (f==name and 'glb' in r.lower()): return os.path.join(r,f)
    for r,_,fs in os.walk(root):
        if name in fs: return os.path.join(r,name)
which=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['all']
def want(n): return 'all' in which or n in which
for n,(src,kw) in ITEMS.items():
    if want(n): prop(src,n,maxtris=6000 if n=='chest' else 4500,tex=1024 if n.startswith('painting') else 512,**kw)
for n,(src,kw,mt) in DECOR.items():
    if not want(n): continue
    if '%s' in src:
        src=find(src.replace('%s',''),{'van':'van.glb','coin':'coin.glb','lasergate':'gate-lasers.glb'}[n])
    prop(src,n,maxtris=mt,**kw)
# ---------- museum case (user model): base + glass separated
if want('case'):
    reset();objs=imp(f'{US}/museum_case.glb');ms=flatten(objs)
    base=[o for o in ms if 'phong' in o.name or 'pCube1' in o.name][0];glass=[o for o in ms if o is not base][0]
    mn,mx=bbox(ms);s=.86/(mx.x-mn.x)
    # base 0..12.47 -> 0..0.78 ; glass 11.36..18.6 -> 0.72..1.38
    for o,(z0,z1,t0,t1) in ((base,(mn.z,12.47,0,.78)),(glass,(11.36,18.6,.72,1.38))):
        for v in o.data.vertices: v.co=Vector((v.co.x*s,v.co.y*s,t0+(v.co.z-z0)/(z1-z0)*(t1-t0)))
        o.data.update()
    base.name='CaseBase';glass.name='CaseGlass'
    base.data.materials.clear();base.data.materials.append(mat('CaseMarble',(.93,.91,.86),0,.32))
    glass.data.materials.clear();glass.data.materials.append(mat('CaseGlass',(.75,.9,1),0,.05,alpha=.18))
    # gold trim ring + light strip
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,.79));t=bpy.context.object;t.scale=(.9,.9,.03);bpy.ops.object.transform_apply(scale=True);t.name='CaseTrim';t.data.materials.append(mat('Gold',(1,.72,.3),1,.28))
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0,0,.06));t2=bpy.context.object;t2.scale=(.92,.92,.12);bpy.ops.object.transform_apply(scale=True);t2.name='CasePlinth';t2.data.materials.append(mat('Dark',(.08,.09,.12),.2,.5))
    export('case')
# ---------- hiding cabinet with door Open action
if want('cabinet'):
    reset();objs=imp(f'{PH}/GothicCabinet_01/GothicCabinet_01.gltf')
    bpy.context.view_layer.update()
    s=1.75/2.361;textures(512)
    root=bpy.data.objects.new('Cabinet',None);bpy.context.scene.collection.objects.link(root)
    for o in objs:
        if o.type!='MESH':continue
        mw=o.matrix_world.copy();o.parent=root;o.matrix_world=mw
        m=o.modifiers.new('dec','DECIMATE');m.ratio=.45;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier='dec')
    root.scale=(s,s,s)
    names={'GothicCabinet_01_door1':'DoorTL','GothicCabinet_01_door2':'DoorTR','GothicCabinet_01_door3':'DoorBL','GothicCabinet_01_door4':'DoorBR','GothicCabinet_01_cabinet':'Body'}
    for o in objs:
        if o.name in names:o.name=names[o.name]
    sc=bpy.context.scene;sc.render.fps=30
    for o in root.children:
        if not o.name.startswith('Door'):continue
        sign=-1 if o.name.endswith('L') else 1
        o.rotation_mode='XYZ';base_rot=o.rotation_euler.copy()
        o.animation_data_create();a=bpy.data.actions.new('Open_'+o.name)
        o.animation_data.action=a
        for f,ang in ((1,0),(7,105),(150,105),(157,0)):
            o.rotation_euler=(base_rot.x,base_rot.y,base_rot.z+math.radians(ang)*sign);o.keyframe_insert('rotation_euler',frame=f)
        tr=o.animation_data.nla_tracks.new();tr.name='Open';st=tr.strips.new('Open',1,a);o.animation_data.action=None
    export('cabinet',anim=True)
# ---------- user fan (keep animation) & shield kit
if want('fan'):
    reset();objs=imp(f'{US}/fan.glb');textures(512)
    for o in objs:
        if o.type=='MESH':
            m=o.modifiers.new('dec','DECIMATE');m.ratio=.18;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier='dec')
    mn,mx=bbox(objs);s=1.25/(mx.z-mn.z)
    top=[o for o in objs if o.parent is None][0];top.scale=(s,s,s);top.location=(0,0,-mn.z*s)
    export('fan',anim=True)
if want('shields'):
    reset();objs=imp(f'{US}/shield_kit.glb');textures(512)
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    bpy.context.view_layer.update()
    meshes=[o for o in objs if o.type=='MESH']
    for o in meshes:
        mw=o.matrix_world.copy();o.parent=None;o.matrix_world=mw
    for o in objs:
        if o.type!='MESH':bpy.data.objects.remove(o)
    for i,o in enumerate(meshes):
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
        bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS');o.location=(i*1.0,0,0);o.name=f'Shield{i}'
        d=o.dimensions;sz=max(d);o.scale=(.62/sz,)*3
    export('shields')
# ---------- crown (handmade)
if want('crown'):
    reset();gold=mat('CrownGold',(1,.74,.25),1,.22);ruby=mat('Ruby',(.9,.05,.12),0,.05,emit=(.5,0,.05));sapph=mat('Sapphire',(.1,.3,1),0,.05,emit=(0,.1,.6));emer=mat('Emerald',(.05,.85,.35),0,.05,emit=(0,.4,.1));velvet=mat('Velvet',(.45,.02,.08),0,.9)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.2,depth=.09,location=(0,0,.045));band=bpy.context.object;band.data.materials.append(gold)
    m=band.modifiers.new('s','SOLIDIFY');m.thickness=.02
    bm=bmesh.new();bm.from_mesh(band.data)
    for f in [f for f in bm.faces if abs(f.normal.z)>.9]: bm.faces.remove(f)
    bm.to_mesh(band.data);bm.free();bpy.ops.object.modifier_apply(modifier='s')
    parts=[band]
    for i in range(8):
        a=i/8*2*math.pi
        bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.06,radius2=0,depth=.16 if i%2==0 else .11,location=(math.cos(a)*.2,math.sin(a)*.2,.09+(.08 if i%2==0 else .055)));c=bpy.context.object;c.rotation_euler=(0,0,a+math.pi/4);c.scale=(1,.35,1);c.data.materials.append(gold);parts.append(c)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=.022,segments=12,ring_count=8,location=(math.cos(a)*.2,math.sin(a)*.2,.09+(.17 if i%2==0 else .12)));b=bpy.context.object;b.data.materials.append(gold);parts.append(b)
        bpy.ops.mesh.primitive_ico_sphere_add(radius=.024,subdivisions=1,location=(math.cos(a+math.pi/8)*.212,math.sin(a+math.pi/8)*.212,.045));g=bpy.context.object;g.scale=(1,1,1.3);g.data.materials.append([ruby,sapph,emer,sapph][i%4]);parts.append(g)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=.175,location=(0,0,.04));cap=bpy.context.object;cap.scale=(1,1,.62);cap.data.materials.append(velvet);parts.append(cap)
    bpy.ops.mesh.primitive_cube_add(size=.06,location=(0,0,.24));cr=bpy.context.object;cr.scale=(.3,.3,1.4);cr.data.materials.append(gold);parts.append(cr)
    bpy.ops.mesh.primitive_cube_add(size=.06,location=(0,0,.25));cr2=bpy.context.object;cr2.scale=(1.1,.3,.3);cr2.data.materials.append(gold);parts.append(cr2)
    bpy.ops.mesh.primitive_ico_sphere_add(radius=.05,subdivisions=1,location=(0,-.205,.05));big=bpy.context.object;big.data.materials.append(ruby);parts.append(big)
    o=join(parts,'Crown');bpy.ops.object.transform_apply(scale=True);export('crown')
# ---------- loot sack
if want('sack'):
    reset();cloth=mat('Burlap',(.24,.13,.05),0,.95);rope=mat('Rope',(.3,.2,.1),0,.9);gold=mat('CoinGold',(1,.78,.25),1,.25)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=.25,location=(0,0,.22));s=bpy.context.object
    for v in s.data.vertices:
        z=v.co.z
        if z>.12:
            k=max(.18,1-(z-.12)/.13*.85);v.co.x*=k;v.co.y*=k;v.co.z=.12+(z-.12)*1.6
        if z<-.1: v.co.z=-.1+(z+.1)*.35
        v.co.x*=1.08
    tex=bpy.data.textures.new('n','CLOUDS');tex.noise_scale=.08
    m=s.modifiers.new('d','DISPLACE');m.texture=tex;m.strength=.025;bpy.ops.object.modifier_apply(modifier='d')
    bpy.ops.object.shade_smooth();s.data.materials.append(cloth)
    bpy.ops.mesh.primitive_torus_add(major_radius=.065,minor_radius=.018,location=(0,0,.47));t=bpy.context.object;t.data.materials.append(rope)
    parts=[s,t]
    for i in range(5):
        bpy.ops.mesh.primitive_cylinder_add(radius=.045,depth=.012,location=(-.05+i*.03,.03*(i%2),.53+i*.006));c=bpy.context.object;c.rotation_euler=(0.3*(i%3),.4,i);c.data.materials.append(gold);parts.append(c)
    join(parts,'Sack');export('sack')
# ---------- velvet rope barrier ring (4 posts, square 3.2m)
if want('ropes'):
    reset();gold=mat('PostGold',(1,.74,.3),1,.25);vel=mat('RopeVelvet',(.62,.02,.08),0,.7)
    parts=[];S=1.6;pts=[(-S,-S),(S,-S),(S,S),(-S,S)]
    for x,y in pts:
        bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.14,depth=.04,location=(x,y,.02));parts.append(bpy.context.object)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.03,depth=.85,location=(x,y,.45));parts.append(bpy.context.object)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=.055,segments=12,ring_count=8,location=(x,y,.9));parts.append(bpy.context.object)
    for p in parts:p.data.materials.append(gold)
    for i in range(4):
        (x0,y0),(x1,y1)=pts[i],pts[(i+1)%4]
        if i==3: continue  # opening on one side
        cu=bpy.data.curves.new('r','CURVE');cu.dimensions='3D';cu.bevel_depth=.025;sp=cu.splines.new('BEZIER');sp.bezier_points.add(2)
        for j,t in enumerate((0,.5,1)):
            bp=sp.bezier_points[j];bp.co=(x0+(x1-x0)*t,y0+(y1-y0)*t,.84-(.22 if j==1 else 0));bp.handle_left_type=bp.handle_right_type='AUTO'
        ob=bpy.data.objects.new('rope',cu);bpy.context.scene.collection.objects.link(ob);bpy.context.view_layer.objects.active=ob
        bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.ops.object.convert(target='MESH');ob.data.materials.append(vel);parts.append(ob)
    join(parts,'Ropes');export('ropes')
# ---------- police drone
if want('drone'):
    reset();body=mat('DroneBody',(.06,.07,.09),.6,.35);white=mat('DroneWhite',(.9,.92,.95),.2,.3);red=mat('LightRed',(1,.05,.05),0,.2,emit=(1,0,0));blue=mat('LightBlue',(.1,.3,1),0,.2,emit=(0,.2,1));eye=mat('Eye',(1,.2,.1),0,.1,emit=(1,.1,0));rotor=mat('Rotor',(.2,.22,.25),.3,.4)
    parts=[]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=.22,location=(0,0,0));b=bpy.context.object;b.scale=(1,1.25,.5);b.data.materials.append(body);bpy.ops.object.shade_smooth();parts.append(b)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,radius=.2,location=(0,0,.05));t=bpy.context.object;t.scale=(.9,1.1,.4);t.data.materials.append(white);bpy.ops.object.shade_smooth();parts.append(t)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=.07,location=(0,-.25,-.04));e=bpy.context.object;e.data.materials.append(eye);parts.append(e)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.09,depth=.06,location=(0,-.22,-.04));c=bpy.context.object;c.rotation_euler=(math.pi/2,0,0);c.data.materials.append(body);parts.append(c)
    for i,(x,y) in enumerate(((.3,.3),(-.3,.3),(.3,-.3),(-.3,-.3))):
        bpy.ops.mesh.primitive_cube_add(size=1,location=(x/2,y/2,.02));a=bpy.context.object;a.scale=(.05,.05,.04);a.rotation_euler=(0,0,math.atan2(y,x));a.scale=(.42,.05,.035);a.data.materials.append(body);parts.append(a)
        bpy.ops.mesh.primitive_torus_add(major_radius=.15,minor_radius=.015,location=(x,y,.04));g=bpy.context.object;g.data.materials.append(white);parts.append(g)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.03,depth=.06,location=(x,y,.04));h=bpy.context.object;h.data.materials.append(body);parts.append(h)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=.045,segments=12,ring_count=8,location=(-.12,.18,.1));lr=bpy.context.object;lr.data.materials.append(red)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=.045,segments=12,ring_count=8,location=(.12,.18,.1));lb=bpy.context.object;lb.data.materials.append(blue)
    d=join(parts,'DroneBody')
    lr.name='LightRed';lb.name='LightBlue'
    rotors=[]
    for i,(x,y) in enumerate(((.3,.3),(-.3,.3),(.3,-.3),(-.3,-.3))):
        bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,.08));r=bpy.context.object;r.scale=(.27,.035,.006);bpy.ops.object.transform_apply(scale=True)
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY',center='BOUNDS');r.data.materials.append(rotor);r.name=f'Rotor{i}'
    export('drone')
