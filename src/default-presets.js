/** Fresh built-in templates; parent model identity is resolved only at creation. */
export const DEFAULT_PRESET_ID = 'default-high';

export function createDefaultPresets() {
  return [
    { id: 'default-low', name: 'Low', modelSource: 'parent', effort: 'low', description: '轻量、范围明确的任务。' },
    { id: 'default-high', name: 'High', modelSource: 'parent', effort: 'high', description: '需要较充分推理的常规任务。' },
    { id: 'default-max', name: 'Max', modelSource: 'parent', effort: 'max', description: '需要深入推理的复杂任务。' },
  ];
}
