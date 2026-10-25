import { ArrowLeft, Building2, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Wordmark } from "@print-cess/ui";

import { requestLocale } from "@/lib/request-locale";

import { VisitorPrintFlow, type VisitorCopy } from "./visitor-flow";

const copy: Record<
  "ko" | "en",
  {
    eyebrow: string;
    title: string;
    intro: string;
    back: string;
    securityTitle: string;
    securityBody: string;
  } & VisitorCopy
> = {
  ko: {
    eyebrow: "관공서 민원 창구 · 방문자 인쇄",
    title: "방문자 인쇄 모드",
    intro:
      "민원인은 창구 화면의 QR 코드를 휴대전화로 스캔해 서류를 올립니다. 직원이 출력하면 서버의 파일은 자동으로 파기됩니다. 로그인, 앱 설치, 회원가입은 필요 없습니다.",
    back: "처음으로",
    securityTitle: "민원 서류는 출력 후 자동 파기됩니다",
    securityBody:
      "올린 서류는 종단간 암호화된 상태로만 서버에 보관되고, 출력이 끝나거나 세션이 만료되면 즉시 삭제됩니다. 방문자가 자리를 떠나기 전에 시작한 인쇄도 세션이 만료되면 자동으로 무효가 됩니다.",
    expiresIn: "세션 만료까지",
    expired: "세션이 만료되었습니다",
    newSession: "새 방문자 세션 만들기",
    preparing: "방문자 세션을 준비하는 중…",
    preparingFailed: "세션을 준비하지 못했습니다. 다시 시도해 주세요.",
    completed: "출력이 완료되었습니다",
    completedDetail: "서류가 출력되었고 서버의 파일은 자동으로 파기되었습니다.",
    failed: "인쇄하지 못했습니다",
    failedDetail: "서류가 출력되지 않았습니다. 새 세션을 만들어 다시 시도해 주세요.",
    expiredTitle: "세션이 만료되었습니다",
    expiredDetail: "업로드된 파일이 자동으로 파기되었습니다. 새 세션을 만들어 주세요.",
    cancelled: "인쇄가 취소되었습니다",
    cancelledDetail: "업로드된 파일은 파기되었습니다.",
    statusLive: "인쇄 진행 상태",
    qrAlt: "서류를 올리는 방문자 인쇄 QR 코드",
    stepScan: "QR 코드 스캔",
    stepScanDetail: "휴대전화 카메라로 QR 코드를 스캔하세요",
    stepUpload: "서류 업로드",
    stepUploadDetail: "휴대전화에서 출력할 서류를 선택해 업로드하세요",
    stepPrint: "창구 출력",
    stepPrintDetail: "직원이 확인한 뒤 창구에서 출력합니다",
    stepDestroy: "자동 파기",
    stepDestroyDetail: "출력 완료 후 서버의 파일이 즉시 삭제됩니다",
  },
  en: {
    eyebrow: "Government and public service counters · visitor printing",
    title: "Visitor print mode",
    intro:
      "Visitors scan the QR code on the counter screen with their phone and upload their documents. Once staff print them, the files are destroyed on the server automatically. No login, app or sign-up needed.",
    back: "Back to start",
    securityTitle: "Visitor documents are destroyed after printing",
    securityBody:
      "Uploaded documents are stored on the server only in end-to-end encrypted form, and are deleted as soon as printing finishes or the session expires. A print started before a visitor leaves is automatically voided when the session expires.",
    expiresIn: "Session expires in",
    expired: "The session has expired",
    newSession: "Start a new visitor session",
    preparing: "Preparing a visitor session…",
    preparingFailed: "The session could not be prepared. Please try again.",
    completed: "Printing is complete",
    completedDetail: "The documents were printed and the server copy was destroyed automatically.",
    failed: "Printing failed",
    failedDetail: "The documents were not printed. Start a new session and try again.",
    expiredTitle: "The session has expired",
    expiredDetail: "The uploaded file was destroyed automatically. Please start a new session.",
    cancelled: "Printing was cancelled",
    cancelledDetail: "The uploaded file was destroyed.",
    statusLive: "Print progress",
    qrAlt: "Visitor print QR code for document upload",
    stepScan: "Scan the QR code",
    stepScanDetail: "Scan the QR code with your phone camera",
    stepUpload: "Upload documents",
    stepUploadDetail: "On your phone, choose the documents to print and upload them",
    stepPrint: "Print at the counter",
    stepPrintDetail: "Staff confirm and print at the counter",
    stepDestroy: "Destroyed automatically",
    stepDestroyDetail: "The server copy is deleted as soon as printing finishes",
  },
} as const;

export default async function VisitorPage() {
  const locale = await requestLocale();
  const text = locale === "ko" ? copy.ko : copy.en;

  return (
    <main className="visitor-page">
      <header className="visitor-header">
        <Wordmark />
        <Link className="visitor-back" href="/">
          <ArrowLeft aria-hidden="true" /> {text.back}
        </Link>
      </header>

      <section className="visitor-hero">
        <div className="visitor-eyebrow">
          <Building2 aria-hidden="true" /> {text.eyebrow}
        </div>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
      </section>

      <VisitorPrintFlow copy={text} />

      <section className="visitor-security">
        <div className="visitor-security__heading">
          <ShieldCheck aria-hidden="true" />
          <h2>{text.securityTitle}</h2>
        </div>
        <p>{text.securityBody}</p>
      </section>
    </main>
  );
}
