const url = $request.url;

try {
  const u = new URL(url);
  const target = u.searchParams.get("url");

  if (target) {
    $done({
      response: {
        status: 302,
        headers: {
          Location: decodeURIComponent(target)
        }
      }
    });
  } else {
    $done({});
  }
} catch (e) {
  $done({});
}