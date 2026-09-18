'use strict';

const $ = (id) => document.getElementById(id);
const state = { type: 'url', foreground: '#000000', background: '#FFFFFF', size: 256 };
const tabs = [...document.querySelectorAll('[role="tab"]')];
const canvas = $('qr-canvas');
const primaryFields = { url: 'url', text: 'text', wifi: 'ssid', email: 'email' };
let updateTimer;

// The QR library uses single-byte text by default. Preserve Unicode with UTF-8.
if (typeof qrcode === 'function') {
  qrcode.stringToBytes = (text) => Array.from(new TextEncoder().encode(text));
}

function getFormData() {
  return {
    url: $('url').value.trim(), text: $('text').value,
    ssid: $('ssid').value, password: $('password').value, security: $('security').value,
    email: $('email').value.trim(), subject: $('subject').value, message: $('message').value,
  };
}

function normalizeURL(value) {
  // Accept bare domains, but never turn a non-web URI into an HTTPS link.
  if (/^[a-z][a-z\d+.-]*:/i.test(value) && !/^https?:\/\//i.test(value)) {
    if (!/^[^/:]+:\d+(?:[/?#]|$)/.test(value)) throw new Error('Invalid URL');
  }
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  if (!['http:', 'https:'].includes(url.protocol) || /\s/.test(value) || !url.hostname || url.username || url.password) {
    throw new Error('Invalid URL');
  }
  if (url.hostname !== 'localhost' && !url.hostname.includes('.') && !url.hostname.startsWith('[')) {
    throw new Error('Invalid URL');
  }
  return url.href;
}

function validateData(data) {
  switch (state.type) {
    case 'url':
      if (!data.url) return { empty: true };
      try { normalizeURL(data.url); } catch { return { field: 'url', error: 'Enter a valid URL.' }; }
      break;
    case 'text':
      if (!data.text.trim()) return { empty: true };
      break;
    case 'wifi':
      if (!data.ssid) return { field: 'ssid', error: 'Enter a network name.' };
      if (new TextEncoder().encode(data.ssid).length > 32) return { field: 'ssid', error: 'Network names must be 32 bytes or fewer.' };
      if (data.security !== 'nopass' && !data.password) return { field: 'password', error: 'Enter the network password.' };
      break;
    case 'email':
      if (!data.email && !data.subject && !data.message) return { empty: true };
      if (!/^[^\s@,;?&#]+@[^\s@,;?&#]+\.[^\s@,;?&#]+$/.test(data.email) || !$('email').validity.valid) {
        return { field: 'email', error: 'Enter a valid email address.' };
      }
      break;
  }
  return {};
}

function escapeWiFi(value) {
  return value.replace(/[\\;,:\"]/g, '\\$&');
}

function buildQRContent(data) {
  switch (state.type) {
    case 'url': return normalizeURL(data.url);
    case 'text': return data.text;
    case 'wifi':
      return `WIFI:T:${data.security};S:${escapeWiFi(data.ssid)};${data.security === 'nopass' ? '' : `P:${escapeWiFi(data.password)};`};`;
    case 'email': {
      const query = [];
      if (data.subject) query.push(`subject=${encodeURIComponent(data.subject)}`);
      if (data.message) query.push(`body=${encodeURIComponent(data.message.replace(/\r?\n/g, '\r\n'))}`);
      const [local, domain] = data.email.split('@');
      return `mailto:${encodeURIComponent(local)}@${domain}${query.length ? `?${query.join('&')}` : ''}`;
    }
  }
}

function showFieldError(field, message) {
  $(field).setAttribute('aria-invalid', 'true');
  $(`${field}-error`).textContent = message;
}

function readSettings() {
  let valid = true;
  for (const name of ['foreground', 'background']) {
    const input = $(`${name}-hex`);
    const value = input.value.trim();
    const ok = /^#[\da-f]{6}$/i.test(value);
    input.setAttribute('aria-invalid', String(!ok));
    $(`${name}-error`).textContent = ok ? '' : 'Use a hex color, e.g. #000000.';
    if (ok) {
      state[name] = value.toUpperCase();
      $(name).value = value;
    } else valid = false;
  }
  state.size = Number($('size').value);
  $('dimensions').textContent = `${state.size} × ${state.size} px`;
  return valid;
}

function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function generateQRCode(content) {
  const qr = qrcode(0, 'M');
  qr.addData(content, 'Byte');
  qr.make();
  const count = qr.getModuleCount();
  // Integer pixels keep every module crisp; reserve at least four quiet modules.
  const scale = Math.floor(state.size / (count + 8));
  if (scale < 1) throw new Error('Choose a larger image size for this content.');
  const offset = Math.floor((state.size - count * scale) / 2);
  canvas.width = canvas.height = state.size;
  const context = canvas.getContext('2d');
  context.fillStyle = state.background;
  context.fillRect(0, 0, state.size, state.size);
  context.fillStyle = state.foreground;
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) context.fillRect(offset + col * scale, offset + row * scale, scale, scale);
    }
  }
}

function clearPreview() {
  canvas.hidden = true;
  $('empty-state').hidden = false;
  $('download').disabled = true;
  $('content-preview').textContent = 'Add your content to get started.';
  $('content-preview').removeAttribute('title');
}

function updatePreview() {
  clearTimeout(updateTimer);
  clearPreview();
  $('preview-status').textContent = '';
  $('contrast-warning').textContent = '';
  document.querySelectorAll('.fields .error').forEach((error) => { error.textContent = ''; });
  document.querySelectorAll('.fields [aria-invalid]').forEach((input) => input.removeAttribute('aria-invalid'));
  const settingsValid = readSettings();
  const data = getFormData();
  const validation = validateData(data);
  if (validation.error) showFieldError(validation.field, validation.error);
  if (typeof qrcode !== 'function') {
    $('preview-status').textContent = 'The QR library could not load. Check your connection and reload.';
    return;
  }
  if (!settingsValid || validation.error || validation.empty) return;
  const foregroundLight = luminance(state.foreground);
  const backgroundLight = luminance(state.background);
  if (foregroundLight >= backgroundLight || (backgroundLight + 0.05) / (foregroundLight + 0.05) < 4.5) {
    $('contrast-warning').textContent = 'For reliable scanning, use a dark QR color on a light background with more contrast.';
  }
  try {
    const content = buildQRContent(data);
    if (new TextEncoder().encode(content).length > 2331) {
      showFieldError(primaryFields[state.type], 'Too much content. Shorten it to fit a QR code.');
      return;
    }
    generateQRCode(content);
    canvas.hidden = false;
    $('empty-state').hidden = true;
    $('download').disabled = false;
    // Never reveal the network password in the visible caption or a tooltip.
    $('content-preview').textContent = state.type === 'wifi' ? `Wi-Fi: ${data.ssid}` : content;
    $('content-preview').title = $('content-preview').textContent;
  } catch (error) {
    $('preview-status').textContent = error instanceof Error && error.message.startsWith('Choose')
      ? error.message : 'This content could not fit in a QR code. Try shortening it.';
  }
}

function renderFormByType(type) {
  state.type = type;
  tabs.forEach((tab) => {
    const active = tab.dataset.type === type;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    $(`panel-${tab.dataset.type}`).hidden = !active;
  });
  updatePreview();
}

function resetSettings() {
  $('foreground-hex').value = '#000000';
  $('background-hex').value = '#FFFFFF';
  $('size').value = '256';
  updatePreview();
}

function downloadQRCode() {
  updatePreview();
  if ($('download').disabled) return;
  const link = document.createElement('a');
  link.download = `qr-${state.type}-${state.size}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.append(link);
  link.click();
  link.remove();
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => renderFormByType(tab.dataset.type));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    tabs[next].focus();
    renderFormByType(tabs[next].dataset.type);
  });
});

$('qr-form').addEventListener('submit', (event) => event.preventDefault());
$('qr-form').addEventListener('input', (event) => {
  if (event.target.type === 'color') $(`${event.target.id}-hex`).value = event.target.value.toUpperCase();
  $('password-field').hidden = $('security').value === 'nopass';
  $('password').disabled = $('security').value === 'nopass';
  // Invalidate immediately so a pending edit can never download an older QR.
  clearPreview();
  clearTimeout(updateTimer);
  updateTimer = setTimeout(updatePreview, 180);
});
$('qr-form').addEventListener('change', updatePreview);
$('reset').addEventListener('click', resetSettings);
$('download').addEventListener('click', downloadQRCode);
updatePreview();
