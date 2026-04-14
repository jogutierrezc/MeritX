const fs = require('fs');

const files = [
  'src/pages/DirectorPage.tsx',
  'src/pages/AuxiliaresPage.tsx',
  'src/pages/decano/ConsejoFacultadPortal.tsx',
  'src/pages/auxiliares/BandejaAuditarModule.tsx',
  'src/pages/auxiliares/ConvocatoriasModule.tsx',
  'src/pages/talento_humano/ChatMetriXModule.tsx',
  'src/pages/talento_humano/ConvocatoriasModule.tsx',
  'src/pages/talento_humano/PerfilesModule.tsx',
  'src/pages/InicioPage.tsx',
  'src/pages/PortalLoginPage.tsx'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let c = fs.readFileSync(f, 'utf8');

  const depth = f.split('/').length - 2;
  const prefix = depth === 1 ? '../' : depth === 2 ? '../../' : './';

  if (!c.includes('useSpacetime } from')) {
    c = c.replace(/^(import.*?;)/m, `$1\nimport { useSpacetime } from '${prefix}context/SpacetimeContext';`);
  }

  // Remove duplicate definitions
  c = c.replace(/const\s+\[connected,\s*setConnected\]\s*=\s*useState.*?;\s*\n?/g, '');
  c = c.replace(/const\s+\[connection,\s*setConnection\]\s*=\s*useState.*?;\s*\n?/g, '');

  const matches = c.match(/const\s+\{\s*connection,\s*connected\s*\}\s*=\s*useSpacetime\(\);/g);
  if (matches && matches.length > 1) {
    let replacedFirst = false;
    c = c.replace(/const\s+\{\s*connection,\s*connected\s*\}\s*=\s*useSpacetime\(\);/g, (match) => {
      if (!replacedFirst) {
        replacedFirst = true;
        return match;
      }
      return '';
    });
  }

  fs.writeFileSync(f, c);
});
