(() => {
  document.documentElement.classList.add('js');

  const topbar = document.getElementById('topbar');
  const nav = document.getElementById('nav');
  const menuBtn = document.getElementById('menuBtn');
  const stickyCta = document.getElementById('stickyCta');

  const onScroll = () => topbar.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const closeMenu = () => {
    nav.classList.remove('open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-label', 'Abrir menú');
  };
  menuBtn.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  });
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

  // Entradas escalonadas dentro de cada grupo de hermanos
  const reveals = [...document.querySelectorAll('.reveal')];
  reveals.forEach((el) => {
    const siblings = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    el.style.setProperty('--d', `${Math.min(siblings.indexOf(el), 6) * 0.08}s`);
  });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));

    const links = [...nav.querySelectorAll('a')];
    const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const navIo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => navIo.observe(s));

    const hero = document.getElementById('inicio');
    const contact = document.getElementById('contacto');
    const visible = { hero: true, contact: false };
    const ctaIo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        visible[entry.target === hero ? 'hero' : 'contact'] = entry.isIntersecting;
      });
      stickyCta.classList.toggle('show', !visible.hero && !visible.contact);
    });
    ctaIo.observe(hero);
    ctaIo.observe(contact);
  } else {
    reveals.forEach((el) => el.classList.add('in'));
  }

  // Test orientativo del Modelo 720
  const THRESHOLD = 50000;
  const checker = document.getElementById('checker');
  const verdict = document.getElementById('verdict');
  const blocks = [
    { name: 'cuentas', label: 'cuentas' },
    { name: 'valores', label: 'valores, seguros y rentas' },
    { name: 'inmuebles', label: 'inmuebles' },
  ];
  const euros = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`;
  const describeBlocks = (items) => items.length === 1 ? `el bloque de ${items[0]}` : `${items.length} bloques (${items.join('; ')})`;

  const setVerdict = (state, icon, title, text) => {
    verdict.className = `verdict${state ? ` is-${state}` : ''}`;
    verdict.innerHTML = `<span class="verdict-icon"><svg><use href="#i-${icon}"/></svg></span><div><b>${title}</b><p>${text}</p></div>`;
  };

  const updateChecker = () => {
    const values = blocks.map((b) => {
      const input = checker.elements[b.name];
      const value = Number(input.value);
      const max = Number(input.max);
      document.getElementById(`out-${b.name}`).textContent = value >= max ? `${euros(max)} o más` : euros(value);
      return { ...b, value };
    });
    const previo = checker.elements.previo.checked;
    const over = values.filter((b) => b.value > THRESHOLD).map((b) => b.label);
    const total = values.reduce((sum, b) => sum + b.value, 0);
    const cta = '<a href="#contacto" data-servicio="720">Pide que lo revisemos</a>';

    if (previo) {
      setVerdict('yes', 'alert', 'Depende de lo que haya cambiado',
        `Tendrás que volver a presentarlo si algún bloque ha aumentado más de 20.000 € desde tu última declaración o si has vendido o cancelado algún bien declarado. ${cta}.`);
    } else if (over.length) {
      setVerdict('yes', 'alert', 'En principio, sí tendrías que presentarlo',
        `Superas los 50.000 € en ${describeBlocks(over)}. ${cta} y lo preparamos antes del 31 de marzo.`);
    } else if (total > 0) {
      setVerdict('no', 'check', 'En principio, no estarías obligado',
        `Ningún bloque supera los 50.000 €. Aun así, conviene revisar saldos medios y cotitularidades. ${cta}.`);
    } else {
      setVerdict('', 'minus', 'Mueve los controles', 'Te diremos si, en principio, te afecta.');
    }
  };
  checker.addEventListener('input', updateChecker);
  checker.addEventListener('submit', (e) => e.preventDefault());
  updateChecker();

  // Formulario de solicitud
  const form = document.getElementById('leadForm');
  const body = form.querySelector('.form-body');
  const done = form.querySelector('.form-done');
  const consentErr = form.querySelector('.err-consent');

  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-servicio]');
    if (!link) return;
    const radio = form.querySelector(`input[name="servicio"][value="${link.dataset.servicio}"]`);
    if (radio) radio.checked = true;
  });

  const validateField = (input) => {
    const ok = input.checkValidity() && input.value.trim() !== '';
    input.closest('.field').classList.toggle('invalid', !ok);
    return ok;
  };
  form.querySelectorAll('input[required]:not([type="checkbox"])').forEach((input) => {
    input.addEventListener('blur', () => { if (input.value) validateField(input); });
    input.addEventListener('input', () => { if (input.closest('.field').classList.contains('invalid')) validateField(input); });
  });
  form.elements.privacidad.addEventListener('change', (e) => consentErr.classList.toggle('show', !e.target.checked));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fields = [form.elements.nombre, form.elements.email];
    const fieldsOk = fields.map(validateField).every(Boolean);
    const consentOk = form.elements.privacidad.checked;
    consentErr.classList.toggle('show', !consentOk);
    if (!fieldsOk || !consentOk) {
      (fields.find((f) => f.closest('.field').classList.contains('invalid')) || form.elements.privacidad).focus();
      return;
    }
    // Sin backend: la solicitud no se envía a ningún servidor. Ver landing/README.md.
    const firstName = form.elements.nombre.value.trim().split(/\s+/)[0];
    document.getElementById('doneName').textContent = firstName;
    body.hidden = true;
    done.hidden = false;
    done.querySelector('button').focus();
  });

  document.getElementById('formReset').addEventListener('click', () => {
    form.reset();
    consentErr.classList.remove('show');
    form.querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
    done.hidden = true;
    body.hidden = false;
    form.elements.nombre.focus();
  });
})();
