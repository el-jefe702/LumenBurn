# -*- coding: utf-8 -*-

bl_info = {
    "name": "Sculptok",
    "author": "Your Name",
    "version": (1, 1),
    "blender": (2, 80, 0),  # Support from 2.80 onwards
    "location": "View3D > UI > Sculptok",
    "description": "AI Creation Tool Plugin",
    "warning": "",
    "doc_url": "",
    "category": "3D View",
}

import bpy
import os
import json
import webbrowser
import requests
import time
import threading
from queue import Queue
from bpy.props import StringProperty, EnumProperty, IntProperty, BoolProperty
from bpy.types import Operator, Panel
from bpy_extras.io_utils import ImportHelper
from urllib.parse import urlparse, unquote

# ========================
# Version Compatibility Logic
# ========================
def is_blender_4_0_or_newer():
    return bpy.app.version >= (4, 0, 0)

def get_node_socket_value(node_socket):
    """Helper to get socket default_value compatible across versions"""
    return node_socket.default_value

def set_node_socket_value(node_socket, value):
    """Helper to set socket default_value compatible across versions"""
    node_socket.default_value = value

# ========================
# Utility Functions
# ========================
def get_plugin_directory():
    """Get the plugin root directory"""
    return os.path.dirname(os.path.realpath(__file__))

def get_generated_images_directory():
    """Get the directory for generated images"""
    dir_path = os.path.join(get_plugin_directory(), "generated_images")
    os.makedirs(dir_path, exist_ok=True)
    return dir_path

def get_generated_models_directory():
    """Get the directory for generated models"""
    dir_path = os.path.join(get_plugin_directory(), "generated_models")
    os.makedirs(dir_path, exist_ok=True)
    return dir_path

def get_best_preset_file():
    """
    Smartly choose the best preset .blend file based on the current Blender version.
    Priority:
    1. relief_{major}_{minor}.blend (e.g., relief_4_3.blend)
    2. relief_{major}.blend (e.g., relief_4.blend)
    3. relief4_2.blend (Legacy fallback)
    4. relief.blend (Generic fallback)
    """
    major = bpy.app.version[0]
    minor = bpy.app.version[1]
    plugin_dir = get_plugin_directory()
    
    # 1. Exact version match (e.g., relief_4_3.blend)
    f1 = f"relief_{major}_{minor}.blend"
    path1 = os.path.join(plugin_dir, f1)
    if os.path.exists(path1):
        print(f"Sculptok: Loading version specific preset: {f1}")
        return path1
        
    # 2. Major version match (e.g., relief_4.blend)
    f2 = f"relief_{major}.blend"
    path2 = os.path.join(plugin_dir, f2)
    if os.path.exists(path2):
        print(f"Sculptok: Loading major version preset: {f2}")
        return path2
        
    # 3. Hardcoded legacy (current file)
    legacy = "relief4_2.blend"
    path_legacy = os.path.join(plugin_dir, legacy)
    if os.path.exists(path_legacy):
        print(f"Sculptok: Loading legacy preset: {legacy}")
        return path_legacy

    # 4. Generic fallback
    generic = "relief.blend"
    print(f"Sculptok: Loading generic preset: {generic}")
    return os.path.join(plugin_dir, generic)

def print_debug_info(title, data):
    """Print debug information to the console"""
    print(f"\n=== {title} ===")
    if isinstance(data, dict):
        for k, v in data.items():
            print(f"{k}: {v}")
    else:
        print(data)
    print("=" * 30)

# ========================
# API Related Functions
# ========================
def get_activation_path():
    return os.path.join(get_plugin_directory(), "activation.json")

def check_activation():
    return os.path.exists(get_activation_path())

def save_api_key(api_key):
    with open(get_activation_path(), 'w') as f:
        json.dump({"apikey": api_key, "activated": True}, f)

def get_api_key():
    if check_activation():
        with open(get_activation_path(), 'r') as f:
            return json.load(f).get("apikey")
    return None

def get_points(api_key):
    url = "https://api.sculptok.com/api-open/point/info"
    headers = {"Content-Type": "application/json", "apikey": api_key}
    
    try:
        response = requests.get(url, headers=headers)
        print_debug_info("Points Query Request", {"url": url, "headers": headers})
        
        if response.status_code == 200:
            data = response.json()
            print_debug_info("Points Query Response", data)
            
            if data.get("code") == 0:
                return data["data"]["point"]
    except Exception as e:
        print(f"Failed to get points: {str(e)}")
    
    return None

def upload_image(api_key, image_path):
    url = "https://api.sculptok.com/api-open/image/upload"
    headers = {"apikey": api_key}
    
    try:
        print_debug_info("Starting Image Upload", {"file": os.path.basename(image_path)})
        
        with open(image_path, 'rb') as f:
            files = {'file': f}
            response = requests.post(url, headers=headers, files=files)
            print_debug_info("Upload Response", response.json())
            
            if response.status_code == 200:
                data = response.json()
                if data.get("code") == 0:
                    return data["data"]["src"]
    except Exception as e:
        print(f"Image upload failed: {str(e)}")
    
    return None

