# TODO
# - dont show LOD Group option when a child of a LOD Group

bl_info = {
    "name": "Hyperfy",
    "author": "Ashxn",
    "version": (1, 0),
    "blender": (2, 80, 0),
    "location": "View3D > Sidebar > Hyperfy Tab",
    "description": "A tool for quickly managing custom properties specific to Hyperfy assets.",
    "warning": "",
    "doc_url": "",
    "category": "3D View",
}

import os
import bpy
from bpy.types import Panel, Operator, PropertyGroup
from bpy.props import BoolProperty, StringProperty, EnumProperty, IntProperty

# Node type options
NODE_NONE = 'none'
NODE_RIGIDBODY = 'rigidbody'
NODE_COLLIDER = 'collider'
NODE_LOD = 'lod'
NODE_SNAP = 'snap'

# Rigidbody type options
TYPE_STATIC = 'static'
TYPE_KINEMATIC = 'kinematic'
TYPE_DYNAMIC = 'dynamic'

class SplatmapProcessor:
    """Helper class to handle splatmap export processing"""
    
    @staticmethod
    def find_splatmap_objects():
        """Find all mesh objects with splatmap=true"""
        return [obj for obj in bpy.context.scene.objects 
            if obj.type == 'MESH' and "exp_splatmap" in obj and obj["exp_splatmap"] == True and not obj.hide_get()]
    
    @staticmethod
    def process_splatmap_object(obj):
        """Process a single splatmap object for export"""
        # Ensure object has only one material
        if len(obj.data.materials) > 1:
            return False, f"Splatmap object '{obj.name}' has more than one material"
        
        if len(obj.data.materials) == 0:
            return False, f"Splatmap object '{obj.name}' has no materials"
        
        original_material = obj.data.materials[0]
        
        # Clone the mesh object
        clone = obj.copy()
        clone.data = obj.data.copy()
        clone.name = f"{obj.name}_splatmap_clone"
        
        # Link clone to the scene
        bpy.context.collection.objects.link(clone)
        
        # Create new principled BSDF material
        new_material = bpy.data.materials.new(name=f"{original_material.name}_splatmap_converted")
        new_material.use_nodes = True
        
        # Clear default nodes
        new_material.node_tree.nodes.clear()
        
        # Add principled BSDF
        principled = new_material.node_tree.nodes.new(type='ShaderNodeBsdfPrincipled')
        output = new_material.node_tree.nodes.new(type='ShaderNodeOutputMaterial')
        
        # Connect principled to output
        new_material.node_tree.links.new(principled.outputs['BSDF'], output.inputs['Surface'])
        
        # Find and copy required image nodes from original material
        if original_material.use_nodes:
            image_nodes = {}
            mapping_scales = {}
            
            for node in original_material.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.label in ['SPLAT', 'RED', 'GREEN', 'BLUE', 'ALPHA']:
                    image_nodes[node.label] = node
                    
                    # Check if this image node has a mapping node connected to it
                    for input_socket in node.inputs:
                        if input_socket.is_linked:
                            for link in input_socket.links:
                                if link.from_node.type == 'MAPPING':
                                    mapping_node = link.from_node
                                    # Get the scale values (X, Y, Z)
                                    scale_x = mapping_node.inputs['Scale'].default_value[0]
                                    scale_y = mapping_node.inputs['Scale'].default_value[1]
                                    scale_z = mapping_node.inputs['Scale'].default_value[2]
                                    # Calculate average scale
                                    avg_scale = (scale_x + scale_y + scale_z) / 3.0
                                    mapping_scales[node.label] = avg_scale
                                    break
            
            # Add and connect image nodes to principled BSDF
            connections = {
                'SPLAT': 'Base Color',
                'RED': 'Specular IOR Level',
                'GREEN': 'Emission Color',
                'BLUE': 'Normal',
                'ALPHA': 'Transmission Weight'
            }
            
            for label, socket_name in connections.items():
                if label in image_nodes:
                    # Copy the image node
                    new_image_node = new_material.node_tree.nodes.new(type='ShaderNodeTexImage')
                    new_image_node.image = image_nodes[label].image
                    new_image_node.label = label
                    
                    # Special handling for normal map
                    if label == 'BLUE' and socket_name == 'Normal':
                        # Add normal map node for proper normal mapping
                        normal_map = new_material.node_tree.nodes.new(type='ShaderNodeNormalMap')
                        new_material.node_tree.links.new(new_image_node.outputs['Color'], normal_map.inputs['Color'])
                        new_material.node_tree.links.new(normal_map.outputs['Normal'], principled.inputs['Normal'])
                    else:
                        # Direct connection for other inputs
                        new_material.node_tree.links.new(new_image_node.outputs['Color'], principled.inputs[socket_name])
        
        # Replace material on clone
        clone.data.materials[0] = new_material
        
        # Add scale values as custom properties on the mesh object
        for label, scale in mapping_scales.items():
            property_name = f"{label.lower()}_scale"
            clone[property_name] = scale
        
        # Hide original object
        obj.hide_set(True)
        
        return True, clone
    
    @staticmethod
    def cleanup_splatmap_clone(clone_data):
        """Clean up after export by removing clones and restoring originals"""
        clone, original_obj = clone_data
        
        # Remove clone's material first
        if clone.data.materials and clone.data.materials[0]:
            material_to_remove = clone.data.materials[0]
            # Remove the material from all material slots
            clone.data.materials.clear()
            # Remove the material from Blender data
            bpy.data.materials.remove(material_to_remove)
        
        # Remove clone's mesh data
        mesh_to_remove = clone.data
        
        # Remove clone object
        bpy.data.objects.remove(clone)
        
        # Remove mesh data
        bpy.data.meshes.remove(mesh_to_remove)
        
        # Unhide original
        original_obj.hide_set(False)

