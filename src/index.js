import { initBasicCustomCursor } from "./components/customCursor";
import { initOverlappingSlider } from "./components/slider";

// -----------------------------------------
// OSMO PAGE TRANSITION BOILERPLATE
// -----------------------------------------

gsap.registerPlugin(CustomEase);

history.scrollRestoration = "manual";

let lenis = null;
let nextPage = document;
let onceFunctionsInitialized = false;

const hasLenis = typeof window.Lenis !== "undefined";
const hasScrollTrigger = typeof window.ScrollTrigger !== "undefined";

const rmMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
let reducedMotion = rmMQ.matches;
rmMQ.addEventListener?.("change", (e) => (reducedMotion = e.matches));
rmMQ.addListener?.((e) => (reducedMotion = e.matches));

const has = (s) => !!nextPage.querySelector(s);

let staggerDefault = 0.05;
let durationDefault = 0.6;

CustomEase.create("osmo", "0.625, 0.05, 0, 1");
gsap.defaults({ ease: "osmo", duration: durationDefault });

// -----------------------------------------
// FUNCTION REGISTRY
// -----------------------------------------

function initOnceFunctions() {
  initLenis();
  if (onceFunctionsInitialized) return;
  onceFunctionsInitialized = true;

  // Runs once on first load
  // if (has('[data-something]')) initSomething();
  initBasicCustomCursor();
}

function initBeforeEnterFunctions(next) {
  nextPage = next || document;

  // Runs before the enter animation
  // if (has('[data-something]')) initSomething();
}

function initAfterEnterFunctions(next) {
  nextPage = next || document;

  // Runs after enter animation completes
  if (has("[data-overlap-slider-init]")) initOverlappingSlider(nextPage);

  if (hasLenis) {
    lenis.resize();
  }

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }
}

// -----------------------------------------
// PAGE TRANSITIONS
// -----------------------------------------

function runPageOnceAnimation(next) {
  const loadingContainer = document.querySelector("[data-loading-container]");
  if (!loadingContainer) return; // Stop animation when no [data-loading-words] is found

  const loadingWords = loadingContainer.querySelector("[data-loading-words]");
  const wordsTarget = loadingWords.querySelector("[data-loading-words-target]");
  const words = loadingWords
    .getAttribute("data-loading-words")
    .split(",")
    .map((w) => w.trim());

  const tl = gsap.timeline();

  tl.set(loadingWords, {
    yPercent: 50,
  });

  tl.to(loadingWords, {
    opacity: 1,
    yPercent: 0,
    duration: 1,
    ease: "Expo.easeInOut",
  });

  words.forEach((word) => {
    tl.call(
      () => {
        wordsTarget.textContent = word;
      },
      null,
      "+=0.15",
    );
  });

  tl.to(loadingWords, {
    opacity: 0,
    yPercent: -75,
    duration: 0.8,
    ease: "Expo.easeIn",
  });

  tl.to(
    loadingContainer,
    {
      autoAlpha: 0,
      duration: 0.6,
      ease: "Power1.easeInOut",
    },
    "+ -0.2",
  );

  tl.call(
    () => {
      resetPage(next);
    },
    null,
    0,
  );

  return tl;
}

function runPageLeaveAnimation(current, next) {
  const tl = gsap.timeline({
    onComplete: () => {
      current.remove();
    },
  });

  if (reducedMotion) {
    // Immediate swap behavior if user prefers reduced motion
    return tl.set(current, { autoAlpha: 0 });
  }

  tl.to(current, { xPercent: -25, duration: 0.8 });

  return tl;
}

function runPageEnterAnimation(next) {
  const tl = gsap.timeline();

  const heading = nextPage.querySelectorAll("[data-heading-reveal]");

  if (reducedMotion) {
    // Immediate swap behavior if user prefers reduced motion
    tl.set(next, { autoAlpha: 1 });
    tl.add("pageReady");
    tl.call(resetPage, [next], "pageReady");
    return new Promise((resolve) => tl.call(resolve, null, "pageReady"));
  }

  tl.add("startEnter");

  tl.fromTo(
    next,
    {
      xPercent: 100,
    },
    {
      xPercent: 0,
      duration: 0.8,
    },
    "startEnter",
  );

  tl.add("pageReady");

  if (heading) {
    tl.from(
      heading,
      {
        yPercent: 100,
        autoAlpha: 0,
        stagger: 0.05,
      },
      ">+=0.1",
    );
  }

  tl.call(resetPage, [next], "pageReady");

  return new Promise((resolve) => {
    tl.call(resolve, null, "pageReady");
  });
}