def submit_draw_task(api_key, image_url, style, ext_info=None):
    url = "https://api.sculptok.com/api-open/draw/prompt"
    headers = {"Content-Type": "application/json", "apikey": api_key}
    
    # Default parameters as requested
    data = {
        "imageUrl": image_url, 
        "style": style,
        "hd_fix": "manual",
        "optimal_size": "true"
    }
    
    if style == 'pro' and ext_info:
        data['extInfo'] = ext_info
    
    try:
        print_debug_info("Submitting Drawing Task", data)
        response = requests.post(url, headers=headers, json=data)
        resp_data = response.json()
        print_debug_info("Task Submission Response", resp_data)
        
        if response.status_code == 200 and resp_data.get("code") == 0:
            return resp_data["data"]["promptId"]
    except Exception as e:
        print(f"Failed to submit task: {str(e)}")
    
    return None

def submit_draw_3d_task(api_key, image_url, hd_fix="basic"):
    url = "https://api.sculptok.com/api-open/draw/3d/prompt"
    headers = {"Content-Type": "application/json", "apikey": api_key}
    data = {"imageUrl": image_url, "hd_fix": hd_fix}
    
    try:
        print_debug_info("Submitting 3D Drawing Task", data)
        response = requests.post(url, headers=headers, json=data)
        resp_data = response.json()
        print_debug_info("3D Task Submission Response", resp_data)
        
        if response.status_code == 200 and resp_data.get("code") == 0:
            return resp_data["data"]["promptId"]
    except Exception as e:
        print(f"Failed to submit 3D task: {str(e)}")
    
    return None

def get_draw_3d_result(api_key, prompt_id):
    # Changed endpoint to match documentation: /api-open/draw/3d/prompt
    # But wait, documentation says Submit 3D Draw is POST /api-open/draw/3d/prompt
    # Usually GET status is on the same endpoint or similar.
    # Let's try GET on /api-open/draw/3d/prompt first (current implementation).
    # If that fails or returns 500/404, maybe it is /api-open/draw/prompt?uuid=... (shared endpoint)?
    # Or maybe the documentation implies something else.
    
    # Strategy: Try the dedicated 3D endpoint first. If it fails with 500, try the general endpoint.
    
    url_3d = "https://api.sculptok.com/api-open/draw/3d/prompt"
    headers = {"Content-Type": "application/json", "apikey": api_key}
    params = {"uuid": prompt_id}
    
    try:
        print_debug_info("Querying 3D Task Status (3D Endpoint)", params)
        response = requests.get(url_3d, headers=headers, params=params)
        resp_data = response.json()
        print_debug_info("3D Task Status Response (3D Endpoint)", resp_data)
        
        if response.status_code == 200 and resp_data.get("code") == 0:
            return resp_data["data"]
        elif response.status_code == 500 or resp_data.get("code") != 0:
             # If 3D endpoint fails, try the general endpoint as fallback
             print("3D endpoint returned error, trying general endpoint fallback...")
             url_general = "https://api.sculptok.com/api-open/draw/prompt"
             response = requests.get(url_general, headers=headers, params=params)
             resp_data = response.json()
             print_debug_info("3D Task Status Response (General Endpoint Fallback)", resp_data)
             
             if response.status_code == 200 and resp_data.get("code") == 0:
                return resp_data["data"]

    except Exception as e:
        print(f"Failed to query 3D task status: {str(e)}")
    
    return None

def get_draw_result(api_key, prompt_id):
    url = "https://api.sculptok.com/api-open/draw/prompt"
    headers = {"Content-Type": "application/json", "apikey": api_key}
    params = {"uuid": prompt_id}
    
    try:
        print_debug_info("Querying Task Status", params)
        response = requests.get(url, headers=headers, params=params)
        resp_data = response.json()
        print_debug_info("Task Status Response", resp_data)
        
        if response.status_code == 200 and resp_data.get("code") == 0:
            return resp_data["data"]
    except Exception as e:
        print(f"Failed to query task status: {str(e)}")
    
    return None

def download_all_images(img_urls, save_dir):
    """Download all images to the specified directory"""
    downloaded_files = []
    downloaded_urls = set()  # Used to deduplicate
    
    for i, url in enumerate(img_urls):
        if url in downloaded_urls:
            continue  # Skip already downloaded links
        
        downloaded_urls.add(url)
        
        try:
            # Try to get filename from URL
            parsed_url = urlparse(url)
            filename = os.path.basename(unquote(parsed_url.path))
            
            # Fallback if filename is empty or has no extension
            if not filename or '.' not in filename:
                filename = f"generated_{int(time.time())}_{i+1}.png"
            
            filepath = os.path.join(save_dir, filename)
            
            print(f"Downloading image {i+1}/{len(img_urls)}: {url}")
            response = requests.get(url, stream=True)
            
            if response.status_code == 200:
                with open(filepath, 'wb') as f:
                    for chunk in response.iter_content(1024):
                        f.write(chunk)
                downloaded_files.append(filepath)
                print(f"Image saved: {filepath}")
            else:
                print(f"Download failed, status code: {response.status_code}")
                print(f"Please check the link validity or try again later.")
        except Exception as e:
            print(f"Error downloading image: {str(e)}")
    
    return downloaded_files

