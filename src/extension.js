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
const lib = Me.imports.lib;

////////////////////////////////////////////////////////////
// Global Variables
let mySetting;
let wallpaperOverlaySetting = null;
let handlerMode;
let handlerFrequency;
let handlerExtensionManager;
let handlerWallpaperOverlaySetting;
let timeoutId;
let imageIndex = -1;

function changeWallpaperSequentially(wallpaperSetter) {
  return () => {
    try {
      let wallpaperList = lib.getWallpaperList();
      if (wallpaperList.length == 0) {
        return GLib.SOURCE_CONTINUE;
      }
      imageIndex = imageIndex + 1;
      if (imageIndex >= wallpaperList.length) imageIndex = 0;
      wallpaperSetter(wallpaperList[imageIndex]);
      return GLib.SOURCE_CONTINUE;
    } catch {
      updateMainloop();
      return GLib.SOURCE_CONTINUE;
    }
  }
}

function changeWallpaperRandomly(wallpaperSetter) {
  return () => {
    try {
      let wallpaperList = lib.getWallpaperList();
      if (wallpaperList.length == 0) {
        return GLib.SOURCE_CONTINUE;
      }
      let idx = Math.floor(Math.random() * wallpaperList.length);
      wallpaperSetter(wallpaperList[idx]);
      return GLib.SOURCE_CONTINUE;
    } catch {
      updateMainloop();
      return GLib.SOURCE_CONTINUE;
    }
  }
}

function updateMainloop(checkWO = 0) {
  if (timeoutId) {
    GLib.Source.remove(timeoutId);
  }
  
  let wallpaperSetter = lib.getWallpaperSetterFunction();
  lib.setErrorMsg("");
  
  try {
    if (checkWO) {
      let newSetting = lib.getWallpaperOverlaySetting();
      if (newSetting != null) {
        if (wallpaperOverlaySetting != newSetting) {
          if (handlerWallpaperOverlaySetting != null && wallpaperOverlaySetting != null) {
            wallpaperOverlaySetting.disconnect(handlerWallpaperOverlaySetting);
          }
          wallpaperOverlaySetting = newSetting;
          handlerWallpaperOverlaySetting = wallpaperOverlaySetting.connect("changed::is-auto-apply", () => {
            updateMainloop(1);
          });
        }
        if (wallpaperOverlaySetting.get_boolean("is-auto-apply")) {
          wallpaperSetter = lib.getWallpaperWithOverlaySetterFunction(wallpaperOverlaySetting);
          lib.setErrorMsg("UWO");
        }
      }
    }
  } catch (e) {}
  
  timeoutId = GLib.timeout_add_seconds(
    GLib.PRIORITY_DEFAULT,
    lib.getFrequency(),
    lib.getSwitchingMode() ? changeWallpaperRandomly(wallpaperSetter) : 
                            changeWallpaperSequentially(wallpaperSetter)
  );
}

////////////////////////////////////////////////////////////
// Extension.js default functions

function init() {
  // No changes needed here
}

function enable() {
  try {
    mySetting = ExtensionUtils.getSettings('org.gnome.shell.extensions.WallpaperSwitcher');
    updateMainloop();
    wallpaperList = lib.getWallpaperList();
    
    handlerMode = mySetting.connect("changed::switching-mode", () => {
      updateMainloop(0);
    });
    
    handlerFrequency = mySetting.connect("changed::frequency", () => {
      updateMainloop(0);
    });
    
    handlerExtensionManager = ExtensionManager.connect("extension-state-changed", () => {
      updateMainloop(1);
    });
  } catch (e) {
    lib.saveExceptionLog(e);
  }
}

function disable() {
  if (handlerFrequency != null) {
    mySetting.disconnect(handlerFrequency);
  }
  if (handlerMode != null) {
    mySetting.disconnect(handlerMode);
  }
  if (handlerExtensionManager != null) {
    ExtensionManager.disconnect(handlerExtensionManager);
  }
  if (handlerWallpaperOverlaySetting != null && wallpaperOverlaySetting != null) {
    wallpaperOverlaySetting.disconnect(handlerWallpaperOverlaySetting);
  }
  if (timeoutId) {
    GLib.Source.remove(timeoutId);
  }
  
  handlerExtensionManager = null;
  handlerFrequency = null;
  handlerMode = null;
  timeoutId = null;
  mySetting = null;
}