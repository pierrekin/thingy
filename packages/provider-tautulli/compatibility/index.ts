export const targets = import.meta.glob('./*/target.json', { eager: true, import: 'default' });
export const records = import.meta.glob(['./*/*.json', '!./*/target.json'], { eager: true, import: 'default' });
