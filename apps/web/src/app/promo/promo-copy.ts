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
    { href: "#support", label: "후원" },
    { href: "#faq", label: "자주 묻는 질문" },
  ],
  menu: "메뉴",
  start: "이용 화면",
} as const;

export const hero = {
  eyebrow: "QR 코드로 연결하는 셀프 인쇄",
  titleLines: ["휴대전화 속 문서를", "프린터에서 바로 뽑아요"],
  lead: "사진이나 PDF를 종이로 뽑아야 할 때, 프린터 옆 QR 코드로 연결하세요.",
  gloss: "가입도 앱 설치도 필요 없어요.",
  cta: "사용 방법 보기",
  secondaryCta: "이용 화면 열기",
  filmLabel: "대학교 도서관과 공항에서 프린터로 종이를 받는 장면",
  filmNote: "AI로 만든 시연 영상이에요. 실제 장소나 설치 사례가 아니에요.",
  stillNote: "기기에서 움직임을 줄이는 설정이라 사진만 보여요.",
} as const;

export const statement = {
  words: ["QR 찍고,", "고르고,", "받으면 끝."],
  lead: "프린터 옆 화면의 QR 코드를 찍고, 휴대전화에서 파일을 고르고, 프린터에서 종이를 받아요. 그 사이에 가입도 설치도 없어요.",
  facts: [
    { value: "0", label: "가입하거나 로그인할 일" },
    { value: "0", label: "새로 설치할 앱" },
    { value: "1", label: "문서 하나는 한 번 인쇄하고 지워요" },
  ],
} as const;

export const how = {
  id: "how",
  title: "QR 코드로 연결하고, 파일을 골라요",
  lead: "프린터 옆 화면에서 시작해요. 단계별 화면 예시도 확인할 수 있어요.",
  mockNote: "화면 예시예요. 이 화면에서는 인쇄되지 않아요.",
  dockLabel: "화면 예시",
  previewLabel: "화면 예시 보기",
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
      title: "파일 고르고 인쇄하기",
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
    chooseRules: "사진 또는 PDF · 사진·PDF 50MB 이하",
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
  entryTitle: "이용 화면에서 시작하세요",
  entryBody:
    "인쇄는 프린터 옆 QR 코드로 연결해요. 파일 공유와 문서 스캔은 이용 화면에서 열 수 있어요.",
  tryTitle: "프린터 없이 흐름을 살펴보세요",
  tryBody: "프린터 옆 화면을 브라우저에서 살펴볼 수 있어요. 시연에는 예시 파일을 사용하세요.",
  tryKiosk: "시연 화면 열기",
  tryStart: "이용 화면 열기",
} as const;