class OBJECT_OT_node_type_set(Operator):
    """Set Node Type Property"""
    bl_idname = "object.node_type_set"
    bl_label = "Set Node Type Property"
    bl_options = {'REGISTER', 'UNDO'}
    
    node_type: StringProperty(
        name="Node Type",
        description="Node type to set",
        default=NODE_NONE
    )
    
    # Property to support depressed state for buttons
    depress: BoolProperty(default=False)
    
    @classmethod
    def poll(cls, context):
        return context.active_object is not None
    
    def execute(self, context):
        obj = context.active_object
        
        # If switching away from rigidbody, we should also remove any type property
        was_rigidbody = "node" in obj and obj["node"] == NODE_RIGIDBODY
        
        # If switching away from collider, remove collider-specific properties
        was_collider = "node" in obj and obj["node"] == NODE_COLLIDER
        
        if self.node_type == NODE_NONE:
            # Remove the custom property if it exists
            if "node" in obj:
                del obj["node"]
                
            # Also remove type property if it exists
            if "type" in obj:
                del obj["type"]
                
            # Remove collider properties if they exist
            if "convex" in obj:
                del obj["convex"]
            if "trigger" in obj:
                del obj["trigger"]
        else:
            # Add or set the custom property
            obj["node"] = self.node_type
            
            # If switching to something other than rigidbody, remove type property
            if self.node_type != NODE_RIGIDBODY and "type" in obj:
                del obj["type"]
                
            # If switching to something other than collider, remove collider properties
            if self.node_type != NODE_COLLIDER:
                if "convex" in obj:
                    del obj["convex"]
                if "trigger" in obj:
                    del obj["trigger"]
        
        # Notify Blender that the object has been updated
        obj.update_tag(refresh={'OBJECT'})
        
        # Force update of the UI - including the properties panel
        for area in context.screen.areas:
            area.tag_redraw()
                
        return {'FINISHED'}

class OBJECT_OT_rigidbody_type_set(Operator):
    """Set Rigidbody Type Property"""
    bl_idname = "object.rigidbody_type_set"
    bl_label = "Set Rigidbody Type Property"
    bl_options = {'REGISTER', 'UNDO'}
    
    rb_type: StringProperty(
        name="Rigidbody Type",
        description="Rigidbody type to set",
        default=TYPE_STATIC
    )
    
    @classmethod
    def poll(cls, context):
        obj = context.active_object
        return obj is not None and "node" in obj and obj["node"] == NODE_RIGIDBODY
    
    def execute(self, context):
        obj = context.active_object
        
        if self.rb_type == TYPE_STATIC:
            # Remove the type property if it exists (since static is default)
            if "type" in obj:
                del obj["type"]
        else:
            # Add or set the type property
            obj["type"] = self.rb_type
        
        # Notify Blender that the object has been updated
        obj.update_tag(refresh={'OBJECT'})
        
        # Force update of the UI
        for area in context.screen.areas:
            area.tag_redraw()
                
        return {'FINISHED'}

