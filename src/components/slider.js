export function initOverlappingSlider(nextPage) {
  const inits = nextPage.querySelectorAll("[data-overlap-slider-init]");
  if (!inits.length) return;

  inits.forEach(setupOverlappingSlider);

  function setupOverlappingSlider(init) {
    // --- attributes with defaults
    const minScale = +(init.getAttribute("data-scale") ?? 0.45);
    const maxRotation = +(init.getAttribute("data-rotate") ?? -8);
    const inertia = true;

    const wrap = init.querySelector("[data-overlap-slider-collection]");
    const slider = init.querySelector("[data-overlap-slider-list]");
    const slides = Array.from(
      init.querySelectorAll("[data-overlap-slider-item]"),
    );

    if (!wrap || !slider || !slides.length) {
      console.warn(
        "OverlappingSlider: missing required structure. Check Osmo Vault documentation please.",
      );
      return;
    }

    wrap.style.touchAction = "none";
    wrap.style.userSelect = "none";

    let spacing = 0;
    let slideW = 0;
    let maxDrag = 0;
    let dragX = 0;
    let draggable;

    // simple clamp that always uses latest maxDrag
    function clamp(value) {
      if (maxDrag <= 0) return 0;
      return Math.min(Math.max(value, 0), maxDrag);
    }

    function update() {
      // move the whole list
      gsap.set(slider, { x: -dragX });

      // update each slide's overlap transform
      slides.forEach((slide, i) => {
        const threshold = i * spacing;
        const local = Math.max(0, dragX - threshold);
        const t = spacing > 0 ? Math.min(local / spacing, 1) : 0;

        gsap.set(slide, {
          x: local,
          scale: 1 - (1 - minScale) * t,
          rotation: maxRotation * t,
          transformOrigin: "75% center",
        });
      });
    }

    function recalc() {
      if (!slides.length) return;

      // measure one slide to get width + margin-right as "gap"
      const style = getComputedStyle(slides[0]);
      const gapRight = parseFloat(style.marginRight) || 0;

      slideW = slides[0].offsetWidth;
      spacing = slideW + gapRight;
      maxDrag = spacing * (slides.length - 1);

      // keep dragX within new bounds
      dragX = clamp(dragX);
      update();

      if (draggable) {
        draggable.applyBounds({ minX: -maxDrag, maxX: 0 });
      }
    }

    // create draggable
    draggable = Draggable.create(slider, {
      type: "x",
      bounds: { minX: -maxDrag, maxX: 0 }, // will be updated after recalc
      inertia,
      maxDuration: 1,
      snap: true
        ? (raw) => {
            // raw is the x value
            const d = clamp(-raw);
            const idx = spacing > 0 ? Math.round(d / spacing) : 0;
            return -idx * spacing;
          }
        : false,
      onDrag() {
        dragX = clamp(-this.x);
        update();
      },
      onThrowUpdate() {
        dragX = clamp(-this.x);
        update();
      },
    })[0];

    // recalc on resize
    const ro = new ResizeObserver(() => {
      recalc();
    });
    ro.observe(init);

    // keyboard navigation (arrow left/right)
    let active = false;
    let currentIndex = 0;

    // helper function to switch slides
    function goToSlide(idx) {
      idx = Math.max(0, Math.min(idx, slides.length - 1));
      currentIndex = idx;

      const targetX = idx * spacing;

      gsap.to(
        { value: dragX },
        {
          value: targetX,
          duration: 0.35,
          ease: "power4.out",
          onUpdate: function () {
            dragX = this.targets()[0].value;
            gsap.set(slider, { x: -dragX });
            update(); // animate overlap transforms properly
          },
        },
      );

      wrap.setAttribute("aria-label", `Slide ${idx + 1} of ${slides.length}`);
    }

    // Observe visibility
    const io = new IntersectionObserver(
      (entries) => {
        active = entries[0].isIntersecting;
      },
      {
        threshold: 0.25, // slider must be at least 25% visible
      },
    );

    io.observe(init);

    // Aria labels for accessibility
    wrap.setAttribute("role", "region");
    wrap.setAttribute("aria-roledescription", "carousel");
    wrap.setAttribute("aria-label", "Testimonial slider");

    // key listener
    function onKey(e) {
      if (!active) return; // only respond when slider in view

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToSlide(currentIndex - 1);
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToSlide(currentIndex + 1);
      }
    }
    window.addEventListener("keydown", onKey);

    // initial layout
    recalc();
  }
}
