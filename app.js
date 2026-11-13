document.addEventListener('DOMContentLoaded', () => {
  const currentYear = new Date().getFullYear();
  const footer = document.querySelector('.footer');
  if (footer) {
    footer.insertAdjacentHTML('beforeend', '<p class="footnote">© ' + currentYear + ' MatchLens 專題作品</p>');
  }
});