export const more = {
  title: "인쇄·공유·스캔",
  lead: "인쇄는 프린터 옆 화면이 필요해요. 파일 공유와 문서 스캔은 기기에서 시작할 수 있어요.",
  conditionsLabel: "쓰기 전에 알아 둘 점",
  items: [
    {
      id: "print",
      name: "인쇄",
      body: "휴대전화 속 파일을 종이 한 부로 뽑아요.",
      conditions: [
        "프린터 옆 Print-cess 화면의 QR 코드를 찍어야 시작돼요.",
        "사진 또는 PDF를 쓸 수 있어요. 사진과 PDF는 각각 50MB 이하예요.",
        "한 번에 파일 10개, 합계 128MB까지 보낼 수 있어요.",
        "HWPX는 프린터가 지원할 때만 고를 수 있어요. 그 밖의 문서는 PDF로 저장한 뒤 고르세요.",
      ],
      cta: "QR 연결 안내 열기",
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
      cta: "파일 보내기 열기",
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
  privacyDetails: "파일 처리와 삭제 범위 보기",
  privacyCaveat:
    "서비스의 파일 삭제가 브라우저 기록·프린터 저장소·제공 업체의 백업까지 즉시 지운다는 뜻은 아니에요.",
  privacyTitle: "파일은 암호화해서 보내요",
  privacyLead:
    "가입이나 연락처 입력 없이 이용해요. 인쇄 파일은 휴대전화에서 암호화한 뒤 보내고, 인쇄가 끝나면 삭제 절차를 실행해요.",
  privacyRows: [
    { on: true, title: "인쇄할 파일", body: "휴대전화에서 잠가 보내요" },
    { on: false, title: "이름·연락처·계정", body: "요청하지 않아요" },
    { on: false, title: "파일 이름", body: "서버가 받지 않아요" },
  ],
  points: [
    {
      title: "계정이 필요 없어요",
      body: "가입도 로그인도 없어요. 공용 컴퓨터에 로그인할 일도 없어요.",
    },
    {
      title: "보내기 전에 암호화해요",
      body: "파일은 휴대전화를 떠나기 전에 암호화돼요. 서버와 저장소에는 잠긴 상태의 파일만 남아요.",
    },
    {
      title: "인쇄가 끝나면 삭제해요",
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
  title: "개발 후원",
  lead: "후원은 선택이에요. 후원하지 않아도 인쇄·공유·스캔 기능을 이용할 수 있어요.",
  usesTitle: "후원금 사용 계획",
  detailsLabel: "후원금 사용 계획과 참여 방법 보기",
  uses: [
    "서버와 저장소 같은 서비스 운영 비용",
    "실제 프린터로 하는 시험",
    "설치 파일 서명 같은 출시 준비",
  ],
  openLabel: "후원할 수 있어요",
  closedLabel: "후원 창구 준비 중",
  closedBody:
    "아직 후원을 받는 창구가 열리지 않았어요. 열리면 이 자리에 안내해요. 그전에는 아래 방법으로 도와 주실 수 있어요.",
  openButton: "후원 방법 보기",
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
  fine: "후원 방법을 확인한 뒤 선택할 수 있어요. 이 페이지에서 결제하지 않아요.",
  freeTitle: "의견으로 참여하기",
  free: [
    {
      title: "의견 보내기",
      body: "불편했던 점이나 개선할 점을 알려주세요.",
      href: "https://docs.google.com/forms/d/e/1FAIpQLSdaKWWcQfV5Tb5rKwFzk8gUh4Mrz0ZgV18TqO2-mZxqOHfRoA/viewform",
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
      a: "PDF와 사진 파일을 인쇄할 수 있어요. JPG·PNG 외에도 휴대전화에서 열 수 있는 여러 사진 형식을 지원해요. HWPX는 해당 기능을 지원하는 인쇄 환경에서 사용할 수 있어요. 다른 문서는 PDF로 저장한 뒤 선택해 주세요. 파일당 최대 50MB까지 가능하며, 페이지 수 제한은 없어요.",
    },
    {
      q: "QR 코드가 안 찍히거나 시간이 지났다고 해요.",
      a: "프린터 옆 화면의 새 QR 코드를 다시 찍으세요. 기본 설정에서 QR 코드는 3분 동안만 쓸 수 있어요. 카메라가 안 되면 휴대전화 기본 카메라 앱으로 찍어 보세요.",
    },
    {
      q: "내 문서는 어디에 남나요?",
      a: "파일은 암호화해서 전송해요. 인쇄가 끝나거나 실패하거나 취소되면 서버에 임시로 저장된 파일을 삭제하도록 설계했어요. 휴대전화에 있는 원본 파일은 삭제되지 않아요.",
    },
    {
      q: "인쇄할 파일이 없으면 어떻게 하나요?",
      a: "인쇄할 파일을 먼저 휴대전화에 저장하세요.",
    },
    {
      q: "후원해야만 이용할 수 있나요?",
      a: "그건 아니긴 한데…. (제발 도와주세요)",
    },
  ],
} as const;

export const footer = {
  by: "by Club Paradiso",
  note: "Print-cess는 Club Paradiso의 오픈소스 프로젝트예요.",
  linksLabel: "프로젝트 링크",
  links: [
    { label: "사용 방법", href: "#how" },
    { label: "GitHub", href: REPOSITORY_URL },
    { label: "보안 정책", href: `${REPOSITORY_URL}/blob/main/SECURITY.md` },
    { label: "개인정보 문서", href: `${DOCS_URL}/PRIVACY.md` },
    { label: "라이선스(Apache-2.0)", href: `${REPOSITORY_URL}/blob/main/LICENSE` },
  ],
} as const;