class OBJECT_OT_collider_property_toggle(Operator):
    """Toggle Collider Property"""
    bl_idname = "object.collider_property_toggle"
    bl_label = "Toggle Collider Property"
    bl_options = {'REGISTER', 'UNDO'}
    
    property_name: StringProperty(
        name="Property Name",
        description="Name of the property to toggle",
        default=""
    )
    
    @classmethod
    def poll(cls, context):
        obj = context.active_object
        return obj is not None and "node" in obj and obj["node"] == NODE_COLLIDER
    
    def execute(self, context):
        obj = context.active_object
        
        # If property exists, toggle its value
        if self.property_name in obj:
            if obj[self.property_name]:
                # If true, remove it (to match engine default)
                del obj[self.property_name]
            else:
                # Toggle to true
                obj[self.property_name] = True
        else:
            # Property doesn't exist, set it to true
            obj[self.property_name] = True
        
        # Notify Blender that the object has been updated
        obj.update_tag(refresh={'OBJECT'})
        
        # Force update of the UI
        for area in context.screen.areas:
            area.tag_redraw()
                
        return {'FINISHED'}

class OBJECT_OT_mesh_property_toggle(Operator):
    """Toggle Mesh Property"""
    bl_idname = "object.mesh_property_toggle"
    bl_label = "Toggle Mesh Property"
    bl_options = {'REGISTER', 'UNDO'}
    
    property_name: StringProperty(
        name="Property Name",
        description="Name of the property to toggle",
        default=""
    )
    
    @classmethod
    def poll(cls, context):
        obj = context.active_object
        return obj is not None and obj.type == 'MESH'
    
    def execute(self, context):
        obj = context.active_object
        
        # If property exists, toggle its value
        if self.property_name in obj:
            # If it's false, delete it to revert to default (true)
            if obj[self.property_name] == False:
                del obj[self.property_name]
            # If it's true already (which shouldn't happen normally), set to false
            else:
                obj[self.property_name] = False
        else:
            # Property doesn't exist (default is true), set it to false 
            obj[self.property_name] = False
        
        # Notify Blender that the object has been updated
        obj.update_tag(refresh={'OBJECT'})
        
        # Force update of the UI
        for area in context.screen.areas:
            area.tag_redraw()
                
        return {'FINISHED'}

class OBJECT_OT_lod_property_toggle(Operator):
    """Toggle LOD Property"""
    bl_idname = "object.lod_property_toggle"
    bl_label = "Toggle LOD Property"
    bl_options = {'REGISTER', 'UNDO'}
    
    property_name: StringProperty(
        name="Property Name",
        description="Name of the property to toggle",
        default=""
    )
    
    @classmethod
    def poll(cls, context):
        obj = context.active_object
        return obj is not None and "node" in obj and obj["node"] == NODE_LOD
    
    def execute(self, context):
        obj = context.active_object
        
        # If property exists and is false, remove it to revert to default (true)
        if self.property_name in obj:
            if obj[self.property_name] == False:
                del obj[self.property_name]
            # If it's set to true explicitly (which shouldn't happen normally), set to false
            else:
                obj[self.property_name] = False
        else:
            # Property doesn't exist (default is true), set it to false
            obj[self.property_name] = False
        
        # Notify Blender that the object has been updated
        obj.update_tag(refresh={'OBJECT'})
        
        # Force update of the UI
        for area in context.screen.areas:
            area.tag_redraw()
                
        return {'FINISHED'}

class OBJECT_OT_splatmap_toggle(Operator):
    """Toggle Splatmap Property"""
    bl_idname = "object.splatmap_toggle"
    bl_label = "Toggle Splatmap"
    bl_options = {'REGISTER', 'UNDO'}
    
    @classmethod
    def poll(cls, context):
        obj = context.active_object
        return obj is not None and obj.type == 'MESH'
    
    def execute(self, context):
        obj = context.active_object
        
        # If property exists and is true, remove it (revert to default false)
        if "exp_splatmap" in obj:
            if obj["exp_splatmap"] == True:
                del obj["exp_splatmap"]
            else:
                # If set to false, toggle to true
                obj["exp_splatmap"] = True
        else:
            # Property doesn't exist (default is false), set it to true
            obj["exp_splatmap"] = True
        
        # Notify Blender that the object has been updated
        obj.update_tag(refresh={'OBJECT'})
        
        # Force update of the UI
        for area in context.screen.areas:
            area.tag_redraw()
                
        return {'FINISHED'}