# ========================
# Multi-threaded Task Classes
# ========================
def find_stl_url(data):
    """Recursively find an STL URL in a dictionary or list"""
    if isinstance(data, dict):
        for k, v in data.items():
            if isinstance(v, str) and v.lower().startswith("http") and (v.lower().endswith(".stl") or v.lower().endswith(".obj")):
                return v
            elif isinstance(v, (dict, list)):
                res = find_stl_url(v)
                if res: return res
    elif isinstance(data, list):
        for item in data:
            res = find_stl_url(item)
            if res: return res
    return None

class Draw3DTaskThread(threading.Thread):
    def __init__(self, operator, context, filepath, hd_fix):
        threading.Thread.__init__(self)
        self.operator = operator
        self.context = context
        self.filepath = filepath
        self.hd_fix = hd_fix
        self.result_queue = Queue()

    def run(self):
        try:
            # 1. Get API key
            api_key = get_api_key()
            if not api_key:
                self.result_queue.put(("ERROR", "Not activated or invalid API key"))
                return

            # 2. Check points
            points = get_points(api_key)
            if points is None or points < 10:
                self.result_queue.put(("ERROR", f"Insufficient points, current points: {points if points is not None else 'Unknown'}"))
                return

            # 3. Upload image
            image_url = upload_image(api_key, self.filepath)
            if not image_url:
                self.result_queue.put(("ERROR", "Image upload failed"))
                return

            # 4. Submit drawing task
            prompt_id = submit_draw_3d_task(api_key, image_url, self.hd_fix)
            if not prompt_id:
                self.result_queue.put(("ERROR", "Failed to submit 3D drawing task"))
                return

            # Save task ID
            self.context.scene.sculptok_task_id = prompt_id

            # 5. Poll for results
            result = None
            model_url = None
            
            for i in range(100):  # Try up to 100 times, every 10 seconds
                result = get_draw_3d_result(api_key, prompt_id)
                
                # Check for task completion/success
                if result:
                    # Case 1: Standard success with imgRecords (General Endpoint Fallback often returns this)
                    if result.get("imgRecords") and isinstance(result["imgRecords"], list) and len(result["imgRecords"]) > 0:
                        # Try to find STL in imgRecords first
                        for url in result["imgRecords"]:
                             if url.lower().endswith(".stl") or url.lower().endswith(".obj"):
                                 model_url = url
                                 break
                        # If no specific extension found, just take the first one (might be the only one)
                        if not model_url and len(result["imgRecords"]) > 0:
                             model_url = result["imgRecords"][0]
                    
                    # Case 2: Try recursive find (3D endpoint or different structure)
                    if not model_url:
                        model_url = find_stl_url(result)

                    if model_url:
                        break
                
                position = result.get("position", 0) if result else 0
                if position is None:
                    position = 0
                
                # Update UI
                if position > 0:
                    self.operator._position = position
                    self.operator._progress = 0
                    self.operator.report({'INFO'}, f"{position} tasks ahead, estimated time: {position * 30} seconds")
                else:
                    self.operator._progress = 0
                    self.operator.report({'INFO'}, "Server is generating 3D model, estimated time: 30-60 seconds")
                
                time.sleep(10)

            if not model_url:
                # One last check on the final result object before giving up
                if result and result.get("imgRecords") and isinstance(result["imgRecords"], list) and len(result["imgRecords"]) > 0:
                     model_url = result["imgRecords"][0]

            if not model_url:
                # Log the last result structure for debugging
                print_debug_info("Failed 3D Result Structure", result)
                self.result_queue.put(("ERROR", "Timed out getting 3D results. Check System Console for details."))
                return

            # 6. Download STL
            save_dir = get_generated_models_directory()
            # Use download_all_images but for one file, returning list
            downloaded_files = download_all_images([model_url], save_dir)
            
            if not downloaded_files:
                self.result_queue.put(("ERROR", "3D Model download failed"))
                return

            # 7. Update points
            new_points = get_points(api_key)
            self.result_queue.put(("SUCCESS", {
                "files": downloaded_files,
                "points": new_points,
                "model_path": downloaded_files[0]
            }))

        except Exception as e:
            self.result_queue.put(("ERROR", f"Task execution error: {str(e)}"))

