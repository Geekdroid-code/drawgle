const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../lib/mobile-transpiler.ts');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Keep lines up to 2368 (index 2367 in 0-indexed array)
// Note: line 2368 is a blank line after toSwiftThemeToken function.
const truncatedLines = lines.slice(0, 2368);

// Add the re-exports
const reExports = [
  'export { transpileToSwiftUI } from "./generators/swiftui-generator";',
  'export { transpileToCompose } from "./generators/compose-generator";',
  'export { transpileToReactNative } from "./generators/react-native-generator";',
  'export { transpileToFlutter } from "./generators/flutter-generator";',
  ''
];

const newContent = truncatedLines.join('\n') + reExports.join('\n');
fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully truncated mobile-transpiler.ts and added re-exports!');
