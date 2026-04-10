# MeritX - Sistema de Categorización de Profesores

MeritX es un sistema modularizado para la auditoría y categorización de profesores de la Universidad de Santander. Utiliza Vite, React, TypeScript y Tailwind CSS.

## ??? Estructura del Proyecto

```
src/
+-- components/         # Componentes React organizados por vistas
+-- services/          # Integración con APIs (Firebase, ORCID, Scopus)
+-- hooks/             # Hooks personalizados (useAuth, useRequests, useFormData)
+-- types/             # Definiciones TypeScript
+-- constants/         # Configuración del proyecto
+-- utils/             # Funciones utilitarias
```

## ?? Inicio Rápido

```bash
npm install          # Instalar dependencias
npm run dev         # Servidor de desarrollo en :5173
npm run build       # Build para producción
npm run preview     # Vista previa del build
```

## ?? Configuración de APIs

### Firebase
```typescript
// src/constants/index.ts
export const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ... más campos
};
```

### ORCID
- Client ID: APP-FIV2ITMHWJTH29SV
- Client Secret: 51a2462f-3777-476f-bd94-0cd7f64cd05b
- Redirect: http://localhost:5173/auth/orcid-callback

### Scopus
```typescript
export const SCOPUS_CONFIG = {
  apiKey: "YOUR_SCOPUS_API_KEY",
  baseUrl: "https://api.elsevier.com",
};
```

## ?? Características

- ? Panel de administración de expedientes
- ? Formulario de registro con validación
- ? Cálculo automático de puntuación
- ? Integración ORCID y Scopus
- ? Generación de dictámenes con IA
- ? Diseño brutalista responsive

## ?? Dependencias

- React 18+
- Vite
- TypeScript
- Firebase
- Tailwind CSS
- Lucide React (iconos)
- Axios

