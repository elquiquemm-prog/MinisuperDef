(() => {
  "use strict";

  const createClient = (projectUrl, publicKey) => {
    let baseUrl;
    try {
      const parsed = new URL(String(projectUrl || "").trim());
      if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && parsed.hostname === "localhost")) throw new Error();
      if (parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error();
      baseUrl = parsed.origin;
    } catch {
      throw new Error("Captura la URL HTTPS de tu proyecto Supabase.");
    }
    const apiKey = String(publicKey || "").trim();
    if (!apiKey) throw new Error("Captura la clave pública (anon o publishable) de Supabase.");
    if (/^sb_secret_/i.test(apiKey)) throw new Error("No uses una clave secreta en el navegador; captura la clave anon o publishable.");
    const jwtPayload = apiKey.split(".")[1];
    if (jwtPayload) {
      try {
        const claims = JSON.parse(atob(jwtPayload.replace(/-/g, "+").replace(/_/g, "/")));
        if (claims.role === "service_role") throw new Error("No uses la clave service_role en el navegador; captura la clave anon o publishable.");
      } catch (error) {
        if (error.message.includes("service_role")) throw error;
      }
    }

    let session = null;
    const parseResponse = async response => {
      const text = await response.text();
      let data = null;
      if (text) {
        try { data = JSON.parse(text); }
        catch { throw new Error(`Supabase devolvió una respuesta no válida (HTTP ${response.status}).`); }
      }
      if (!response.ok) {
        const message = data && (data.msg || data.message || data.error_description || data.error || data.details || data.hint);
        throw new Error(message || `Supabase respondió con HTTP ${response.status}.`);
      }
      return data;
    };
    const send = async (path, options = {}, authenticated = false) => {
      const headers = {
        apikey: apiKey,
        "Content-Type": "application/json",
        ...options.headers
      };
      if (authenticated && session) headers.Authorization = "Bearer " + session.access_token;
      let response;
      try {
        response = await fetch(`${baseUrl}${path}`, { ...options, headers });
      } catch (error) {
        throw new Error(`No se pudo llegar a Supabase. Revisa la conexión y la URL del proyecto. ${error.message}`);
      }
      if (authenticated && response.status === 401 && session && session.refresh_token) {
        const refreshed = await refreshSession();
        headers.Authorization = "Bearer " + refreshed.access_token;
        try {
          response = await fetch(`${baseUrl}${path}`, { ...options, headers });
        } catch (error) {
          throw new Error(`No se pudo llegar a Supabase. Revisa la conexión y la URL del proyecto. ${error.message}`);
        }
      }
      return parseResponse(response);
    };
    const refreshSession = async () => {
      if (!session || !session.refresh_token) throw new Error("Tu sesión venció. Inicia sesión de nuevo.");
      const refreshed = await send("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      session = refreshed;
      return session;
    };

    return {
      setSession(value) { session = value || null; },
      getSession() { return session; },
      async signIn(email, password) {
        session = await send("/auth/v1/token?grant_type=password", {
          method: "POST",
          body: JSON.stringify({ email: String(email || "").trim(), password: String(password || "") })
        });
        return session;
      },
      async restoreSession(value) {
        session = value || null;
        if (!session || !session.access_token) throw new Error("Inicia sesión con tu cuenta de Supabase.");
        if (session.expires_at && session.expires_at <= Math.floor(Date.now() / 1000) + 60) await refreshSession();
        return session;
      },
      async signOut() {
        if (session && session.access_token) {
          await send("/auth/v1/logout", { method: "POST" }, true);
        }
        session = null;
      },
      async load() {
        const rows = await send(
          "/rest/v1/app_state?id=eq.miranda&select=state,revision",
          { method: "GET" },
          true
        );
        if (!Array.isArray(rows) || rows.length !== 1) {
          throw new Error("No se encontró la fila de datos. Ejecuta el SQL de supabase/schema.sql en el editor SQL de tu proyecto.");
        }
        return rows[0];
      },
      async save(state, revision) {
        const rows = await send(
          `/rest/v1/app_state?id=eq.miranda&revision=eq.${encodeURIComponent(revision)}&select=revision`,
          {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ state, revision: revision + 1, updated_at: new Date().toISOString() })
          },
          true
        );
        if (!Array.isArray(rows) || rows.length !== 1) {
          throw new Error("Los datos cambiaron en otro dispositivo. Vuelve a iniciar sesión para cargar la versión actual antes de continuar.");
        }
        return rows[0];
      }
    };
  };

  window.NativaSupabase = { createClient };
})();
