const { Vector2D, Matrix2D, pxToMm, scaleViewBox } = require('../lumenburn/math/geometry');
const { Linearizer } = require('../lumenburn/math/linearizer');

describe('Geometry', () => {
    test('Vector2D operations', () => {
        const v1 = new Vector2D(1, 2);
        const v2 = new Vector2D(3, 4);
        const sum = v1.add(v2);
        expect(sum.x).toBe(4);
        expect(sum.y).toBe(6);
    });

    test('pxToMm', () => {
        expect(pxToMm(96)).toBeCloseTo(25.4);
    });
    
    test('Linearizer parses SVG', () => {
        const lin = new Linearizer();
        const vertices = lin.linearize('M 0 0 L 10 10 Z');
        expect(vertices.length).toBe(3);
        expect(vertices[0].x).toBe(0);
        expect(vertices[1].x).toBe(10);
        expect(vertices[2].x).toBe(0);
    });
});
