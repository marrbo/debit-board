import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock do window.alert para evitar o aviso "Not implemented: Window's alert()"
if (typeof window !== 'undefined') {
  window.alert = vi.fn();
}