class DrawTaskThread(threading.Thread):
    def __init__(self, operator, context, filepath, style, ext_info=None):
        threading.Thread.__init__(self)
        self.operator = operator
        self.context = context
        self.filepath = filepath
        self.style = style
        self.ext_info = ext_info
        self.result_queue = Queue()

    def run(self):
        try:
            # 1. Get API key
            api_key = get_api_key()
            if not api_key:
                self.result_queue.put(("ERROR", "Not activated or invalid API key"))
                return

            # 2. Check points
            points = get_points(api_key)
            if points is None or points < 10:
                self.result_queue.put(("ERROR", f"Insufficient points, current points: {points if points is not None else 'Unknown'}"))
                return

            # 3. Upload image
            image_url = upload_image(api_key, self.filepath)
            if not image_url:
                self.result_queue.put(("ERROR", "Image upload failed"))
                return

            # 4. Submit drawing task
            prompt_id = submit_draw_task(api_key, image_url, self.style, self.ext_info)
            if not prompt_id:
                self.result_queue.put(("ERROR", "Failed to submit drawing task"))
                return

            # Save task ID to context.scene
            self.context.scene.sculptok_task_id = prompt_id

            # 5. Poll for results
            result = None
            for i in range(100):  # Try up to 100 times, every 10 seconds
                result = get_draw_result(api_key, prompt_id)
                if result and result.get("imgRecords"):
                    break
                
                position = result.get("position", 0) if result else 0
                if position is None:
                    position = 0
                
                # Update UI to show queue position and estimated time
                if position > 0:
                    self.operator._position = position
                    self.operator._progress = 0
                    self.operator.report({'INFO'}, f"{position} tasks ahead, estimated time: {position * 20} seconds")
                else:
                    self.operator._progress = 0
                    self.operator.report({'INFO'}, "Server is generating, estimated time: 20-40 seconds")
                
                time.sleep(10)

            if not result or not result.get("imgRecords"):
                self.result_queue.put(("ERROR", "Timed out getting drawing results, please download manually from the website"))
                return

            # 6. Download all images
            save_dir = get_generated_images_directory()
            img_urls = result["imgRecords"]
            downloaded_files = download_all_images(img_urls, save_dir)
            
            if not downloaded_files:
                self.result_queue.put(("ERROR", "Image download failed"))
                return

            # 7. Update points
            new_points = get_points(api_key)
            self.result_queue.put(("SUCCESS", {
                "files": downloaded_files,
                "points": new_points,
                "img_count": len(downloaded_files)
            }))

        except Exception as e:
            self.result_queue.put(("ERROR", f"Task execution error: {str(e)}"))

# ========================
# Operator Classes
# ========================
class sculptok_OT_Login(Operator):
    bl_idname = "sculptok.login"
    bl_label = "Login to sculptok"

    def execute(self, context):
        webbrowser.open("https://www.sculptok.com/")
        return {'FINISHED'}

class sculptok_OT_GetAPI(Operator):
    bl_idname = "sculptok.get_api"
    bl_label = "Get API Key"

    def execute(self, context):
        webbrowser.open("https://www.sculptok.com/apidoc/access#api-KEY")
        return {'FINISHED'}

class sculptok_OT_SaveAPIKey(Operator):
    bl_idname = "sculptok.save_api_key"
    bl_label = "Save API Key"

    def execute(self, context):
        api_key = context.scene.sculptok_api_key
        if api_key:
            save_api_key(api_key)
            points = get_points(api_key)
            if points is not None:
                context.scene.sculptok_points = points
                self.report({'INFO'}, f"API key saved successfully! Current points: {points}")
            else:
                self.report({'ERROR'}, "Failed to get points, please check your API key")
        else:
            self.report({'ERROR'}, "API key cannot be empty")
        return {'FINISHED'}

class sculptok_OT_LocalUploadAndDraw(Operator):
    bl_idname = "sculptok.local_upload_and_draw"
    bl_label = "Upload and Draw Locally"
    bl_description = "Upload a local image to generate AI art (consumes 10 points)"
    
    filter_glob: StringProperty(default="*.jpg;*.jpeg;*.png;*.bmp", options={'HIDDEN'})
    filepath: StringProperty(subtype="FILE_PATH")
    
    style: EnumProperty(
        name="Style Type",
        description="Select the style type for the image",
        items=[
            ("normal", "Normal", "Normal Style"),
            ("portrait", "Portrait", "Portrait Style"),
            ("sketch", "Sketch", "Sketch Style"),
            ("pro", "Pro", "Pro Style")
        ],
        default="normal"
    )

    _timer = None
    _thread = None
    _progress = 0
    _position = 0

    def modal(self, context, event):
        if event.type == 'TIMER':
            # Update UI to show progress
            if self._thread and not self._thread.is_alive():
                if not self._thread.result_queue.empty():
                    status, data = self._thread.result_queue.get()
                    
                    if status == "SUCCESS":
                        context.scene.sculptok_points = data["points"]
                        context.scene.sculptok_img_count = data["img_count"]
                        self.report({'INFO'}, 
                            f"Drawing complete! {data['img_count']} images saved\n"
                            f"Current points: {data['points'] if data['points'] is not None else 'Unknown'}"
                        )
                        # Import the first image as a heightmap
                        if data['files']:
                            bpy.ops.sculptok.import_generated_image('EXEC_DEFAULT', filepath=data['files'][0])
                    else:
                        self.report({'ERROR'}, data)
                    
                    context.window_manager.event_timer_remove(self._timer)
                    return {'FINISHED'}
                    
            # Update UI to show progress
            context.scene.sculptok_progress = self._progress
            context.scene.sculptok_position = self._position
            context.area.tag_redraw()  # Force UI redraw
        
        return {'PASS_THROUGH'}

    def execute(self, context):
        # Use Scene properties instead of Operator properties to respect the panel settings
        style = context.scene.sculptok_draw_style
        ext_info = context.scene.sculptok_ext_info

        # Start background thread
        self._thread = DrawTaskThread(self, context, self.filepath, style, ext_info)
        self._thread.start()
        
        # Set up modal timer
        wm = context.window_manager
        self._timer = wm.event_timer_add(1, window=context.window)  # Update every second
        wm.modal_handler_add(self)
        
        self.report({'INFO'}, "Processing task in the background, please wait...")
        return {'RUNNING_MODAL'}

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}

