<script setup lang="ts">
withDefaults(defineProps<{
  active: boolean
  phase: 'rolling' | 'revealed'
  label: string
  detail: string
  accent?: string
}>(), {
  accent: '#a855f7',
})
</script>

<template>
  <Transition name="mystery-presence">
    <section
      v-if="active"
      class="mystery-reveal"
      :class="`is-${phase}`"
      :style="{ '--mystery-accent': accent }"
    >
      <span class="mystery-live-result" role="status" aria-live="assertive" aria-atomic="true">
        {{ phase === 'revealed' ? `${label}. ${detail}` : '' }}
      </span>
      <div class="mystery-vignette" aria-hidden="true" />

      <div class="mystery-core">
        <div class="energy-rings" aria-hidden="true">
          <i class="energy-ring energy-ring--outer" />
          <i class="energy-ring energy-ring--middle" />
          <i class="energy-ring energy-ring--inner" />
          <i class="energy-sweep" />
        </div>

        <div class="dice-stage" aria-hidden="true">
          <div class="dice-glow" />
          <div class="dice-shadow" />
          <div class="mystery-cube">
            <span class="cube-face cube-face--front">?</span>
            <span class="cube-face cube-face--back">?</span>
            <span class="cube-face cube-face--right">?</span>
            <span class="cube-face cube-face--left">?</span>
            <span class="cube-face cube-face--top">?</span>
            <span class="cube-face cube-face--bottom">?</span>
          </div>
          <div class="reveal-flare" />
        </div>

        <div class="mystery-copy">
          <span class="mystery-kicker">
            <i class="kicker-line" />
            {{ phase === 'rolling' ? 'Le destin tourne' : 'Dé mystère' }}
            <i class="kicker-line" />
          </span>
          <strong class="mystery-label">{{ label }}</strong>
          <span class="mystery-detail">{{ detail }}</span>
        </div>

        <div class="mystery-particles" aria-hidden="true">
          <i v-for="particle in 14" :key="particle" :style="{ '--particle-index': particle }" />
        </div>
      </div>
    </section>
  </Transition>
</template>

<style scoped>
.mystery-reveal {
  --mystery-accent: #a855f7;
  --mystery-gold: #ffd879;
  --mystery-ink: #050512;
  position: absolute;
  z-index: 88;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: clamp(6rem, 18vh, 12rem) clamp(0.8rem, 4vw, 2rem);
  color: #fff;
  pointer-events: none;
  isolation: isolate;
  contain: layout paint style;
}

.mystery-vignette {
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(circle at 50% 48%, color-mix(in srgb, var(--mystery-accent) 28%, transparent) 0 12%, transparent 48%),
    radial-gradient(ellipse at center, rgba(2, 3, 14, 0.08) 8%, rgba(2, 3, 14, 0.56) 47%, transparent 77%);
  opacity: 0.92;
}

.mystery-core {
  position: relative;
  display: grid;
  width: min(91%, 35rem);
  min-height: clamp(22rem, 49vh, 31rem);
  place-items: center;
  align-content: center;
  gap: clamp(1rem, 2vh, 1.65rem);
  padding: clamp(1.6rem, 4vh, 3rem) clamp(1rem, 4vw, 2.5rem);
  border: 1px solid color-mix(in srgb, var(--mystery-accent) 62%, white 20%);
  clip-path: polygon(8% 0, 92% 0, 100% 9%, 100% 91%, 92% 100%, 8% 100%, 0 91%, 0 9%);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.09), transparent 24% 76%, rgba(255, 255, 255, 0.06)),
    radial-gradient(circle at 50% 28%, color-mix(in srgb, var(--mystery-accent) 25%, transparent), transparent 43%),
    linear-gradient(180deg, rgba(8, 9, 28, 0.93), rgba(3, 4, 17, 0.86));
  box-shadow:
    0 0 0 0.28rem rgba(2, 3, 13, 0.54),
    0 0 2.8rem color-mix(in srgb, var(--mystery-accent) 42%, transparent),
    inset 0 0 2.5rem rgba(255, 255, 255, 0.045);
}

