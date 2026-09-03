/**
 * CutSettings layer for LumenBurn
 */

const DEFAULT_SETTINGS = {
    speed: 100, // mm/sec
    power: 100, // %
    passes: 1,
    airAssist: true
};

class CutSettings {
    constructor() {
        this.cutSettings = new Map(); // Map from index to settings
        this.colorMap = new Map(); // Map from color (hex) to index
        this.nextIndex = 0;
    }

    _getColorIndex(color) {
        if (this.colorMap.has(color)) {
            return this.colorMap.get(color);
        }
        if (this.nextIndex > 29) {
            throw new Error("Maximum CutIndex of 29 reached.");
        }
        const index = this.nextIndex++;
        this.colorMap.set(color, index);
        this.cutSettings.set(index, { ...DEFAULT_SETTINGS, color });
        return index;
    }

    setSettingForColor(color, settings) {
        const index = this._getColorIndex(color);
        const current = this.cutSettings.get(index);
        this.cutSettings.set(index, { ...current, ...settings });
        return index;
    }

    getSettingsForIndex(index) {
        return this.cutSettings.get(index);
    }

    getIndexForColor(color) {
        return this._getColorIndex(color);
    }

    getAllSettings() {
        return Array.from(this.cutSettings.entries()).map(([index, settings]) => ({
            index,
            ...settings
        }));
    }
}

module.exports = {
    CutSettings,
    DEFAULT_SETTINGS
};
