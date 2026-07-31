const authCookieName = /-auth-token(?:\.\d+)?$/;

export function hasAuthCookie(cookies: Iterable<{ name: string }>): boolean {
  for (const { name } of cookies) {
    if (name.startsWith("sb-") && authCookieName.test(name)) return true;
  }

  return false;
}
