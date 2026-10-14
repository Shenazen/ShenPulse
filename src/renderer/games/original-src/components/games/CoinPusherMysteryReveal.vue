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

<style scoped src="./styles/mystery-reveal/index.generated.css"></style>
