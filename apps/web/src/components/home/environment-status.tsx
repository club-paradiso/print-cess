"use client";

import { useState } from "react";

import { WorkstationReadiness } from "@/app/workstation/workstation-readiness";

const messages = {
  ko: {
    summary: "이 기기에서 파일을 주고받을 수 있는지 확인하기",
    intro:
      "휴대전화와 업무용 PC는 같은 보내기·받기 기능을 써요. 이 점검은 필요한 기능을 지원하는지만 확인하고, 실제 전송이나 인쇄가 성공한다고 보장하지는 않아요.",
    checking: "기기 환경을 확인하고 있어요",
    ready: "기본 전송에 필요한 조건을 갖췄어요",
    limited: "일부 기능이 제한될 수 있어요",
    blocked: "전송에 필요한 기능 일부를 쓸 수 없어요",
    secureContext: "HTTPS 연결",
    webCrypto: "브라우저 암호화",
    fileApi: "파일 선택",
    downloadApi: "다운로드 지원",
    serviceReach: "전송 API 정상 응답",
    sameOriginRoute: "같은 주소로 바로 보내는 경로",
    pass: "확인",
    pending: "확인 중",
    fail: "제한",
    blockedHint: "최신 Edge·Chrome 등 지원 브라우저와 보안 연결을 확인하세요.",
    limitedHint: "일부 저장 방식이나 중계 경로를 쓸 수 없어요. 테스트용 파일로 직접 확인해 보세요.",
    unreachableHint: "서비스에 연결하지 못했어요. 네트워크 정책을 확인하세요.",
    serviceErrorHint:
      "서버가 오류나 요청 제한을 알려 왔어요. 그래서 전송할 수 있는 상태로 보지 않아요.",
    preferRelay: "허용된 Print-cess 주소로 먼저 보내기",
    relaySelected: "이 탭에서는 이 Print-cess 주소로 먼저 보내요",
    noGuarantee:
      "이 결과는 실제 업로드·다운로드나 프린터 테스트가 아니에요. 기관 보안 정책이 항상 먼저예요.",
  },
  en: {
    summary: "Check this device can send and receive files",
    intro:
      "Phones and work computers send and receive files the same way. This checks only whether this device has what a transfer needs. It can't promise that a transfer or print will succeed.",
    checking: "Checking this device",
    ready: "Basic requirements are met",
    limited: "Some features may be limited",
    blocked: "Some features needed for transfers are unavailable",
    secureContext: "HTTPS connection",
    webCrypto: "Browser encryption",
    fileApi: "File selection",
    downloadApi: "Download support",
    serviceReach: "Transfer API responds successfully",
    sameOriginRoute: "Direct route through this address",
    pass: "Available",
    pending: "Checking",
    fail: "Limited",
    blockedHint:
      "Use an up-to-date browser such as Edge or Chrome, on a secure (HTTPS) connection.",
    limitedHint:
      "Some save methods or relay paths may be unavailable. Try it with a test file to be sure.",
    unreachableHint: "The service cannot be reached. Check network restrictions.",
    serviceErrorHint:
      "The server reported an error or a request limit, so this device doesn't count as ready to send.",
    preferRelay: "Try the approved Print-cess address first",
    relaySelected: "This tab sends through this Print-cess address first",
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
