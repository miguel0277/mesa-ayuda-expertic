# Dirección visual: "Bitácora"

> Estado: **propuesta para aprobación** (Fase 2). Muestra viva en `pnpm dev` → http://localhost:3000/diseno (solo en desarrollo).

## La idea

El problema que resuelve la Mesa de Ayuda es que **nada quedaba registrado**: quién pidió qué, quién lo atiende y si se cumplió a tiempo. Por eso la dirección se llama **Bitácora**: un registro de trabajo sobrio y preciso, donde el tiempo es la dimensión principal.

- Es una herramienta de uso diario. Debe sentirse **tranquila, ordenada y rápida**, no como una página de marketing.
- La personalidad sale de **la marca ExperTIC** (el azul y el verde del logo) y de **una sola pieza propia**: la regla de tiempo.
- Todo lo demás es disciplinado: bordes finos en lugar de sombras, poca decoración y mucho espacio para el contenido real.

## Revisión contra el brief (qué descarté y por qué)

| Primera idea                                                          | Por qué no                                                                       | Qué quedó                                                                                   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Inter o Geist (lo que traía el proyecto)                              | Es la tipografía por defecto de casi cualquier SaaS; no dice nada de ExperTIC    | **IBM Plex Sans**: técnica pero humana, con números tabulares reales y buenas tildes y eñes |
| EB Garamond, recomendada por la base de ui-ux-pro-max ("universidad") | Sirve para un sitio académico, no para una herramienta que se usa 8 horas al día | Plex Sans en todo; la seriedad la aporta el logo                                            |
| Cinco tarjetas KPI sueltas con sombra y degradado                     | Es el kit SaaS genérico, y separa lo que se lee junto                            | **Una sola banda** dividida por líneas finas                                                |
| Etiquetas en MAYÚSCULAS sobre cada sección                            | Ruido; parece plantilla                                                          | Títulos en tipo oración ("Cumplimiento por auxiliar")                                       |
| Semáforo como puntos de color                                         | Inaccesible para daltónicos                                                      | Ícono + texto + color, siempre                                                              |

## Color

Sale del logo oficial. Todos los pares texto/fondo se verificaron con un script: **cumplen AA (≥ 4.5:1)** en claro y oscuro (el más bajo da 4.61:1).

| Rol                      | Claro     | Oscuro    | Uso                                                                      |
| ------------------------ | --------- | --------- | ------------------------------------------------------------------------ |
| Azul ExperTIC (primario) | `#1673BB` | `#4A9EE0` | Botones principales, enlaces, foco, ítem activo                          |
| Verde SEA (acento)       | `#85BE53` | `#8FCB5E` | "A tiempo", detalles de marca. **Nunca como texto** sobre blanco (2.3:1) |
| Verde para texto         | `#3B6A1C` | `#A6D97A` | Cuando el verde tiene que leerse                                         |
| Fondo ("papel" frío)     | `#F4F6F9` | `#0B131C` | Lienzo de la app                                                         |
| Tarjeta                  | `#FFFFFF` | `#111B26` | Superficies de trabajo                                                   |
| Tinta                    | `#16202B` | `#E4EBF2` | Texto principal (16.5:1)                                                 |
| Texto secundario         | `#556373` | `#95A5B6` | Metadatos, ayudas                                                        |
| Borde                    | `#D9E1E9` | `#233040` | Estructura                                                               |

**Semáforo:** cada estado tiene un relleno (barras y puntos), un fondo suave (chips) y una tinta AA (texto).

| Estado    | Ícono        | Tinta     | Relleno                       |
| --------- | ------------ | --------- | ----------------------------- |
| A tiempo  | ✓ en círculo | `#3B7A1F` | `#85BE53` (el verde del logo) |
| En riesgo | Reloj        | `#8A5300` | `#F0A92E`                     |
| Atrasada  | ! en círculo | `#B42318` | `#E5483B`                     |

Los tokens viven en un solo lugar: `src/app/globals.css` (`:root` y `.dark`). Para cambiar a los colores oficiales exactos de ExperTIC o UIS basta con editar esas variables.

## Tipografía

- **IBM Plex Sans** (400, 500, 600 y 700) para toda la interfaz, con el _stylistic set_ `ss02` (la "a" y la "g" de un solo piso, más legibles en pantalla).
- **IBM Plex Mono** solo para **códigos** (`EXP-2026-00042`, `TAR-2026-00107`), con cero tachado. Son identificadores que la gente dicta y copia, así que tiene sentido que se distingan.
- **Números tabulares** (`.tabular`) en tablas, KPIs y contadores, para que las cifras no "bailen".

| Nivel            | Tamaño y peso                             | Ejemplo                   |
| ---------------- | ----------------------------------------- | ------------------------- |
| Título de página | 24 px, 600                                | Panel de control          |
| Cifra KPI        | 28 px, 600, tabular                       | 72 %                      |
| Sección          | 16–18 px, 600                             | Cumplimiento por auxiliar |
| Cuerpo           | 16 px, 400, máx. ~70 caracteres por línea | Descripciones, mensajes   |
| Interfaz         | 14 px                                     | Tablas, botones, menús    |
| Metadatos        | 12–13 px                                  | "hace 2 h", autor         |

