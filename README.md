# 🏎️ LLM Speedometer

> OpenAI 호환 스트리밍 API를 통해 로컬 및 클라우드 LLM의 실제 생성 속도(TPS)와 첫 토큰 지연 시간(TTFT)을 실시간으로 계측·시각화하는 모던 벤치마크 도구입니다.

[![Vercel Deployment](https://img.shields.io/badge/Demo-Vercel-black?style=flat-square&logo=vercel)](https://llm-speedometer.vercel.app/)
[![Vue 3](https://img.shields.io/badge/Framework-Vue%203-42b883?style=flat-square&logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Chart.js](https://img.shields.io/badge/Visualization-Chart.js-ff6384?style=flat-square&logo=chart.js)](https://www.chartjs.org/)
[![Tauri](https://img.shields.io/badge/Desktop-Tauri%20v2-24c8db?style=flat-square&logo=tauri)](https://tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

🔗 **웹 데모 바로가기**: [https://llm-speedometer.vercel.app/](https://llm-speedometer.vercel.app/)

---

## 📌 프로젝트 소개

**LLM Speedometer**는 OpenAI 호환 규격의 스트리밍 API(Ollama, vLLM, llama.cpp, LM Studio, SGLang, Groq, OpenAI 등)에 직접 연결하여 실시간 생성 속도 지표를 초정밀로 추출하고 시각화하는 오픈소스 벤치마크 도구입니다.

복잡하고 무거운 서버 측 모니터링 에이전트 없이도, 웹 브라우저나 가벼운 네이티브 데스크톱 앱(Tauri)에서 JSON SSE 스트림을 직접 파싱하여 **TTFT (첫 토큰 시간)**, **TPOT (토큰당 시간)**, **TPS (초당 생성 토큰 수)** 등의 핵심 지표를 즉각 확인하고 비교할 수 있습니다.

> 🔒 **100% 프라이버시 보장**: 모든 계측과 연산은 사용자의 클라이언트(브라우저/앱) 내부에서만 수행되며, 입력한 엔드포인트 URL, API 키 및 대화 프롬프트는 어떤 외부 서버로도 전송되지 않습니다.

---

## ✨ 주요 기능

### 1. 🏎️ 슈퍼카 아날로그 속도계 (Radial Tachometer Gauge)
* **실시간 네온 바늘 (Needle)**: 토큰이 스트리밍되는 즉시 순간 생성 속도(TPS)에 반응하여 부드럽게 가속하는 아날로그 계기판.
* **속도 구간별 동적 모드 (Drive Modes)**:
  * `0 ~ 40 tok/s`: **CRUISING 🚗** (시안 블루)
  * `40 ~ 90 tok/s`: **SPORT 🏎️** (에메랄드 그린)
  * `90 ~ 150 tok/s`: **RACE 🚀** (앰버 골드)
  * `150+ tok/s`: **NITRO 🔥** (네온 마젠타 오버드라이브 발광)
* **MAX PEAK TPS 기록**: 세션 중 달성한 최고 순간 속도를 핀 마커와 뱃지로 실시간 추적.
* **🔊 Web Audio API 음향 피드백**: 토큰 생성 속도(TPS)에 비례하는 경쾌한 피치의 오디오 틱 사운드 지원 (원클릭 음소거 토글 제공).

### 2. ⏱️ 초정밀 실시간 성능 지표 (Live Metrics)
* **TTFT (Time to First Token)**: 사용자의 요청 전송 시점부터 첫 번째 디코딩 토큰이 화면에 도착할 때까지의 지연 시간(프리필 단계 속도)을 ms 단위로 측정.
* **TPOT (Time Per Output Token)**: 모델이 1개의 토큰을 디코딩하는 데 걸리는 평균 시간(ms).
* **TPS (Tokens Per Second)**: 실시간 생성 처리량(Throughput)을 계산하여 모델의 순수 추론 속도 확인.
* **토큰 수 정밀 집계**: OpenAI `stream_options: { include_usage: true }` 및 Ollama 메타데이터를 파싱하여 `prompt_tokens` / `completion_tokens` / `total_tokens`를 정확하게 집계.

### 3. 📈 실시간 속도 그래프 (Live Speed Graph)
* **슬라이딩 윈도우 스무딩**: 네트워크 버퍼링으로 인한 왜곡을 방지하기 위해 1초 트레일링 윈도우 방식으로 정제된 실시간 TPS 변화 추이를 Chart.js로 시각화.
* **생성 전 과정 추적**: 생성 시작부터 완료까지 토큰 생성 속도의 안정성을 한눈에 파악 가능.

### 4. 💾 실행 기록 저장 및 성능 비교 (Saved Runs)
* **로컬 영구 저장**: 실행 결과를 브라우저 `localStorage`에 자동 저장.
* **백엔드/양자화 비교**: 동일 프롬프트에 대해 FP16 vs Q4_K_M 양자화 모델, vLLM vs Ollama 백엔드 간의 성능 차이를 카드 형태로 손쉽게 비교·분석.

### 5. 🌐 유연한 멀티 플랫폼 지원
* **Vercel 웹 배포**: 브라우저 어디서나 바로 접속하여 사용 가능.
* **Tauri 네이티브 데스크톱 앱**: Rust 기반 초경량 데스크톱 앱으로, 웹 브라우저의 CORS 및 Mixed Content 제약 없이 로컬 `http://localhost:11434`에 즉시 접속 가능.
* **Mixed Content & CORS 스마트 진단**: HTTPS 환경에서 발생할 수 있는 네트워크/보안 차단을 자동 감지하고 해결 가이드 제공.

---

## 📊 지표 설명 및 산출 공식

| 지표 | 명칭 | 계산 공식 | 설명 |
| :--- | :--- | :--- | :--- |
| **TTFT** | Time to First Token | $T_{\text{first}} - T_{\text{start}}$ (ms) | 프롬프트 처리(Prefill) 및 대기열 지연 시간 |
| **TPOT** | Time Per Output Token | $\frac{\text{generationDurationMs}}{\text{tokens} - 1}$ (ms) | 디코딩 단계에서 토큰 1개를 생성하는 평균 시간 |
| **TPS** | Tokens Per Second | $\frac{\text{completion\_tokens}}{\text{generationDurationMs}} \times 1000$ | 순수 생성 구간의 초당 토큰 생성량 |
| **Effective TPS** | 유효 생성 속도 | $\frac{\text{completion\_tokens}}{\text{totalDurationMs}} \times 1000$ | 첫 토큰 대기 시간(TTFT)을 포함한 전체 체감 속도 |
| **Tokens** | 토큰 구성 | 프롬프트 / 완료 / 총합 | 서버 반환 공식 `usage` 기반 집계 |

---

## 🛠️ 기술 스택

* **Frontend**: [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
* **Charts**: [Chart.js 4](https://www.chartjs.org/)
* **Desktop App Wrapper**: [Tauri v2](https://tauri.app/) (Rust 기반 네이티브 래퍼)
* **Testing**: [Vitest](https://vitest.dev/) (59개 유닛 테스트 통과)
* **Deployment**: [Vercel](https://vercel.com/)

---

## 🚀 사용 가이드

### 1. Vercel 웹에서 사용 시

Vercel(HTTPS) 웹 브라우저에서 로컬 모델(Ollama, vLLM)을 연결할 때 브라우저의 Mixed Content/CORS 정책을 해결하는 가장 추천하는 방법입니다:

```bash
# 1. 로컬 Ollama에 외부 접속 및 CORS 허용
OLLAMA_ORIGINS="*" ollama serve

# 2. 무료 Cloudflare 터널로 HTTPS 주소 발급 (설치 필요 없음)
npx cloudflared tunnel --url http://localhost:11434
```
* 터미널에 생성된 `https://xxxx.trycloudflare.com` 주소를 웹사이트의 **Endpoint URL**에 입력하고 모델 이름을 설정한 뒤 **▶ Run benchmark**를 누르면 끝!

---

### 2. 로컬 개발 환경 실행

```bash
# 1. 저장소 클론
git clone https://github.com/woodongho/LLM-Speedometer.git
cd LLM-Speedometer

# 2. 의존성 패키지 설치
npm install

# 3. 로컬 Vite 개발 서버 실행 (HTTP 환경이므로 localhost:11434에 바로 접속 가능)
npm run dev
```
브라우저에서 `http://localhost:5173`으로 접속합니다.

---

### 3. Tauri 네이티브 데스크톱 앱 빌드

```bash
# 데스크톱 개발 모드 실행
npm run tauri dev

# 프로덕션 데스크톱 앱 번들 빌드
npm run tauri build
```

---

## 🧪 테스트 실행

핵심 메트릭 계산, SSE 라인 파서, 토큰 추출 알고리즘은 Vitest를 통해 완벽히 검증됩니다:

```bash
npm test
```

---

## 👤 Author

* **우동호 (woodongho)**
  * Email: [uhotax@gmail.com](mailto:uhotax@gmail.com)
  * GitHub: [@woodongho](https://github.com/woodongho)

---

## 📄 라이선스

This project is licensed under the [MIT License](LICENSE).
