"use client";

import { useEffect } from "react";

/** Charge le SDK Facebook APRÈS l'hydratation.
 *
 * Le SDK ajoutait sa balise `<script id="facebook-jssdk">` dans le `<head>`
 * servi, et le navigateur la réécrivait avant que React n'hydrate → à chaque
 * page : « A tree hydrated but some attributes of the server rendered HTML
 * didn't match… ». Sorti du HTML servi, le mismatch disparaît ; le SDK, async
 * par nature, continue de fonctionner (initialisation par `fbAsyncInit`).
 */
export function FacebookSdk({ appId }: { appId: string }) {
  useEffect(() => {
    type FbGlobal = typeof window & {
      fbAsyncInit?: () => void;
      FB?: {
        init: (options: Record<string, unknown>) => void;
        AppEvents?: { logPageView: () => void };
      };
    };
    const w = window as FbGlobal;

    // `fbAsyncInit` doit exister AVANT le chargement du script : le SDK l'appelle.
    w.fbAsyncInit = function () {
      w.FB?.init({ appId, cookie: true, xfbml: true, version: "v21.0" });
      w.FB?.AppEvents?.logPageView();
    };

    if (document.getElementById("facebook-jssdk")) return;
    const js = document.createElement("script");
    js.id = "facebook-jssdk";
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    js.async = true;
    document.head.appendChild(js);
  }, [appId]);

  return null;
}