class OBJECT_OT_hyperfy_export_all(Operator):
    """Export entire scene as GLB with custom properties enabled and webp textures"""
    bl_idname = "object.hyperfy_export_all"
    bl_label = "Export All"
    bl_options = {'REGISTER'}
    
    @classmethod
    def poll(cls, context):
        # Export button is always available if there's an active object
        return context.active_object is not None
    
    def execute(self, context):
        # Get the current blend file path
        blend_filepath = bpy.data.filepath
        
        # If the file hasn't been saved yet, use the temp directory
        if not blend_filepath:
            directory = os.path.join(os.path.expanduser("~"), "Documents")
            filename = "untitled.glb"
        else:
            # Use the same directory as the blend file
            directory = os.path.dirname(blend_filepath)
            # Use the blend filename but with .glb extension
            filename = os.path.splitext(os.path.basename(blend_filepath))[0] + ".glb"
        
        filepath = os.path.join(directory, filename)

        # Process splatmap objects
        splatmap_objects = SplatmapProcessor.find_splatmap_objects()
        splatmap_clones = []
        
        try:
            # Process each splatmap object
            for splatmap_obj in splatmap_objects:
                success, result = SplatmapProcessor.process_splatmap_object(splatmap_obj)
                if not success:
                    self.report({'ERROR'}, result)
                    return {'CANCELLED'}
                splatmap_clones.append((result, splatmap_obj))
            
            # Perform the export
            export_params = {
                'filepath': filepath,
                'export_format': 'GLB',
                'export_image_format': 'WEBP',
                'export_extras': True, # custom properties
                'export_apply': True, # apply modifiers
                'use_selection': False,  # entire scene
                'use_visible': True  # only visible
            }

            try:
                bpy.ops.export_scene.gltf(**export_params)
            except TypeError as e:
                # If there's an error about WebP not being found, try without it
                if "enum \"WEBP\" not found" in str(e):
                    del export_params['export_image_format']
                    bpy.ops.export_scene.gltf(**export_params)
                else:
                    # If it's some other error, re-raise it
                    raise e

            self.report({'INFO'}, f"Exported to {filepath}")
            
        finally:
            # Cleanup splatmap clones
            for clone_data in splatmap_clones:
                SplatmapProcessor.cleanup_splatmap_clone(clone_data)

        return {'FINISHED'}

