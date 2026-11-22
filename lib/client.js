// dsh-emergent-complexity — web client
// A single overlay slot: launcher pill + full-page studio (iframe to the plugin's own
// /api/emergent/studio route). No build step, no external assets.
window.__ModuleLoader__.load({
  id: 'dsh-emergent-complexity',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;

    const CSS = [
      '.ecx-root{position:fixed;z-index:70;inset:0;pointer-events:none}',
      '.ecx-launcher{position:absolute;top:52px;right:14px;pointer-events:auto;display:flex;align-items:center;gap:6px;',
      '  background:linear-gradient(135deg,#0b3b52,#0e5a75);border:1px solid #1f7a9c;color:#e8fbff;',
      '  border-radius:999px;padding:7px 12px;font-size:12px;font-weight:600;letter-spacing:.2px;cursor:pointer;',
      '  box-shadow:0 6px 20px rgba(0,0,0,.35);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif}',
      '.ecx-launcher:hover{filter:brightness(1.12)}',
      '.ecx-launcher .dot{width:7px;height:7px;border-radius:50%;background:#5eead4}',
      '.ecx-backdrop{position:fixed;inset:0;background:rgba(4,8,12,.55);backdrop-filter:blur(2px);pointer-events:auto}',
      '.ecx-panel{position:fixed;inset:24px;background:#0e1116;border:1px solid #2a3542;border-radius:12px;overflow:hidden;',
      '  box-shadow:0 24px 80px rgba(0,0,0,.6);pointer-events:auto;display:flex;flex-direction:column}',
      '.ecx-bar{display:flex;align-items:center;gap:8px;padding:7px 10px;background:#121820;border-bottom:1px solid #232c38;color:#cfe3f5;font-size:12px}',
      '.ecx-bar b{font-weight:600}',
      '.ecx-bar .sub{color:#7f8c9d;font-size:11px}',
      '.ecx-spacer{flex:1}',
      '.ecx-x{background:#1c2531;border:1px solid #2f3b4a;color:#dbe7f3;border-radius:7px;padding:4px 9px;cursor:pointer;font-size:12px}',
      '.ecx-x:hover{background:#26333f}',
      '.ecx-frame{flex:1;width:100%;border:0;background:#0e1116}',
      '@media (max-width:760px){.ecx-panel{inset:10px}.ecx-launcher{top:48px;right:10px}}',
    ].join('');

    function Studio() {
      const [open, setOpen] = React.useState(false);
      React.useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, []);
      const panel = open
        ? h('div', { className: 'ecx-panel', role: 'dialog', 'aria-label': 'Emergent Complexity Studio' },
            h('div', { className: 'ecx-bar' },
              h('b', null, '⚗ Emergent Complexity Studio'),
              h('span', { className: 'sub' }, '資源池 · 生成器 · 想法板'),
              h('span', { className: 'ecx-spacer' }),
              h('button', { className: 'ecx-x', onClick: () => setOpen(false), title: '關閉 (Esc)' }, '關閉')),
            h('iframe', { className: 'ecx-frame', src: '/api/emergent/studio', title: 'Emergent Complexity Studio' }))
        : null;
      return h('div', { className: 'ecx-root' },
        open ? h('div', { className: 'ecx-backdrop', onClick: () => setOpen(false) }) : null,
        h('button', { className: 'ecx-launcher', onClick: () => setOpen(true), title: '打開 Emergent Complexity Studio' },
          h('span', { className: 'dot' }), 'Emergent Studio'),
        panel);
    }

    function apply(ctx) {
      ctx.effect(() => {
        const el = document.createElement('style');
        el.setAttribute('data-dsh-emergent-complexity', '');
        el.textContent = CSS;
        document.head.appendChild(el);
        return () => { el.remove(); };
      }, 'dsh-emergent-complexity: styles');
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'dsh-emergent-complexity-studio',
        order: 60,
      }, Studio), 'dsh-emergent-complexity: studio overlay');
    }

    return { apply, inject: ['slots'] };
  },
});
