# 📚 Mi Biblioteca v2

Aplicación de lectura personal con UI premium.

## Funcionalidades
- Sube PDFs (renderizados con PDF.js), TXT e imágenes
- Biblioteca por categorías con portadas de libro
- 4 temas de lectura: Papel ☀️, Noche 🌙, Sepia 🍂, Blanco 🔆
  - El tema afecta fondo, texto del documento y filtro de color del PDF
- Marcapáginas, notas por página (exportables)
- Última página guardada automáticamente
- Modal de detalles del libro
- Estadísticas de tiempo de lectura

## PDF.js
Los PDFs se renderizan directamente en canvas con PDF.js 3.11.
El tema de lectura aplica filtros CSS al canvas:
- Noche → invert(1) brightness(.88)  (texto blanco, fondo negro)
- Sepia  → sepia(1) contrast(1.05) brightness(.7)
- Papel  → sepia(0.12) brightness(1.02)
- Blanco → sin filtro

## Uso local
```bash
npm install
# Descomenta la línea de storage-polyfill en src/index.js
npm start
```
