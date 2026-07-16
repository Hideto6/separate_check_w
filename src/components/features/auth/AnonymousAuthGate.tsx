"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 p-6 text-center text-blue-800 font-bold">
    {message}
  </div>
);

export default function AnonymousAuthGate({ children }: { children: ReactNode }) {
  const { authStatus, authError, authenticate } = useGroup();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
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
        void authenticate(token).then((result) => {
          if (!result.ok && widgetIdRef.current && window.turnstile) {
            window.turnstile.reset(widgetIdRef.current);
          }
        });
      },
      "error-callback": () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
      "expired-callback": () => {
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    });
  }, [authenticate, scriptReady, siteKey]);

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

  if (authStatus === "ready") {
    return children;
  }
  if (authStatus === "checking" || authStatus === "signing_in") {
    return <LoadingScreen message="共有機能を準備しています..." />;
  }
  if (authStatus === "misconfigured") {
    return (
      <LoadingScreen message="共有機能の接続情報が未設定です。.env.localを確認してください。" />
    );
  }
  if (!siteKey) {
    return <LoadingScreen message="Turnstileのサイトキーが未設定です。" />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-100 to-blue-400 p-6 text-center">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <h1 className="text-2xl font-extrabold text-blue-800 mb-3">
        ワリタビへようこそ
      </h1>
      <p className="text-sm text-blue-700 mb-5">
        共同編集を安全に利用するため、確認をお願いします。
      </p>
      <div ref={containerRef} aria-label="ボット確認" />
      {authError && (
        <p role="alert" className="mt-4 text-sm font-bold text-red-600">
          {authError}
        </p>
      )}
    </div>
  );
}
