/**
 * Generates a LightBurn XML (.lbrn2) project file.
 * 
 * @param {string} absoluteImagePath - The full OS path to the image file.
 * @param {number} width - Target width in mm (default 100)
 * @param {number} height - Target height in mm (default 100)
 * @returns {string} XML payload for the .lbrn2 file
 */
export const generateLightburnXML = (absoluteImagePath, width = 100, height = 100) => {
    // LightBurn settings requested:
    // Speed: 250, Max Power: 60, Min Power: 10
    // DPI: 254 (Interval: 0.1), Passes: 1, Mode: Grayscale (halfToning 2)
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<LightBurnProject AppVersion="1.4.00" FormatVersion="0" MaterialHeight="0" MirrorX="False" MirrorY="True">
    <CutSetting type="Scan">
        <index Value="0"/>
        <name Value="C00"/>
        <speed Value="250"/>
        <maxPower Value="60"/>
        <minPower Value="10"/>
        <passes Value="1"/>
        <interval Value="0.1"/>
        <color Value="#000000"/>
        <halfToning Value="2"/>
        <isDark Value="True"/>
        <output Value="True"/>
    </CutSetting>
    <Shape Type="Picture" CutIndex="0">
        <XForm>1 0 0 1 0 0</XForm>
        <Width Value="${width}"/>
        <Height Value="${height}"/>
        <ImagePath Value="${absoluteImagePath}"/>
        <LockRatio Value="True"/>
    </Shape>
</LightBurnProject>`;
};