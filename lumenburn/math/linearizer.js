import { Vector2D } from './geometry.js';

export class Linearizer {
    constructor(toleranceOrPath = 0.1) {
        if (typeof toleranceOrPath === 'string') {
            this.tolerance = 0.1;
            this.pathStr = toleranceOrPath;
        } else {
            this.tolerance = toleranceOrPath;
            this.pathStr = '';
        }
    }

    parseSVGPath(pathStr) {
        const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
        let match;
        const commands = [];
        while ((match = regex.exec(pathStr)) !== null) {
            const type = match[1];
            const args = match[2].trim().split(/[\s,]+/).filter(s => s !== '').map(Number);
            commands.push({ type, args });
        }
        return commands;
    }

    sampleBezier(p0, p1, p2, p3) {
        const points = [];
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const u = 1 - t;
            const x = u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x;
            const y = u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y;
            points.push(new Vector2D(x, y));
        }
        return points;
    }

    sampleArc(rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y, currX, currY) {
        return [new Vector2D(currX, currY), new Vector2D(x, y)];
    }

    linearize(pathStr) {
        const str = pathStr || this.pathStr;
        const commands = this.parseSVGPath(str);
        const vertices = [];
        let currentPoint = new Vector2D(0, 0);
        let subpathStart = new Vector2D(0, 0);

        for (const cmd of commands) {
            const { type, args } = cmd;
            switch (type) {
                case 'M':
                    currentPoint = new Vector2D(args[0], args[1]);
                    subpathStart = currentPoint.clone();
                    vertices.push(currentPoint);
                    break;
                case 'L':
                    currentPoint = new Vector2D(args[0], args[1]);
                    vertices.push(currentPoint);
                    break;
                case 'Z':
                case 'z':
                    vertices.push(subpathStart.clone());
                    currentPoint = subpathStart.clone();
                    break;
                default:
                    if (args && args.length >= 2) {
                        currentPoint = new Vector2D(args[args.length - 2], args[args.length - 1]);
                        vertices.push(currentPoint);
                    }
                    break;
            }
        }
        return vertices;
    }

    process() {
        const vertices = this.linearize(this.pathStr);
        return { vertices, primitives: [] };
    }
    
    generateLightBurnPrimitives(vertices) {
        return vertices.map((v, i) => `<V T="${i===0 ? 0 : 1}" X="${v.x}" Y="${v.y}"/>`);
    }
}

export default Linearizer;