class sculptok_OT_LocalUploadAndDraw3D(Operator):
    bl_idname = "sculptok.local_upload_and_draw_3d"
    bl_label = "Upload and Draw 3D"
    bl_description = "Upload a local image to generate 3D model (consumes 10 points)"
    
    filter_glob: StringProperty(default="*.jpg;*.jpeg;*.png;*.bmp", options={'HIDDEN'})
    filepath: StringProperty(subtype="FILE_PATH")
    
    _timer = None
    _thread = None
    _progress = 0
    _position = 0

    def modal(self, context, event):
        if event.type == 'TIMER':
            if self._thread and not self._thread.is_alive():
                if not self._thread.result_queue.empty():
                    status, data = self._thread.result_queue.get()
                    
                    if status == "SUCCESS":
                        context.scene.sculptok_points = data["points"]
                        self.report({'INFO'}, 
                            f"3D Generation complete! Model saved to {data['model_path']}\n"
                            f"Current points: {data['points'] if data['points'] is not None else 'Unknown'}"
                        )
                        # Import STL and center view
                        if data.get('model_path'):
                            self.import_stl_and_center(context, data['model_path'])
                    else:
                        self.report({'ERROR'}, data)
                    
                    context.window_manager.event_timer_remove(self._timer)
                    return {'FINISHED'}
                    
            context.scene.sculptok_progress = self._progress
            context.scene.sculptok_position = self._position
            context.area.tag_redraw()
        
        return {'PASS_THROUGH'}

    def import_stl_and_center(self, context, filepath):
        try:
            # Ensure we are in Object mode
            if context.mode != 'OBJECT':
                bpy.ops.object.mode_set(mode='OBJECT')

            # Record objects before import
            objects_before = set(bpy.data.objects)

            # Import STL - Try different methods based on Blender version
            import_success = False
            
            # Method 1: Try new STL importer (Blender 4.2+)
            try:
                bpy.ops.wm.stl_import(filepath=filepath)
                import_success = True
                print(f"Successfully imported STL using wm.stl_import")
            except:
                pass
            
            # Method 2: Try legacy STL importer (Blender < 4.2)
            if not import_success:
                try:
                    bpy.ops.import_mesh.stl(filepath=filepath)
                    import_success = True
                    print(f"Successfully imported STL using import_mesh.stl")
                except:
                    pass
            
            if not import_success:
                self.report({'ERROR'}, "无法找到 STL 导入操作符。请确保 STL 导入扩展已启用。")
                return
            
            # Find the newly imported object
            objects_after = set(bpy.data.objects)
            new_objects = objects_after - objects_before
            
            if new_objects:
                imported_obj = list(new_objects)[0]
                # Set as active object
                context.view_layer.objects.active = imported_obj
                imported_obj.select_set(True)
                
                # Center view on object
                for area in context.screen.areas:
                    if area.type == 'VIEW_3D':
                        for region in area.regions:
                            if region.type == 'WINDOW':
                                with context.temp_override(area=area, region=region):
                                    bpy.ops.view3d.view_selected(use_all_regions=False)
                                break
                self.report({'INFO'}, f"已导入模型: {imported_obj.name}")
            else:
                self.report({'WARNING'}, "STL 文件已导入，但无法找到新对象")
                
        except Exception as e:
            self.report({'WARNING'}, f"自动导入 STL 失败: {str(e)}")

    def execute(self, context):
        hd_fix = context.scene.sculptok_hd_fix
        self._thread = Draw3DTaskThread(self, context, self.filepath, hd_fix)
        self._thread.start()
        
        wm = context.window_manager
        self._timer = wm.event_timer_add(1, window=context.window)
        wm.modal_handler_add(self)
        
        self.report({'INFO'}, "Processing 3D task in background...")
        return {'RUNNING_MODAL'}

    def invoke(self, context, event):
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}

class sculptok_OT_WebUpload(Operator):
    bl_idname = "sculptok.web_upload"
    bl_label = "Upload via Web"
    bl_description = "Upload images via the web interface"

    def execute(self, context):
        webbrowser.open("https://www.sculptok.com/imageGenerator")
        return {'FINISHED'}

