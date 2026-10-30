/**
 * Korean copy for /promo. Every product claim here is taken from a screen or a
 * document that already ships: the phone strings in `packages/i18n`
 * (`ko`), `docs/PRIVACY.md`, `docs/PRINT_QUOTA.md` and `docs/FILE_TRANSFER.md`.
 * When one of those changes, change the line here too.
 */

export const REPOSITORY_URL = "https://github.com/club-paradiso/print-cess";
const DOCS_URL = `${REPOSITORY_URL}/blob/main/docs`;

export const nav = {
  label: "이 페이지",
  items: [
    { href: "#how", label: "사용 방법" },
    { href: "#more", label: "기능" },
    { href: "#trust", label: "개발 현황" },
    { href: "#support", label: "후원" },
    { href: "#faq", label: "자주 묻는 질문" },
  ],
  menu: "메뉴",
  start: "시작하기",
} as const;

export const hero = {
  eyebrow: "휴대전화에서 보내고 바로 출력하는 셀프 인쇄",
  titleLines: ["휴대전화 속 문서를", "프린터에서 바로 뽑아요"],
  lead: "QR 코드를 찍고 파일을 고르면, 프린터에서 한 부가 나와요.",
  gloss: "가입도 앱 설치도 필요 없어요.",
  cta: "사용 방법 보기",
  secondaryCta: "Print-cess 시작하기",
  statusLine: "개발·시연 단계예요. 실제 기관에 설치된 서비스가 아니에요.",
  statusLink: "개발 현황 보기",
  scenePicker: "장면 고르기",
  previewScene: "화면 예시",
  previewNote: "화면 예시예요. 실제로 인쇄되지 않아요.",
  motionReduce: "움직임 줄이기",
  motionDefault: "움직임 기본값",
  scenes: [
    { id: "university", label: "대학교" },
    { id: "airport", label: "공항" },
  ],
  filmLabel: "대학교 도서관과 공항에서 프린터로 종이를 받는 장면",
  filmNote: "AI로 만든 시연 영상이에요. 실제 장소나 설치 사례가 아니에요.",
  pause: "영상 멈추기",
  play: "영상 재생",
  stillNote: "움직임을 줄이는 설정이라 사진만 보여요.",
} as const;

export const how = {
  id: "how",
  title: "세 단계면 끝나요",
  lead: "스크롤하면 오른쪽 화면이 지금 읽는 단계를 따라가요. 화면은 휴대전화에 실제로 뜨는 문구를 따라 만든 예시이고, 누르는 버튼은 없어요.",
  mockNote: "화면 예시예요. 이 화면에서는 인쇄되지 않아요.",
  dockLabel: "화면 예시",
  variantsLabel: "화면 고르기",
  variants: ["파일 고르기", "확인하고 인쇄"],
  pictures: {
    kiosk: "프린터 옆 큰 화면에 QR 코드가 보여요.",
    choose: "휴대전화에 인쇄할 문서를 고르라는 화면이 떠요.",
    check: "휴대전화에 미리보기와 A4 한 부 인쇄 버튼이 보여요.",
    done: "휴대전화에 종이를 가져가라는 안내가 떠요.",
  },
  steps: [
    {
      title: "QR 코드 찍기",
      body: "프린터 옆 큰 화면의 QR 코드를 휴대전화 카메라로 찍어요.",
    },
    {
      title: "휴대전화에서 파일 선택",
      body: "인쇄할 사진이나 PDF를 고르고, 미리보기로 확인한 뒤 인쇄 버튼을 눌러요.",
    },
    {
      title: "프린터에서 종이 받기",
      body: "큰 화면 옆 프린터에서 종이를 가져가요.",
    },
  ],
  screens: {
    kioskTitle: "프린터 옆 화면",
    kioskCaption: "휴대전화 카메라로 이 화면의 QR 코드를 찍어요.",
    kioskFinder: "이 표시가 있는 화면을 찾으세요.",
    chooseTitle: "인쇄할 문서를 하나 고르세요",
    chooseRules: "사진 또는 PDF · 사진 20MB 이하 · PDF 10MB, 50페이지 이하",
    choosePhotos: "사진에서 고르기",
    chooseFiles: "파일에서 고르기",
    checkTitle: "이 문서가 맞나요?",
    checkHelp: "아래에 보이는 그대로 인쇄돼요. 꼼꼼히 확인하세요.",
    checkSummary: "한 부 · A4 용지 · 흑백 · 단면",
    checkPrivacy: "문서는 보내는 동안 잠겨 있고, 인쇄가 끝나면 바로 지워져요.",
    checkPrint: "A4 한 부 인쇄",
    checkOther: "다른 문서 고르기",
    doneTitle: "종이를 가져가세요",
    doneBody: "큰 화면 옆 프린터에 종이가 나와 있어요.",
    doneClose: "이 화면 닫기",
  },
  tryTitle: "직접 해 보려면",
  tryBody:
    "인쇄는 프린터 옆 화면에서만 시작돼요. 이 사이트의 시연 화면에서는 프린터 없이 전체 흐름을 눌러 볼 수 있어요.",
  tryKiosk: "시연 화면 열기",
  tryStart: "휴대전화 첫 화면 보기",
} as const;

