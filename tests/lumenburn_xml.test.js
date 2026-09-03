const { CutSettings } = require('../lumenburn/xml/cut_settings');
const { Lbrn2Builder, escapeXml } = require('../lumenburn/xml/lbrn2_builder');

describe('CutSettings', () => {
    it('should assign indices to colors up to 29', () => {
        const cs = new CutSettings();
        expect(cs.getIndexForColor('red')).toBe(0);
        expect(cs.getIndexForColor('blue')).toBe(1);
        expect(cs.getIndexForColor('red')).toBe(0); // reuse
    });

    it('should update settings', () => {
        const cs = new CutSettings();
        cs.setSettingForColor('red', { speed: 50, power: 80 });
        const settings = cs.getSettingsForIndex(0);
        expect(settings.speed).toBe(50);
        expect(settings.power).toBe(80);
    });

    it('should throw when exceeding 29 cut indexes', () => {
        const cs = new CutSettings();
        for (let i = 0; i < 30; i++) {
            cs.getIndexForColor(`color${i}`);
        }
        expect(() => cs.getIndexForColor('color30')).toThrow("Maximum CutIndex of 29 reached.");
    });
});

describe('Lbrn2Builder', () => {
    it('should escape xml entities', () => {
        expect(escapeXml('< > & \\\' "')).toBe('&lt; &gt; &amp; &apos; &quot;');
    });

    it('should build lbrn2 valid xml', () => {
        const cs = new CutSettings();
        cs.setSettingForColor('red', { speed: 100 });
        
        const builder = new Lbrn2Builder(cs);
        builder.addPath(0, [1, 0, 0, 1, 0, 0], [{x: 0, y: 0}, {x: 10, y: 10}], ['L']);
        
        const xml = builder.build();
        expect(xml).toContain('AppVersion="1.4.00"');
        expect(xml).toContain('<CutSetting index="0" speed="100"');
        expect(xml).toContain('<Shape Type="Path" CutIndex="0">');
        expect(xml).toContain('<XForm>1 0 0 1 0 0</XForm>');
        expect(xml).toContain('<V x="0" y="0" />');
        expect(xml).toContain('<P>L</P>');
    });
});
