import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CutSettings } from '../lumenburn/xml/cut_settings.js';
import { Lbrn2Builder, escapeXml } from '../lumenburn/xml/lbrn2_builder.js';

describe('CutSettings', () => {
    it('should assign indices to colors up to 29', () => {
        const cs = new CutSettings();
        assert.equal(cs.getIndexForColor('red'), 0);
        assert.equal(cs.getIndexForColor('blue'), 1);
        assert.equal(cs.getIndexForColor('red'), 0); // reuse
    });

    it('should update settings', () => {
        const cs = new CutSettings();
        cs.setSettingForColor('red', { speed: 50, power: 80 });
        const settings = cs.getSettingsForIndex(0);
        assert.equal(settings.speed, 50);
        assert.equal(settings.power, 80);
    });

    it('should throw when exceeding 29 cut indexes', () => {
        const cs = new CutSettings();
        for (let i = 0; i < 30; i++) {
            cs.getIndexForColor(`color${i}`);
        }
        assert.throws(() => cs.getIndexForColor('color30'), /Maximum CutIndex of 29 reached/);
    });
});

describe('Lbrn2Builder', () => {
    it('should escape xml entities', () => {
        assert.equal(escapeXml('< > & \' "'), '&lt; &gt; &amp; &apos; &quot;');
    });

    it('should build lbrn2 valid xml', () => {
        const cs = new CutSettings();
        cs.setSettingForColor('red', { speed: 100 });
        
        const builder = new Lbrn2Builder(cs);
        builder.addPath(0, [1, 0, 0, 1, 0, 0], [{x: 0, y: 0}, {x: 10, y: 10}], ['L']);
        
        const xml = builder.build();
        assert.ok(xml.includes('AppVersion="1.4.00"'));
        assert.ok(xml.includes('<CutSetting index="0" speed="100"'));
        assert.ok(xml.includes('<Shape Type="Path" CutIndex="0">'));
        assert.ok(xml.includes('<XForm>1 0 0 1 0 0</XForm>'));
        assert.ok(xml.includes('<V x="0" y="0" />'));
        assert.ok(xml.includes('<P>L</P>'));
    });
});