export const more = {
  title: "이런 것도 할 수 있어요",
  lead: "Print-cess에는 세 가지 기능이 있어요. 각각 쓸 수 있는 조건이 달라요.",
  conditionsLabel: "쓰기 전에 알아 둘 점",
  items: [
    {
      id: "print",
      name: "인쇄",
      body: "휴대전화 속 파일을 종이 한 부로 뽑아요.",
      conditions: [
        "프린터 옆 Print-cess 화면의 QR 코드를 찍어야 시작돼요.",
        "사진 또는 PDF를 쓸 수 있어요. 사진은 20MB, PDF는 10MB 이하예요.",
        "11페이지까지는 바로 인쇄돼요. 12~50페이지는 직원이 큰 화면에서 승인해야 하고, 50페이지가 넘으면 인쇄할 수 없어요.",
        "HWPX는 프린터가 지원할 때만 고를 수 있어요. 그 밖의 문서는 PDF로 저장한 뒤 고르세요.",
      ],
      cta: "인쇄 시작 화면",
      href: "/start",
    },
    {
      id: "share",
      name: "공유",
      body: "사진과 파일을 다른 휴대전화, 태블릿, 컴퓨터로 보내요.",
      conditions: [
        "보내는 사람이 파일을 고르고, 받는 사람이 QR 코드나 링크로 받아요.",
        "파일은 보내는 기기에서 암호화되고, 기본 30분 뒤 서버에서 지워져요. 보낸 사람이 먼저 지울 수도 있어요.",
        "프린터나 큰 화면 없이 두 사람의 기기만 있으면 돼요.",
      ],
      cta: "보낼 파일 고르기",
      href: "/send",
      secondaryCta: "코드로 파일 받기",
      secondaryHref: "/receive",
    },
    {
      id: "scan",
      name: "스캔",
      body: "종이 문서를 이 휴대전화에서 PDF로 만들고, 저장하거나 보내요.",
      conditions: [
        "카메라를 쓰도록 허용해야 해요. 사진첩에서 고를 수도 있어요.",
        "종이 모서리를 찾아 반듯하게 펴 주고, 모서리는 직접 조절할 수 있어요.",
        "프린터에서 뽑으려면 스캔한 PDF를 먼저 저장하세요. 그다음 큰 화면의 QR 코드를 찍고 파일에서 그 PDF를 고르세요.",
      ],
      cta: "문서 스캔하기",
      href: "/scan",
    },
  ],
} as const;

