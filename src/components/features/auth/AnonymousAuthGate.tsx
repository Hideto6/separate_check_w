"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ActionButton from "@/components/ui/ActionButton";
import InlineNotice from "@/components/ui/InlineNotice";
import PageShell from "@/components/ui/PageShell";
import StatusPanel from "@/components/ui/StatusPanel";
import { useGroup } from "@/contexts/GroupContext";

interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  "error-callback": () => void;
  "expired-callback": () => void;
  theme: "auto";
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export default function AnonymousAuthGate({ children }: { children: ReactNode }) {
  const {
    authStatus,
    authError,
    authenticate,
    continueOffline,
    offlineFallbackAvailable,
    offlineMode,
  } = useGroup();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [showOfflineFallback, setShowOfflineFallback] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const renderWidget = useCallback(() => {
    if (
      !scriptReady ||
      !siteKey ||
      !containerRef.current ||
      !window.turnstile ||
      widgetIdRef.current
    ) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      theme: "auto",
      callback: (token) => {
        setWidgetError(null);
        void authenticate(token).then((result) => {
          if (!result.ok && widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
        });
      },
      "error-callback": () => {
        setWidgetError(
          "安全確認を読み込めませんでした。通信状態を確認して、もう一度お試しください。"
        );
      },
      "expired-callback": () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    });
  }, [authenticate, scriptReady, siteKey]);

  const retryWidget = () => {
    setWidgetError(null);
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      return;
    }
    if (scriptReady) {
      renderWidget();
      return;
    }
    window.location.reload();
  };

  useEffect(() => {
    if (authStatus === "needs_captcha") {
      renderWidget();
    }
  }, [authStatus, renderWidget]);

  useEffect(() => {
    if (
      authStatus === "ready" &&
      widgetIdRef.current &&
      window.turnstile
    ) {
      window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    }
  }, [authStatus]);

  useEffect(
    () => () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    },
    []
  );

  useEffect(() => {
    if (authStatus === "ready" || offlineMode || !offlineFallbackAvailable) {
      setShowOfflineFallback(false);
      return;
    }
    if (
      !navigator.onLine ||
      authStatus === "error" ||
      authStatus === "misconfigured" ||
      authError ||
      widgetError
    ) {
      setShowOfflineFallback(true);
      return;
    }
    const timeoutId = window.setTimeout(
      () => setShowOfflineFallback(true),
      5_000
    );
    return () => window.clearTimeout(timeoutId);
  }, [
    authError,
    authStatus,
    offlineFallbackAvailable,
    offlineMode,
    widgetError,
  ]);

  const offlineFallbackButton = showOfflineFallback ? (
    <ActionButton variant="secondary" onClick={continueOffline}>
      端末データで続ける
    </ActionButton>
  ) : undefined;

  if (authStatus === "ready" || offlineMode) {
    return children;
  }

  if (authStatus === "checking" || authStatus === "signing_in") {
    return (
      <PageShell centered width="md">
        <StatusPanel
          title="共有機能を準備中"
          message={
            authStatus === "signing_in"
              ? "安全にサインインしています..."
              : "認証状態を確認しています..."
          }
          loading
          actions={offlineFallbackButton}
        />
      </PageShell>
    );
  }

  if (authStatus === "misconfigured") {
    return (
      <PageShell centered width="md">
        <StatusPanel
          title="共有機能を利用できません"
          message="Supabaseの接続情報が未設定です。.env.localの設定を確認してください。"
          tone="error"
          actions={offlineFallbackButton}
        />
      </PageShell>
    );
  }

  if (authStatus === "error") {
    return (
      <PageShell centered width="md">
        <StatusPanel
          title="認証状態を確認できません"
          message={
            authError ??
            "一時的な通信エラーが発生しました。再読み込みしてください。"
          }
          tone="error"
          actions={
            <>
              <ActionButton onClick={() => window.location.reload()}>
                再読み込みする
              </ActionButton>
              {offlineFallbackButton}
            </>
          }
        />
      </PageShell>
    );
  }

  if (!siteKey) {
    return (
      <PageShell centered width="md">
        <StatusPanel
          title="安全確認を開始できません"
          message="Turnstileのサイトキーが未設定です。.env.localの設定を確認してください。"
          tone="error"
          actions={offlineFallbackButton}
        />
      </PageShell>
    );
  }

  return (
    <PageShell centered width="md">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onReady={() => setScriptReady(true)}
        onError={() =>
          setWidgetError(
            "安全確認の読み込みに失敗しました。ページを再読み込みしてください。"
          )
        }
      />
      <StatusPanel
        title="ワリタビへようこそ"
        message="共同編集を安全に利用するため、下の確認を完了してください。"
        actions={
          <>
            <div className="flex min-h-[4.5rem] w-full items-center justify-center overflow-visible">
              <div ref={containerRef} aria-label="ボット確認" />
            </div>
            {authError && (
              <InlineNotice tone="error">{authError}</InlineNotice>
            )}
            {widgetError && (
              <>
                <InlineNotice tone="error">{widgetError}</InlineNotice>
                <ActionButton variant="secondary" onClick={retryWidget}>
                  安全確認を再試行
                </ActionButton>
              </>
            )}
            {offlineFallbackButton}
          </>
        }
      />
    </PageShell>
  );
}
