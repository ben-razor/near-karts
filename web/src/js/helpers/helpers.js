export function isLocal() {
  return window.location.href.includes('localhost');
}

export async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 8000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
      ...options,
      signal: controller.signal  
  });
  clearTimeout(id);
  return response;
}

export function cloneObj(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function clip(text, toaster) {
  navigator.clipboard.writeText(text).then(function() {
      toaster('Copied to clipboard', 'success');
  }, function(err) {
      toaster('Copy to clipbard failed, bummer!', 'error');
      console.log(err);
  });
}

export function createSuccessInfo() {
  return { success: true, reason: 'ok', code: 0, message: ''};
}

export function createErrorInfo(reason='error', code=0, message='') {
  return { success: false, reason, code, message };
}

export function result(success, reason, code, message, data) {
  return { success, reason, code, message, data};
}
