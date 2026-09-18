# 🏎️ LLM Speedometer

로컬에서 동작하는 **대형 언어 모델(LLM)의 속도를 계측·시각화**하는 경량의 데스크톱 애플리케이션입니다.
**OpenAI 호환 스트림 API**(Ollama, vLLM, llama.cpp, LM Studio, SGLang)에 연결해,
API가 뿜어내는 JSON 스트림에서 실시간 성능 지표를 바로 추출합니다 —
무거운 서버 측 모니터링은 필요 없습니다.

리소스를 아끼는 현대적 스택으로 구축했습니다: **Tauri (Rust)** + **Vue 3 (Vite)**,
실시간 차트는 **Chart.js**로 구현했습니다.

---

## ✨ 주요 기능

### 실시간 성능 지표
- **TTFT** – Time to First Token (프릴레이드 단계의 지연시간)
- **TPOT** – 출력 토큰 1개당 평균 시간 (디코딩 단계)
- **TPS** – 초당 토큰 수 (생성 스루풋)
- **토큰 수 확인** – `prompt_tokens` / `completion_tokens` / `total_tokens`
- **Ollama 메타데이터 파싱** – `eval_duration`, `prompt_eval_count` 등
  (프릴레이드 시간 및 스루풋 계산에 활용)

### 스트림 기반 분석
- **실속도 그래프** – 응답이 스트림으로 들어오는 동안 TPS를 실시간으로 시각화
- **실행 기록 비교** – 벤치마크 결과를 로컬에 저장해
  백엔드별 / 양자화(quantization) 레벨별 속도를 비교

### 엔진 독립 통합
- 완전히 커스터마이징 가능한 **endpoint URL** 과 **API key**
- 브라우저 웹뷰에서 직접 스트림 처리 → **API key는 이 기기를 절대 떠나지 않음**

---

## 📊 지표 설명

| 지표 | 의미 | 계산 방법 |
| ---- | ---- | --------- |
| TTFT | 첫 토큰까지의 시간 | 요청 시작부터 첫 출력 토큰이 들어올 때까지의 경과(ms) |
| TPOT | 출력 토큰 1개당 평균 시간 | `generationDurationMs / (톤토큰 수 - 1)` |
| TPS | 생성 스루풋 | `completion_tokens / generationDurationMs * 1000` |
| effectiveTps | 전체.wall-clock 기준 스루풋 | `completion_tokens / totalDurationMs * 1000` |

토큰 수는 다음 우선순위로 결정됩니다:
명확한 OpenAI `usage` → Ollama `usage` → 출력된 토큰으로 추정.

---

## 🚀 시작하기

### 사전 준비
- **Node.js** 18+ 및 **npm**
- **Rust** 도구체인 ([rustup](https://rustup.rs)) — Tauri 데스크톱 앱 빌드에 필요
- **시스템 라이브러리**(Linux) — 한 번만 설치:

```bash
# Debian/Ubuntu
sudo apt-get update
sudo apt-get install -y pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev libssl-dev
```

### 설치 및 개발

```bash
npm install        # 프론트엔드 의존성 설치
npm run dev        # Vite 개발 서버 실행 (프론트엔드만)
npm run tauri dev  # full Tauri 데스크톱 앱 빌드 & 실행
```

### 프로덕션 빌드

```bash
npm run build      # 타입체크(vue-tsc) + 프론트엔드를 dist/로 빌드
npm run tauri build # 네이티브 데스크톱 앱 번들 (dist-tauri/ 생성)
```

### 로컬 모델로 테스트하기

1. 로컬 OpenAI 호환 서버를 시작합니다. 예: [Ollama](https://ollama.com)
   ```bash
   ollama run llama3.1
   ```
2. 앱을 열고 **Endpoint URL** 을 `http://localhost:11434`(Ollama) 또는
   사용 중인 엔진의 base URL로 설정합니다.
3. 모델 이름을 입력하고 **▶ Run benchmark** 를 누릅니다.

---

## 🧪 테스트

핵심 벤치마크 로직(지표 계산 + SSE 파싱)은 순수 TypeScript이며
Vitest로 완전히 유닛 테스트됩니다:

```bash
npm test        # 모든 테스트 한 번에 실행
npm run test:watch
```

다음과 같은 경계 사례(edge case)를 다룹니다:
빈 스트림, 단일 토큰 응답, 순서가 바뀐 타임스탬프,
OpenAI vs Ollama 청크 포맷, 손상/반으로 잘린 SSE 라인,
토큰 수 결정, Ollama 시간 메타데이터.

---

## 🏗️ 프로젝트 구조

```
LLM_Speedometer/
├── src/
│   ├── components/          # Vue UI 컴포넌트
│   │   ├── ConfigPanel.vue  # endpoint / api key / model / 파라미터
│   │   ├── MetricCards.vue  # TTFT / TPOT / TPS / 토큰 수
│   │   ├── SpeedChart.vue   # Chart.js 실시간 속도 그래프
│   │   ├── ChatOutput.vue   # 스트림으로 받은 응답 텍스트
│   │   └── SavedRuns.vue    # 저장된 실행 기록 비교
│   ├── composables/
│   │   └── useBenchmark.ts  # 스트림 오케스트레이션 + 상태
│   ├── lib/
│   │   ├── llm.ts           # OpenAI 호환 스트림 fetch
│   │   ├── sse.ts           # SSE/JSON 라인 파서 (OpenAI + Ollama)
│   │   ├── metrics.ts       # TTFT/TPOT/TPS 계산
│   │   ├── endpoint.ts      # endpoint URL 정규화
│   │   ├── storage.ts       # localStorage 영구 저장
│   │   ├── format.ts        # 표시 헬퍼
│   │   └── types.ts
│   ├── App.vue
│   └── main.ts
├── src-tauri/               # Tauri (Rust) 데스크톱 래퍼
│   ├── src/main.rs
│   ├── tauri.conf.json
│   ├── capabilities/
│   └── icons/
├── tests/                   # Vitest 유닛 테스트
├── vercel.json              # 프론트엔드 Vercel 배포 설정
└── README.md
```

---

## 📄 라이선스

MIT
