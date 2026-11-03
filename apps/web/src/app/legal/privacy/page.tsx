import type { Metadata } from "next";
import Link from "next/link";

import { LegalNote, LegalSection, LegalShell, LegalTable } from "../legal-shell";
import { privacyContact } from "../legal-config";

export const metadata: Metadata = {
  title: "개인정보 처리방침 · Print-cess by Club Paradiso",
  description: "Print-cess가 처리하는 정보, 보유 기간, 파기 방법, 위탁과 국외 이전, 이용자의 권리.",
  robots: { index: false, follow: false },
};

const FEEDBACK_FORM =
  "https://docs.google.com/forms/d/e/1FAIpQLSdaKWWcQfV5Tb5rKwFzk8gUh4Mrz0ZgV18TqO2-mZxqOHfRoA/viewform";
const REPOSITORY = "https://github.com/club-paradiso/print-cess";

const toc = [
  { id: "purpose", label: "1. 처리 목적" },
  { id: "items", label: "2. 처리하는 정보" },
  { id: "retention", label: "3. 보유 기간" },
  { id: "destruction", label: "4. 파기 절차와 방법" },
  { id: "third-party", label: "5. 제3자 제공" },
  { id: "outsourcing", label: "6. 처리 위탁과 국외 이전" },
  { id: "rights", label: "7. 이용자의 권리와 행사 방법" },
  { id: "safety", label: "8. 안전성 확보 조치" },
  { id: "cookies", label: "9. 쿠키 등 자동 수집 장치" },
  { id: "children", label: "10. 만 14세 미만 아동" },
  { id: "officer", label: "11. 개인정보 보호책임자" },
  { id: "remedy", label: "12. 권익 침해 구제 방법" },
  { id: "institution", label: "13. 기관에 설치한 경우" },
  { id: "changes", label: "14. 처리방침의 변경" },
];