// -----------------------------------------
// BARBA HOOKS + INIT
// -----------------------------------------

barba.hooks.beforeEnter((data) => {
  // Position new container on top
  gsap.set(data.next.container, {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
  });

  if (lenis && typeof lenis.stop === "function") {
    lenis.stop();
  }

  initBeforeEnterFunctions(data.next.container);
  applyThemeFrom(data.next.container);
});

barba.hooks.afterLeave(() => {
  if (hasScrollTrigger) {
    ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
  }
});

barba.hooks.enter((data) => {
  initBarbaNavUpdate(data);
});

barba.hooks.afterEnter((data) => {
  // Run page functions
  initAfterEnterFunctions(data.next.container);

  // Settle
  if (hasLenis) {
    lenis.resize();
    lenis.start();
  }

  if (hasScrollTrigger) {
    ScrollTrigger.refresh();
  }
});

barba.init({
  debug: true, // Set to 'false' in production
  timeout: 7000,
  preventRunning: true,
  transitions: [
    {
      name: "default",
      sync: true,

      // First load
      async once(data) {
        initOnceFunctions();

        return runPageOnceAnimation(data.next.container);
      },

      // Current page leaves
      async leave(data) {
        return runPageLeaveAnimation(
          data.current.container,
          data.next.container,
        );
      },

      // New page enters
      async enter(data) {
        return runPageEnterAnimation(data.next.container);
      },
    },
  ],
});

// -----------------------------------------
// GENERIC + HELPERS
// -----------------------------------------

const themeConfig = {
  light: {
    nav: "dark",
    transition: "light",
  },
  dark: {
    nav: "light",
    transition: "dark",
  },
};

function applyThemeFrom(container) {
  const pageTheme = container?.dataset?.pageTheme || "light";
  const config = themeConfig[pageTheme] || themeConfig.light;

  document.body.dataset.pageTheme = pageTheme;
  const transitionEl = document.querySelector("[data-theme-transition]");
  if (transitionEl) {
    transitionEl.dataset.themeTransition = config.transition;
  }

  const nav = document.querySelector("[data-theme-nav]");
  if (nav) {
    nav.dataset.themeNav = config.nav;
  }
}

function initLenis() {
  if (lenis) return; // already created
  if (!hasLenis) return;

  lenis = new Lenis({
    lerp: 0.165,
    wheelMultiplier: 1.25,
  });

  if (hasScrollTrigger) {
    lenis.on("scroll", ScrollTrigger.update);
  }

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);
}

function resetPage(container) {
  window.scrollTo(0, 0);
  gsap.set(container, { clearProps: "position,top,left,right" });

  if (hasLenis) {
    lenis.resize();
    lenis.start();
  }
}

function debounceOnWidthChange(fn, ms) {
  let last = innerWidth,
    timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (innerWidth !== last) {
        last = innerWidth;
        fn.apply(this, args);
      }
    }, ms);
  };
}

function initBarbaNavUpdate(data) {
  var tpl = document.createElement("template");
  tpl.innerHTML = data.next.html.trim();
  var nextNodes = tpl.content.querySelectorAll("[data-barba-update]");
  var currentNodes = document.querySelectorAll("nav [data-barba-update]");

  currentNodes.forEach(function (curr, index) {
    var next = nextNodes[index];
    if (!next) return;

    // Aria-current sync
    var newStatus = next.getAttribute("aria-current");
    if (newStatus !== null) {
      curr.setAttribute("aria-current", newStatus);
    } else {
      curr.removeAttribute("aria-current");
    }

    // Class list sync
    var newClassList = next.getAttribute("class") || "";
    curr.setAttribute("class", newClassList);
  });
}

// -----------------------------------------
// YOUR FUNCTIONS GO BELOW HERE
// -----------------------------------------
