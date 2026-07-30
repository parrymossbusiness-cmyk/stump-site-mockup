(function () {
  /* Mobile hero height: CSS dvh should track Safari's toolbar as it
     collapses to its compact floating state, but WebKit has documented
     inconsistencies recalculating dvh after that transition happens mid-
     session (as opposed to on initial load). window.visualViewport.height
     (falling back to window.innerHeight) is the value Safari itself keeps
     accurate to the toolbar's real, current state, so drive the hero's
     height from that directly instead of trusting the CSS unit alone. */
  function setHeroVh() {
    var vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
    document.documentElement.style.setProperty('--hero-vh', vh + 'px');
  }
  setHeroVh();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setHeroVh);
  } else {
    window.addEventListener('resize', setHeroVh);
  }

  var header = document.getElementById('site-header');
  var hamburger = document.getElementById('hamburger-btn');
  var mobileNav = document.getElementById('mobile-nav');
  var navScrim = document.getElementById('nav-scrim');
  var mobileClose = document.getElementById('mobile-nav-close');

  function onScroll() {
    if (!header) return;
    if (window.scrollY > 12) {
      header.classList.add('is-solid');
    } else {
      header.classList.remove('is-solid');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function openMenu() {
    mobileNav.classList.add('is-open');
    navScrim.classList.add('is-open');
    hamburger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    mobileNav.classList.remove('is-open');
    navScrim.classList.remove('is-open');
    hamburger.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', function () {
      var isOpen = mobileNav.classList.contains('is-open');
      if (isOpen) { closeMenu(); } else { openMenu(); }
    });
  }
  if (mobileClose) { mobileClose.addEventListener('click', closeMenu); }
  if (navScrim) { navScrim.addEventListener('click', closeMenu); }

  /* Desktop Services / Service Areas dropdowns: CSS :hover and :focus-within
     already reveal these; this click handler is a fallback for touch/keyboard
     users on desktop-width screens who never trigger :hover. Clicking a link
     inside still navigates normally — this only toggles the .is-open class. */
  var navDropdowns = document.querySelectorAll('.main-nav .nav-dropdown');
  for (var d = 0; d < navDropdowns.length; d++) {
    (function (dropdown) {
      var trigger = dropdown.querySelector('.nav-summary');
      if (!trigger) return;
      trigger.addEventListener('click', function (e) {
        e.preventDefault();
        var isOpen = dropdown.classList.contains('is-open');
        for (var j = 0; j < navDropdowns.length; j++) {
          navDropdowns[j].classList.remove('is-open');
          var t = navDropdowns[j].querySelector('.nav-summary');
          if (t) { t.setAttribute('aria-expanded', 'false'); }
        }
        if (!isOpen) {
          dropdown.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    })(navDropdowns[d]);
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.main-nav .nav-dropdown')) {
      for (var k = 0; k < navDropdowns.length; k++) {
        navDropdowns[k].classList.remove('is-open');
        var trig = navDropdowns[k].querySelector('.nav-summary');
        if (trig) { trig.setAttribute('aria-expanded', 'false'); }
      }
    }
  });

  /* Close the mobile panel after a real link navigation is already underway;
     this never calls preventDefault so taps always navigate. */
  if (mobileNav) {
    var mobileLinks = mobileNav.querySelectorAll('a[href]');
    for (var i = 0; i < mobileLinks.length; i++) {
      mobileLinks[i].addEventListener('click', function () {
        window.setTimeout(closeMenu, 0);
      });
    }
  }

  /* The hero/banner image and web fonts load asynchronously and shift page
     height, which can leave the browser's native scroll-to-fragment short of
     its target. Re-run it once everything has settled. */
  function scrollToHash() {
    if (!location.hash) return;
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) { target.scrollIntoView({ behavior: 'instant', block: 'start' }); }
  }
  if (document.readyState === 'complete') {
    scrollToHash();
    window.setTimeout(scrollToHash, 300);
  } else {
    window.addEventListener('load', function () {
      scrollToHash();
      window.setTimeout(scrollToHash, 300);
    });
  }

  /* Hero background video: the <video> tag ships in the initial HTML with
     real muted/autoplay/playsinline attributes (Safari only grants autoplay
     reliably when those are present from page load, not added by script
     after the fact) but has no <source> children and no src at parse time,
     so no video bytes are ever requested. On desktop-width, motion-ok
     browsers we assign .src directly on the <video> element itself (Safari's
     WebKit engine has a long-standing quirk where dynamically promoting
     <source data-src> children and calling .load() is unreliable — it does
     not consistently re-run resource selection against the new children;
     setting video.src directly is the well-supported cross-browser pattern),
     then call .load()/.play(). Mobile and reduced-motion users never trigger
     this — zero extra network cost. */
  var heroVideo = document.querySelector('.hero-video');
  if (heroVideo) {
    var wantsMotion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isWideEnough = window.matchMedia('(min-width: 1024px)').matches;
    if (wantsMotion && isWideEnough) {
      var canWebm = typeof heroVideo.canPlayType === 'function' &&
        heroVideo.canPlayType('video/webm; codecs="vp9"') !== '';
      var src = canWebm ? heroVideo.getAttribute('data-webm') : heroVideo.getAttribute('data-mp4');
      /* Belt-and-suspenders: force the muted state as a JS property, not
         just the parsed attribute. Muted autoplay is the one autoplay mode
         every major browser (including Safari's per-site Auto-Play policy,
         when not set to "Never Auto-Play") allows without a user gesture,
         so this must be unambiguously true before play() is called. */
      heroVideo.muted = true;
      heroVideo.defaultMuted = true;
      heroVideo.src = src;
      heroVideo.load();
      heroVideo.classList.add('is-active');
      /* Force layout before play() — some browsers evaluate whether a video
         is "on screen" (for background-video power-saving pauses) against
         the pre-reflow display:none state if play() is called in the very
         same tick as the class toggle that reveals it. */
      void heroVideo.offsetWidth;
      var playPromise = heroVideo.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function (err) {
          /* Autoplay blocked for some reason; fall back to the poster image.
             Logged so Safari's Web Inspector console shows the real reason
             (e.g. a per-site "Never Auto-Play" setting) instead of a silent
             failure that looks identical to every other possible cause. */
          if (window.console && console.warn) {
            console.warn('Hero video autoplay was blocked:', err && err.name, err && err.message);
          }
          heroVideo.classList.remove('is-active');
        });
      }
    }
  }
})();
