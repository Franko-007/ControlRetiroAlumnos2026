# 🎒 Control de Retiro Escolar

App simple para gestionar el estado de retiro de alumnos con 3 estados:
- En espera (Rojo)
- En busca del alumno/a (Amarillo)
- Avisado para retiro (Verde)

## Cómo subir a GitHub Pages

1. Crea un repositorio nuevo (por ejemplo, `control-retiro-escolar`).
2. Sube estos archivos a la rama `main`:
   - `index.html`
   - `style.css`
   - `script.js`
   - `README.md`
3. Ve a Settings → Pages → “Build and deployment”:
   - Source: “Deploy from a branch”
   - Branch: `main` y carpeta `/root`
4. Guarda. La página se publicará en unos segundos:
   - `https://TU_USUARIO.github.io/control-retiro-escolar/`

## Uso

- Agrega alumnos con nombre y curso.
- Toca el botón de estado para ciclar entre Rojo → Amarillo → Verde.
- Usa los filtros de búsqueda, curso y estado.
- Ordena con ▲ ▼ y elimina con 🗑️.
- Los datos se guardan en `localStorage` del navegador.

## Notas

- Si quieres reiniciar la lista, usa “Vaciar lista”.
- Puedes editar colores en `style.css` (`--rojo`, `--amarillo`, `--verde`).
