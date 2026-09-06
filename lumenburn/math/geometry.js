export class Vector2D {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(v) { return new Vector2D(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector2D(this.x - v.x, this.y - v.y); }
    mul(scalar) { return new Vector2D(this.x * scalar, this.y * scalar); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    dist(v) { return this.sub(v).mag(); }
    clone() { return new Vector2D(this.x, this.y); }
}

export class Matrix2D {
    constructor(a = 1, b = 0, c = 0, d = 1, tx = 0, ty = 0) {
        this.a = a; this.b = b; this.c = c; this.d = d; this.tx = tx; this.ty = ty;
    }
    
    transformPoint(x, y) {
        return new Vector2D(
            this.a * x + this.c * y + this.tx,
            this.b * x + this.d * y + this.ty
        );
    }
}

export function pxToMm(px, ppi = 96) {
    return px * 25.4 / ppi;
}

export function scaleViewBox(viewBoxStr, widthMm, heightMm) {
    if (!viewBoxStr) return { scaleX: 1, scaleY: 1, tx: 0, ty: 0 };
    const parts = viewBoxStr.split(/[\s,]+/).map(Number);
    if (parts.length !== 4) return { scaleX: 1, scaleY: 1, tx: 0, ty: 0 };
    const [minX, minY, vbWidth, vbHeight] = parts;
    return {
        scaleX: widthMm / vbWidth,
        scaleY: heightMm / vbHeight,
        tx: -minX,
        ty: -minY
    };
}

export default { Vector2D, Matrix2D, pxToMm, scaleViewBox };
