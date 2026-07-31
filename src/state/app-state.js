export const state = {
  filePath: null,
  fileName: "Untitled",
  isDirty: false,
  theme: "system",
  viewMode: "split",
  panesSwapped: false,
  _listeners: new Map(),

  set(key, value) {
    this[key] = value;
    const listeners = this._listeners.get(key);
    if (listeners) {
      listeners.forEach((fn) => fn(value));
    }
  },

  on(key, fn) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, []);
    }
    this._listeners.get(key).push(fn);
  },
};
