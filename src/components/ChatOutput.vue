<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  text: string
  running: boolean
  error?: string | null
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
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
      <h2 class="section-title" style="margin:0">Response</h2>
      <span v-if="running" class="badge" style="border-color:var(--accent); color:var(--accent)">
        ● Streaming...
      </span>
    </div>

    <div class="chat" ref="scrollRef">
      <!-- Error Message Box inside Chat Output -->
      <div v-if="error" class="chat-error-box">
        <div class="chat-error-title">⚠️ 요청 실패 (Response Error)</div>
        <div class="chat-error-body">{{ error }}</div>
        <div class="chat-error-tips">
          <strong>점검 사항:</strong>
          <ul>
            <li><strong>CORS 허용 여부:</strong> 엔드포인트 서버가 웹 브라우저(Vercel 도메인)의 요청을 허용하는 <code>Access-Control-Allow-Origin</code> 헤더를 반환하는지 확인하세요. (curl로 작동해도 브라우저는 CORS 검사를 합니다)</li>
            <li><strong>Model 이름:</strong> 설정된 <code>Model</code> 이름이 실제 서버에 존재하는 모델 이름과 정확히 일치하는지 확인하세요.</li>
            <li><strong>API Key:</strong> 엔드포인트가 인증을 필요로 한다면 올바른 <code>API Key</code>가 입력되었는지 확인하세요.</li>
            <li><strong>브라우저 콘솔:</strong> 키보드 <code>F12</code> 키를 눌러 [Console] 및 [Network] 탭에서 빨간색 상세 에러 로그를 확인하세요.</li>
          </ul>
        </div>
      </div>

      <!-- Response Content -->
      <span v-if="text" class="chat-content">{{ text }}</span>

      <!-- Active Cursor -->
      <span v-if="running" class="cursor"></span>

      <!-- Waiting Indicator before First Token -->
      <div v-if="running && !text && !error" class="chat-waiting">
        <span class="pulse-dot"></span> 엔드포인트에 연결하여 첫 번째 토큰을 기다리는 중입니다 (TTFT 측정 중)...
      </div>

      <!-- Idle Hint -->
      <div v-else-if="!text && !running && !error" class="muted small" style="font-family: inherit">
        좌측 설정 후 [▶ Run benchmark] 버튼을 클릭하면 여기에 실시간 스트리밍 답변과 속도가 출력됩니다.
      </div>
    </div>
  </section>
</template>
