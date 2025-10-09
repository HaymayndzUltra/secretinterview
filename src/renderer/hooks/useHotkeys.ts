import { useEffect } from 'react';

export function useHotkeys() {
  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (['1', '2', '3'].includes(event.key)) {
        const index = parseInt(event.key, 10) - 1;
        window.interview.sendHotkey(index);
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);
}