class sculptok_OT_ImportGeneratedImage(Operator, ImportHelper):
    bl_idname = "sculptok.import_generated_image"
    bl_label = "Download Recent Task Results"
    bl_description = "Download recent task results based on the task ID"
    
    filter_glob: StringProperty(default="*.png;*.jpg;*.jpeg", options={'HIDDEN'})
    filepath: StringProperty(subtype="FILE_PATH")
    
    def execute(self, context):
        api_key = get_api_key()
        if not api_key:
            self.report({'ERROR'}, "Not activated or invalid API key")
            return {'CANCELLED'}

        task_id = context.scene.sculptok_task_id
        if not task_id:
            self.report({'ERROR'}, "Task ID is empty, please submit a task first")
            return {'CANCELLED'}

        # Call API to get image links
        result = get_draw_result(api_key, task_id)
        if not result or not result.get("imgRecords"):
            self.report({'ERROR'}, "Failed to get image links, please check the task ID")
            return {'CANCELLED'}

        # Only download the most recent three images
        img_urls = result["imgRecords"][:3]
        save_dir = get_generated_images_directory()
        downloaded_files = download_all_images(img_urls, save_dir)
        if not downloaded_files:
            self.report({'ERROR'}, "Image download failed")
            return {'CANCELLED'}

        # Import the first image as a heightmap
        try:
            relief_obj = bpy.data.objects.get("relief")
            if not relief_obj:
                # Try searching in collection if not found directly (Blender 4.x behavior change sometimes)
                for obj in bpy.context.scene.objects:
                    if obj.name == "relief":
                        relief_obj = obj
                        break
            
            if not relief_obj or "relief" not in relief_obj.modifiers:
                self.report({'ERROR'}, "Missing relief object or modifier")
                return {'CANCELLED'}
            
            current_mode = context.object.mode if context.object else 'OBJECT'
            active_obj = context.object
            
            context.view_layer.objects.active = relief_obj
            if current_mode != 'OBJECT':
                bpy.ops.object.mode_set(mode='OBJECT')
            
            image = bpy.data.images.load(downloaded_files[0])
            
            # Calculate aspect ratio (Y fixed to 1.0, calculate X ratio)
            if image.size[0] > 0 and image.size[1] > 0:
                aspect_ratio = image.size[0] / image.size[1]
            else:
                aspect_ratio = 1.0
            
            relief_mod = relief_obj.modifiers["relief"]
            
            # Blender 4.0+ Geometry Nodes modifier input handling compatibility
            if is_blender_4_0_or_newer():
                 # New way to access inputs in 4.0+ is strictly via dictionary access or node group inputs
                 # But modifier dictionary access ["InputName"] usually still works if the input exists.
                 # However, for safety and future proofing:
                 pass 

            relief_mod["Socket_4"] = image
            relief_mod["Socket_3"] = aspect_ratio  # Set aspect ratio
            
            relief_obj.data.update()
            
            # Force update trick
            original_show = relief_mod.show_viewport
            relief_mod.show_viewport = not original_show
            relief_mod.show_viewport = original_show
            
            if active_obj:
                context.view_layer.objects.active = active_obj
            if current_mode != 'OBJECT':
                bpy.ops.object.mode_set(mode=current_mode)
            
            self.report({'INFO'}, 
                f"Image imported and applied: {image.name}\n"
                f"Resolution: {image.size[0]}×{image.size[1]}\n"
                f"Aspect Ratio: {aspect_ratio:.2f} (Y fixed to 1)"
            )
        except Exception as e:
            self.report({'ERROR'}, f"Import failed: {str(e)}")
            return {'CANCELLED'}

        # Open the local folder
        self.open_folder(save_dir)
        self.report({'INFO'}, f"Images downloaded to: {save_dir}")
        return {'FINISHED'}

    def open_folder(self, folder_path):
        """Open the local folder"""
        import subprocess
        import platform
        if platform.system() == "Windows":
            subprocess.Popen(f'explorer "{folder_path}"')
        elif platform.system() == "Darwin":  # macOS
            subprocess.Popen(["open", folder_path])
        else:  # Linux
            subprocess.Popen(["xdg-open", folder_path])

    def invoke(self, context, event):
        # Set default path to the generated images directory
        self.filepath = get_generated_images_directory()
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}

class sculptok_OT_ManualDownload(Operator):
    bl_idname = "sculptok.manual_download"
    bl_label = "Manual Image Download"
    bl_description = "Download historical images via the web interface"

    def execute(self, context):
        webbrowser.open("https://www.sculptok.com/imageGenerator")
        return {'FINISHED'}

class sculptok_OT_OpenModelsFolder(Operator):
    bl_idname = "sculptok.open_models_folder"
    bl_label = "Open Models Folder"
    bl_description = "Open the folder containing generated 3D models"

    def execute(self, context):
        folder_path = get_generated_models_directory()
        
        import subprocess
        import platform
        if platform.system() == "Windows":
            subprocess.Popen(f'explorer "{folder_path}"')
        elif platform.system() == "Darwin":  # macOS
            subprocess.Popen(["open", folder_path])
        else:  # Linux
            subprocess.Popen(["xdg-open", folder_path])
            
        return {'FINISHED'}

class sculptok_OT_ImportPreset(Operator):
    bl_idname = "sculptok.import_preset"
    bl_label = "Import Preset"
    bl_description = "Import preset objects"

    def execute(self, context):
        api_key = get_api_key()
        if not api_key:
            self.report({'ERROR'}, "Not activated or invalid activation code")
            return {'CANCELLED'}
        
        points = get_points(api_key)
        if points is None:
            self.report({'ERROR'}, "Failed to get points, please check your API key")
            return {'CANCELLED'}
        
        context.scene.sculptok_points = points
        
        if points < 0:
            self.report({'ERROR'}, f"Insufficient points, current points: {points}")
            return {'CANCELLED'}
        
        # Use the smart file loader
        blend_file_path = get_best_preset_file()
        
        try:
            # Use 'assets' logic or append/link based on version if necessary, 
            # but libraries.load is generally stable.
            # For Blender 4.0+, ensure we are not using deprecated data access.
            
            with bpy.data.libraries.load(blend_file_path, link=False) as (data_from, data_to):
                if "relief" in data_from.objects:
                    data_to.objects = ["relief"]
            
            for obj in data_to.objects:
                if obj is not None:
                    # Link to collection (version safe way)
                    if bpy.app.version >= (2, 80, 0):
                        bpy.context.collection.objects.link(obj)
                    else:
                        bpy.context.scene.objects.link(obj)
                        
                    bpy.context.view_layer.objects.active = obj
                    obj.select_set(True)
                    self.report({'INFO'}, f"Object added: {obj.name}")
                else:
                    self.report({'ERROR'}, "Relief object not found")
        except Exception as e:
            self.report({'ERROR'}, f"Failed to load file: {str(e)}")
            return {'CANCELLED'}
        
        self.report({'INFO'}, "If you cannot use it normally, please download another version of the plugin.")
        return {'FINISHED'}

