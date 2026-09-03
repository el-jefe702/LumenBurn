import fs from 'fs';
import path from 'path';
import { Converter } from './converter.js';

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: node cli.js <input.svg> <output.lbrn2>");
    process.exit(1);
}

const inputPath = path.resolve(args[0]);
const outputPath = path.resolve(args[1]);

if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found at ${inputPath}`);
    process.exit(1);
}

try {
    const svgContent = fs.readFileSync(inputPath, 'utf-8');
    const lbrn2Content = Converter.convertSvgToLbrn2(svgContent);
    fs.writeFileSync(outputPath, lbrn2Content, 'utf-8');
    console.log(`Successfully converted ${inputPath} to ${outputPath}`);
} catch (error) {
    console.error("Conversion failed:", error);
    process.exit(1);
}
