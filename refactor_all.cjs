const fs = require('fs');

const files = [
  'src/pages/InicioPage.tsx',
  'src/pages/auxiliares/BandejaAuditarModule.tsx',
  'src/pages/auxiliares/ConvocatoriasModule.tsx',
  'src/pages/decano/ConsejoFacultadPortal.tsx',
  'src/pages/talento_humano/ChatMetriXModule.tsx',
  'src/pages/talento_humano/ConvocatoriasModule.tsx',
  'src/pages/talento_humano/PerfilesModule.tsx',
  'src/pages/PortalLoginPage.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  console.log(`Processing ${file}`);
  let c = fs.readFileSync(file, 'utf8');

  // Replace import
  const depth = file.split('/').length - 2;
  const prefix = depth === 1 ? '../' : depth === 2 ? '../../' : './';
  
  if (!c.includes('useSpacetime')) {
    c = c.replace(/import \{ getSpacetimeConnectionConfig \} from '.*?spacetime';\r?\n?/, 
      `import { useSpacetime } from '${prefix}context/SpacetimeContext';\n`);
  }

  // Remove setConnected and setConnection
  c = c.replace(/const\s*\[connected,\s*setConnected\]\s*=\s*useState\(false\);\r?\n?/g, '');
  c = c.replace(/const\s*\[connection,\s*setConnection\]\s*=\s*useState<DbConnection\s*\|\s*null>\(null\);\r?\n?/g, '');

  // Add { connection, connected }
  if(!c.includes('{ connection, connected } = useSpacetime();')) {
     c = c.replace(/(const \[loading,\s*setLoading\]\s*=\s*useState.*?;)/, `$1\n  const { connection, connected } = useSpacetime();`);
     // if 'loading' wasn't there (e.g. InicioPage hasn't loading), then target something else
     if(!c.includes('useSpacetime();')) {
         c = c.replace(/(const \[activeTab,\s*setActiveTab\]\s*=\s*useState.*?;)/, `const { connection, connected } = useSpacetime();\n  $1`);
     }
  }

  // Replace generic block using generic regex (carefully)
  const regex = /useEffect\(\(\) => \{\n\s*const \{ host, databaseName \} = getSpacetimeConnectionConfig\(\);[\s\S]*?conn\.disconnect\(\);\n\s*setConnection\(null\);\n\s*\};\n\s*\}, \[\]\);/g;

  if (regex.test(c)) {
     c = c.replace(regex, `useEffect(() => {
    if (connection) {
      if (typeof loadDataOnce === 'function') {
         void loadDataOnce(connection).catch(console.error);
      } else if (typeof refreshFromCache === 'function') {
         const subscription = connection.subscriptionBuilder().onApplied(() => refreshFromCache()).subscribe(['SELECT * FROM application']);
         return () => subscription.unsubscribe();
      }
    }
  }, [connection]);`);
  } else {
     // fallback if indentation or spaces differ
     const regexLoose = /useEffect\(\(\)\s*=>\s*\{[\s\S]*?getSpacetimeConnectionConfig\(\);[\s\S]*?conn\.disconnect\(\);\s*setConnection\(null\);\s*\}\s*;\s*\}\s*,\s*\[\]\s*\);/g;
     c = c.replace(regexLoose, `useEffect(() => {
    if (connection) {
       // Re-adapted connection hook (manual view needed for subscription check)
       if (typeof loadDataOnce === 'function') void loadDataOnce(connection).catch(console.error);
    }
  }, [connection]);`);
  }

  // Cleanup stray logic
  c = c.replace(/const connection = connectionRef\.current;/g, `/* connection ref removed */`);
  
  if(file.includes('PortalLoginPage')) {
     // PortalLoginPage may have a simple onConnect => ensurePortalSession. 
     // We actually don't need to wrap SpacetimeProvider around Auth page if it works standalone, 
     // but leaving it is fine or skipping it is fine.
  }

  fs.writeFileSync(file, c);
});
