try {
  let body = $response.body || "";
  let headers = $response.headers || {};

  const contentType =
    headers["Content-Type"] ||
    headers["content-type"] ||
    "";

  if (!body || !/html/i.test(contentType + body.slice(0, 200))) {
    $done({});
  } else {
    for (const key of Object.keys(headers)) {
      if (/^content-security-policy$/i.test(key)) delete headers[key];
      if (/^content-length$/i.test(key)) delete headers[key];
    }

    const inject = `
<script>
(function () {
  function decodeSafe(s) {
    try {
      return decodeURIComponent(s);
    } catch (e) {
      return s;
    }
  }

  function getRealUrl(href) {
    try {
      const u = new URL(href, location.href);

      if (u.hostname === "missav.ai" && u.pathname === "/pop" && u.searchParams.has("url")) {
        return decodeSafe(u.searchParams.get("url"));
      }
    } catch (e) {}

    return null;
  }

  function patchLinks() {
    document.querySelectorAll("a[href]").forEach(function (a) {
      const real = getRealUrl(a.href);
      if (real) {
        a.href = real;
        a.target = "_self";
        a.rel = "noreferrer";
      }
    });
  }

  document.addEventListener("click", function (e) {
    const a = e.target.closest && e.target.closest("a[href]");
    if (!a) return;

    const real = getRealUrl(a.href);
    if (real) {
      e.preventDefault();
      e.stopImmediatePropagation();
      location.href = real;
    }
  }, true);

  patchLinks();

  new MutationObserver(patchLinks).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
</script>
`;

    if (/<\/body>/i.test(body)) {
      body = body.replace(/<\/body>/i, inject + "</body>");
      $done({ headers, body });
    } else {
      $done({});
    }
  }
} catch (e) {
  $done({});
}