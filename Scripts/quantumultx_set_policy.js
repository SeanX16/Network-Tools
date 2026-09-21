// Quantumult X HTTP Backend: set a static policy from a JSON request body.
// Expected body: {"group":"地区","node":"Proxy节点"}

function finish(status, payload) {
  $done({
    status,
    headers: {
      "Cache-Control": "no-store",
      "Connection": "Close",
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
}

function fail(status, message, details) {
  finish(status, {
    success: false,
    error: message,
    details: details || null,
  });
}

function parseInput() {
  if (typeof $request !== "object" || !$request) {
    throw new Error("$request is unavailable");
  }

  const body = $request.body;
  const input = typeof body === "string" ? JSON.parse(body) : body;

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Request body must be a JSON object");
  }

  const group = input.group;
  const node = input.node;

  if (typeof group !== "string" || !group.trim()) {
    throw new Error("group must be a non-empty string");
  }
  if (typeof node !== "string" || !node.trim()) {
    throw new Error("node must be a non-empty string");
  }
  if (group.length > 256 || node.length > 256) {
    throw new Error("group and node must not exceed 256 characters");
  }

  return { group, node };
}

let input;

try {
  input = parseInput();
} catch (error) {
  fail("HTTP/1.1 400 Bad Request", String(error));
}

if (input) {
  if (typeof $configuration !== "object" || !$configuration) {
    fail("HTTP/1.1 500 Internal Server Error", "$configuration is unavailable");
  } else {
    $configuration
      .sendMessage({ action: "get_policy_state" })
      .then((result) => {
        if (!result || result.error) {
          throw new Error((result && result.error) || "Failed to read policy state");
        }

        const route = result.ret && result.ret[input.group];
        if (!Array.isArray(route)) {
          fail("HTTP/1.1 404 Not Found", "Policy group was not found", {
            group: input.group,
          });
          return null;
        }

        const current = route[1] || null;
        if (current === input.node) {
          finish("HTTP/1.1 200 OK", {
            success: true,
            changed: false,
            group: input.group,
            previous: current,
            current: input.node,
          });
          return null;
        }

        const content = {};
        content[input.group] = input.node;

        return $configuration
          .sendMessage({ action: "set_policy_state", content })
          .then((updated) => {
            if (!updated || updated.error) {
              throw new Error(
                (updated && updated.error) || "Failed to update policy state",
              );
            }

            finish("HTTP/1.1 200 OK", {
              success: true,
              changed: true,
              group: input.group,
              previous: current,
              current: input.node,
              state: updated.ret || null,
            });
          });
      })
      .catch((error) => {
        fail("HTTP/1.1 500 Internal Server Error", String(error));
      });
  }
}
