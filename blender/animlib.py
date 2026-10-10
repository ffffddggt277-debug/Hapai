import bpy,math,mathutils
from mathutils import Quaternion,Vector,Matrix
P='mixamorig:'
def B(n):
    return {'Hips':'Hips_01','Spine':'Spine_02','Spine1':'Spine1_03','Spine2':'Spine2_04','Neck':'Neck_05','Head':'Head_06',
     'LShoulder':'LeftShoulder_08','LArm':'LeftArm_09','LForeArm':'LeftForeArm_010','LHand':'LeftHand_011',
     'RShoulder':'RightShoulder_020','RArm':'RightArm_00','RForeArm':'RightForeArm_021','RHand':'RightHand_022',
     'LUpLeg':'LeftUpLeg_031','LLeg':'LeftLeg_032','LFoot':'LeftFoot_033','LToe':'LeftToeBase_034',
     'RUpLeg':'RightUpLeg_036','RLeg':'RightLeg_037','RFoot':'RightFoot_038','RToe':'RightToeBase_039',
     'LThumb1':'LeftHandThumb1_012','LIndex1':'LeftHandIndex1_016','LIndex2':'LeftHandIndex2_017','RThumb1':'RightHandThumb1_023','RIndex1':'RightHandIndex1_027','RIndex2':'RightHandIndex2_028'}[n]
AX={'x':Vector((1,0,0)),'y':Vector((0,1,0)),'z':Vector((0,0,1))}
# Armature space: +X = character left, -Y = forward, +Z = up.
# Conventions (degrees): pitch(+)=lean/bend forward for spine; arms: 'down' lowers from T-pose; 'fwd' swings forward; legs: 'fwd' raises thigh forward; knee 'bend'.
def armrot(pairs):
    q=Quaternion()
    for ax,deg in pairs: q=Quaternion(AX[ax],math.radians(deg))@q
    return q
def semantic(name,**k):
    r=[]
    L=name.startswith('L')
    if name in('Hips','Spine','Spine1','Spine2','Neck','Head'):
        r+= [('x',k.get('pitch',0)),('z',k.get('yaw',0)),('y',k.get('roll',0))]
    elif name in('LArm','RArm','LShoulder','RShoulder'):
        s=1 if L else -1
        if 'fwd' in k: r+= [('z',-s*k['fwd']),('x',k.get('down',0))]
        else: r+= [('y',s*k.get('down',0)),('x',k.get('twist',0))]
        # after lowering, swinging forward is rotation about X (down-pointing arm -> forward is -Y)
        if 'swing' in k: r+=[('x',-k['swing'])]
    elif name in('LForeArm','RForeArm'):
        s=1 if L else -1
        r+= [('z',-s*k.get('bend',0)),('y',s*k.get('down',0))]
        if 'swing' in k: r+=[('x',-k['swing'])]
    elif name in('LHand','RHand'):
        s=1 if L else -1
        r+= [('y',s*k.get('down',0)),('z',-s*k.get('fwd',0))]
    elif name in('LUpLeg','RUpLeg'):
        s=1 if L else -1
        r+= [('x',-k.get('fwd',0)),('y',-s*k.get('out',0)),('z',k.get('yaw',0))]
    elif name in('LLeg','RLeg'):
        r+= [('x',k.get('bend',0))]
    elif name in('LFoot','RFoot'):
        r+= [('x',-k.get('up',0))]
    else:
        r+= [('x',k.get('x',0)),('y',k.get('y',0)),('z',k.get('z',0))]
    return armrot(r)
class Animator:
    def __init__(s,arm):
        s.arm=arm;s.rest={pb.name:pb.bone.matrix_local.to_quaternion() for pb in arm.pose.bones}
        s.rest3={pb.name:pb.bone.matrix_local.to_3x3() for pb in arm.pose.bones}
    def pose(s,frame,spec,hips=(0,0,0)):
        # spec: {semanticName:{...}} ; armature-space deltas composed hierarchically in rest frames
        for pb in s.arm.pose.bones:
            pb.rotation_mode='QUATERNION'
        done=set()
        done=set()
        for name,k in spec.items(): done.add(P+B(name))
        for pb in s.arm.pose.bones:
            if pb.name not in done:
                pb.rotation_quaternion=Quaternion();pb.keyframe_insert('rotation_quaternion',frame=frame)
                if pb.name!=P+B('Hips'): pb.location=(0,0,0);pb.keyframe_insert('location',frame=frame)
        for name,k in spec.items(): done.add(P+B(name))
        for pb in s.arm.pose.bones:
            if pb.name not in done:
                pb.rotation_quaternion=Quaternion();pb.keyframe_insert('rotation_quaternion',frame=frame)
                if pb.name!=P+B('Hips'): pb.location=(0,0,0);pb.keyframe_insert('location',frame=frame)
        done=set()
        for name,k in spec.items(): done.add(P+B(name))
        for pb in s.arm.pose.bones:
            if pb.name not in done:
                pb.rotation_quaternion=Quaternion();pb.keyframe_insert('rotation_quaternion',frame=frame)
                if pb.name!=P+B('Hips'): pb.location=(0,0,0);pb.keyframe_insert('location',frame=frame)
        for name,k in spec.items():
            bn=P+B(name);pb=s.arm.pose.bones[bn];R=s.rest[bn]
            qa=semantic(name,**k)
            pb.rotation_quaternion=R.inverted()@qa@R
            pb.keyframe_insert('rotation_quaternion',frame=frame)
        hb=P+B('Hips');pb=s.arm.pose.bones[hb]
        pb.location=s.rest3[hb].inverted()@Vector(hips)
        pb.keyframe_insert('location',frame=frame)
    def new_action(s,name):
        a=bpy.data.actions.new(name);s.arm.animation_data_create();s.arm.animation_data.action=a
        for pb in s.arm.pose.bones:
            pb.rotation_mode='QUATERNION';pb.rotation_quaternion=Quaternion();pb.location=(0,0,0);pb.scale=(1,1,1)
        return a