class OBJECT_OT_hyperfy_export_individual(Operator):
    """Export each root object individually as GLB with custom properties enabled and webp textures"""
    bl_idname = "object.hyperfy_export_individual"
    bl_label = "Export Individual"
    bl_options = {'REGISTER'}
    
    @classmethod
    def poll(cls, context):
        # Export button is always available if there are objects in the scene
        return len(context.scene.objects) > 0
    
    def execute(self, context):
        # Get the current blend file path
        blend_filepath = bpy.data.filepath
        
        # Create a directory for exported GLBs
        if not blend_filepath:
            base_directory = os.path.join(os.path.expanduser("~"), "Documents")
        else:
            base_directory = os.path.dirname(blend_filepath)
        
        export_directory = os.path.join(base_directory, "exported_glbs")
        
        # Create the directory if it doesn't exist
        if not os.path.exists(export_directory):
            os.makedirs(export_directory)
        
        # Store original selection
        original_selection = context.selected_objects.copy()
        original_active = context.active_object
        
        # Deselect all objects
        bpy.ops.object.select_all(action='DESELECT')
        
        # Find all root objects (objects with no parent)
        root_objects = [obj for obj in context.scene.objects if obj.parent is None]
        
        # Counter for exported objects
        exported_count = 0
        # Counter for skipped objects
        skipped_count = 0
        
        # For each root object
        for obj in root_objects:
            # Skip if the root object is hidden in viewport
            if obj.hide_get():
                skipped_count += 1
                continue
                
            # Store the original location
            original_location = obj.location.copy()
            
            # Set object position to 0,0,0
            obj.location = (0, 0, 0)
            
            # Select the object and all its children
            obj.select_set(True)
            for child in obj.children_recursive:
                child.select_set(True)
            
            # Set as active object
            context.view_layer.objects.active = obj
            
            # Process splatmap objects in selection
            splatmap_objects_in_selection = []
            splatmap_clones = []
            for selected_obj in context.selected_objects:
                if selected_obj.type == 'MESH' and "exp_splatmap" in selected_obj and selected_obj["exp_splatmap"] == True:
                    splatmap_objects_in_selection.append(selected_obj)
            
            try:
                # Process splatmap objects
                for splatmap_obj in splatmap_objects_in_selection:
                    success, result = SplatmapProcessor.process_splatmap_object(splatmap_obj)
                    if not success:
                        self.report({'ERROR'}, result)
                        continue
                    splatmap_clones.append((result, splatmap_obj))
                    # Add clone to selection, remove original from selection
                    splatmap_obj.select_set(False)
                    result.select_set(True)
                
                # Define export path
                filepath = os.path.join(export_directory, f"{obj.name}.glb")
                
                export_params = {
                    'filepath': filepath,
                    'export_format': 'GLB',
                    'export_image_format': 'WEBP',
                    'export_extras': True,  # custom properties
                    'export_apply': True,   # apply modifiers
                    'use_selection': True,   # only selected objects
                    'use_visible': True  # only visible
                }
                
                try:
                    bpy.ops.export_scene.gltf(**export_params)
                    exported_count += 1
                except TypeError as e:
                    # If there's an error about WebP not being found, try without it
                    if "enum \"WEBP\" not found" in str(e):
                        del export_params['export_image_format']
                        bpy.ops.export_scene.gltf(**export_params)
                        exported_count += 1
                    else:
                        # If it's some other error, re-raise it
                        raise e
                
            finally:
                # Cleanup splatmap clones
                for clone_data in splatmap_clones:
                    SplatmapProcessor.cleanup_splatmap_clone(clone_data)
                    # Restore original selection state
                    clone_data[1].select_set(True)
            
            # Move object back to original position
            obj.location = original_location
            
            # Deselect all objects for the next iteration
            bpy.ops.object.select_all(action='DESELECT')
        
        # Restore original selection
        for obj in original_selection:
            obj.select_set(True)
        if original_active:
            context.view_layer.objects.active = original_active
        
        # Report with additional info about skipped objects
        if skipped_count > 0:
            self.report({'INFO'}, f"Exported {exported_count} objects to {export_directory} (Skipped {skipped_count} hidden root objects)")
        else:
            self.report({'INFO'}, f"Exported {exported_count} objects to {export_directory}")
        
        return {'FINISHED'}