class sculptok_OT_ImportHeightmap(Operator, ImportHelper):
    bl_idname = "sculptok.import_heightmap"
    bl_label = "Import Heightmap"
    bl_description = "Import a heightmap and automatically set the aspect ratio"
    
    filter_glob: StringProperty(default="*.png;*.jpg;*.jpeg;*.tif;*.tiff;*.bmp", options={'HIDDEN'})
    filepath: StringProperty(subtype="FILE_PATH")
    
    def execute(self, context):
        try:
            relief_obj = bpy.data.objects.get("relief")
            if not relief_obj:
                 for obj in bpy.context.scene.objects:
                    if obj.name == "relief":
                        relief_obj = obj
                        break

            if not relief_obj or "relief" not in relief_obj.modifiers:
                self.report({'ERROR'}, "Missing relief object or modifier")
                return {'CANCELLED'}
                
            current_mode = context.object.mode if context.object else 'OBJECT'
            active_obj = context.object
            
            context.view_layer.objects.active = relief_obj
            if current_mode != 'OBJECT':
                bpy.ops.object.mode_set(mode='OBJECT')
            
            image = bpy.data.images.load(self.filepath)
            
            # Calculate aspect ratio (Y fixed to 1.0, calculate X ratio)
            if image.size[0] > 0 and image.size[1] > 0:
                aspect_ratio = image.size[0] / image.size[1]
            else:
                aspect_ratio = 1.0
            
            relief_mod = relief_obj.modifiers["relief"]
            relief_mod["Socket_4"] = image
            relief_mod["Socket_3"] = aspect_ratio  # Set aspect ratio
            
            relief_obj.data.update()
            
            # Force update trick
            original_show = relief_mod.show_viewport
            relief_mod.show_viewport = not original_show
            relief_mod.show_viewport = original_show
            
            if active_obj:
                context.view_layer.objects.active = active_obj
            if current_mode != 'OBJECT':
                bpy.ops.object.mode_set(mode=current_mode)
            
            self.report({'INFO'}, 
                f"Heightmap imported: {image.name}\n"
                f"Resolution: {image.size[0]}×{image.size[1]}\n"
                f"Aspect Ratio: {aspect_ratio:.2f} (Y fixed to 1)"
            )
            return {'FINISHED'}
        except Exception as e:
            self.report({'ERROR'}, f"Import failed: {str(e)}")
            return {'CANCELLED'}

    def invoke(self, context, event):
        # Set default path to the generated_images folder in the plugin directory
        self.filepath = get_generated_images_directory()
        context.window_manager.fileselect_add(self)
        return {'RUNNING_MODAL'}

