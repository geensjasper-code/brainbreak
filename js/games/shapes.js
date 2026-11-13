// Shape glyphs used by memory and logic games.

export const SHAPES = ['circle', 'square', 'triangle', 'diamond', 'hexagon', 'star'];
export const COLORS = ['#FF4D5E', '#FFB400', '#2F6BFF', '#12B57A', '#8A5CF6', '#172033'];
export const FILLS = ['solid', 'outline', 'light'];
export const SIZES = [0.55, 0.78, 1];

function poly(points) { return points.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' '); }

function shapeEl(shape, cx, cy, r, paint) {
  switch (shape) {
    case 'circle': return `<circle cx="${cx}" cy="${cy}" r="${r * 0.92}" ${paint}/>`;
    case 'square': { const s = r * 1.62; return `<rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="${r * 0.2}" ${paint}/>`; }
    case 'triangle': return `<polygon points="${poly([[cx, cy - r], [cx + r * 1.0, cy + r * 0.78], [cx - r * 1.0, cy + r * 0.78]])}" ${paint}/>`;
    case 'diamond': return `<polygon points="${poly([[cx, cy - r], [cx + r * 0.9, cy], [cx, cy + r], [cx - r * 0.9, cy]])}" ${paint}/>`;
    case 'hexagon': {
      const pts = [];
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      return `<polygon points="${poly(pts)}" ${paint}/>`;
    }
    case 'star': {
      const pts = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r * 1.05;
        pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
      }
      return `<polygon points="${poly(pts)}" ${paint}/>`;
    }
    default: return '';
  }
}

const LAYOUT = {
  1: [[50, 50, 32]],
  2: [[29, 50, 19], [71, 50, 19]],
  3: [[50, 29, 17], [29, 69, 17], [71, 69, 17]],
};

export function glyph({ shape = 'circle', color = COLORS[0], size = 1, fill = 'solid', count = 1 }, cls = '') {
  const paint = fill === 'solid'
    ? `fill="${color}"`
    : fill === 'outline'
      ? `fill="none" stroke="${color}" stroke-width="6" stroke-linejoin="round"`
      : `fill="${color}" fill-opacity="0.28" stroke="${color}" stroke-width="5" stroke-linejoin="round"`;
  const body = LAYOUT[count].map(([x, y, r]) => shapeEl(shape, x, y, r * size, paint)).join('');
  return `<svg class="glyph ${cls}" viewBox="0 0 100 100" aria-hidden="true">${body}</svg>`;
}

export const sameGlyph = (a, b) => ['shape', 'color', 'size', 'fill', 'count'].every((k) => (a[k] ?? null) === (b[k] ?? null));
export const glyphKey = (g) => ['shape', 'color', 'size', 'fill', 'count'].map((k) => g[k] ?? '-').join('|');
