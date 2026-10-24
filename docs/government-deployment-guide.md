# 기관 도입 가이드 (Government Deployment Guide)

이 문서는 print-cess를 관공서에 도입할 때 거쳐야 할 절차를 정리합니다.
print-cess는 **무설치** 방식입니다. 기관 PC에도 방문자 휴대전화에도 프로그램을 설치하지
않고 브라우저의 표준 HTTPS와 Web Crypto만 씁니다.

> 아래 6개 게이트가 모두 닫히기 전에는 Production 배포를 금지합니다. 게이트마다 담당자,
> 날짜를 적은 근거 자료, 정식 승인 결정이 있어야 합니다. 리포지토리의 체크박스는 안내일
> 뿐이며 승인이 아닙니다. 근거 자료의 세부 규정은 `docs/READINESS_EVIDENCE.md`를,
> 기관 승인 기록 양식은 `docs/INSTITUTIONAL_APPROVAL.md`를 따릅니다.

## 도입 전제

- **무설치 원칙**: 방문자(민원인)는 `/visitor` 화면의 QR 코드를 휴대전화 카메라로
  스캔하고 서류를 업로드합니다. 로그인·앱 설치·회원가입이 필요 없습니다.
- **자동 파기**: 업로드된 서류는 출력이 끝나거나 세션이 만료되면 서버에서 자동으로
  삭제됩니다. 전송 파일에는 만료 시간(기본 30분, `DROP_TTL_SECONDS`로 설정 가능)이
  붙고 시간이 지나면 자동 삭제 스윕이 암호문 조각을 모두 지웁니다.
- **우회 금지**: 기관의 DLP, 다운로드 차단, 프록시, 망분리, 허용 도메인 정책이
  print-cess를 막으면 그 정책이 우선합니다. print-cess는 기관 보안정책을
  우회하지 않습니다.

## 도입 체크리스트 (Production Gate 6건)

### Gate 1 — 기관 승인 (Institutional approval)

