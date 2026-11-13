import { numberPad } from '../ui.js';

// Number-entry helper: one pad for the whole round, one question at a time.
// ask() resolves {correct, given, timeout} or null when the round ends.
export function makeAsker(api, padHost, display, { allowNeg = true } = {}) {
  let pending = null;
  const pad = numberPad(padHost, {
    display,
    allowNeg,
    answerLength: () => (pending ? String(pending.answer).length : null),
    onSubmit: (v) => {
      if (!pending) return;
      const p = pending; pending = null;
      // String answers (digit spans like "0471") compare exactly; numbers compare by value.
      const correct = typeof p.answer === 'string' ? v === p.answer : Number(v) === p.answer;
      p.res({ given: v, correct, timeout: false });
    },
  });
  api.onOver(() => {
    if (pending) { const p = pending; pending = null; p.res(null); }
    pad.destroy();
  });
  return {
    pad,
    ask(answer, timeoutMs) {
      pad.clear();
      pad.enable(true);
      return new Promise((res) => {
        const mine = { answer, res };
        pending = mine;
        if (timeoutMs) {
          api.wait(timeoutMs).then((alive) => {
            if (pending === mine) { pending = null; res(alive ? { timeout: true, correct: false, given: '' } : null); }
          });
        }
      });
    },
  };
}

export const ri = (rng, a, b) => rng.int(a, b);
