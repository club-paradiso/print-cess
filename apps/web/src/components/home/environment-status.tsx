"use client";

import { useState } from "react";

import { WorkstationReadiness } from "@/app/workstation/workstation-readiness";

const messages = {
  ko: {
    summary: "이 기기에서 잘 작동하는지 확인하기",
    intro:
      "휴대전화와 업무용 PC는 같은 보내기·받기 기능을 씁니다. 이 진단은 기능을 지원하는지만 확인하며, 실제 파일 전송이나 인쇄가 성공한다고 보증하지 않습니다.",
    checking: "기기 환경을 확인하고 있습니다",
    ready: "기본 전송에 필요한 조건을 갖췄습니다",
    limited: "일부 기능이 제한될 수 있습니다",
    blocked: "전송에 필요한 일부 기능을 사용할 수 없습니다",
    secureContext: "HTTPS 연결",
    webCrypto: "브라우저 암호화",
    fileApi: "파일 선택",
    downloadApi: "다운로드 지원",
    serviceReach: "전송 API 정상 응답",
    sameOriginRoute: "동일 도메인 파일 중계 경로",
    pass: "확인",
    pending: "확인 중",
    fail: "제한",
    blockedHint: "최신 Edge·Chrome 등 지원 브라우저와 보안 연결을 확인하세요.",
    limitedHint: "일부 저장 방식이나 중계 경로를 쓸 수 없습니다. 테스트용 파일로 직접 확인하세요.",
    unreachableHint: "서비스에 연결하지 못했습니다. 네트워크 정책을 확인하세요.",
    serviceErrorHint:
      "서버가 오류나 요청 제한을 반환했습니다. 전송할 수 있는 상태로 판정하지 않습니다.",
    preferRelay: "허용된 Print-cess 주소로 먼저 전송 시도",
    relaySelected: "이 탭에서 동일 도메인 경로 우선 사용",
    noGuarantee:
      "이 결과는 실제 업로드·다운로드 또는 프린터 테스트가 아닙니다. 기관 보안정책이 우선합니다.",
  },
  en: {
    summary: "Check whether this device works",
    intro:
      "Phones and work computers use the same transfer flow. This checks browser capabilities and the API, not whether an actual file transfer or print will succeed.",
    checking: "Checking this device",
    ready: "Basic requirements are met",
    limited: "Some features may be limited",
    blocked: "Some features needed for transfers are unavailable",
    secureContext: "HTTPS connection",
    webCrypto: "Browser encryption",
    fileApi: "File selection",
    downloadApi: "Download support",
    serviceReach: "Transfer API responds successfully",
    sameOriginRoute: "Same-origin file relay available",
    pass: "Available",
    pending: "Checking",
    fail: "Limited",
    blockedHint: "Check that your browser supports modern web standards and HTTPS.",
    limitedHint: "Some save methods or relay paths may be unavailable. Test with a synthetic file.",
    unreachableHint: "The service cannot be reached. Check network restrictions.",
    serviceErrorHint: "The server returned an error or rate limit. Transfers are not marked ready.",
    preferRelay: "Prefer transfer through the approved Print-cess origin",
    relaySelected: "Same-origin transfer preferred in this tab",
    noGuarantee:
      "This is not an upload, download, or printer test. Organizational policy always applies.",
  },
} as const;

export function EnvironmentStatus({ locale }: { locale: string }) {
  const [expanded, setExpanded] = useState(false);
  const copy = locale === "ko" ? messages.ko : messages.en;
  return (
    <section className="home-environment" id="environment">
      <details onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary>{copy.summary}</summary>
        <p>{copy.intro}</p>
        {expanded ? <WorkstationReadiness copy={copy} /> : null}
      </details>
    </section>
  );
}
