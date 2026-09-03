import fs from 'fs';
import { Linearizer } from './math/linearizer.js';
import { LBRN2Builder } from './xml/lbrn2_builder.js';
import { CutSettingsManager } from './xml/cut_settings.js';

export class Converter {
    /**
     * Converts raw SVG content to LBRN2 XML format.
     * @param {string} svgContent 
     * @returns {string} LBRN2 XML string
     */
    static convertSvgToLbrn2(svgContent) {
        // 1. Initialize builders
        const cutSettingsManager = new CutSettingsManager();
        const builder = new LBRN2Builder();

        // 2. Parse SVG 
        // Note: For a production engine, you'd use a full XML DOM parser here. 
        // We'll extract basic path tags using regex for this iteration of the engine.
        const pathRegex = /<path[^>]*d="([^"]+)"[^>]*stroke="([^"]+)"/g;
        
        let match;
        while ((match = pathRegex.exec(svgContent)) !== null) {
            const dString = match[1];
            const strokeColor = match[2];

            // 3. Map Color to Cut Index
            const cutIndex = cutSettingsManager.getOrAssignIndex(strokeColor);

            // 4. Linearize path to vertices and primitives
            const linearizer = new Linearizer(dString);
            const { vertices, primitives } = linearizer.process();

            // 5. Add to builder
            builder.addShape({
                cutIndex,
                vertices,
                primitives
            });
        }

        // 6. Build final XML with cut settings
        const cutSettings = cutSettingsManager.getAllSettings();
        return builder.build(cutSettings);
    }
}
