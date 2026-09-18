<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { listRuns, deleteRun, clearRuns, summarize } from '@/lib/storage'
import type { StoredRun } from '@/lib/types'

const runs = ref<StoredRun[]>([])

function load() {
  runs.value = listRuns()
}

function remove(id: string) {
  deleteRun(id)
  load()
}

function refresh() {
  load()
}

defineExpose({ refresh })

onMounted(load)
</script>

<template>
  <section class="card" style="flex:1; min-height:0; display:flex; flex-direction:column">
    <div style="display:flex; justify-content:space-between; align-items:center">
      <h2 class="section-title" style="margin:0">Saved Runs</h2>
      <button v-if="runs.length" class="link small" @click="clearRuns(); load()">Clear</button>
    </div>

    <div style="flex:1; overflow-y:auto; margin-top:10px">
      <p v-if="!runs.length" class="small muted">No runs saved yet. Results are stored locally.</p>

      <div v-for="run in runs" :key="run.id" class="run-item">
        <div class="top">
          <span class="model">{{ run.label || run.model }}</span>
          <span class="badge" :class="{ ollama: run.engine === 'ollama' }">{{ run.engine }}</span>
        </div>
        <div class="meta">{{ run.model }} · {{ run.endpoint }} · {{ new Date(run.createdAt).toLocaleString() }}</div>
        <div class="run-grid">
          <span class="k">TTFT</span><span class="v">{{ summarize(run).ttft }}</span>
          <span class="k">TPOT</span><span class="v">{{ summarize(run).tpot }}</span>
          <span class="k">TPS</span><span class="v">{{ summarize(run).tps }}</span>
          <span class="k">Tokens</span><span class="v">{{ summarize(run).tokens }}</span>
        </div>
        <div style="margin-top:8px; text-align:right">
          <button class="link small" style="color:var(--bad)" @click="remove(run.id)">Delete</button>
        </div>
      </div>
    </div>
  </section>
</template>
