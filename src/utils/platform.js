export function isMac() {
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
}

export function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