.mystery-core::before,
.mystery-core::after {
  position: absolute;
  z-index: 4;
  width: 31%;
  height: 0.22rem;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, var(--mystery-gold), #fff7d2, transparent);
  box-shadow: 0 0 1rem var(--mystery-gold);
  content: "";
}

.mystery-core::before {
  top: 0.28rem;
  left: 9%;
}

.mystery-core::after {
  right: 9%;
  bottom: 0.28rem;
}

.energy-rings {
  position: absolute;
  top: clamp(1.35rem, 4vh, 2.8rem);
  left: 50%;
  width: clamp(10.5rem, 29vw, 14.5rem);
  aspect-ratio: 1;
  transform: translateX(-50%);
  opacity: 0.9;
}

.energy-ring,
.energy-sweep {
  position: absolute;
  border-radius: 50%;
  inset: 0;
}

.energy-ring--outer {
  border: 1px solid color-mix(in srgb, var(--mystery-accent) 66%, white);
  border-right-color: transparent;
  border-left-color: var(--mystery-gold);
  box-shadow:
    0 0 1rem color-mix(in srgb, var(--mystery-accent) 72%, transparent),
    inset 0 0 1rem color-mix(in srgb, var(--mystery-accent) 46%, transparent);
  animation: ring-spin 2.4s linear infinite;
}

.energy-ring--middle {
  inset: 9%;
  border: 0.18rem dashed color-mix(in srgb, var(--mystery-gold) 70%, transparent);
  opacity: 0.72;
  animation: ring-spin-reverse 4s linear infinite;
}

.energy-ring--inner {
  inset: 23%;
  border: 1px solid color-mix(in srgb, var(--mystery-accent) 82%, white);
  box-shadow: inset 0 0 1.7rem color-mix(in srgb, var(--mystery-accent) 62%, transparent);
  animation: ring-pulse 0.82s ease-in-out infinite alternate;
}

.energy-sweep {
  inset: -8%;
  background: conic-gradient(from 10deg, transparent 0 38%, color-mix(in srgb, var(--mystery-accent) 68%, white) 47%, transparent 55% 100%);
  filter: blur(0.2rem);
  opacity: 0.34;
  animation: ring-spin 1.7s linear infinite;
}

.dice-stage {
  position: relative;
  z-index: 2;
  width: clamp(8rem, 24vw, 11.2rem);
  aspect-ratio: 1;
  perspective: 45rem;
  perspective-origin: 50% 42%;
}

.mystery-cube {
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(5.5rem, 16vw, 7.4rem);
  aspect-ratio: 1;
  transform-style: preserve-3d;
  will-change: transform;
}

.is-rolling .mystery-cube {
  animation: mystery-roll 1.05s cubic-bezier(0.38, 0.02, 0.62, 0.98) infinite;
}

.is-revealed .mystery-cube {
  animation: mystery-land 1.25s cubic-bezier(0.18, 0.88, 0.28, 1.18) both;
}

