// GENERATED — do not edit. Source: mantle-business/brand/

(function () {
  var REVEAL_MS = 1400;
  var PULSE_ACTIVE_MS = 1000;
  var PULSE_WAIT_MS = 1000;
  var PULSE_MS = PULSE_ACTIVE_MS + PULSE_WAIT_MS;
  var POP_MS = 1200;
  var POP_COLLAPSE_FRAC = 0.35;
  var POP_TURN_FRAC = 0.6;
  var POP_FADE_FRAC = 0.85;
  var POP_RING_RADIUS = 80;
  var POP_RING_THICKNESS = 3;
  var PULSE_AMP = 1;
  var STAGGER = 0.16;
  var WIN = 0.36;

  var DOT_R = 7.366336633663366;
  var ARC_RS = [25.045544554455443,44.934653465346535,67.03366336633664];
  var PREV_RS = [7.366336633663366,25.045544554455443,44.934653465346535];
  var CX = 200;
  var CY = 200;
  var PALETTE = {"dark":{"dot":"#e0dcd6","arcs":["#edebe8","#efeeeb","#f4f4f2"],"pulseTarget":"#6b6560","signal":"#7db897"},"light":{"dot":"#2e2e2e","arcs":["#222222","#1f1f1f","#1a1a1a"],"pulseTarget":"#6b6560","signal":"#4a8a67"}};

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function staggered(t, i, stagger, win) {
    return clamp01((t - i * stagger) / win);
  }
  function shade(hex, target, k) {
    if (k === 0) return hex;
    if (k > 1) k = 1;
    if (k < 0) k = 0;
    var n = parseInt(hex.slice(1), 16);
    var t = parseInt(target.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var tr = (t >> 16) & 255, tg = (t >> 8) & 255, tb = t & 255;
    function mix(c, tc) { return Math.round(c + (tc - c) * k); }
    function hh(x) { return x.toString(16).padStart(2, "0"); }
    return "#" + hh(mix(r, tr)) + hh(mix(g, tg)) + hh(mix(b, tb));
  }

  function create(container, options) {
    options = options || {};
    var onChange = options.onChange;

    var dotEl = container.querySelector(".m-loader__dot");
    var arcEls = container.querySelectorAll(".m-loader__arc");
    var fansEl = container.querySelector(".m-loader__fans");

    // State machine: initial | reveal | pulse | pop
    var state = "initial";
    var playing = false;
    var startT = 0;
    var pauseAt = 0;
    var rafId = null;
    // How to handle end-of-phase. "auto" (production): reveal → pulse → looped,
    // pop → initial. "once": each phase plays one cycle and then seeks back to
    // frame 0 of the same phase, paused.
    var loopBehavior = "auto";

    function notify() {
      if (!onChange) return;
      try { onChange({ state: state, playing: playing }); }
      catch (e) { /* don't let consumer errors break the clock */ }
    }

    function theme() {
      var t = container.getAttribute("data-theme");
      if (t === "dark" || t === "light") return t;
      return (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    }

    function pulseK(elIdx, pulseT) {
      if (state !== "pulse") return 0;
      // pulseT is elapsed / PULSE_MS (total cycle = active + wait). One cycle
      // has an active sweep for the first active/total fraction, then a quiet
      // wait where all elements sit at baseline.
      var cycleFrac = pulseT % 1;
      var activeFrac = PULSE_ACTIVE_MS / PULSE_MS;
      if (cycleFrac > activeFrac) return 0;
      var localPhase = cycleFrac / activeFrac;
      var peak = localPhase * 4.2 - 0.3;
      var d = Math.abs(elIdx - peak);
      var bump = Math.max(0, 1 - d * 1.4);
      var bell = Math.sin(bump * Math.PI * 0.5);
      return PULSE_AMP * bell;
    }

    function render(revealT, pulseT, popT) {
      var th = theme();
      var pal = PALETTE[th];
      var isPop = state === "pop";

      // Arcs: reveal stagger, then collapse toward center and fade during pop.
      // Collapse completes at popT = POP_COLLAPSE_FRAC.
      var collapseT = isPop ? clamp01(popT / POP_COLLAPSE_FRAC) : 0;
      var collapseCurve = easeOutExpo(collapseT);
      fansEl.style.opacity = "1";

      for (var i = 0; i < 3; i++) {
        var k = easeOutBack(staggered(revealT, i + 1, STAGGER, WIN));
        var kC = clamp01(k);
        var minS = PREV_RS[i] / ARC_RS[i];
        var revealS = minS + (1 - minS) * kC;
        var s = revealS * (1 - collapseCurve);
        var op = Math.min(1, k * 1.4) * (1 - collapseCurve);
        var fill = shade(pal.arcs[i], pal.pulseTarget, pulseK(i + 1, pulseT));
        var arcEl = arcEls[i];
        arcEl.setAttribute("transform",
          "translate(" + (CX * (1 - s)) + " " + (CY * (1 - s)) + ") scale(" + s + ")");
        arcEl.style.opacity = String(op);
        var path = arcEl.querySelector("path");
        if (path) path.style.fill = fill;
      }

      // Dot:
      //   initial/reveal: radius follows easeOutBack, fill = pal.dot (pulse-tinted).
      //   pop: colour lerps dot→signal through POP_TURN_FRAC, then stretches
      //        horizontally into a line via non-uniform scale, then fades.
      var dotK = easeOutBack(staggered(revealT, 0, 0, 0.18));

      if (isPop) {
        var turnT = clamp01(popT / POP_TURN_FRAC);
        var dotFill = shade(pal.dot, pal.signal, easeOutExpo(turnT));

        // Burst: at popT = POP_TURN_FRAC the dot releases its fill and a stroke
        // of POP_RING_THICKNESS appears at r = DOT_R (the dot's boundary). The
        // ring then expands to POP_RING_RADIUS with easeOutBack overshoot.
        var inBurst = popT >= POP_TURN_FRAC;
        var burstT = clamp01((popT - POP_TURN_FRAC) / (POP_FADE_FRAC - POP_TURN_FRAC));
        var burstCurve = burstT === 0 ? 0 : easeOutBack(burstT);
        var ringR = DOT_R + (POP_RING_RADIUS - DOT_R) * burstCurve;

        var fadeT = clamp01((popT - POP_FADE_FRAC) / (1 - POP_FADE_FRAC));
        var dotOp = 1 - fadeT;

        dotEl.setAttribute("transform", "");
        if (inBurst) {
          dotEl.setAttribute("r", String(ringR));
          dotEl.style.fill = "none";
          dotEl.style.stroke = pal.signal;
          dotEl.style.strokeWidth = String(POP_RING_THICKNESS);
        } else {
          dotEl.setAttribute("r", String(DOT_R));
          dotEl.style.fill = dotFill;
          dotEl.style.stroke = "";
          dotEl.style.strokeWidth = "";
        }
        dotEl.style.opacity = String(dotOp);
      } else {
        dotEl.setAttribute("r", String(DOT_R * Math.max(0, dotK)));
        dotEl.setAttribute("transform", "");
        dotEl.style.fill = shade(pal.dot, pal.pulseTarget, pulseK(0, pulseT));
        dotEl.style.stroke = "";
        dotEl.style.strokeWidth = "";
        dotEl.style.opacity = "1";
      }
    }

    function renderAt(elapsed) {
      if (state === "initial") { render(0, 0, 0); return; }
      if (state === "reveal") { render(Math.min(1, elapsed / REVEAL_MS), 0, 0); return; }
      if (state === "pulse")  { render(1, elapsed / PULSE_MS, 0); return; }
      if (state === "pop")    { render(1, 0, Math.min(1, elapsed / POP_MS)); return; }
    }

    function tick() {
      if (!playing) return;
      var now = performance.now();
      var el = now - startT;
      renderAt(el);
      if (state === "reveal" && el >= REVEAL_MS) {
        if (loopBehavior === "once") { seek("reveal"); return; }
        transition("pulse"); return;
      }
      if (state === "pulse" && loopBehavior === "once" && el >= PULSE_MS) {
        seek("pulse"); return;
      }
      if (state === "pop" && el >= POP_MS) {
        if (loopBehavior === "once") { seek("pop"); return; }
        // Auto: hold the faded final frame. In production the caller tears
        // down the overlay at this point; in the playground the held state
        // remains until reset() is invoked.
        renderAt(POP_MS);
        playing = false;
        pauseAt = POP_MS;
        cancelRaf();
        notify();
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    function cancelRaf() {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    }

    function transition(next) {
      state = next;
      startT = performance.now();
      pauseAt = 0;
      container.setAttribute("data-state", next);
      cancelRaf();
      renderAt(0);
      if (next === "initial") { playing = false; notify(); return; }
      if (playing) rafId = requestAnimationFrame(tick);
      notify();
    }

    function seek(phase) {
      state = phase;
      playing = false;
      pauseAt = 0;
      startT = performance.now();
      container.setAttribute("data-state", phase);
      cancelRaf();
      renderAt(0);
      notify();
    }

    function pause() {
      if (!playing) return;
      playing = false;
      pauseAt = performance.now() - startT;
      cancelRaf();
      notify();
    }

    function resume() {
      if (playing) return;
      playing = true;
      if (state === "initial") { notify(); return; }
      startT = performance.now() - pauseAt;
      rafId = requestAnimationFrame(tick);
      notify();
    }

    // Put the mark at frame 0 immediately so the paused container isn't blank.
    renderAt(0);

    return {
      start:   function () { playing = true; transition("reveal"); },
      loading: function () { playing = true; transition("pulse"); },
      finish:  function () { playing = true; transition("pop"); },
      reset:   function () { transition("initial"); },
      ready:   function () { if (state === "pulse" || state === "reveal") { playing = true; transition("pop"); } },
      seek:      seek,
      setLoopBehavior: function (b) { loopBehavior = b; },
      pause:     pause,
      resume:    resume,
      isPlaying: function () { return playing; },
      state:     function () { return state; },
    };
  }

  window.MantleLoader = window.MantleLoader || { create: create };
})();