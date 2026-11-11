# Writing Clinic

화전 우등생 학원 영어 글쓰기 연습장입니다.

- 모의고사에 자주 나오는 제재 30개 중 하나를 뽑거나 골라 영어로 한 단락을 씁니다.
- Basic · Intermediate · Advanced 레벨에 따라 단어 힌트(30 · 20 · 10개)와 첨삭 기준이 달라집니다.
- 문법과 구조 첨삭, 피드백을 반영한 글쓰기 예시를 보여 줍니다.

## 구성

- `index.html`: 사이트 전체 (GitHub Pages, Vercel 어디서든 열림)
- `api/evaluate.js`: AI 첨삭 중계 서버 (Vercel에서만 작동). API 키는 이 서버에만 있고 학생 화면에는 노출되지 않습니다.
- `api/_lib/prompt.js`: 첨삭 기준 (사이트와 같은 기준을 서버에서 사용, 자동 생성 파일)

## Vercel 환경 변수

| 이름 | 설명 | 기본값 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API 키 (필수) | 없음 |
| `MODEL` | 첨삭 모델 | `claude-sonnet-5-5` |
| `HOURLY_LIMIT` | 기기당 1시간 첨삭 횟수 | `5` |
| `IP_HOURLY_LIMIT` | 같은 인터넷 주소(학원 와이파이 등)당 1시간 첨삭 횟수 | `60` |
| `DAILY_LIMIT` | 사이트 전체 하루 첨삭 횟수 | `300` |
| `LOG_URL` | 첨삭 기록을 받을 구글 Apps Script 웹 앱 주소 (`tools/apps-script.gs`) | 없음 (기록 안 함) |
| `STATS_PASSWORD` | 통계 화면(/stats)의 선생님 전용 비밀번호 | 없음 |
| `LOG_SECRET` | Apps Script의 `SECRET`과 같은 값 | 없음 |

API 키가 없거나 GitHub Pages에서 열면 첨삭 버튼 대신 "제출용으로 복사" 안내가 나옵니다.

`LOG_URL`이 있으면 사이트에 "쓴 글과 결과가 선생님께 저장돼요" 안내가 자동으로 표시됩니다.

통계 화면: `/stats` (학생 공개 통계 + 선생님 비밀번호로 학생별 기록). 이름이 '테스트'인 기록은 통계에서 빠집니다.