export default function PrivacyPolicyPage() {
  const contact = privacyContact();

  return (
    <LegalShell
      current="/legal/privacy"
      kicker="개인정보"
      title="개인정보 처리방침"
      lead={
        <p>
          Club Paradiso(이하 “운영자”)는 Print-cess 서비스(인쇄·파일 공유·문서 스캔)를 운영하면서
          「개인정보 보호법」 제30조에 따라 이 처리방침을 공개해요. Print-cess는 가입이나 연락처
          입력 없이 쓰도록 만들었고, 파일은 휴대전화에서 잠근 뒤 보내요. 그래도 서비스를 쓰는
          과정에서 처리되는 정보가 있어서 그 범위를 숨김없이 적었어요.
        </p>
      }
      summary={{
        title: "한눈에 보기",
        items: [
          { label: "회원가입·연락처", value: "받지 않아요" },
          {
            label: "인쇄·공유하는 파일",
            value: "기기에서 암호화한 상태로만 잠깐 보관하고, 끝나면 지워요",
          },
          {
            label: "보유 기간",
            value: "인쇄는 최대 약 3분, 파일 공유는 기본 30분(보낸 사람이 먼저 지울 수 있어요)",
          },
          { label: "제3자 제공", value: "하지 않아요" },
          {
            label: "처리 위탁·국외 이전",
            value: "서버·저장소 운영을 해외(미국) 클라우드 업체에 맡겨요",
          },
          { label: "쿠키", value: "언어 설정 등 기능용만 써요. 광고·분석 쿠키는 없어요" },
        ],
      }}
      toc={toc}
    >
      <LegalSection id="purpose" title="1. 개인정보의 처리 목적">
        <p>
          운영자는 아래 목적에만 정보를 처리하고, 목적이 바뀌면 미리 알리고 필요한 절차를 밟아요.
        </p>
        <ul>
          <li>휴대전화의 파일을 프린터 옆 화면(키오스크)으로 전달해 한 번 인쇄하기</li>
          <li>기기와 기기 사이에 파일을 전달하기(파일 공유)</li>
          <li>종이 문서를 휴대전화에서 PDF로 만들기(문서 스캔)</li>
          <li>남용 방지, 장애 대응, 보안 사고 조사 등 서비스를 안전하게 유지하기</li>
          <li>이용자가 직접 보낸 의견에 답하고 서비스를 고치기(선택)</li>
        </ul>
      </LegalSection>

      <LegalSection id="items" title="2. 처리하는 개인정보의 항목">
        <p>
          이름, 이메일, 전화번호, 국적, 여권번호, 외국인등록번호, 예약번호 같은 항목은 입력란 자체가
          없어요. 계정을 만들거나 로그인하지도 않아요. 처리되는 정보는 아래와 같아요.
        </p>
        <LegalTable
          caption="처리하는 정보와 수집 방법"
          head={["구분", "항목", "어떻게 생기나요"]}
          rows={[
            [
              "인쇄·공유할 파일",
              "이용자가 고른 파일의 내용(문서 안에 이름, 여권번호 같은 개인정보가 들어 있을 수 있어요)",
              "이용자가 직접 고른 파일을 휴대전화에서 암호화해 보내요. 서버는 잠긴 파일만 받아요.",
            ],
            [
              "서비스 이용 기록",
              "IP 주소, 브라우저·기기 정보(User-Agent), 접속 시각, 요청한 주소, 응답 결과",
              "웹사이트에 접속하면 서버와 호스팅 업체의 인프라에 자동으로 남아요.",
            ],
            [
              "남용 방지 값",
              "IP 주소에 매시간 바뀌는 값을 섞어 만든 SHA-256 해시",
              "파일 공유를 지나치게 많이 쓰는지 세려고 만들어요. 원래 IP 주소는 저장하지 않아요.",
            ],
            [
              "연결용 임시 값",
              "무작위 세션 번호, 일회용 공개 키와 그 지문, 인증값의 해시, 파일 크기, 처리 상태와 시각",
              "QR 코드로 휴대전화와 프린터 옆 화면을 연결할 때 만들어져요.",
            ],
            [
              "의견 보내기(선택)",
              "이용자가 의견 양식에 직접 적은 내용",
              "소개 페이지의 ‘의견 보내기’를 눌러 Google Forms 양식에 적을 때만 생겨요.",
            ],
            [
              "계좌 후원(선택)",
              "보내는 분 이름(은행이 표시하는 입금자명), 금액, 송금 시각",
              "후원 계좌로 직접 송금할 때 은행이 알려 줘요. 카드 정보는 받지 않아요.",
            ],
          ]}
        />
        <p>
          파일 이름은 인쇄할 때 서버로 보내지 않아요. 파일 공유에서는 파일 목록과 이름도 함께
          암호화해서, 서버는 열쇠 없이 그 내용을 읽을 수 없어요. 문서 스캔의 사진과 글자 인식은
          휴대전화 안에서 처리돼요.
        </p>
        <LegalNote>
          파일 안에 여권번호 같은 고유식별정보나 민감한 내용이 있을 수 있어요. 운영자는 그 내용을
          열어 보거나 따로 뽑아내지 않고, 암호화된 상태로 전달만 해요. 꼭 필요한 페이지만 고르는 게
          가장 안전해요.
        </LegalNote>
      </LegalSection>

      <LegalSection id="retention" title="3. 개인정보의 처리 및 보유 기간">
        <LegalTable
          caption="정보별 보유 기간"
          head={["정보", "보유 기간"]}
          rows={[
            [
              "인쇄할 파일(암호화 상태)",
              "인쇄가 끝나거나 실패·취소되면 바로 삭제해요. 그렇지 않아도 연결 후 약 3분 안에 지우도록 예약돼 있어요.",
            ],
            ["창구용 인쇄(/visitor)", "기본 10분 안에 같은 방식으로 삭제해요(설정 범위 1~30분)."],
            [
              "파일 공유(암호화 상태)",
              "기본 30분 뒤 삭제해요(운영 설정 범위 5분~24시간). 보낸 사람이 언제든 먼저 지울 수 있어요.",
            ],
            [
              "‘숫자 네 자리와 도형’으로 받는 방식의 열쇠",
              "이 방식을 고른 경우에만 서버가 3분 동안 맡아 두고, 받거나 틀리거나 시간이 지나면 지워요.",
            ],
            ["연결용 임시 값", "연결 후 약 3분과 정리 여유 시간, 결과 확인용 기록은 15초"],
            ["남용 방지 해시", "2시간 안에 자동으로 만료돼요."],
            [
              "프린터 옆 화면의 인쇄 기록",
              "세션 번호의 해시와 처리 상태만 남기고 24시간 뒤 지워요. 인쇄 여부가 불확실한 기록은 관리자가 확인한 뒤 24시간 동안 더 보관해요(같은 문서가 두 번 인쇄되는 것을 막기 위해서예요).",
            ],
            [
              "서비스 이용 기록",
              "운영자의 앱 로그에는 정해진 이벤트 코드만 남겨요. 호스팅 업체의 인프라 로그는 각 업체의 보관 정책을 따라요.",
            ],
            ["의견 양식 응답", "의견을 검토하고 답하는 데 필요한 기간이 지나면 지워요."],
            [
              "계좌 후원 기록",
              "은행 거래 기록은 은행이 법령에 따라 보관해요. 운영자는 후원 확인 외에 쓰지 않고, Print-cess 이용 기록과 연결하지 않아요.",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection id="destruction" title="4. 개인정보의 파기 절차 및 방법">
        <ul>
          <li>
            보유 기간이 끝나거나 목적을 이루면 자동으로 삭제해요. 인쇄 성공, 실패, 취소, 시간 초과,
            업로드 중단, 파일 거부, 앱 재시작 때마다 삭제가 실행되고, 지연 삭제 예약과 주기적인 정리
            작업이 한 번 더 확인해요.
          </li>
          <li>
            전자 파일은 저장소에서 삭제해요. 파일을 여는 열쇠는 서버에 남지 않아서, 업체 백업에
            사본이 잠시 남더라도 그 내용을 읽을 수 없어요.
          </li>
          <li>
            인쇄가 끝나면 휴대전화 화면이 이 사이트가 저장한 데이터를 비우고 닫혀요. 다만 브라우저
            방문 기록과 휴대전화 사진첩·파일 앱의 원본은 이용자 기기에 그대로 남아요.
          </li>
          <li>
            종이 인쇄물은 이용자가 직접 가져가야 해요. 두고 간 인쇄물은 설치 장소의 관리자가
            파기해요.
          </li>
        </ul>
        <LegalNote>
          ‘삭제했다’는 서비스가 삭제 절차를 마쳤다는 뜻이에요. 업체의 백업, 브라우저 캐시, 프린터
          내부 저장소까지 그 순간 물리적으로 지워진다는 약속은 아니에요.
        </LegalNote>
      </LegalSection>

      <LegalSection id="third-party" title="5. 개인정보의 제3자 제공">
        <p>
          운영자는 개인정보를 제3자에게 제공하지 않아요. 법률에 특별한 규정이 있거나 수사기관이
          법령에 따른 절차로 요구하는 경우에만 예외가 있고, 이때도 운영자가 가진 정보는 암호화된
          파일과 위에 적은 임시 값뿐이라 문서 내용은 제공할 수 없어요.
        </p>
      </LegalSection>

      <LegalSection id="outsourcing" title="6. 개인정보 처리의 위탁과 국외 이전">
        <p>
          운영자는 서버와 저장소를 직접 두지 않고 아래 클라우드 업체에 맡겨요. 업체는 모두 미국
          법인이고, 정보는 서비스를 쓰는 순간 인터넷으로 업체의 서버에 전송돼요. 이 이전은 이용자가
          요청한 인쇄·공유를 해내는 데 필요한 처리위탁·보관이에요(「개인정보 보호법」
          제28조의8제1항제3호). 운영 구성에 따라 아래 업체 중 일부만 쓸 수 있어요.
        </p>
        <LegalTable
          caption="위탁받는 업체와 국외 이전 내용"
          head={["받는 업체(국가)", "맡기는 일", "이전되는 정보", "보유 기간", "연락처"]}
          rows={[
            [
              "Vercel Inc.(미국)",
              "웹사이트 운영(호스팅), 암호화된 파일의 임시 보관(Vercel Blob)",
              "서비스 이용 기록, 암호화된 파일",
              "3항의 기간. 인프라 로그는 업체 정책",
              <a key="v" href="mailto:privacy@vercel.com">
                privacy@vercel.com
              </a>,
            ],
            [
              "Upstash, Inc.(미국, 서버 위치는 운영 설정에 따름)",
              "연결 상태 저장(Redis), 지연 삭제 예약(QStash)",
              "연결용 임시 값, 남용 방지 해시, 삭제 예약 정보",
              "3항의 기간",
              <a key="u" href="mailto:support@upstash.com">
                support@upstash.com
              </a>,
            ],
            [
              "Railway Corporation(미국, 서버 위치는 운영 설정에 따름)",
              "위 두 업체 대신 쓰는 대체 구성(저장소, 정리 작업)",
              "연결용 임시 값, 암호화된 파일",
              "3항의 기간",
              <a key="r" href="https://railway.com/legal/privacy" rel="noreferrer">
                railway.com/legal/privacy
              </a>,
            ],
            [
              "Google LLC(미국)",
              "의견 양식 운영(Google Forms) — 선택",
              "의견 양식에 적은 내용",
              "3항의 기간",
              <a key="g" href="https://policies.google.com/privacy?hl=ko" rel="noreferrer">
                policies.google.com/privacy
              </a>,
            ],
          ]}
        />
        <h3>파일을 받지 않는 외부 자원</h3>
        <p>
          QR 코드 인식 보조 프로그램(jsQR)과 문서 스캔의 글자 인식 프로그램(Tesseract.js)은
          jsDelivr(cdn.jsdelivr.net)에서, 글자 인식용 언어 데이터는 tessdata.projectnaptha.com에서
          받아요. 이 과정에서 그 서버에는 IP 주소와 브라우저 정보가 전달되지만, 사진이나 파일은
          전달되지 않아요.
        </p>
        <h3>국외 이전을 원하지 않을 때</h3>
        <p>
          서비스를 쓰지 않으면 이전도 일어나지 않아요. 다만 해외 서버를 거치지 않으면 인쇄와 공유를
          할 수 없어요. 의견 양식은 선택이라 쓰지 않아도 다른 기능에는 영향이 없어요.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="7. 정보주체와 법정대리인의 권리·의무 및 행사 방법">
        <p>
          이용자(정보주체)는 언제든지 자기 개인정보의 열람, 정정·삭제, 처리정지를 요구하고 동의를
          철회할 수 있어요(「개인정보 보호법」 제35조~제37조). 법정대리인이나 위임받은 대리인도
          요구할 수 있어요. 아래 11항의 연락처로 요청하면 지체 없이 처리하고 결과를 알려 드려요.
        </p>
        <ul>
          <li>
            Print-cess는 이름이나 계정을 받지 않아서, 운영자가 특정 이용자의 기록을 찾아내기
            어려워요. 요청할 때는 이용한 날짜·시각과 기능을 알려 주세요. 본인을 확인할 수 없거나
            이미 지워진 정보라면 그 사실을 알려 드려요.
          </li>
          <li>
            가장 빠른 방법은 직접 지우는 거예요. 파일 공유는 준비 화면의 ‘지우기’로, 인쇄는 ‘취소’로
            바로 삭제돼요.
          </li>
          <li>
            이용자는 다른 사람의 개인정보가 담긴 문서를 그 사람의 허락 없이 인쇄하거나 공유해서는 안
            돼요.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="safety" title="8. 개인정보의 안전성 확보 조치">
        <ul>
          <li>
            종단 간 암호화: 파일은 휴대전화에서 AES-256-GCM으로 암호화되고, 열쇠는 프린터 옆 화면과
            휴대전화 사이의 ECDH(P-256) 교환으로 만들어져요. 서버는 열쇠를 갖지 않아요.
          </li>
          <li>전송 구간 보호: 모든 통신은 HTTPS로만 이뤄져요.</li>
          <li>
            최소 수집·짧은 보관: 입력란을 두지 않고, 임시 값에는 만료 시간을 걸고, 삭제를 여러
            겹으로 확인해요.
          </li>
          <li>
            접근 통제: 저장소는 비공개이고, 서버 비밀값은 배포 환경에만 두며, 관리 기능은 별도
            비밀값으로 보호해요.
          </li>
          <li>
            로그 관리: 앱 로그에는 파일 이름, 내용, 토큰, 열쇠, 전체 서명 주소를 남기지 않아요.
          </li>
          <li>
            웹 보안: 콘텐츠 보안 정책(CSP)으로 허용한 스크립트만 실행하고, 공개 저장소에서 코드와
            보안 검사를 누구나 확인할 수 있어요.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="cookies" title="9. 쿠키 등 개인정보 자동 수집 장치의 설치·운영 및 거부">
        <p>
          광고, 방문 분석, 이용자 추적용 쿠키와 분석 도구는 쓰지 않아요. 기능에 필요한 쿠키만
          있어요.
        </p>
        <LegalTable
          caption="사용하는 쿠키"
          head={["이름", "쓰는 곳과 목적", "보관 기간"]}
          rows={[
            ["print-cess-locale", "이용자가 고른 화면 언어를 기억해요.", "180일"],
            [
              "pc_kiosk",
              "프린터 옆 화면으로 쓰는 기기에만 저장돼 그 기기를 키오스크로 열어요.",
              "1년",
            ],
          ]}
        />
        <p>
          브라우저 설정에서 쿠키를 거부하거나 지울 수 있어요. 거부해도 서비스는 쓸 수 있고, 언어를
          매번 다시 고르게 될 수 있어요. 인쇄가 끝나면 휴대전화 화면이 이 사이트의 쿠키와 저장
          데이터를 스스로 비워요.
        </p>
      </LegalSection>

      <LegalSection id="children" title="10. 만 14세 미만 아동의 개인정보">
        <p>
          Print-cess는 나이나 신원을 묻지 않고, 아동의 개인정보를 따로 수집하지 않아요. 만 14세 미만
          아동이 의견 양식에 개인정보를 적었다는 사실을 알게 되면 바로 지워요.
        </p>
      </LegalSection>

      <LegalSection id="officer" title="11. 개인정보 보호책임자와 고충 처리">
        <LegalTable
          caption="개인정보 보호책임자"
          head={["구분", "내용"]}
          rows={[
            ["개인정보 보호책임자", contact.officer],
            [
              "연락처",
              contact.email ? (
                <a key="mail" href={`mailto:${contact.email}`}>
                  {contact.email}
                </a>
              ) : (
                <span key="none">
                  전용 이메일은 아직 공개하지 않았어요. 그전에는{" "}
                  <a href={FEEDBACK_FORM} rel="noreferrer">
                    의견 양식
                  </a>{" "}
                  또는{" "}
                  <a href={REPOSITORY} rel="noreferrer">
                    GitHub 저장소
                  </a>
                  로 알려 주세요.
                </span>
              ),
            ],
            [
              "보안 문제 신고",
              <Link key="sec" href="/legal/security">
                보안 정책의 신고 방법
              </Link>,
            ],
          ]}
        />
        <p>
          개인정보와 관련한 문의, 불만, 피해 구제 요청은 위 연락처로 보내 주세요. 지체 없이
          답할게요.
        </p>
      </LegalSection>

      <LegalSection id="remedy" title="12. 권익 침해 구제 방법">
        <p>운영자의 답이 충분하지 않으면 아래 기관에 상담하거나 분쟁 조정을 신청할 수 있어요.</p>
        <LegalTable
          caption="개인정보 침해 상담·신고 기관"
          head={["기관", "전화", "누리집"]}
          rows={[
            [
              "개인정보침해 신고센터(한국인터넷진흥원)",
              "(국번 없이) 118",
              <a key="1" href="https://privacy.kisa.or.kr" rel="noreferrer">
                privacy.kisa.or.kr
              </a>,
            ],
            [
              "개인정보 분쟁조정위원회",
              "1833-6972",
              <a key="2" href="https://www.kopico.go.kr" rel="noreferrer">
                www.kopico.go.kr
              </a>,
            ],
            [
              "대검찰청",
              "(국번 없이) 1301",
              <a key="3" href="https://www.spo.go.kr" rel="noreferrer">
                www.spo.go.kr
              </a>,
            ],
            [
              "경찰청",
              "(국번 없이) 182",
              <a key="4" href="https://ecrm.police.go.kr" rel="noreferrer">
                ecrm.police.go.kr
              </a>,
            ],
          ]}
        />
      </LegalSection>

      <LegalSection id="institution" title="13. 기관이나 매장에 설치한 경우">
        <p>
          학교, 공공기관, 매장 같은 곳이 Print-cess를 직접 설치해 운영한다면, 그곳이
          개인정보처리자가 되고 그곳의 개인정보 처리방침이 우선해요. 이 처리방침은 Club Paradiso가
          직접 운영하는 Print-cess에 적용돼요. 설치 장소에서는 두고 간 인쇄물의 처리와 프린터 저장
          설정을 직접 관리해야 해요.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="14. 개인정보 처리방침의 변경">
        <p>
          이 처리방침은 위에 적힌 시행일부터 적용돼요. 내용이 바뀌면 시행 전에 이 페이지에 알리고,
          이전 버전과 바뀐 부분은{" "}
          <a
            href={`${REPOSITORY}/commits/main/apps/web/src/app/legal/privacy/page.tsx`}
            rel="noreferrer"
          >
            GitHub 변경 이력
          </a>
          에서 볼 수 있어요.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
