import type { Metadata } from "next";
import Link from "next/link";

import { LegalNote, LegalSection, LegalShell, LegalTable } from "../legal-shell";

export const metadata: Metadata = {
  title: "보안 정책 · Print-cess by Club Paradiso",
  description: "Print-cess가 파일을 보호하는 방식과 보안 취약점을 신고하는 방법.",
  robots: { index: false, follow: false },
};

const REPOSITORY = "https://github.com/club-paradiso/print-cess";
const REPORT_URL = `${REPOSITORY}/security/advisories/new`;

const toc = [
  { id: "protect", label: "1. 파일을 지키는 방법" },
  { id: "limits", label: "2. 보안의 한계" },
  { id: "report", label: "3. 취약점 신고 방법" },
  { id: "response", label: "4. 신고 후 처리 일정" },
  { id: "scope", label: "5. 신고 대상 범위" },
  { id: "safe-harbor", label: "6. 선의의 보안 연구" },
  { id: "docs", label: "7. 기술 문서" },
];

export default function SecurityPolicyPage() {
  return (
    <LegalShell
      current="/legal/security"
      kicker="보안"
      title="보안 정책"
      lead={
        <p>
          Print-cess는 다른 사람의 서류를 다루기 때문에 보안을 가장 먼저 생각해요. 이 페이지는
          이용자가 알아야 할 보호 방식과, 보안 문제를 찾은 분이 신고하는 방법을 쉬운 말로 정리한
          거예요. 원문(영어)은{" "}
          <a href={`${REPOSITORY}/blob/main/SECURITY.md`} rel="noreferrer">
            SECURITY.md
          </a>
          예요.
        </p>
      }
      summary={{
        title: "한눈에 보기",
        items: [
          { label: "파일 보호", value: "휴대전화에서 암호화하고, 서버는 열쇠를 갖지 않아요" },
          { label: "보관", value: "인쇄가 끝나면 지우고, 한 문서는 한 번만 인쇄해요" },
          {
            label: "취약점을 찾았다면",
            value: "공개 게시판이 아니라 GitHub 비공개 신고로 알려 주세요",
          },
          { label: "답변", value: "영업일 3일 안에 접수 확인, 7일 안에 첫 판단" },
        ],
      }}
      toc={toc}
    >
      <LegalSection id="protect" title="1. 파일을 지키는 방법">
        <ul>
          <li>
            <strong>보내기 전에 잠가요.</strong> 파일은 휴대전화를 떠나기 전에 AES-256-GCM으로
            암호화돼요. 열쇠는 프린터 옆 화면과 휴대전화가 ECDH(P-256)로 그 자리에서 만들어요.
          </li>
          <li>
            <strong>서버는 열 수 없어요.</strong> 서버와 저장소에는 잠긴 파일만 잠깐 있고, 열쇠는
            서버에 저장되지 않아요.
          </li>
          <li>
            <strong>한 번 인쇄하고 지워요.</strong> 같은 문서가 두 번 인쇄되지 않도록 막고, 끝나거나
            실패·취소·시간 초과되면 삭제해요.
          </li>
          <li>
            <strong>QR 코드는 짧게만 써요.</strong> 기본 설정에서 QR 코드는 몇 분 안에 만료되고, 한
            번 연결되면 다른 기기가 끼어들 수 없어요.
          </li>
          <li>
            <strong>로그에 남기지 않아요.</strong> 파일 이름, 내용, 토큰, 열쇠, 전체 서명 주소는 앱
            로그에 남지 않아요.
          </li>
          <li>
            <strong>허용한 코드만 실행해요.</strong> 콘텐츠 보안 정책(CSP)으로 정해진 스크립트만
            실행하고, 외부 스크립트는 버전까지 고정해요.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="limits" title="2. 보안의 한계">
        <p>숨기지 않고 알려 드려요. 다음은 Print-cess가 막을 수 없어요.</p>
        <ul>
          <li>잠금이 풀린 채 둔 휴대전화, 악성 앱이 깔린 휴대전화</li>
          <li>프린터 옆에 두고 간 인쇄물, 프린터 내부 저장 장치에 남는 작업 기록</li>
          <li>브라우저 방문 기록과 휴대전화 사진첩의 원본</li>
          <li>
            ‘숫자 네 자리와 도형’으로 받는 공유 방식에서는 편의를 위해 서버가 3분 동안 열쇠를 맡아
            둬요. 더 안전한 방법은 QR 코드나 링크로 받는 거예요.
          </li>
        </ul>
        <LegalNote>
          공용 프린터에서는 인쇄가 끝나면 종이를 바로 가져가고, 휴대전화 화면을 닫아 주세요.
        </LegalNote>
      </LegalSection>

      <LegalSection id="report" title="3. 보안 취약점 신고 방법">
        <p>
          보안 문제는 GitHub 이슈, 토론, 풀 리퀘스트처럼{" "}
          <strong>공개된 곳에 올리지 말아 주세요</strong>. 고치기 전에 알려지면 이용자가 위험해져요.
        </p>
        <ol>
          <li>
            <a href={REPORT_URL} rel="noreferrer">
              GitHub 비공개 취약점 신고
            </a>
            를 열어요(저장소의 Security → Advisories → Report a vulnerability).
          </li>
          <li>
            시험한 커밋이나 배포 주소, 공격자가 할 수 있는 일과 그 전제 조건, 재현 방법을 적어요.
          </li>
          <li>재현에는 만든 예시 문서와 시험용 계정만 써 주세요.</li>
        </ol>
        <LegalNote>
          실제 신분증·여권·항공권 같은 서류, 실제 비밀번호나 토큰, 전송 코드, 서명된 주소는 절대
          첨부하지 마세요. 노출된 비밀값을 발견했다면 그 사실만 알려 주세요. 가장 먼저 폐기할게요.
        </LegalNote>
      </LegalSection>

      <LegalSection id="response" title="4. 신고 후 처리 일정">
        <LegalTable
          caption="신고 처리 일정"
          head={["단계", "기한"]}
          rows={[
            ["접수 확인", "영업일 3일 안"],
            ["첫 판단과 다음 단계 안내", "영업일 7일 안"],
            ["수정 배포", "위험도에 따라 최대한 빨리. 고친 뒤 원하면 공지에 이름을 올려 드려요"],
          ]}
        />
        <p>
          아직 정식 버전이 없어서 수정은 <code>main</code> 브랜치의 최신 코드에만 반영해요. 공개는
          고칠 시간을 충분히 둔 뒤에 해 주세요.
        </p>
      </LegalSection>

      <LegalSection id="scope" title="5. 신고 대상 범위">
        <ul>
          <li>
            대상: 웹 앱과 API(<code>apps/web</code>), 정리 작업(cleanup worker), Windows 키오스크 (
            <code>apps/kiosk</code>), 공용 패키지(<code>packages</code>), CI 설정
          </li>
          <li>
            제외: 트래픽만으로 서비스를 마비시키는 공격, 이미 해킹된 기기나 관리자 계정이 있어야
            하는 문제, Print-cess의 사용 방식과 무관한 외부 업체(Vercel, Upstash, Railway) 자체의
            문제
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="safe-harbor" title="6. 선의의 보안 연구">
        <p>
          이 정책을 지키며 선의로 조사하고 신고한 분에게 운영자가 먼저 법적 조치를 하지 않아요. 다만
          다른 이용자의 실제 파일에 접근하거나, 서비스를 멈추게 하거나, 찾은 정보를 보관·공개하는
          일은 허용하지 않아요. 운영자가 허락할 수 있는 범위는 운영자의 권리에 한정되고, 법령이나
          다른 사람의 권리까지 대신 면제할 수는 없어요.
        </p>
      </LegalSection>

      <LegalSection id="docs" title="7. 기술 문서">
        <ul>
          <li>
            <a href={`${REPOSITORY}/blob/main/docs/SECURITY.md`} rel="noreferrer">
              보안 설계(docs/SECURITY.md)
            </a>
          </li>
          <li>
            <a href={`${REPOSITORY}/blob/main/docs/THREAT_MODEL.md`} rel="noreferrer">
              위협 모델(docs/THREAT_MODEL.md)
            </a>
          </li>
          <li>
            <a href={`${REPOSITORY}/blob/main/docs/CRYPTOGRAPHY.md`} rel="noreferrer">
              암호 설계(docs/CRYPTOGRAPHY.md)
            </a>
          </li>
          <li>
            개인정보를 처리하는 방식은 <Link href="/legal/privacy">개인정보 처리방침</Link>에
            있어요.
          </li>
        </ul>
      </LegalSection>
    </LegalShell>
  );
}
