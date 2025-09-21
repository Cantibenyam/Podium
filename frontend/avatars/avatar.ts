import { createAvatar } from '@dicebear/core';
import { micah, avataaars } from '@dicebear/collection';

type StyleName = 'micah' | 'avataaars';
type AnyOptions = Record<string, unknown>;

const styles = { micah, avataaars } as const;

export function renderAvatarSVG(
  style: StyleName,
  seed: string,
  options: AnyOptions = {}
): string {
  const styleImpl = styles[style] as unknown as any;
  return createAvatar(styleImpl, { seed, ...options } as any).toString();
}