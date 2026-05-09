// Four Elements v0.4 module: screen visibility and toast helpers.

(function () {
  function create(options) {
    const screens = options.screens || [];
    const hudEl = options.hudEl;
    const topHelp = options.topHelp;
    const toastEl = options.toastEl;
    const getGame = options.getGame || (() => null);

    function allScreens() {
      return screens;
    }

    function showScreen(el) {
      allScreens().forEach(s => s.classList.remove('active'));
      if (el) el.classList.add('active');

      const game = getGame();
      const inGame = !!game && game.screen === 'game';
      hudEl.style.display = inGame ? 'block' : 'none';
      topHelp.style.display = inGame ? 'block' : 'none';
    }

    function hideScreens() {
      allScreens().forEach(s => s.classList.remove('active'));

      const game = getGame();
      if (game && game.screen === 'game') {
        hudEl.style.display = 'block';
        topHelp.style.display = 'block';
      }
    }

    function showToast(text, ms=6700) {
      toastEl.textContent = text;
      toastEl.style.display = 'block';
      clearTimeout(showToast._t);
      showToast._t = setTimeout(() => toastEl.style.display = 'none', ms);
    }

    return {
      allScreens,
      showScreen,
      hideScreens,
      showToast
    };
  }

  window.FE_SCREEN_MANAGER = {
    create
  };
})();
