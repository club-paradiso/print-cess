# print-cess 디자인 감사 — 2026-10-20 (universal UX/UI 프롬프트 3차 적용)

## 프로젝트 정보

- 관공서용 무설치(zero-install) 파일 전송·인쇄 (방문자 모드)
- 핵심 사용자: 카운터의 민원인(QR 스캔→업로드)과 직원(출력)
- 대상 화면: `/visitor` — QR 카드 + 4단계 스테퍼(스캔→업로드→출력→파기) + 세션 카운트다운 + 상태 알림
- 기존 상태: Lucide 아이콘, 디자인 토큰(--pc-*), 한/영 카피, aria-live/aria-current 처리 완료 — 기본기가 탄탄함

## 적용된 수정

1. **포커스 가시성** (`visitor.css`): `.visitor-back`, `.visitor-restart`에 `:focus-visible`
   스타일 추가 (3px `--pc-focus-ring` 아웃라인). 기존 `.home-kiosk-entry`와 같은 패턴.
2. **로딩 상태 애니메이션** (`visitor-flow.tsx` + `visitor.css`): QR을 준비하는 동안
   플레이스홀더의 RefreshCw 아이콘이 멈춰 있어 "고장"처럼 보이던 문제 수정. 준비 중일 때만
   1.6s 회전하고 실패 상태(AlertTriangle)에는 적용되지 않도록 `--failed` 클래스로 분기.
   `prefers-reduced-motion`에서는 애니메이션 비활성화.

## 검증

- `npx tsc --noEmit` 통과, vitest visitor 테스트 2개 통과, eslint 0 errors (img 경고 1건은 이전부터 있던 것)

## 손대지 않은 것

- 단계 스테퍼의 `opacity: 0.65` 비활성 처리 — upcoming-step을 나타내는 의도된 affordance로 판단
- 한/영 카피 — kolint가 설치되지 않아(선택 도구) 육안으로만 검토했고 문제 없음
- kiosk 앱(.NET)은 웹 UI 범위 밖이라 제외
