const fs = require('fs');

const layoutPath = 'app/_layout.tsx';
let code = fs.readFileSync(layoutPath, 'utf8');

const importStatement = `import { migrateHistoryToWatermelonDB } from '../src/database/migration';
import { useEffect } from 'react';`;

code = code.replace("import * as SplashScreen from 'expo-splash-screen';", "import * as SplashScreen from 'expo-splash-screen';\n" + importStatement);

const hookCode = `
    useEffect(() => {
        let mounted = true;
        const prepare = async () => {
            try {
                // Migrate any old AsyncStorage data to WatermelonDB on startup
                await migrateHistoryToWatermelonDB();
            } catch (e) {
                console.warn('Migration failed or skipped:', e);
            } finally {
                // Tell the application to render
                if (mounted) {
                    SplashScreen.hideAsync();
                }
            }
        };

        prepare();
        return () => { mounted = false; };
    }, []);
`;

code = code.replace("export default function Layout() {", "export default function Layout() {\n" + hookCode);

fs.writeFileSync(layoutPath, code);