.cube-face {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border: 0.2rem solid var(--mystery-gold);
  border-radius: 19%;
  background:
    radial-gradient(circle at 29% 23%, rgba(255, 255, 255, 0.63), transparent 12%),
    linear-gradient(145deg, color-mix(in srgb, var(--mystery-accent) 72%, white 16%), color-mix(in srgb, var(--mystery-accent) 79%, #13051f));
  box-shadow:
    inset 0 0 0 0.22rem rgba(255, 255, 255, 0.12),
    inset -0.6rem -0.7rem 1.2rem rgba(0, 0, 0, 0.38),
    inset 0.45rem 0.5rem 0.9rem rgba(255, 255, 255, 0.19),
    0 0 0.9rem color-mix(in srgb, var(--mystery-accent) 60%, transparent);
  color: #fff9db;
  font-family: ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif;
  font-size: clamp(3.3rem, 9vw, 4.8rem);
  font-weight: 1000;
  line-height: 1;
  text-shadow:
    0 0.08em 0 #8c5b0c,
    0 0 0.28em rgba(255, 238, 167, 0.9);
  backface-visibility: hidden;
}

.cube-face--front {
  transform: translateZ(clamp(2.75rem, 8vw, 3.7rem));
}

.cube-face--back {
  transform: rotateY(180deg) translateZ(clamp(2.75rem, 8vw, 3.7rem));
}

.cube-face--right {
  transform: rotateY(90deg) translateZ(clamp(2.75rem, 8vw, 3.7rem));
}

.cube-face--left {
  transform: rotateY(-90deg) translateZ(clamp(2.75rem, 8vw, 3.7rem));
}

.cube-face--top {
  transform: rotateX(90deg) translateZ(clamp(2.75rem, 8vw, 3.7rem));
}

.cube-face--bottom {
  transform: rotateX(-90deg) translateZ(clamp(2.75rem, 8vw, 3.7rem));
}

.dice-glow {
  position: absolute;
  inset: 7%;
  border-radius: 50%;
  background: var(--mystery-accent);
  filter: blur(1.35rem);
  opacity: 0.72;
  animation: glow-breathe 0.72s ease-in-out infinite alternate;
}

.dice-shadow {
  position: absolute;
  right: 7%;
  bottom: -7%;
  left: 7%;
  height: 15%;
  border-radius: 50%;
  background: #000;
  filter: blur(0.42rem);
  opacity: 0.72;
  transform: scaleX(0.78);
  animation: shadow-bounce 0.52s ease-in-out infinite alternate;
}

.is-revealed .dice-shadow {
  animation: shadow-land 1.25s ease-out both;
}

.reveal-flare {
  position: absolute;
  inset: -65%;
  border-radius: 50%;
  background:
    linear-gradient(90deg, transparent 47%, rgba(255, 255, 255, 0.95) 50%, transparent 53%),
    linear-gradient(0deg, transparent 47%, rgba(255, 255, 255, 0.92) 50%, transparent 53%),
    radial-gradient(circle, #fff 0 2%, var(--mystery-gold) 5%, color-mix(in srgb, var(--mystery-accent) 64%, transparent) 16%, transparent 48%);
  opacity: 0;
  transform: scale(0.18) rotate(0deg);
}

.is-revealed .reveal-flare {
  animation: reveal-flash 1.15s 0.45s ease-out both;
}

.mystery-copy {
  position: relative;
  z-index: 5;
  display: grid;
  width: 100%;
  justify-items: center;
  gap: clamp(0.45rem, 1.1vh, 0.8rem);
  text-align: center;
}

.mystery-kicker {
  display: flex;
  align-items: center;
  justify-content: center;
  width: min(100%, 23rem);
  gap: 0.65rem;
  color: var(--mystery-gold);
  font-size: clamp(0.7rem, 2.3vw, 0.95rem);
  font-weight: 900;
  letter-spacing: 0.22em;
  line-height: 1;
  text-transform: uppercase;
  text-shadow: 0 0 0.8rem rgba(255, 216, 121, 0.72);
}

.kicker-line {
  width: clamp(1.2rem, 7vw, 3.4rem);
  height: 1px;
  background: linear-gradient(90deg, transparent, currentColor);
}

.kicker-line:last-child {
  transform: scaleX(-1);
}

.mystery-label {
  max-width: 100%;
  color: #fff;
  font-family: "Arial Black", Impact, ui-sans-serif, system-ui, sans-serif;
  font-size: clamp(2rem, 8vw, 4.35rem);
  font-style: italic;
  font-weight: 1000;
  letter-spacing: -0.045em;
  line-height: 0.94;
  overflow-wrap: anywhere;
  text-wrap: balance;
  text-transform: uppercase;
  -webkit-text-stroke: clamp(1px, 0.16vw, 2px) color-mix(in srgb, var(--mystery-accent) 74%, white);
  text-shadow:
    0 0.08em 0 rgba(0, 0, 0, 0.92),
    0 0 0.12em #fff,
    0 0 0.38em var(--mystery-accent),
    0 0.18em 0.42em rgba(0, 0, 0, 0.9);
}

.is-rolling .mystery-label {
  animation: label-charge 0.72s ease-in-out infinite alternate;
}

.is-revealed .mystery-label {
  animation: label-impact 0.82s 0.48s cubic-bezier(0.16, 1.32, 0.32, 1) both;
}

.mystery-detail {
  max-width: 29rem;
  padding: 0.5rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--mystery-accent) 48%, transparent);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.42);
  color: rgba(255, 255, 255, 0.91);
  font-size: clamp(0.82rem, 2.7vw, 1.12rem);
  font-weight: 750;
  line-height: 1.25;
  overflow-wrap: anywhere;
  text-wrap: balance;
  box-shadow: inset 0 0 1rem color-mix(in srgb, var(--mystery-accent) 13%, transparent);
}