class VIEW3D_PT_hyperfy_panel(Panel):
    """Creates a Panel in the N-Panel"""
    bl_label = "Hyperfy"
    bl_idname = "VIEW3D_PT_hyperfy_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Hyperfy'  # This is the tab name
    
    def draw(self, context):
        layout = self.layout
        obj = context.active_object
        
        # Only show UI if an object is selected
        if obj:
            # Get current node type from the object if it exists
            current_node_type = NODE_NONE
            if "node" in obj:
                current_node_type = obj["node"]
            
            layout.label(text="Node")
            
            # Create a vertical list of buttons with clear visual indication of selection
            
            # None button
            row = layout.row()
            none_button_label = "Group" if obj.type == 'EMPTY' else "Mesh" if obj.type == 'MESH' else "Skinned Mesh" if obj.type == "ARMATURE" else "None"
            if current_node_type == NODE_NONE:
                row.operator("object.node_type_set", text=none_button_label, icon='RADIOBUT_ON').node_type = NODE_NONE
            else:
                row.operator("object.node_type_set", text=none_button_label, icon='RADIOBUT_OFF').node_type = NODE_NONE
            
            # Meshes can be:
            if obj.type == 'MESH':

                # Collider button
                row = layout.row()
                if current_node_type == NODE_COLLIDER:
                    row.operator("object.node_type_set", text="Collider", icon='RADIOBUT_ON').node_type = NODE_COLLIDER
                else:
                    row.operator("object.node_type_set", text="Collider", icon='RADIOBUT_OFF').node_type = NODE_COLLIDER

            # Empties can be:
            if obj.type == 'EMPTY':

                # Rigidbody button
                if obj.type == 'EMPTY':
                    row = layout.row()
                    if current_node_type == NODE_RIGIDBODY:
                        row.operator("object.node_type_set", text="Rigidbody", icon='RADIOBUT_ON').node_type = NODE_RIGIDBODY
                    else:
                        row.operator("object.node_type_set", text="Rigidbody", icon='RADIOBUT_OFF').node_type = NODE_RIGIDBODY

                # LOD Group button
                row = layout.row()
                if current_node_type == NODE_LOD:
                    row.operator("object.node_type_set", text="LOD Group", icon='RADIOBUT_ON').node_type = NODE_LOD
                else:
                    row.operator("object.node_type_set", text="LOD Group", icon='RADIOBUT_OFF').node_type = NODE_LOD

                # Snap Point button
                row = layout.row()
                if current_node_type == NODE_SNAP:
                    row.operator("object.node_type_set", text="Snap Point", icon='RADIOBUT_ON').node_type = NODE_SNAP
                else:
                    row.operator("object.node_type_set", text="Snap Point", icon='RADIOBUT_OFF').node_type = NODE_SNAP
            
            # If node type is rigidbody, show additional options for rigidbody type
            if current_node_type == NODE_RIGIDBODY:
                # Get current rigidbody type if it exists
                current_rb_type = TYPE_STATIC
                if "type" in obj:
                    current_rb_type = obj["type"]
                
                # Add a separator
                layout.separator()
                
                # Add a title for the rigidbody type section
                layout.label(text="Rigidbody Type")
                
                # Static button
                row = layout.row()
                if current_rb_type == TYPE_STATIC:
                    row.operator("object.rigidbody_type_set", text="Static", icon='RADIOBUT_ON').rb_type = TYPE_STATIC
                else:
                    row.operator("object.rigidbody_type_set", text="Static", icon='RADIOBUT_OFF').rb_type = TYPE_STATIC
                
                # Kinematic button
                row = layout.row()
                if current_rb_type == TYPE_KINEMATIC:
                    row.operator("object.rigidbody_type_set", text="Kinematic", icon='RADIOBUT_ON').rb_type = TYPE_KINEMATIC
                else:
                    row.operator("object.rigidbody_type_set", text="Kinematic", icon='RADIOBUT_OFF').rb_type = TYPE_KINEMATIC
                
                # Dynamic button
                row = layout.row()
                if current_rb_type == TYPE_DYNAMIC:
                    row.operator("object.rigidbody_type_set", text="Dynamic", icon='RADIOBUT_ON').rb_type = TYPE_DYNAMIC
                else:
                    row.operator("object.rigidbody_type_set", text="Dynamic", icon='RADIOBUT_OFF').rb_type = TYPE_DYNAMIC
            
            # If node type is collider, show collider options
            elif current_node_type == NODE_COLLIDER:
                # Add a separator
                layout.separator()
                
                # Add a title for the collider options section
                layout.label(text="Collider")
                
                # Check if properties exist and set the checkbox state accordingly
                is_convex = "convex" in obj and obj["convex"] == True
                is_trigger = "trigger" in obj and obj["trigger"] == True
                
                # Convex checkbox
                row = layout.row()
                op = row.operator("object.collider_property_toggle", text="Convex", icon='CHECKBOX_HLT' if is_convex else 'CHECKBOX_DEHLT')
                op.property_name = "convex"
                
                # Trigger checkbox
                row = layout.row()
                op = row.operator("object.collider_property_toggle", text="Trigger", icon='CHECKBOX_HLT' if is_trigger else 'CHECKBOX_DEHLT')
                op.property_name = "trigger"

            # Inside the draw method, after checking for different node types
            # Add this code right after the NODE_LOD check in the current if statements
            elif current_node_type == NODE_LOD:
                # Add a separator
                layout.separator()
                
                # Add a title for the LOD options section
                layout.label(text="LOD")
                
                # Check if property exists and is false, otherwise it's considered true (default)
                is_scale_aware = not ("scaleAware" in obj and obj["scaleAware"] == False)
                
                # Scale Aware checkbox
                row = layout.row()
                op = row.operator("object.lod_property_toggle", text="Scale Aware", icon='CHECKBOX_HLT' if is_scale_aware else 'CHECKBOX_DEHLT')
                op.property_name = "scaleAware"
            
            # Check if object is a child of an LOD node
            parent = obj.parent
            is_lod_child = parent and "node" in parent and parent["node"] == NODE_LOD
            
            # If this is a child of an LOD node, show max distance option
            if is_lod_child:
                layout.separator()
                layout.label(text="LOD")
                layout.prop(obj, "hyperfy_max_distance")
            
            # If object is a mesh and not a node type, show mesh options
            if obj.type == 'MESH' and current_node_type == NODE_NONE:
                # Add a separator
                layout.separator()
                
                # Add a title for the mesh options section
                layout.label(text="Mesh")
                
                # Check if properties exist and set the checkbox state accordingly
                # For castShadow and receiveShadow, they are true by default
                # So they should appear checked unless explicitly set to false
                cast_shadow = not ("castShadow" in obj and obj["castShadow"] == False)
                receive_shadow = not ("receiveShadow" in obj and obj["receiveShadow"] == False)
                
                # Cast Shadow checkbox
                row = layout.row()
                op = row.operator("object.mesh_property_toggle", text="Cast Shadow", icon='CHECKBOX_HLT' if cast_shadow else 'CHECKBOX_DEHLT')
                op.property_name = "castShadow"
               
                # Receive Shadow checkbox
                row = layout.row()
                op = row.operator("object.mesh_property_toggle", text="Receive Shadow", icon='CHECKBOX_HLT' if receive_shadow else 'CHECKBOX_DEHLT')
                op.property_name = "receiveShadow"
                
                # Add Splatmap checkbox
                # is_splatmap = "exp_splatmap" in obj and obj["exp_splatmap"] == True
                # row = layout.row()
                # op = row.operator("object.splatmap_toggle", text="Splatmap (Experimental)", icon='CHECKBOX_HLT' if is_splatmap else 'CHECKBOX_DEHLT')

            # Add a separator before the Export button
            layout.separator()
            layout.label(text="Export")
            
            # Add the Export buttons at the bottom of the panel
            box = layout.box()
            row = box.row(align=True)
            row.scale_y = 1.5  # Make the buttons a bit larger
            
            # Split into two columns
            split = row.split(factor=0.5)
            col1 = split.column(align=True)
            col2 = split.column(align=True)
            
            # "All" button on the left
            col1.operator("object.hyperfy_export_all", text="All", icon='FILE_TICK')
            
            # "Individual" button on the right
            col2.operator("object.hyperfy_export_individual", text="Individual", icon='FILE_TICK')
               
        else:
            layout.label(text="No object selected")