- 이슈: [#8](https://github.com/club-paradiso/print-cess/issues/8)
- 내용: 정보보안·개인정보(법무)·조달/공급자·Windows 단말·프린터/현장 운영·접근성 및
  언어·사고 대응·브랜드/서비스 귀속 분야의 승인권자가 각각 아키텍처, 위협 모델,
  인터넷/공급자 사용, 단말 강화, 사고 대응, 잔여 리스크를 승인합니다.
- 사고/롤백 드릴을 통과하고 연락망·복구 목표와 교체·통지 결정을 문서로 남깁니다.
- 근거: `docs/INSTITUTIONAL_APPROVAL.md`의 승인 기록표에 결정·범위·조건·유효기간·
  근거 링크·담당자를 적습니다. 승인 뒤에 바뀌는 것이 있으면 영향을 받는 게이트를 다시 엽니다.

### Gate 2 — Authenticode 서명 (Windows kiosk artifact signing)

- 이슈: [#10](https://github.com/club-paradiso/print-cess/issues/10)
- 내용: 서명 없이 체크섬만 있는 파일은 배포할 수 있는 Windows 산출물이 아닙니다. 인증서
  발급자·코드서명 EKU·게시자 주체·보관 모델·교체/폐기 담당자·타임스탬프 서비스를
  승인하고 서명 방식은 HSM/관리형 서명을 우선합니다.
- 절차: 보호된 `windows-signing` 환경에서 필수 리뷰어와 태그 제한을 설정하고,
  `WINDOWS_SIGNING_CERT_BASE64`, `WINDOWS_SIGNING_CERT_PASSWORD`,
  `AUTHENTICODE_EXPECTED_SUBJECT`, `AUTHENTICODE_TIMESTAMP_URL`을 값이 드러나지 않게
  설정합니다.
- 검증: 사전 릴리스 태그 워크플로를 실행하고 `signtool verify /pa /all /v`로
  게시자·타임스탬프·체인·체크섬을 확인합니다. 이어서 대상 Windows 이미지에서 다시
  내려받아 한 번 더 검증하고 악성코드 검사를 합니다. 근거는 `docs/AUTHENTICODE.md`에
  정리합니다.

### Gate 3 — 실물 프린터 검증 (Target Windows and physical-printer acceptance)

- 이슈: [#7](https://github.com/club-paradiso/print-cess/issues/7)
- 내용: CI 빌드가 녹색이어도 프린터가 동작한다는 근거는 되지 않습니다. 배포 전에 반드시
  실물 프린터로 테스트해야 합니다.
- 검증 항목: 실제로 쓸 프린터의 정확한 모델/드라이버/펌웨어 수락, 용지·소모품, 물리적
  배치와 출력물 처리(출력물 방치 방지), 오류가 났을 때의 책임 소재. Windows kiosk 이미지는
  `docs/WINDOWS_KIOSK_DEPLOYMENT.md` 절차를 따릅니다.
- 방문자 인쇄 모드(`/visitor`)는 카운터 화면에서 QR→업로드→출력→자동 파기로 이어지는
  전 과정을 실제 프린터로 검증합니다. mock 프린터는
  `PRINT_CESS_ENVIRONMENT=Development`와 루프백 서버에서만 쓸 수 있고 Production
  설치에서는 켤 수 없습니다.

### Gate 4 — 격리된 Preview 프로바이더 (Isolated Preview providers)

- 이슈: [#6](https://github.com/club-paradiso/print-cess/issues/6)
- 내용: Production과 분리된 Preview 전용 제공자 리소스(Vercel/Blob, Redis, QStash
  또는 Railway 스택)를 프로비저닝하고 정확한 HTTPS 오리진과 필수 Blob·Redis·
  QStash·키오스크 등록·관리자 자격증명을 넣습니다. 호스팅되는 Preview/Production은
  값이 없으면 fail-closed로 시작합니다.
- 검증: 승인된 자격증명으로 제공자 수락 테스트를 합니다(수동으로 실행하는
  `Preview provider acceptance` 워크플로). 자격증명이 필요한 테스트는 일부러 따로
  떼어 두었으며 CI의 mock 테스트로 대신할 수 없습니다.
- 관련 문서: `docs/VERCEL_DEPLOYMENT.md`, `docs/RAILWAY_PROVIDERS.md`,
  `docs/READINESS_EVIDENCE.md`.

### Gate 5 — 접근성·8개 언어 리뷰 (Device, accessibility, and language review)

- 이슈: [#11](https://github.com/club-paradiso/print-cess/issues/11)
- 내용: axe/브라우저 자동 검사와 기계 번역 문자열은 개발 단계의 근거일 뿐, 수락 근거가
  되지 않습니다. 지원하는 iPhone Safari·Android Chrome 조합(셀룰러 경로 포함)과, 실제로 쓸
  Windows kiosk의 디스플레이/배율·스피커·키보드 정책·보조기술을 테스트합니다.
- 검사 항목: 키보드 전용 조작, VoiceOver/TalkBack/Windows 스크린리더, 200% 텍스트,
  400% 리플로, 고대비, 모션 감소, 음소거/음성 불가, 화면 방향, 포커스/오류 알림,
  WCAG 2.2 AA 명도 대비, 잘리지 않는 64px 조작 요소.
- 언어: 영어·한국어·중국어 간체·베트남어·몽골어·태국어·러시아어·네팔어는 자격을 갖춘
  원어민 리뷰어가 문맥 안에서 확인하고 승인합니다. `/visitor` 카운터 화면의 문구(파일
  위치, 문서 누락, 1회 출력 승인, 오류, 개인정보/삭제 안내, 비공식 서비스 고지, 음성
  안내 포함)도 같은 방식으로 검토합니다. 근거는
  `docs/ACCESSIBILITY_LANGUAGE_ACCEPTANCE.md`에 정리합니다.

### Gate 6 — 코드/시크릿 보호 (GitHub native code and secret protection)

- 이슈: [#9](https://github.com/club-paradiso/print-cess/issues/9)
- 내용: GitHub 네이티브 코드 스캐닝/시크릿 스캐닝·푸시 보호를 활성화합니다.
  지금은 보완 통제로 보호된 `main`(strict PR, 대화 해결, 선형 히스토리, 관리자
  강제, Web/Windows/의존성/Gitleaks 검사, 강제 푸시·삭제 차단), `v*` 태그 생성
  제한, `.gitleaks.toml` 기반 검사가 동작하고 있습니다.
- 검증: 네이티브 보호를 켠 뒤에도 보완 통제는 그대로 유지하고 리포지토리에 시크릿이
  커밋되지 않았는지 주기적으로 스캔합니다. 기관에 도입할 때 이 내용을 승인 기록에 넣습니다.

## 운영 설정 (관공서 권장값)

| 환경 변수                                | 권장값                | 의미                                                                             |
| ---------------------------------------- | --------------------- | -------------------------------------------------------------------------------- |
| `VISITOR_TTL_SECONDS`                    | `600` (기본값)        | `/visitor` 세션의 QR 유효 시간이자 업로드 파일 수명. 세션 만료 시 파일 자동 파기 |
| `DROP_TTL_SECONDS`                       | `1800` (기본값, 30분) | 휴대전화 간 전송 파일의 만료 시간. 만료 시 자동 삭제                             |
| `QR_TTL_SECONDS` / `SESSION_TTL_SECONDS` | `120` / `180`         | 일반 키오스크 QR/세션 수명                                                       |

방문자 대기열이 긴 창구에서는 `VISITOR_TTL_SECONDS`를 최대 1800(30분)까지 늘릴 수
있습니다. 30분을 넘는 값은 설정 검증에서 거부됩니다.

## 도입 순서

1. Gate 4(격리된 Preview 프로바이더)를 먼저 닫고 제공자 수락 테스트를 진행합니다.
2. Gate 3(실물 프린터 검증)과 Gate 2(Authenticode 서명)를 목표 Windows 이미지에서
   진행합니다.
3. Gate 6(코드/시크릿 보호)과 Gate 5(접근성·8개 언어 리뷰)를 병행합니다.
4. 모든 근거를 `docs/PRODUCTION_BLOCKERS.md`와 대조한 뒤, Gate 1(기관 승인)과
   사고/롤백 드릴을 거쳐 최종 go/no-go 결정을 요청합니다.

민원 창구에서 서류를 출력하는 시나리오는 `docs/visitor-counter-scenario.md`를 참고하세요.
