// Smooth-scroll nos links do menu
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const el = document.querySelector(id);
    if (el) {
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, "", id);
    }
  });
});

// Atualiza ano do rodapé
document.getElementById('year').textContent = new Date().getFullYear();
