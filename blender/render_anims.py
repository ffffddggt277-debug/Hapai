import bpy,mathutils,sys
bpy.ops.wm.open_mainfile(filepath='/data/v2/blender/thief_anim.blend')
sc=bpy.context.scene
arm=[o for o in sc.objects if o.type=='ARMATURE'][0]
cam=bpy.data.objects.new('cam',bpy.data.cameras.new('cam'));sc.collection.objects.link(cam);sc.camera=cam;cam.data.lens=40
cam.location=(4.8,-4.2,2.6);tgt=mathutils.Vector((0,0,1.7));cam.rotation_euler=(tgt-cam.location).to_track_quat('-Z','Y').to_euler()
l=bpy.data.objects.new('l',bpy.data.lights.new('l','SUN'));sc.collection.objects.link(l);l.data.energy=4;l.rotation_euler=(0.8,0.2,0.5)
w=bpy.data.worlds.new('w');sc.world=w;w.use_nodes=True;w.node_tree.nodes['Background'].inputs[0].default_value=(.25,.27,.3,1)
bpy.ops.mesh.primitive_plane_add(size=8)
sc.render.engine='CYCLES';sc.cycles.samples=6;sc.render.resolution_x=260;sc.render.resolution_y=300
names=sys.argv[sys.argv.index('--')+1:]
for tr in arm.animation_data.nla_tracks: tr.mute=True
for tr in arm.animation_data.nla_tracks:
    if tr.name not in names: continue
    tr.mute=False;a=tr.strips[0].action;s,e=a.frame_range
    for i in range(4):
        f=int(s+(e-s)*i/4);sc.frame_set(f)
        sc.render.filepath=f'/data/v2/anim/{tr.name}_{i}.png';bpy.ops.render.render(write_still=True)
    tr.mute=True
