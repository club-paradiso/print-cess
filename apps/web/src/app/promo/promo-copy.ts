/**
 * Korean copy for /promo. Every product claim here is taken from a screen or a
 * document that already ships: the phone strings in `packages/i18n`
 * (`ko`), `docs/PRIVACY.md`, `docs/PRINT_QUOTA.md` and `docs/FILE_TRANSFER.md`.
 * When one of those changes, change the line here too.
 */

export const REPOSITORY_URL = "https://github.com/club-paradiso/print-cess";
const DOCS_URL = `${REPOSITORY_URL}/blob/main/docs`;

export const hero = {
  eyebrow: "휴대전화에서 보내고 바로 출력하는 셀프 인쇄",
  title: "휴대전화 속 문서를 프린터에서 바로 뽑아요",
  lead: "프린터 옆 화면의 QR 코드를 찍고, 파일을 고르면 한 부가 나와요. 가입도 앱 설치도 필요 없어요.",
  cta: "사용 방법 보기",
  secondaryCta: "Print-cess 시작하기",
  statusLine: "개발·시연 단계예요. 실제 기관에 설치된 서비스가 아니에요.",
  scenes: [
    { id: "university", label: "대학교" },
    { id: "airport", label: "공항" },
  ],
  filmLabel: "대학교 도서관과 공항에서 프린터로 종이를 받는 장면",
  filmNote: "시연용 영상이에요. 실제 장소나 설치 사례가 아니에요.",
  pause: "영상 멈추기",
  play: "영상 재생",
  stillNote: "움직임을 줄이는 설정이라 사진만 보여요.",
} as const;

export const how = {
  id: "how",
  title: "세 단계면 끝나요",
  lead: "아래는 휴대전화에 실제로 뜨는 문구를 따라 만든 화면 예시예요. 누르는 버튼은 없고, 위 단계 버튼으로 넘겨 볼 수 있어요.",
  stepsLabel: "단계 고르기",
  previous: "이전 화면",
  next: "다음 화면",
  mockNote: "화면 예시예요. 이 화면에서는 인쇄되지 않아요.",
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
  title: "믿고 쓸 수 있는지 먼저 알려 드려요",
  statusTitle: "지금은 개발·시연 단계예요",
  statusBody:
    "Print-cess는 아직 실제 개인 문서를 다루도록 승인받은 서비스가 아니에요. 어느 기관에도 설치되어 있지 않고, 인증이나 정식 운영 중이라는 뜻도 아니에요. 시연에는 실제 개인 문서를 쓰지 마세요.",
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
