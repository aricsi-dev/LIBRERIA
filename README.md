# 📚 Mi Biblioteca

Aplicación de gestión y lectura de libros personales.

## Características

- 📁 Sube PDFs, TXTs e imágenes
- 🗂 Organiza por categorías con estante visual
- 🔖 Marcapáginas por libro
- 📝 Notas por página (exportables)
- 🎨 4 temas: Papel, Noche, Sepia, Blanco
- ⏱ Estadísticas de lectura
- 🔍 Búsqueda en texto
- 📄 Modo doble página (PDFs)
- 💾 Guarda automáticamente la última página leída

## Uso en Claude.ai

Pega el contenido de `src/App.jsx` directamente como artefacto React en Claude.ai.

## Uso local (desarrollo)

```bash
npm install
# Agrega al inicio de src/index.js:
# import './storage-polyfill';
npm start
```

## Notas

- El renderizado de PDF usa PDF.js (CDN).
- El almacenamiento usa `window.storage` (API de Claude.ai).
- Para uso local activa el polyfill en `src/storage-polyfill.js`.
