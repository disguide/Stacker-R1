const fs = require('fs');

const tsconfigPath = 'tsconfig.json';
let config = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

// The existing project didn't have strict mode, keep it the way it was.
config.compilerOptions.strict = false;

fs.writeFileSync(tsconfigPath, JSON.stringify(config, null, 2));
