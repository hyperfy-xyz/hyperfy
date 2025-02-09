# Blender Exporter

If you are building any kind of kit sets in blender and have a bunch of objects all spread out, The following blender script auto-exports each individual object, properly centering each object at its own origin.
It will also ignore hidden objects, and automatically enable "custom properties" on the gltf export so that you can export colliders etc.

```py
import bpy
import os
import shutil

blend_dir = os.path.dirname(bpy.data.filepath)
export_dir = os.path.join(blend_dir, "exported_glbs")

if os.path.exists(export_dir):
   shutil.rmtree(export_dir)
os.makedirs(export_dir)

orig_selected = bpy.context.selected_objects
orig_active = bpy.context.active_object

bpy.ops.object.select_all(action='DESELECT')

for obj in bpy.context.scene.objects:
   if not obj.parent and obj.visible_get():  # Only visible top-level objects
       orig_location = obj.location.copy()
       obj.location = (0, 0, 0)
       
       obj.select_set(True)
       for child in obj.children_recursive:
           child.select_set(True)
       
       bpy.context.view_layer.objects.active = obj
       
       export_path = os.path.join(export_dir, f"{obj.name}.glb")
       bpy.ops.export_scene.gltf(
           filepath=export_path,
           use_selection=True,
           export_format='GLB',
           export_extras=True  # Enables custom properties export
       )
       
       obj.location = orig_location
       bpy.ops.object.select_all(action='DESELECT')

for obj in orig_selected:
   obj.select_set(True)
bpy.context.view_layer.objects.active = orig_active
```

To use it, go to the scripting tab in blender, click + New, paste it in, and hit the play button to run it. 