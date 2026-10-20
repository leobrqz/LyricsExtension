export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'className') node.className = value;
    else if (key === 'value') node.value = value;
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? '' : String(value));
  }
  children.flat(Infinity).filter(child => child !== undefined && child !== null && child !== false).forEach(child => {
    node.append(typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child);
  });
  return node;
}

const shapes = {
  wave: [['path', { d: 'M4 8v8m5-12v16m6-12v8m5-10v12' }]],
  search: [['circle', { cx: 10.7, cy: 10.7, r: 6.7 }], ['path', { d: 'm16 16 4.2 4.2' }]],
  star: [['path', { d: 'm12 3 2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.4l-5.6 3 1.1-6.3-4.6-4.5 6.3-.9L12 3Z' }]],
  heart: [['path', { d: 'M20.2 5.8a5 5 0 0 0-7.1 0L12 6.9l-1.1-1.1a5 5 0 0 0-7.1 7.1L12 21l8.2-8.1a5 5 0 0 0 0-7.1Z' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3 2' }]],
  back: [['path', { d: 'm14 6-6 6 6 6M8 12h12' }]],
  arrow: [['path', { d: 'M5 12h14m-5-5 5 5-5 5' }]],
  chevron: [['path', { d: 'm9 6 6 6-6 6' }]],
  close: [['path', { d: 'm7 7 10 10M7 17 17 7' }]],
  settings: [['path', { d: 'm9 3-.5 2-2 1.2-2-.5L2.5 9l1.5 1.5v3L2.5 15l2 3.3 2-.5 2 1.2.5 2h4l.5-2 2-1.2 2 .5 2-3.3-1.5-1.5v-3L20 9l-2-3.3-2 .5L14 5l-.5-2Z' }], ['circle', { cx: 11.3, cy: 12, r: 3 }]],
  translate: [['path', { d: 'M3 5h12M9 3v2m-4 3c1.6 4 4.5 6.5 8 8M13 5c-.8 4.5-4.4 8.7-9 11m10 4 4-10 4 10m-6.6-3h5.2' }]],
  youtube: [['rect', { x: 2, y: 5, width: 20, height: 14, rx: 4 }], ['path', { d: 'm10 9 5 3-5 3Z', fill: 'currentColor', stroke: 'none' }]],
  external: [['path', { d: 'M14 4h6v6m0-6L10 14m0-10H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4' }]],
  check: [['path', { d: 'm5 12 4 4L19 6' }]],
  refresh: [['path', { d: 'M20 7v5h-5M4 17v-5h5M5.8 7A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.2-1' }]],
  note: [['path', { d: 'M10 17V5l10-2v12M10 9l10-2' }], ['ellipse', { cx: 6.5, cy: 18, rx: 3.5, ry: 3 }], ['ellipse', { cx: 16.5, cy: 16, rx: 3.5, ry: 3 }]],
  alert: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v6m0 4h.01' }]],
};

export function icon(name, filled = false) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  Object.entries({ viewBox: '0 0 24 24', fill: filled ? 'currentColor' : 'none', stroke: 'currentColor', 'stroke-width': 1.7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: `icon icon-${name}` }).forEach(([key, value]) => svg.setAttribute(key, value));
  (shapes[name] || shapes.note).forEach(([tag, attrs]) => {
    const shape = document.createElementNS(namespace, tag);
    Object.entries(attrs).forEach(([key, value]) => shape.setAttribute(key, value));
    svg.append(shape);
  });
  return svg;
}
