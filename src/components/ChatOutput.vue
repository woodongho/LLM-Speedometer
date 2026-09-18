<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  text: string
  running: boolean
}>()

const scrollRef = ref<HTMLElement | null>(null)

watch(() => props.text, () => {
  requestAnimationFrame(() => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
})
</script>

<template>
  <section class="card" style="flex:1; display:flex; flex-direction:column; min-height:0">
    <h2 class="section-title" style="margin-bottom:10px">Response</h2>
    <div class="chat" ref="scrollRef">
      {{ props.text }}{{ props.running ? '<span class="cursor"></span>' : '' }}
    </div>
  </section>
</template>