## Forma

- **Radios con jerarquía:** 6 px en controles, 8 px en botones, 12 px en tarjetas y paneles, 16 px en contenedores grandes, y círculo en avatares (eco del círculo del logo).
- **Sombras casi nulas:** la estructura la dan bordes de 1 px. La sombra solo aparece en lo que flota (menús, diálogos, paleta ⌘K).
- **Controles de 36 px** (40 px en la acción principal). En móvil los objetivos táctiles llegan a 44 px.

## La pieza propia: la regla de tiempo

Una pista fina con una **marca vertical en el vencimiento**. El relleno muestra cuánto del plazo ya se consumió y toma el color del semáforo. Si se pasa del vencimiento, el exceso se ve después de la marca.

- Es **la misma** en tickets (SLA), tareas (fecha límite) y paneles, así "¿vamos a tiempo?" se lee igual en toda la app.
- Siempre va con texto: "Vence en 6 h", "Venció hace 1 día", "Cumplida con 2 días de retraso". La fecha exacta aparece en un tooltip.
- Es accesible: `role="meter"` con descripción completa para lectores de pantalla.

## Estructura (shell)

```
Escritorio (≥ 1024 px)
┌──────────────┬─────────────────────────────────────────────────┐
│ [logo]       │ Inicio / Panel de control    [Buscar…  Ctrl K] 🔔│
│              ├─────────────────────────────────────────────────┤
│ Seguimiento  │ Panel de control              [filtros] [Acción]│
│ ▌Panel       │ Martes 10 de noviembre…                          │
│  Bandeja   8 │ ┌────────┬────────┬────────┬────────┬────────┐  │
│  Tareas      │ │ KPI    │ KPI    │ KPI    │ KPI    │ KPI    │  │
│              │ └────────┴────────┴────────┴────────┴────────┘  │
│ Gestión      │ ┌─────────────────────────┐ ┌─────────────────┐  │
│  Auxiliares  │ │ Lista principal          │ │ Lista secundaria│  │
│  Plantillas  │ │                         │ │                 │  │
│  Reportes    │ └─────────────────────────┘ └─────────────────┘  │
│ [usuario ▾]  │                                                  │
└──────────────┴─────────────────────────────────────────────────┘

Móvil (375 px): [☰] Panel de control      [🔍] 🔔
                el sidebar pasa a un cajón (drawer), las tablas a listas apiladas
```

- **Sidebar agrupado por rol** (cada rol ve solo sus secciones), con el ítem activo marcado por una barra azul a la izquierda.
- **Topbar:** migas de pan, búsqueda con ⌘K / Ctrl+K y campana de notificaciones.
- Contenido alineado a la izquierda y ancho máximo de 1440 px.

## Movimiento

Presets en `src/shared/ui/motion.ts`. Principio: **el movimiento responde a una acción o señala un cambio; no decora.**

| Momento                         | Movimiento                                      |
| ------------------------------- | ----------------------------------------------- |
| Cambio de página                | Fundido + 8 px, 220 ms, _ease-out_              |
| Entrada de KPIs y filas         | Escalonado de 40 ms, una sola vez               |
| KPIs                            | Contador animado (900 ms) al entrar en pantalla |
| Botones                         | Escala 0.98 al presionar                        |
| Kanban                          | Animación de _layout_ + _spring_ al soltar      |
| Completar tarea o enviar ticket | Checkmark animado                               |
| Notificación nueva              | Un solo pulso del contador (no en bucle)        |
| Skeletons                       | _Shimmer_ con `transform` (sin repintar)        |

Con `prefers-reduced-motion` todo se desactiva: `MotionConfig reducedMotion="user"` más una regla CSS global.

## Accesibilidad (piso, no extra)

- Contraste AA verificado; el semáforo nunca depende solo del color.
- Foco visible de 2 px en el azul de marca; navegación completa por teclado; `<button>` y `<a>` reales.
- Etiquetas en todos los campos; las acciones con solo ícono llevan `aria-label`.
- Fechas relativas ("hace 2 h") con la fecha absoluta en un tooltip y en `<time dateTime>`.

## Modo oscuro y logo

- Fondo azul noche (no negro puro), con los mismos roles y contrastes.
- El logo trae "TIC" en negro, así que **en modo oscuro se apoya sobre una placa blanca**. Si ExperTIC tiene una versión del logo para fondos oscuros, la cambiamos.

## Lo que sigue en la Fase 2 (después de tu aprobación)

1. Shell real e interactivo: sidebar colapsable por rol, cajón en móvil, menú de usuario y migas automáticas.
2. Paleta de comandos ⌘K (`cmdk`) con navegación según el rol.
3. Campana de notificaciones (vacía por ahora) y tema claro/oscuro/sistema en el menú de usuario.
4. Estados globales: carga (skeletons con la forma real), vacío, error con "Reintentar", **403 amable** y 404.
5. Transiciones de página con Motion o View Transitions.