# ========================
# Main Panel
# ========================
class sculptok_PT_Panel(Panel):
    bl_label = "Sculptok"
    bl_idname = "sculptok_PT_Panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Sculptok'

    def draw(self, context):
        layout = self.layout
        
        if check_activation():
            layout.label(text=f"Current Points: {context.scene.sculptok_points}")
            if context.scene.sculptok_points >= 0:
                layout.operator("sculptok.import_preset")
                
                upload_box = layout.box()
                upload_box.label(text="Depth Map Draw:")
                row = upload_box.row()
                row.operator("sculptok.local_upload_and_draw", text="Local Upload")
                row.operator("sculptok.web_upload", text="Web Upload")
                upload_box.prop(context.scene, "sculptok_draw_style", text="Style Type")
                
                if context.scene.sculptok_draw_style == 'pro':
                    upload_box.prop(context.scene, "sculptok_ext_info", text="extInfo")

                # Submit 3D Draw Section
                draw_3d_box = layout.box()
                draw_3d_box.label(text="Submit 3D Draw:")
                row_3d = draw_3d_box.row()
                row_3d.operator("sculptok.local_upload_and_draw_3d", text="Upload Image (3D)")
                draw_3d_box.prop(context.scene, "sculptok_hd_fix", text="HD Fix")
                
                # Open Models Folder Button
                draw_3d_box.operator("sculptok.open_models_folder", text="Open Models Folder")

                # Task Progress Section
                progress_box = layout.box()
                progress_box.label(text="Task Progress:")
                if not context.scene.sculptok_task_id:
                    progress_box.label(text="Task not started")
                else:
                    if context.scene.sculptok_progress == 0:
                        if context.scene.sculptok_position > 0:
                            progress_box.label(text=f"{context.scene.sculptok_position} tasks ahead, estimated time: {context.scene.sculptok_position * 20} seconds")
                        else:
                            progress_box.label(text="Server is generating, estimated time: 20-40 seconds")
                    elif context.scene.sculptok_progress == 100:
                        progress_box.label(text="Task completed")
                        progress_box.label(text=f"Drawing complete! {context.scene.sculptok_img_count} images saved")
                        progress_box.label(text=f"Current points: {context.scene.sculptok_points}")
                    else:
                        progress_box.label(text=f"Downloading... {context.scene.sculptok_progress}%")
                
                download_box = layout.box()
                download_box.label(text="Download Functions:")
                row = download_box.row()
                row.operator("sculptok.import_generated_image", text="Download Recent Task Results")
                row.operator("sculptok.manual_download", text="Manual Download")
                
                if "relief" in bpy.data.objects and "relief" in bpy.data.objects["relief"].modifiers:
                    relief_modifier = bpy.data.objects["relief"].modifiers["relief"]
                    box = layout.box()
                    box.label(text="Relief Parameter Adjustment:")
                    
                    row = box.row()
                    row.operator("sculptok.import_heightmap", text="Import Heightmap")
                    
                    if relief_modifier["Socket_4"] is not None:
                        box.label(text=f"Current Image: {relief_modifier['Socket_4'].name}")
                        box.label(text=f"Aspect Ratio: {relief_modifier['Socket_3']:.2f}")
                    
                    box.prop(relief_modifier, '["Socket_2"]', text="Mesh Density")
                    box.prop(relief_modifier, '["Socket_5"]', text="3D Depth")
                    box.prop(relief_modifier, '["Socket_6"]', text="Crop Depth")
                    box.prop(relief_modifier, '["Socket_7"]', text="Thickness")
                    box.prop(relief_modifier, '["Socket_8"]', text="Surface Blur Times")
                    box.prop(relief_modifier, '["Socket_9"]', text="Back Mirroring")
            else:
                layout.label(text="Insufficient points to use functions")
        else:
            layout.operator("sculptok.login")
            layout.operator("sculptok.get_api")
            layout.prop(context.scene, "sculptok_api_key")
            layout.operator("sculptok.save_api_key")

# ========================
# Registration and Unregistration
# =================
classes = (
    sculptok_OT_Login,
    sculptok_OT_GetAPI,
    sculptok_OT_SaveAPIKey,
    sculptok_OT_LocalUploadAndDraw,
    sculptok_OT_LocalUploadAndDraw3D,
    sculptok_OT_OpenModelsFolder,
    sculptok_OT_WebUpload,
    sculptok_OT_ImportGeneratedImage,
    sculptok_OT_ManualDownload,
    sculptok_OT_ImportPreset,
    sculptok_OT_ImportHeightmap,
    sculptok_PT_Panel,
)

def register():
    for cls in classes:
        bpy.utils.register_class(cls)
    
    bpy.types.Scene.sculptok_api_key = StringProperty(
        name="API Key",
        description="Enter your Sculptok API Key",
        default=""
    )
    bpy.types.Scene.sculptok_points = IntProperty(
        name="Points",
        description="Current points",
        default=0
    )
    bpy.types.Scene.sculptok_draw_style = EnumProperty(
        name="Style Type",
        description="Select the style type for the image",
        items=[
            ("normal", "Normal", "Normal Style"),
            ("portrait", "Portrait", "Portrait Style"),
            ("sketch", "Sketch", "Sketch Style"),
            ("pro", "Pro", "Pro Style")
        ],
        default="normal"
    )
    bpy.types.Scene.sculptok_ext_info = EnumProperty(
        name="Ext Info",
        description="Bit depth for the generated image",
        items=[
            ("8bit", "8bit", "8bit"),
            ("16bit", "16bit", "16bit"),
            ("exr", "exr", "exr")
        ],
        default="8bit"
    )
    bpy.types.Scene.sculptok_hd_fix = EnumProperty(
        name="HD Fix",
        description="Precision of image you uploaded",
        items=[
            ("basic", "Basic", "Basic Precision"),
            ("standard", "Standard", "Standard Precision"),
            ("high", "High", "High Precision")
        ],
        default="basic"
    )
    bpy.types.Scene.sculptok_task_id = StringProperty(
        name="Task ID",
        description="Enter the task ID",
        default=""
    )
    bpy.types.Scene.sculptok_position = IntProperty(
        name="Queue Position",
        description="Current queue position",
        default=0
    )
    bpy.types.Scene.sculptok_progress = IntProperty(
        name="Progress",
        description="Task progress",
        default=0
    )
    bpy.types.Scene.sculptok_img_count = IntProperty(
        name="Image Count",
        description="Number of saved images",
        default=0
    )

def unregister():
    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    
    del bpy.types.Scene.sculptok_api_key
    del bpy.types.Scene.sculptok_points
    del bpy.types.Scene.sculptok_draw_style
    del bpy.types.Scene.sculptok_ext_info
    del bpy.types.Scene.sculptok_hd_fix
    del bpy.types.Scene.sculptok_task_id
    del bpy.types.Scene.sculptok_position
    del bpy.types.Scene.sculptok_progress
    del bpy.types.Scene.sculptok_img_count

if __name__ == "__main__":
    register()