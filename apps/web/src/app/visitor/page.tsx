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
      "민원인은 창구 화면의 QR 코드를 휴대전화로 찍어 서류를 올려요. 직원이 출력하면 서버에 있던 파일은 자동으로 지워져요. 로그인, 앱 설치, 회원가입은 필요 없어요.",
    back: "처음으로",
    securityTitle: "민원 서류는 출력하면 바로 지워져요",
    securityBody:
      "올린 서류는 종단간 암호화된 상태로만 서버에 보관돼요. 출력이 끝나거나 세션이 만료되면 바로 지워져요. 방문자가 자리를 떠나기 전에 시작한 인쇄도 세션이 만료되면 자동으로 취소돼요.",
    expiresIn: "세션 만료까지",
    expired: "세션이 만료됐어요",
    newSession: "새 방문자 세션 만들기",
    preparing: "방문자 세션을 준비하는 중…",
    preparingFailed: "세션을 준비하지 못했어요. 다시 시도해 주세요.",
    completed: "출력이 끝났어요",
    completedDetail: "서류를 출력했고, 서버에 있던 파일은 자동으로 지웠어요.",
    failed: "인쇄하지 못했어요",
    failedDetail: "서류가 출력되지 않았어요. 새 세션을 만들어 다시 시도해 주세요.",
    expiredTitle: "세션이 만료됐어요",
    expiredDetail: "올라온 파일은 자동으로 지웠어요. 새 세션을 만들어 주세요.",
    cancelled: "인쇄를 취소했어요",
    cancelledDetail: "올라온 파일은 지웠어요.",
    statusLive: "인쇄 진행 상태",
    qrAlt: "서류를 올리는 방문자 인쇄 QR 코드",
    stepScan: "QR 코드 찍기",
    stepScanDetail: "휴대전화 카메라로 QR 코드를 찍으세요",
    stepUpload: "서류 올리기",
    stepUploadDetail: "휴대전화에서 출력할 서류를 골라 올리세요",
    stepPrint: "창구 출력",
    stepPrintDetail: "직원이 확인한 뒤 창구에서 출력해요",
    stepDestroy: "자동 삭제",
    stepDestroyDetail: "출력이 끝나면 서버에 있던 파일이 바로 지워져요",
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
