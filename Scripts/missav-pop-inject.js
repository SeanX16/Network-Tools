let body = $response.body || "";
let headers = $response.headers || {};

for (const key of Object.keys(headers)) {
  if (/^content-security-policy$/i.test(key)) {
    delete headers[key];
  }
}

const inject = `
<script>
(function () {
  try {
    const u = new URL(location.href);
    const target = u.searchParams.get("url");
    if (target) {
      location.replace(decodeURIComponent(target));
    }
  } catch (e) {}
})();
</script>
`;

if (/<\/head>/i.test(body)) {
  body = body.replace(/<\/head>/i, inject + "</head>");
} else if (/<\/body>/i.test(body)) {
  body = body.replace(/<\/body>/i, inject + "</body>");
} else {
  body = inject + body;
}

$done({ headers, body });