export const trust = {
  id: "trust",
  title: "지금은 여기까지 만들었어요",
  statusTitle: "지금은 개발·시연 단계예요",
  statusBody:
    "Print-cess는 아직 실제 개인 문서를 다루도록 승인받은 서비스가 아니에요. 어느 기관에도 설치되어 있지 않고, 인증이나 정식 운영 중이라는 뜻도 아니에요. 시연에는 실제 개인 문서를 쓰지 마세요.",
  timelineLead: "끝난 것과 아직 남은 일을 나눠서 적었어요. 정식 운영 날짜는 정해지지 않았어요.",
  timeline: [
    {
      state: "done",
      title: "인쇄, 공유, 스캔의 전 과정",
      body: "개발 환경과 Preview 배포에서 처음부터 끝까지 동작해요.",
    },
    {
      state: "done",
      title: "자동 테스트와 접근성 검사",
      body: "화면 흐름과 접근성을 자동으로 확인해요.",
    },
    {
      state: "next",
      title: "실제 프린터 현장 검증",
      body: "실제 프린터로 하는 시험은 아직 남아 있어요.",
    },
    {
      state: "next",
      title: "기관의 정보보안·개인정보 검토",
      body: "실제 개인 문서를 다루려면 거쳐야 하는 검토예요.",
    },
    {
      state: "next",
      title: "외부 서비스 승인과 서명된 설치 파일",
      body: "저장소 같은 외부 서비스의 승인과 윈도우용 설치 파일 서명이 남았어요.",
    },
  ],
  stateLabels: { done: "동작해요", next: "아직이에요" },
  privacyTitle: "문서만 잠깐 지나가요",
  privacyLead: "이름도 연락처도 계정도 요청하지 않아요. 파일은 휴대전화에서 잠근 채 보내요.",
  privacyRows: [
    { on: true, title: "인쇄할 파일", body: "휴대전화에서 잠가 보내요" },
    { on: false, title: "이름·연락처·계정", body: "요청하지 않아요" },
    { on: false, title: "파일 이름", body: "서버가 받지 않아요" },
  ],
  statusLink: "남은 과제 보기",
  statusHref: `${DOCS_URL}/PRODUCTION_BLOCKERS.md`,
  points: [
    {
      title: "계정이 필요 없어요",
      body: "가입도 로그인도 없어요. 공용 컴퓨터에 로그인할 일도 없어요.",
    },
    {
      title: "휴대전화에서 잠가 보내요",
      body: "파일은 휴대전화를 떠나기 전에 암호화돼요. 서버와 저장소에는 잠긴 상태의 파일만 남아요.",
    },
    {
      title: "출력하면 지워져요",
      body: "문서 하나는 한 번만 인쇄해요. 인쇄가 끝나거나 실패하거나 취소되거나 시간이 지나면 파일을 지우도록 되어 있어요.",
    },
    {
      title: "파일 이름도 받지 않아요",
      body: "서버는 파일 이름을 받지 않고, 분석 도구도 넣지 않았어요.",
    },
  ],
  limitsTitle: "그래도 알아 둘 점",
  limits: [
    "‘지워진다’는 서비스가 삭제 절차를 마쳤다는 뜻이에요. 제공 업체의 백업, 브라우저 기록, 프린터 내부 저장소까지 즉시 지워진다는 약속은 아니에요.",
    "인쇄가 끝나면 이 화면의 저장 데이터를 비우고 화면을 닫지만, 브라우저 방문 기록과 휴대전화 사진첩의 원본은 그대로예요.",
    "‘숫자 네 자리와 도형’으로 받는 선택 방식에서는 서버가 3분 동안 열쇠를 맡아 둬요. QR 코드와 링크로 보낼 때는 그렇지 않아요.",
  ],
  limitsLink: "개인정보 문서 읽기",
  limitsHref: `${DOCS_URL}/PRIVACY.md`,
} as const;

