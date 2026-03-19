const fs = require('fs');
let code = fs.readFileSync('src/database/schema.ts', 'utf8');
code = code.replace("{ name: 'due_date', type: 'string', isOptional: true },", "{ name: 'due_date', type: 'string', isOptional: true },\n                { name: 'date', type: 'string' },");
fs.writeFileSync('src/database/schema.ts', code);
