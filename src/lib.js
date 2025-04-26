/*
* Name: Wallpaper Switcher
* Description: Extension to automatically Change wallpaper after a given interval
* Author: alfaquillo
*/
////////////////////////////////////////////////////////////
//Const Variables
const { Gio, GLib } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const homeDir = GLib.get_home_dir();

////////////////////////////////////////////////////////////
// Function Implementations
function _modifyExternalSetting(schemaPath, settingId, settingValue) {
    let setting = new Gio.Settings({
        schema_id: schemaPath  // Cambiado de schema a schema_id
    });
    
    if (setting.is_writable(settingId)) {
        let response = setting.set_string(settingId, settingValue);
        if (response) {
            setting.sync();  // Simplificado Gio.Settings.sync()
            return [settingId + " set \n", 1];
        }
        saveExceptionLog(schemaPath+"."+settingId +" unmodifiable");
        return [settingId +" unmodifiable \n", 0];
    }
    saveExceptionLog(schemaPath+"."+settingId +" unwritable");
    return [settingId +" unwritable \n", 0];
}

function getCurrentColorScheme() {
    let colorSchemeSetting = new Gio.Settings({
        schema_id: "org.gnome.desktop.interface"
    });
    return colorSchemeSetting.get_enum("color-scheme") === 1 ? 1 : 0; // 1 means dark
}

function getCurrentWallpaperUri() {
    let backgroundSetting = new Gio.Settings({
        schema_id: "org.gnome.desktop.background"
    });
    
    const uri = getCurrentColorScheme() === 1 ? 
        backgroundSetting.get_string("picture-uri-dark") : 
        backgroundSetting.get_string("picture-uri");
    
    return decodeURIComponent(uri.substring(7));  // Mejorado decodeURI
}

function getOtherExtensionSettings(schema, otherExtension) {
    if (!otherExtension)
        throw new Error('getSettings() can only be called from extensions');

    schema ||= otherExtension.metadata['settings-schema'];

    const GioSSS = Gio.SettingsSchemaSource;

    let schemaDir = otherExtension.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = GioSSS.new_from_directory(
            schemaDir.get_path(),
            GioSSS.get_default(),
            false
        );
    } else {
        schemaSource = GioSSS.get_default();
    }

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj)
        throw new Error(`Schema ${schema} could not be found for extension ${otherExtension.metadata.uuid}`);

    return new Gio.Settings({ settings_schema: schemaObj });
}

function getWallpaperOverlaySetting() {
    try {
        const ExtensionManager = imports.ui.main.extensionManager;
        let otherExtension = ExtensionManager.lookup("WallpaperOverlay@Rishu");
        
        // 1 = ENABLED
        if (otherExtension.state !== 1) {
            return null;
        }
        
        return getOtherExtensionSettings(
            'org.gnome.shell.extensions.WallpaperOverlay',
            otherExtension
        );
    } catch (e) {
        return null;
    }
}

function getWallpaperWithOverlaySetterFunction(wallpaperOverlaySetting) {
    return (path) => {
        wallpaperOverlaySetting.set_string("picture-uri", path);
    };
}

function getWallpaperSetterFunction() {
    return (path) => {
        let file = Gio.File.new_for_path(path);
        if (file.query_exists(null)) {
            let uri = "file://" + path;
            let colorScheme = getCurrentColorScheme();
            
            let setting = new Gio.Settings({
                schema_id: "org.gnome.desktop.background"
            });
            
            if (colorScheme === 0) {
                setting.set_string("picture-uri", uri);
            } else {
                setting.set_string("picture-uri-dark", uri);
            }
        }
    };
}

// Resto de las funciones permanecen iguales (saveExceptionLog, getWallpaperList, etc.)
// Solo necesitan actualizaciones menores en el manejo de paths

function getWallpaperList(wallpaperFolderPath = getWallpaperPath()) {
    try {
        if (!wallpaperFolderPath.endsWith('/')) {
            wallpaperFolderPath += "/";
        }
        
        let wallpaperFolder = Gio.File.new_for_path(wallpaperFolderPath);
        let enumerator = wallpaperFolder.enumerate_children(
            "standard::name,standard::type",
            Gio.FileQueryInfoFlags.NONE,  // Cambiado de NOFOLLOW_SYMLINKS
            null
        );
        
        let wallpaperPaths = [];
        let child;
        while ((child = enumerator.next_file(null))) {
            if (child.get_file_type() === Gio.FileType.REGULAR && 
                !child.get_is_hidden()) {
                let ext = child.get_name().split(".").pop().toLowerCase();
                if (["png", "jpg", "jpeg"].includes(ext)) {
                    wallpaperPaths.push(wallpaperFolderPath + child.get_name());
                }
            }
        }
        
        if (wallpaperPaths.length === 0) {
            setErrorMsg("NIF:--\n"+wallpaperFolderPath);
        }
        return wallpaperPaths;
    } catch (e) {
        setErrorMsg("PNE:--\n"+wallpaperFolderPath);
        return [];
    }
}


function getFrequency(){
  return ExtensionUtils.getSettings('org.gnome.shell.extensions.WallpaperSwitcher').get_int('frequency');
}
function getWallpaperPath(){
  return ExtensionUtils.getSettings('org.gnome.shell.extensions.WallpaperSwitcher').get_string('wallpaper-path');
}
function getSwitchingMode(){
  return ExtensionUtils.getSettings('org.gnome.shell.extensions.WallpaperSwitcher').get_int('switching-mode');
}
function setFrequency(val){
  return ExtensionUtils.getSettings('org.gnome.shell.extensions.WallpaperSwitcher').set_int('frequency',val);
}
function setWallpaperPath(val){
  if(val[0] == "~"){
    val = homeDir + val.substr(1,)
  }
  return ExtensionUtils.getSettings('org.gnome.shell.extensions.WallpaperSwitcher').set_string('wallpaper-path',val);
}
function setSwitchingMode(val){
  return ExtensionUtils.getSettings('org.gnome.shell.extensions.WallpaperSwitcher').set_int('switching-mode',val);
}
function getErrorMsg(){
  return ExtensionUtils.getSettings('org.gnome.shell.extensions.WallpaperSwitcher').get_string('error-msg');
}
function setErrorMsg(val){
  let dropErr = ["UWO",""]
  if(!dropErr.includes(val)) saveExceptionLog("DisplayLog: "+String(val));
  return ExtensionUtils.getSettings('org.gnome.shell.extensions.WallpaperSwitcher').set_string('error-msg',String(val));
}
