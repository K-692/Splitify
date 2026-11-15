import '@testing-library/jest-dom';

// Ensure consistent localStorage in jsdom / Node 22 environment
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value.toString();
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    Object.keys(store).forEach((k) => delete store[k]);
  },
  key: (index: number) => Object.keys(store)[index] || null,
  get length() {
    return Object.keys(store).length;
  },
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});
