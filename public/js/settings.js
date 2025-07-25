import { defaultSettings, SETTINGS_KEY } from './config.js';
import { applyUI, updateSettingsUI, showToast } from './ui.js';

let settings = { ...defaultSettings };
let tempSettings = { ...defaultSettings };

export function getSettings() {
    return settings;
}

export function loadSettings() {
    try {
        const storedSettings = localStorage.getItem(SETTINGS_KEY);
        if (storedSettings) {
            settings = { ...defaultSettings, ...JSON.parse(storedSettings) };
        }
        tempSettings = { ...settings };
    } catch (e) {
        console.error("Failed to load settings:", e);
    }
    applyUI(settings);
    updateSettingsUI(settings);
}

export function saveSettings() {
    settings = { ...tempSettings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    applyUI(settings);
    showToast("Einstellungen gespeichert und angewendet!");
}

export function resetSettings() {
    if (confirm("Möchten Sie wirklich alle Einstellungen auf die Standardwerte zurücksetzen?")) {
        tempSettings = { ...defaultSettings };
        saveSettings();
        updateSettingsUI(tempSettings);
    }
}

export function handleSettingChange(e) {
    const { id, value, type, checked, name } = e.target;
    let key = id.replace('setting-', '').replace(/-/g, '');
    if (id === 'accent-color') key = 'accentColor';
    if (name === 'home-icon') key = 'homeScreenIcon';
    
    let finalValue = type === 'checkbox' ? checked : value;
    
    const keyMap = {
        uilanguage: 'uiLanguage',
        theme: 'theme',
        accentColor: 'accentColor',
        fontsize: 'fontSize',
        layoutdensity: 'layoutDensity',
        animationspeed: 'animationSpeed',
        homescreenicon: 'homeScreenIcon',
        savehistory: 'saveHistory',
        autodelete: 'autoDelete',
        tts: 'tts',
        contrastmode: 'contrastMode',
        keyboardnav: 'keyboardNav',
    };
    
    const settingKey = keyMap[key.toLowerCase()];
    if (settingKey) {
        tempSettings[settingKey] = finalValue;
        if (settingKey === 'uiLanguage') {
            applyUI(tempSettings);
        }
    }
}

export function openSettings() {
    tempSettings = { ...settings };
    updateSettingsUI(tempSettings);
    document.getElementById('settings-modal').classList.add('open');
}

export function closeSettings() {
    document.getElementById('settings-modal').classList.remove('open');
}