export const support = {
  id: "support",
  title: "Print-cess 개발을 후원하고 싶다면",
  lead: "후원은 선택이에요. 후원하지 않아도 Print-cess의 모든 기능을 그대로 쓸 수 있고, 후원한다고 더 쓸 수 있는 기능이나 한도가 생기지도 않아요.",
  usesTitle: "후원금은 이런 곳에 쓰려고 해요",
  uses: [
    "서버와 저장소 같은 서비스 운영 비용",
    "실제 프린터로 하는 시험",
    "설치 파일 서명 같은 출시 준비",
  ],
  openLabel: "후원할 수 있어요",
  closedLabel: "후원 창구 준비 중",
  closedBody:
    "아직 후원을 받는 창구가 열리지 않았어요. 열리면 이 자리에 안내해요. 그전에는 아래 방법으로 도와 주실 수 있어요.",
  openButton: "후원하기",
  closedButton: "후원 준비 상태 보기",
  dialogTitle: "후원 안내",
  dialogClose: "닫기",
  linkCta: "후원하러 가기",
  linkNote:
    "버튼을 누르면 아래 주소의 외부 사이트로 이동해요. 결제는 그 사이트에서 이뤄지고, Print-cess는 결제 정보를 받지 않아요.",
  bankTitle: (bank: string) => `${bank} 계좌로 후원하기`,
  bankCheck: "송금하기 전에 은행, 예금주, 금액을 꼭 확인하세요.",
  bankName: "은행",
  bankAccount: "계좌번호",
  bankHolder: "예금주",
  tossCta: "토스로 송금하기",
  tossNote: "휴대전화에서 누르면 토스 앱이 열려요. 금액은 토스에서 직접 정하고 확인해요.",
  tossQrTitle: "QR로 송금하기",
  tossQrBody:
    "컴퓨터로 보고 있다면 휴대전화 카메라로 QR 코드를 찍으세요. 토스가 열리지 않으면 아래 계좌번호를 복사해 송금할 수 있어요.",
  tossQrAlt: "토스 앱 송금 화면으로 연결되는 QR 코드",
  bankCopy: "계좌번호 복사",
  bankCopied: "복사했어요",
  bankFailed: "복사하지 못했어요. 번호를 직접 선택해 복사하세요.",
  fine: "후원금은 기부금 영수증이나 세액공제 대상이 아니에요. 후원 때문에 문서나 개인정보를 받는 일은 없어요.",
  freeTitle: "돈 말고도 큰 도움이 돼요",
  free: [
    {
      title: "GitHub에서 지켜보기",
      body: "코드와 개발 과정이 모두 공개되어 있어요.",
      href: REPOSITORY_URL,
    },
    {
      title: "의견이나 오류 알려 주기",
      body: "써 보다 불편했던 점을 이슈로 남겨 주세요.",
      href: `${REPOSITORY_URL}/issues`,
    },
  ],
} as const;

export const faq = {
  id: "faq",
  title: "자주 묻는 질문",
  items: [
    {
      q: "가입이나 앱 설치가 필요한가요?",
      a: "아니요. 가입도 로그인도 앱 설치도 없어요. 휴대전화 브라우저만 있으면 돼요.",
    },
    {
      q: "어떤 파일을 인쇄할 수 있나요?",
      a: "사진 또는 PDF예요. 사진은 20MB, PDF는 10MB 이하, 50페이지 이하여야 해요. 다른 문서는 휴대전화에서 PDF로 저장한 뒤 고르세요. HWPX는 프린터가 지원할 때만 고를 수 있어요.",
    },
    {
      q: "12페이지가 넘으면 어떻게 되나요?",
      a: "11페이지까지는 바로 인쇄돼요. 12~50페이지는 직원이 프린터 옆 화면에서 승인해야 하고, 휴대전화에서는 승인할 수 없어요. 50페이지가 넘으면 인쇄할 수 없어요.",
    },
    {
      q: "QR 코드가 안 찍히거나 시간이 지났다고 해요.",
      a: "프린터 옆 화면의 새 QR 코드를 다시 찍으세요. 기본 설정에서 QR 코드는 3분 동안만 쓸 수 있어요. 카메라가 안 되면 휴대전화 기본 카메라 앱으로 찍어 보세요.",
    },
    {
      q: "내 문서는 어디에 남나요?",
      a: "휴대전화에서 잠근 상태로 보내고, 서버에는 잠긴 파일만 잠깐 있어요. 인쇄가 끝나거나 실패하거나 취소되면 지우도록 되어 있어요. 다만 브라우저 방문 기록이나 사진첩의 원본은 그대로예요.",
    },
    {
      q: "보낼 파일이 아직 없어요.",
      a: "이 서비스는 문서를 찾거나 새로 만들어 주지 않아요. 예약한 분이나 항공사, 여행사에 연락해서 휴대전화로 문서를 받으세요.",
    },
    {
      q: "후원하면 더 많이 인쇄할 수 있나요?",
      a: "아니요. 후원 여부와 기능, 인쇄 한도는 관계없어요.",
    },
  ],
} as const;

export const footer = {
  by: "by Club Paradiso",
  note: "Print-cess는 개발·시연 단계의 오픈소스 프로젝트예요. 공공기관의 서비스가 아니에요.",
  linksLabel: "프로젝트 링크",
  links: [
    { label: "사용 방법", href: "#how" },
    { label: "GitHub", href: REPOSITORY_URL },
    { label: "보안 정책", href: `${REPOSITORY_URL}/blob/main/SECURITY.md` },
    { label: "개인정보 문서", href: `${DOCS_URL}/PRIVACY.md` },
    { label: "라이선스(Apache-2.0)", href: `${REPOSITORY_URL}/blob/main/LICENSE` },
  ],
} as const;