.mystery-live-result {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.is-revealed .mystery-detail {
  animation: detail-rise 0.68s 0.65s ease-out both;
}

.mystery-particles {
  position: absolute;
  z-index: 3;
  inset: 12% 6% 14%;
}

.mystery-particles i {
  --angle: calc(var(--particle-index) * 25.714deg);
  position: absolute;
  top: 39%;
  left: 50%;
  width: 0.24rem;
  aspect-ratio: 1;
  border-radius: 50%;
  background: color-mix(in srgb, var(--mystery-accent) 45%, var(--mystery-gold));
  box-shadow:
    0 0 0.5rem currentColor,
    0 0 1.1rem currentColor;
  opacity: 0;
  transform: rotate(var(--angle)) translateY(-1.8rem);
}

.mystery-particles i:nth-child(3n + 1) {
  width: 0.2rem;
}

.mystery-particles i:nth-child(3n + 2) {
  width: 0.29rem;
}

.is-rolling .mystery-particles i {
  animation: particle-orbit 1.45s calc(var(--particle-index) * -0.09s) linear infinite;
}

.is-revealed .mystery-particles i {
  animation: particle-burst 1.1s calc(0.38s + var(--particle-index) * 0.018s) ease-out both;
}

.mystery-presence-enter-active {
  transition: opacity 0.26s ease-out;
}

.mystery-presence-leave-active {
  transition: opacity 0.24s ease-in;
}

.mystery-presence-enter-from,
.mystery-presence-leave-to {
  opacity: 0;
}

.mystery-presence-enter-active .mystery-core {
  animation: core-arrive 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
}

@keyframes mystery-roll {
  0% {
    transform: translate(-50%, -50%) translateY(-0.2rem) rotateX(18deg) rotateY(0deg) rotateZ(8deg);
  }
  24% {
    transform: translate(-50%, -50%) translateY(-1.1rem) rotateX(118deg) rotateY(154deg) rotateZ(-22deg);
  }
  50% {
    transform: translate(-50%, -50%) translateY(0.25rem) rotateX(238deg) rotateY(306deg) rotateZ(12deg);
  }
  75% {
    transform: translate(-50%, -50%) translateY(-0.9rem) rotateX(371deg) rotateY(456deg) rotateZ(31deg);
  }
  100% {
    transform: translate(-50%, -50%) translateY(-0.2rem) rotateX(498deg) rotateY(720deg) rotateZ(8deg);
  }
}

@keyframes mystery-land {
  0% {
    transform: translate(-50%, -50%) translateY(-1rem) scale(0.9) rotateX(510deg) rotateY(690deg) rotateZ(-18deg);
  }
  48% {
    transform: translate(-50%, -50%) translateY(0.55rem) scale(1.1) rotateX(344deg) rotateY(402deg) rotateZ(8deg);
  }
  66% {
    transform: translate(-50%, -50%) translateY(-0.5rem) scale(0.97) rotateX(330deg) rotateY(384deg) rotateZ(-3deg);
  }
  82% {
    transform: translate(-50%, -50%) translateY(0.14rem) scale(1.025) rotateX(344deg) rotateY(391deg) rotateZ(1deg);
  }
  100% {
    transform: translate(-50%, -50%) rotateX(340deg) rotateY(390deg) rotateZ(0deg);
  }
}

@keyframes core-arrive {
  from {
    opacity: 0;
    transform: scale(0.72);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes ring-spin-reverse {
  to {
    transform: rotate(-360deg);
  }
}

@keyframes ring-pulse {
  to {
    opacity: 0.55;
    transform: scale(1.08);
  }
}

@keyframes glow-breathe {
  to {
    opacity: 0.94;
    transform: scale(1.2);
  }
}

@keyframes shadow-bounce {
  to {
    opacity: 0.43;
    transform: scaleX(0.5);
  }
}

@keyframes shadow-land {
  0% {
    opacity: 0.3;
    transform: scaleX(0.46);
  }
  52% {
    opacity: 0.9;
    transform: scaleX(1.06);
  }
  72% {
    transform: scaleX(0.7);
  }
  100% {
    opacity: 0.72;
    transform: scaleX(0.8);
  }
}

@keyframes reveal-flash {
  0% {
    opacity: 0;
    transform: scale(0.15) rotate(0deg);
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: scale(1.1) rotate(32deg);
  }
}

@keyframes label-charge {
  to {
    filter: brightness(1.28);
    transform: scale(1.025);
  }
}

@keyframes label-impact {
  0% {
    opacity: 0;
    filter: blur(0.55rem);
    transform: scale(1.85);
  }
  65% {
    opacity: 1;
    filter: blur(0);
    transform: scale(0.93);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes detail-rise {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes particle-orbit {
  0% {
    opacity: 0;
    transform: rotate(var(--angle)) translateY(-2.8rem) scale(0.4);
  }
  22%,
  72% {
    opacity: 0.9;
  }
  100% {
    opacity: 0;
    transform: rotate(calc(var(--angle) + 86deg)) translateY(-6.8rem) scale(1);
  }
}

@keyframes particle-burst {
  0% {
    opacity: 0;
    transform: rotate(var(--angle)) translateY(-1rem) scale(0.2);
  }
  16% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: rotate(var(--angle)) translateY(-12rem) scale(1.5);
  }
}

@media (max-width: 34rem) {
  .mystery-core {
    width: min(95%, 30rem);
    min-height: clamp(21rem, 46vh, 28rem);
  }

  .mystery-detail {
    border-radius: 0.7rem;
  }
}

@media (max-height: 46rem) and (orientation: landscape) {
  .mystery-reveal {
    padding-block: 1rem;
  }

  .mystery-core {
    grid-template-columns: minmax(8rem, 0.72fr) minmax(13rem, 1.28fr);
    min-height: 17rem;
    gap: 1rem;
  }

  .energy-rings {
    top: 50%;
    left: 25%;
    width: 10.5rem;
    transform: translate(-50%, -50%);
  }

  .mystery-copy {
    grid-column: 2;
  }

  .mystery-label {
    font-size: clamp(2rem, 6vw, 3.8rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mystery-reveal *,
  .mystery-reveal *::before,
  .mystery-reveal *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }

  .mystery-presence-enter-active,
  .mystery-presence-leave-active {
    transition-duration: 0.001ms;
  }

  .is-rolling .mystery-cube {
    transform: translate(-50%, -50%) rotateX(-18deg) rotateY(28deg);
  }

  .is-revealed .mystery-cube {
    transform: translate(-50%, -50%) rotateX(340deg) rotateY(390deg);
  }
}
</style>
