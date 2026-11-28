(() => {
  'use strict';

  const mobile = matchMedia('(max-width: 760px)');
  const sidebar = document.getElementById('skos-sidebar');
  const menu = document.querySelector('.mobile-menu-toggle');
  const close = document.querySelector('.mobile-drawer-close');
  const backdrop = document.querySelector('.mobile-backdrop');
  const actions = document.querySelector('.mobile-actions-toggle');
  const content = document.querySelector('.content');
  let opened = false;

  function setMenu(open, restoreFocus = false) {
    opened = open;
    sidebar.classList.toggle('mobile-open',open);
    backdrop.hidden = !open;
    menu.setAttribute('aria-expanded', String(open));
    if (open) {
      sidebar.querySelector('.nav-btn.active:not([hidden])')?.scrollIntoView({block:'nearest'});
      close.focus();
    } else if (restoreFocus && mobile.matches) menu.focus();
  }

  menu.onclick = () => setMenu(!opened,true);
  close.onclick = backdrop.onclick = () => setMenu(false,true);
  actions.onclick = () => {
    const expanded = actions.getAttribute('aria-expanded') === 'true';
    actions.setAttribute('aria-expanded',String(!expanded));
  };

  sidebar.addEventListener('click',event => {
    if (!mobile.matches || !event.target.closest('.nav-btn')) return;
    setMenu(false,true);
    actions.setAttribute('aria-expanded','false');
    content.scrollTop = 0;
  });

  document.addEventListener('keydown',event => {
    if (!opened) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(false,true);
    } else if (event.key === 'Tab') {
      const focusable = [...sidebar.querySelectorAll('button:not(:disabled), input:not(:disabled)')]
        .filter(control=>control.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });

  mobile.addEventListener('change', () => {
    setMenu(false);
    actions.setAttribute('aria-expanded','false');
  });
})();
