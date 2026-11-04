import type { Metadata } from "next";
import Link from "next/link";

import { LegalNote, LegalSection, LegalShell } from "../legal-shell";

export const metadata: Metadata = {
  title: "이용약관 · Print-cess by Club Paradiso",
  description: "Print-cess를 무료로 쓰는 조건, 이용자가 지킬 일, 서비스의 책임 범위.",
  robots: { index: false, follow: false },
};

const toc = [
  { id: "purpose", label: "제1조 목적" },
  { id: "service", label: "제2조 서비스 내용" },
  { id: "fee", label: "제3조 이용 요금과 후원" },
  { id: "duties", label: "제4조 이용자가 지킬 일" },
  { id: "files", label: "제5조 파일과 인쇄물" },
  { id: "change", label: "제6조 서비스 변경과 중단" },
  { id: "liability", label: "제7조 책임의 범위" },
  { id: "ip", label: "제8조 저작권과 상표" },
  { id: "terms-change", label: "제9조 약관의 변경" },
  { id: "law", label: "제10조 준거법과 분쟁 해결" },
];

export default function TermsPage() {
  return (
    <LegalShell
      current="/legal/terms"
      kicker="이용 조건"
      title="이용약관"
      lead={
        <p>
          Print-cess를 쓰면 이 약관에 동의한 것으로 봐요. 가입 절차가 없어서 따로 동의 버튼은
          없어요. 중요한 내용은 아래 요약에 먼저 적었어요.
        </p>
      }
      summary={{
        title: "한눈에 보기",
        items: [
          { label: "요금", value: "무료예요. 후원은 선택이고 기능과 상관없어요" },
          { label: "이용자의 책임", value: "내 문서, 또는 허락받은 문서만 인쇄·공유해 주세요" },
          { label: "인쇄물", value: "나온 종이는 바로 가져가세요" },
          {
            label: "서비스 상태",
            value: "개선 중인 서비스라 예고 없이 바뀌거나 잠시 멈출 수 있어요",
          },
        ],
      }}
      toc={toc}
    >
      <LegalSection id="purpose" title="제1조 목적">
        <p>
          이 약관은 Club Paradiso(이하 “운영자”)가 제공하는 Print-cess 서비스를 이용하는 조건과
          절차, 운영자와 이용자의 권리·의무를 정해요.
        </p>
      </LegalSection>

      <LegalSection id="service" title="제2조 서비스 내용">
        <ul>
          <li>인쇄: 프린터 옆 화면의 QR 코드로 연결해 휴대전화 속 파일을 한 번 인쇄해요.</li>
          <li>파일 공유: 암호화한 파일을 다른 기기로 보내요.</li>
          <li>문서 스캔: 종이 문서를 휴대전화에서 PDF로 만들어요.</li>
        </ul>
        <p>
          Print-cess는 서류를 발급하거나 찾아 주거나 대신 제출하지 않아요. 인쇄할 파일은 이용자가
          먼저 갖고 있어야 해요.
        </p>
      </LegalSection>

      <LegalSection id="fee" title="제3조 이용 요금과 후원">
        <ul>
          <li>
            운영자는 Print-cess 이용 요금을 받지 않아요. 설치 장소가 용지·인쇄 비용을 따로 정할 수는
            있어요.
          </li>
          <li>
            개발 후원은 이용자가 원할 때만 하는 선택이에요. 후원 여부는 기능, 인쇄 한도, 처리 순서에
            영향을 주지 않아요.
          </li>
          <li>
            후원금은 서비스 이용의 대가가 아니에요. 법정 기부금 단체가 아니어서 기부금 영수증이나
            세금 혜택이 없어요.
          </li>
          <li>
            금액을 잘못 보냈다면 개인정보 처리방침의 연락처로 알려 주세요. 확인한 뒤 돌려드려요.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="duties" title="제4조 이용자가 지킬 일">
        <p>이용자는 다음과 같은 일을 해서는 안 돼요.</p>
        <ul>
          <li>다른 사람의 신분증, 서류, 개인정보를 그 사람의 허락 없이 인쇄하거나 공유하기</li>
          <li>저작권 등 다른 사람의 권리를 침해하는 자료를 인쇄하거나 공유하기</li>
          <li>법령으로 금지된 자료나 악성 코드를 보내기</li>
          <li>
            자동화 도구로 요청을 쏟아 내거나, 보안 장치를 우회하거나, 다른 사람의 세션에 끼어들기
          </li>
          <li>Print-cess나 Club Paradiso를 사칭하거나, 수정본을 공식 서비스처럼 보이게 하기</li>
        </ul>
        <p>
          운영자는 이런 이용을 발견하면 해당 요청을 막거나 지울 수 있어요. 보안 취약점을 찾았다면{" "}
          <Link href="/legal/security">보안 정책</Link>에 따라 비공개로 알려 주세요.
        </p>
      </LegalSection>

      <LegalSection id="files" title="제5조 파일과 인쇄물">
        <ul>
          <li>파일의 권리와 내용에 대한 책임은 그 파일을 고른 이용자에게 있어요.</li>
          <li>
            운영자는 파일을 열어 보지 않고, 개인정보 처리방침에 적은 기간이 지나면 지워요. 파일을
            보관해 주는 서비스가 아니니 원본은 이용자 기기에 꼭 남겨 두세요.
          </li>
          <li>
            인쇄 전 미리보기로 내용을 확인해 주세요. 나온 종이는 바로 가져가야 하고, 두고 간
            인쇄물은 다른 사람이 볼 수 있어요.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="change" title="제6조 서비스 변경과 중단">
        <p>
          Print-cess는 계속 고쳐 가는 서비스예요. 운영자는 기능을 바꾸거나, 점검·장애·업체 사정으로
          서비스를 잠시 멈추거나, 운영을 끝낼 수 있어요. 미리 알릴 수 있으면 이 사이트에 먼저
          알려요. 운영을 끝내더라도 남은 파일은 처리방침에 따라 지워요.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="제7조 책임의 범위">
        <ul>
          <li>
            운영자는 무료 서비스를 안전하게 운영하려고 노력하지만, 모든 기기·프린터·네트워크에서
            언제나 동작한다고 보장하지는 않아요.
          </li>
          <li>
            이용자 기기, 설치 장소의 프린터와 네트워크, 통신 업체처럼 운영자가 관리하지 않는
            원인으로 생긴 손해, 그리고 이용자가 이 약관을 어겨 생긴 손해는 운영자가 책임지지 않아요.
          </li>
          <li>
            다만 운영자의 고의 또는 중대한 과실로 생긴 손해, 그리고 법령상 운영자가 져야 하는 책임은
            이 약관으로 줄이거나 없애지 않아요.
          </li>
        </ul>
        <LegalNote>
          소스 코드 자체의 사용 조건(Apache License 2.0)의 보증 부인 조항은 코드를
          복제·수정·배포하는 사람에게 적용돼요. 이 약관은 Club Paradiso가 운영하는 서비스를 이용하는
          사람에게 적용돼요.
        </LegalNote>
      </LegalSection>

      <LegalSection id="ip" title="제8조 저작권과 상표">
        <ul>
          <li>
            Print-cess의 소스 코드는 Apache License 2.0으로 공개돼 있어요. 자세한 조건은{" "}
            <Link href="/legal/licenses">라이선스·오픈소스 고지</Link>에서 볼 수 있어요.
          </li>
          <li>
            “Print-cess”, “Club Paradiso”라는 이름과 로고는 Apache License가 사용을 허락하지 않아요.
            출처를 밝히는 일반적인 경우를 빼고는 쓰려면 미리 허락을 받아야 해요.
          </li>
          <li>소개 페이지의 영상은 AI로 제작한 연출 영상이고, 실제 장소나 설치 사례가 아니에요.</li>
        </ul>
      </LegalSection>

      <LegalSection id="terms-change" title="제9조 약관의 변경">
        <p>
          운영자는 관련 법령을 어기지 않는 범위에서 이 약관을 바꿀 수 있어요. 바꿀 때는 시행일과
          바뀐 내용을 시행 7일 전부터 이 페이지에 알리고, 이용자에게 불리한 변경은 30일 전부터
          알려요.
        </p>
      </LegalSection>

      <LegalSection id="law" title="제10조 준거법과 분쟁 해결">
        <p>
          이 약관은 대한민국 법을 따라요. 분쟁이 생기면 먼저 서로 협의하고, 해결되지 않으면
          「민사소송법」에 따른 관할 법원에서 해결해요.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
