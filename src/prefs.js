/*
* Name: Wallpaper Switcher
* Description: Extension to automatically Change wallpaper after a given interval
* Author: Rishu Raj
*/
'use strict';

////////////////////////////////////////////////////////////
// Const Imports
const { Gtk, Adw, Gio, GLib, Gdk, GdkPixbuf } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const lib = Me.imports.lib;

////////////////////////////////////////////////////////////
// Prefs.js default functions
function init() {
    // Cargar CSS actualizado para GNOME 48
    const styleProvider = new Gtk.CssProvider();
    const cssPath = GLib.build_filenamev([Me.path, 'stylesheet.css']);
    
    try {
        styleProvider.load_from_path(cssPath);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            styleProvider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
    } catch (e) {
        log(`Error loading CSS: ${e}`);
    }
}

function fillPreferencesWindow(window) {
    window.set_default_size(530, 400);
    
    // Crear builder y cargar la interfaz
    const builder = Gtk.Builder.new();
    try {
        builder.add_from_file(GLib.build_filenamev([Me.path, 'prefs.ui']));
    } catch (e) {
        log(`Error loading UI file: ${e}`);
        return;
    }

    // Configuración
    const mySetting = ExtensionUtils.getSettings('org.gnome.shell.extensions.WallpaperSwitcher');

    // Obtener elementos de la UI
    const frequencyChanger = builder.get_object('frequency-changer');
    const switchingModeComboRow = builder.get_object("switching-mode-comborow");
    const wallpaperPathRow = builder.get_object("wallpaper-path-row");
    const wallpaperPathEntry = builder.get_object("wallpaper-path-entry");
    const showCurrentButton = builder.get_object("show-current");
    const resetButton = builder.get_object("reset-button");
    const errorGroup = builder.get_object("error-group");
    const errorRow = builder.get_object("error-row");
    const errorView = builder.get_object("error-view");

    // Limpiar mensajes de error temporales
    const dropErr = ["WC", "NIF", "PNE", "Reset"];
    if (dropErr.includes(lib.getErrorMsg().split(":--")[0])) {
        lib.setErrorMsg("");
    }

    // Configurar bindings
    mySetting.bind(
        'frequency',
        frequencyChanger,
        'value',
        Gio.SettingsBindFlags.DEFAULT
    );

    // Configurar modo de cambio
    switchingModeComboRow.connect("notify::selected-item", () => {
        lib.setSwitchingMode(switchingModeComboRow.selected);
    });
    switchingModeComboRow.selected = lib.getSwitchingMode();

    // Función para actualizar la ruta del wallpaper
    function updatePathEntry() {
        const isValid = lib.getWallpaperList(wallpaperPathEntry.text).length;
        if (isValid > 0) {
            wallpaperPathEntry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, "go-next-symbolic");
            wallpaperPathRow.set_subtitle(wallpaperPathEntry.text);
            wallpaperPathRow.set_expanded(false);
            lib.setWallpaperPath(wallpaperPathEntry.text);
            lib.setErrorMsg("WC:--" + String(isValid));
        } else {
            wallpaperPathEntry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, "mail-mark-junk-symbolic");
        }
    }

    // Configurar entrada de ruta
    wallpaperPathRow.set_subtitle(lib.getWallpaperPath());
    wallpaperPathEntry.set_text(lib.getWallpaperPath());
    wallpaperPathEntry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, "go-next-symbolic");
    wallpaperPathEntry.connect("activate", updatePathEntry);
    wallpaperPathEntry.connect("icon-press", () => updatePathEntry());

    // Botón para mostrar el wallpaper actual
    showCurrentButton.connect("clicked", () => {
        const wallpaper = lib.getCurrentWallpaperUri();
        const command = ["nautilus", "-s", wallpaper];
        GLib.spawn_async(null, command, null, GLib.SpawnFlags.SEARCH_PATH, null);
    });

    // Botón de reset
    resetButton.connect('clicked', () => {
        lib.setFrequency(300);
        lib.setWallpaperPath("/usr/share/backgrounds");
        switchingModeComboRow.selected = 1;
        lib.setWallpaperOverlaySupport(false);
        lib.setErrorMsg("Reset");
    });

    // Manejo de errores
    function showSimpleError(icon_name, title) {
        const errorRowActionRow = errorRow.get_first_child().get_first_child().get_first_child();
        const errorRowSuffix = errorRowActionRow.get_first_child().get_last_child();
        
        errorGroup.set_visible(true);
        errorRow.set_enable_expansion(false);
        errorRow.set_expanded(false);
        errorRowActionRow.set_activatable(false);
        errorRowSuffix.set_visible(false);
        errorRow.set_title(title);
        errorRow.set_icon_name(icon_name);
    }

    function showComplexError(icon_name, title, description) {
        const errorRowActionRow = errorRow.get_first_child().get_first_child().get_first_child();
        const errorRowSuffix = errorRowActionRow.get_first_child().get_last_child();
        
        errorGroup.set_visible(true);
        errorRow.set_enable_expansion(true);
        errorRow.set_expanded(false);
        errorRowActionRow.set_activatable(true);
        errorRowSuffix.set_visible(true);
        errorRow.set_title(title);
        errorRow.set_icon_name(icon_name);
        errorView.set_label(description);
    }

    function updateErrorShowStatus() {
        const errMsgs = lib.getErrorMsg().split(":--");
        
        switch(errMsgs[0]) {
            case "":
                showSimpleError("face-smile-symbolic", "Thanks for using Wallpaper Switcher");
                break;
            case "UWO":
                showSimpleError("face-smile-symbolic", "Thanks for using Wallpaper Switcher and Wallpaper Overlay");
                break;
            case "WC":
                showSimpleError("emblem-default-symbolic", errMsgs[1] + " Wallpapers Collected");
                break;
            case "NIF":
                showComplexError("dialog-warning-symbolic", "No images found", "No images found on " + errMsgs[1]);
                break;
            case "PNE":
                showComplexError("dialog-error-symbolic", "Path Does not Exist", "The path " + errMsgs[1] + " does not exist.");
                break;
            case "Reset":
                showSimpleError("emblem-default-symbolic", "Settings have been reset");
                break;
            default:
                showComplexError("dialog-error-symbolic", "Some Error Occurred", String(errMsgs));
        }
    }

    // Configurar y conectar señales
    updateErrorShowStatus();
    mySetting.connect("changed::error-msg", updateErrorShowStatus);

    // Añadir página a la ventana
    const page = builder.get_object('prefs-page');
    window.add(page);
}