# Registration
classes = (
    OBJECT_OT_node_type_set,
    OBJECT_OT_rigidbody_type_set,
    OBJECT_OT_collider_property_toggle,
    OBJECT_OT_mesh_property_toggle,
    OBJECT_OT_lod_property_toggle,
    OBJECT_OT_splatmap_toggle,
    OBJECT_OT_hyperfy_export_all, 
    OBJECT_OT_hyperfy_export_individual, 
    VIEW3D_PT_hyperfy_panel,
)

def get_max_distance(self):
    # return stored value or 0 if missing
    return self.get("maxDistance", 0)

def set_max_distance(self, value):
    # writing zero = remove the ID-property
    if value == 0:
        if "maxDistance" in self:
            del self["maxDistance"]
    else:
        self["maxDistance"] = value
    # tag update so the UI refreshes
    self.update_tag(refresh={'OBJECT'})
    for area in bpy.context.screen.areas:
        area.tag_redraw()

def register():
    # register our "proxy" property on all Objects
    bpy.types.Object.hyperfy_max_distance = IntProperty(
        name="Max Distance",
        description="Maximum LOD distance (0 = ignored by lod group)",
        get=get_max_distance,
        set=set_max_distance,
    )
    for cls in classes:
        bpy.utils.register_class(cls)

def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    # clean up our proxy property
    del bpy.types.Object.hyperfy_max_distance

if __name__ == "__main__":
    register()