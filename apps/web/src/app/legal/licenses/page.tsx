import type { Metadata } from "next";

import { LegalNote, LegalSection, LegalShell, LegalTable, legalStyles } from "../legal-shell";
import { THIRD_PARTY } from "../third-party";

export const metadata: Metadata = {
  title: "라이선스·오픈소스 고지 · Print-cess by Club Paradiso",
  description: "Print-cess의 Apache License 2.0과 함께 쓰는 오픈소스 소프트웨어 고지.",
  robots: { index: false, follow: false },
};

const REPOSITORY = "https://github.com/club-paradiso/print-cess";

export default function LicensesPage() {
  return (
    <LegalShell
      current="/legal/licenses"
      kicker="라이선스"
      title="라이선스·오픈소스 고지"
      lead={
        <p>
          Print-cess는 누구나 코드를 보고 고쳐 쓸 수 있는 오픈소스예요. 이 페이지는 Print-cess의
          라이선스를 쉬운 말로 설명하고, 함께 쓰는 오픈소스의 저작권과 라이선스를 알려요.
        </p>
      }
      summary={{
        title: "한눈에 보기",
        items: [
          { label: "Print-cess의 라이선스", value: "Apache License 2.0" },
          { label: "저작권", value: "Copyright 2026 Club Paradiso" },
          { label: "할 수 있는 일", value: "무료로 사용·복제·수정·배포, 상업적 이용" },
          { label: "지켜야 할 일", value: "라이선스와 NOTICE 유지, 바꾼 파일 표시" },
        ],
      }}
      toc={[
        { id: "apache", label: "1. Print-cess의 라이선스" },
        { id: "trademark", label: "2. 이름과 로고(상표)" },
        { id: "third-party", label: "3. 함께 쓰는 오픈소스" },
        { id: "lgpl", label: "4. LGPL 구성 요소" },
        { id: "fonts", label: "5. 글꼴" },
        { id: "external", label: "6. 브라우저가 따로 받는 프로그램" },
        { id: "media", label: "7. 영상과 이미지" },
      ]}
    >
      <LegalSection id="apache" title="1. Print-cess의 라이선스: Apache License 2.0">
        <LegalTable
          caption="Apache License 2.0 쉬운 요약(법적 효력은 영문 원문에만 있어요)"
          head={["구분", "내용"]}
          rows={[
            [
              "할 수 있어요",
              "사용, 복제, 수정, 배포, 다른 라이선스와 함께 배포, 상업적 이용, 특허 사용",
            ],
            [
              "지켜야 해요",
              "배포할 때 라이선스 사본과 NOTICE 파일을 함께 주고, 바꾼 파일에는 바꿨다고 표시하고, 원래 저작권 고지를 남겨요",
            ],
            ["허락하지 않아요", "Print-cess·Club Paradiso의 이름, 상표, 로고 사용(아래 2항)"],
            [
              "보증하지 않아요",
              "코드는 ‘있는 그대로’ 제공돼요. 코드를 가져다 쓰는 사람에게 기여자는 보증이나 손해 책임을 지지 않아요(법령상 책임은 예외)",
            ],
            [
              "특허",
              "기여자는 자기 기여분에 대한 특허 사용을 허락해요. 특허 소송을 걸면 그 허락이 끝나요",
            ],
          ]}
        />
        <p>
          <a href="/licenses/LICENSE.txt">Apache License 2.0 원문(영어)</a> ·{" "}
          <a href="/licenses/NOTICE.txt">NOTICE 파일</a> ·{" "}
          <a href="https://www.apache.org/licenses/LICENSE-2.0" rel="noreferrer">
            apache.org 원문
          </a>
        </p>
        <LegalNote>
          이 라이선스는 소스 코드를 쓰는 조건이에요. Club Paradiso가 운영하는 서비스를 쓰는 조건은{" "}
          <a href="/legal/terms">이용약관</a>에 있어요.
        </LegalNote>
      </LegalSection>

      <LegalSection id="trademark" title="2. 이름과 로고(상표)">
        <p>
          Apache License 제6조에 따라, 라이선스는 “Print-cess”, “Club Paradiso”라는 이름이나 로고를
          쓸 권리를 주지 않아요. 코드의 출처를 밝히는 일반적인 경우는 괜찮아요. 수정본은 공식
          Print-cess 서비스처럼 보이게 해서는 안 돼요.
        </p>
      </LegalSection>

      <LegalSection id="third-party" title="3. 함께 쓰는 오픈소스">
        <p>
          아래는 화면이나 서버에 포함되는 주요 구성 요소예요. 각 구성 요소의 저작권은 해당
          저작자에게 있고, 전체 고지문은 각 패키지에 들어 있는 LICENSE 파일에 있어요. 이 밖의 하위
          의존성도 MIT, Apache-2.0, ISC, BSD, 0BSD 같은 허용형 라이선스예요.
        </p>
        <LegalTable
          caption="주요 오픈소스 구성 요소"
          head={["이름", "버전", "라이선스", "출처"]}
          rows={THIRD_PARTY.map((item) => [
            item.name,
            item.version,
            item.license,
            <a key={item.name} href={item.url} rel="noreferrer">
              {item.url.replace("https://", "")}
            </a>,
          ])}
        />
      </LegalSection>

      <LegalSection id="lgpl" title="4. LGPL 구성 요소">
        <ul>
          <li>
            <strong>heic-to 1.6.6</strong>(LGPL-3.0, libheif 포함): 아이폰 HEIC 사진을 브라우저에서
            JPEG로 바꿔요. 고치지 않은 원본을 따로 불러오는 별도 모듈로 쓰기 때문에, 호환되는 다른
            버전으로 바꿔 끼울 수 있어요. <a href="/licenses/heic-to-LGPL-3.0.txt">라이선스 전문</a>{" "}
            ·{" "}
            <a href="https://github.com/hoppergee/heic-to" rel="noreferrer">
              소스 코드
            </a>
          </li>
          <li>
            <strong>libvips</strong>(LGPL-3.0-or-later, sharp를 통해): 서버의 이미지 처리에서 고치지
            않은 공유 라이브러리로 써요.{" "}
            <a href="https://github.com/libvips/libvips" rel="noreferrer">
              소스 코드
            </a>
          </li>
          <li>
            LGPL은 GNU GPL 3.0의 조항을 함께 적용해요.{" "}
            <a href="https://www.gnu.org/licenses/lgpl-3.0.html" rel="noreferrer">
              LGPL-3.0
            </a>{" "}
            ·{" "}
            <a href="https://www.gnu.org/licenses/gpl-3.0.html" rel="noreferrer">
              GPL-3.0
            </a>
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="fonts" title="5. 글꼴">
        <LegalTable
          caption="사용하는 글꼴"
          head={["글꼴", "라이선스", "쓰는 곳"]}
          rows={[
            [
              "Pretendard Variable 1.3.9 (© 2021 Kil Hyung-jin)",
              <a key="p" href="/licenses/pretendard-OFL-1.1.txt">
                SIL Open Font License 1.1
              </a>,
              "소개 페이지와 법적 고지 페이지",
            ],
            [
              "Pathway Extreme (Google Fonts, 빌드할 때 이 사이트에 포함)",
              <a key="w" href="https://openfontlicense.org" rel="noreferrer">
                SIL Open Font License 1.1
              </a>,
              "Print-cess 로고 글자",
            ],
          ]}
        />
      </LegalSection>

      <LegalSection id="external" title="6. 브라우저가 따로 받는 프로그램">
        <p>
          아래 프로그램은 이 사이트에 포함하지 않고, 필요할 때 이용자의 브라우저가 jsDelivr에서
          정해진 버전만 받아요.
        </p>
        <ul>
          <li>jsQR 1.4.0(Apache-2.0): 카메라가 QR 코드를 직접 못 읽는 브라우저에서 QR 코드 인식</li>
          <li>Tesseract.js 7.0.0, tesseract.js-core 7.0.0(Apache-2.0): 문서 스캔의 글자 인식</li>
          <li>Tesseract 언어 데이터(tessdata, Apache-2.0): 글자 인식에 쓰는 언어별 데이터</li>
        </ul>
      </LegalSection>

      <LegalSection id="media" title="7. 영상과 이미지">
        <p>
          소개 페이지의 대학교 도서관·공항 영상은 Google Gemini로 만든 AI 시연 영상이에요. 실제
          장소나 설치 사례가 아니고, 영상에 보이던 프린터 제조사 로고는 지웠어요. 아이콘은
          Lucide(ISC)를 써요.
        </p>
      </LegalSection>

      <details className={legalStyles.fullText}>
        <summary>원본 파일 위치</summary>
        <div>
          <p>
            <a href={`${REPOSITORY}/blob/main/LICENSE`} rel="noreferrer">
              LICENSE
            </a>{" "}
            ·{" "}
            <a href={`${REPOSITORY}/blob/main/NOTICE`} rel="noreferrer">
              NOTICE
            </a>{" "}
            ·{" "}
            <a href={`${REPOSITORY}/blob/main/apps/web/package.json`} rel="noreferrer">
              apps/web/package.json
            </a>
          </p>
        </div>
      </details>
    </LegalShell>
  );
}
