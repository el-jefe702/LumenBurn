import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector2D, Matrix2D, pxToMm, scaleViewBox } from '../lumenburn/math/geometry.js';
import { Linearizer } from '../lumenburn/math/linearizer.js';

describe('Geometry', () => {
    test('Vector2D operations', () => {
        const v1 = new Vector2D(1, 2);
        const v2 = new Vector2D(3, 4);
        const sum = v1.add(v2);
        assert.equal(sum.x, 4);
        assert.equal(sum.y, 6);
    });

    test('pxToMm', () => {
        assert.ok(Math.abs(pxToMm(96) - 25.4) < 0.001);
    });
    
    test('Linearizer parses SVG', () => {
        const lin = new Linearizer();
        const vertices = lin.linearize('M 0 0 L 10 10 Z');
        assert.equal(vertices.length, 3);
        assert.equal(vertices[0].x, 0);
        assert.equal(vertices[1].x, 10);
        assert.equal(vertices[2].x, 0);
    });
});
