/**
 * LBRN2 XML Document Generator
 */
const { CutSettings } = require('./cut_settings');

function escapeXml(unsafe) {
    if (typeof unsafe !== 'string') return unsafe;
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

class Lbrn2Builder {
    constructor(cutSettings) {
        this.cutSettings = cutSettings || new CutSettings();
        this.shapes = [];
    }

    addPath(cutIndex, transform, vertices, primitives) {
        this.shapes.push({
            type: 'Path',
            cutIndex,
            transform, // Array of 6 numbers: [a, b, c, d, e, f]
            vertices, // Array of {x, y, ...}
            primitives // Array of strings (e.g. 'L', 'B')
        });
    }

    _buildCutSettingsXml() {
        const settings = this.cutSettings.getAllSettings();
        let xml = '  <CutSetting>\n';
        for (const s of settings) {
            xml += `    <CutSetting index="${s.index}" speed="${s.speed}" power="${s.power}" passes="${s.passes}" air_assist="${s.airAssist}" color="${escapeXml(s.color)}" />\n`;
        }
        xml += '  </CutSetting>\n';
        return xml;
    }

    _buildShapesXml() {
        let xml = '  <ShapeList>\n';
        for (const s of this.shapes) {
            if (s.type === 'Path') {
                xml += `    <Shape Type="Path" CutIndex="${s.cutIndex}">\n`;
                if (s.transform) {
                    xml += `      <XForm>${s.transform.join(' ')}</XForm>\n`;
                }
                if (s.vertices && s.vertices.length > 0) {
                    for (const v of s.vertices) {
                        xml += `      <V x="${v.x}" y="${v.y}" />\n`;
                    }
                }
                if (s.primitives && s.primitives.length > 0) {
                    xml += `      <P>${s.primitives.join(' ')}</P>\n`;
                }
                xml += `    </Shape>\n`;
            }
        }
        xml += '  </ShapeList>\n';
        return xml;
    }

    build() {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<LightBurnProject AppVersion="1.4.00" FormatVersion="1">\n';
        xml += this._buildCutSettingsXml();
        xml += this._buildShapesXml();
        xml += '</LightBurnProject>';
        return xml;
    }
}

module.exports = {
    Lbrn2Builder,
    escapeXml
};
