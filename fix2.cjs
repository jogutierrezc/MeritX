const fs = require('fs');

// 1. Fix ExpedientesPage.tsx
let f = 'src/pages/ExpedientesPage.tsx';
let c = fs.readFileSync(f, 'utf8');
c = c.replace(/import { importOrcidProduccion as importOrcidProduccionFromApi } from '\.\.\/services\/orcid';\r?\n/, '');
c = c.replace(/import { useSpacetime } from '\.\.\/context\/SpacetimeContext';/, 
  "import { useSpacetime } from '../context/SpacetimeContext';\nimport { getPortalSession } from '../services/portalAuth';");
fs.writeFileSync(f, c);

// 2. Fix setConnected usages
const filesWithSetConnected = [
  'src/pages/InicioPage.tsx',
  'src/pages/talento_humano/ChatMetriXModule.tsx',
  'src/pages/talento_humano/ConvocatoriasModule.tsx',
  'src/pages/talento_humano/PerfilesModule.tsx'
];

filesWithSetConnected.forEach(file => {
  let text = fs.readFileSync(file, 'utf8');
  text = text.replace(/setConnected\(.*?\);/g, '');
  fs.writeFileSync(file, text);
});
