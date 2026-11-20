import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export type BannerMode = 'animate' | 'static' | 'text';

export type BannerDecision = {
  mode: BannerMode;
  /** Whether anything may move at all, spinners included. */
  motion: boolean;
  reason: string | null;
};

export type BannerStream = {
  isTTY?: boolean;
  rows?: number;
  columns?: number;
};

export const GLOBE_COLUMNS = 50;
// The animation redraws a 26-line block (globe and status line) by moving the
// cursor up over it, so the block and the cursor's line must fit on screen.
// The header and command output print after the globe lands and need no room.
export const MIN_ANIMATED_ROWS = 30;
const OS_CHECK_TIMEOUT_MS = 300;

const isSet = (value: string | undefined): value is string =>
  value !== undefined && value !== '';
const isOn = (value: string | undefined) =>
  isSet(value) && !/^(0|false|no|off)$/i.test(value);

/** The user-level settings file: $XDG_CONFIG_HOME/gt/config.json. */
export function getUserConfigPath(env: NodeJS.ProcessEnv = process.env) {
  // XDG Base Directory spec: relative XDG_* values are invalid and ignored.
  const configHome = env.XDG_CONFIG_HOME;
  return path.join(
    configHome && path.isAbsolute(configHome)
      ? configHome
      : path.join(homedir(), '.config'),
    'gt',
    'config.json'
  );
}

function userConfigTurnsAnimationOff(env: NodeJS.ProcessEnv): boolean {
  try {
    const config: unknown = JSON.parse(
      readFileSync(getUserConfigPath(env), 'utf8')
    );
    return (
      typeof config === 'object' &&
      config !== null &&
      'animation' in config &&
      config.animation === false
    );
  } catch {
    // A missing or unreadable settings file leaves the default on.
    return false;
  }
}

/** Reads the OS "Reduce motion" setting where that is cheap (macOS, GNOME). */
export function systemReducesMotion(
  platform: NodeJS.Platform = process.platform
): boolean {
  const read = (command: string, args: string[]) => {
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      timeout: OS_CHECK_TIMEOUT_MS,
    });
    return result.status === 0 ? result.stdout.trim() : undefined;
  };
  if (platform === 'darwin') {
    // The key is absent until the setting has been turned on once.
    return (
      read('defaults', [
        'read',
        'com.apple.universalaccess',
        'reduceMotion',
      ]) === '1'
    );
  }
  if (platform === 'linux') {
    return (
      read('gsettings', [
        'get',
        'org.gnome.desktop.interface',
        'enable-animations',
      ]) === 'false'
    );
  }
  return false;
}

export type DecideBannerOptions = {
  stream: BannerStream;
  /** False when the command ran with --no-animation. */
  animationFlag?: boolean;
  env?: NodeJS.ProcessEnv;
  reducesMotion?: () => boolean;
};

/**
 * Decides once, before the first frame, how the banner shows: animated, as
 * the static globe (the animation's landing frame), or as the text header
 * alone. Like other animated CLIs it never animates where it can't (no TTY,
 * TERM=dumb, CI) and lets users opt out per run, per shell or for good.
 */
export function decideBanner({
  stream,
  animationFlag = true,
  env = process.env,
  reducesMotion = systemReducesMotion,
}: DecideBannerOptions): BannerDecision {
  const interactive = stream.isTTY === true;
  const motionOff = ((): string | null => {
    if (!interactive) return 'output is not a terminal';
    if (env.TERM === 'dumb') return 'TERM is dumb';
    if (isSet(env.CI) && env.CI !== 'false' && env.CI !== '0') {
      return 'CI is set';
    }
    if (!animationFlag) return '--no-animation';
    if (isOn(env.GT_NO_ANIMATION)) return 'GT_NO_ANIMATION is set';
    if (/^(1|true)$/i.test(env.REDUCE_MOTION ?? '')) {
      return 'REDUCE_MOTION is set';
    }
    if (isSet(env.NO_COLOR)) return 'NO_COLOR is set';
    if (userConfigTurnsAnimationOff(env)) {
      return `"animation": false in ${getUserConfigPath(env)}`;
    }
    return null;
  })();

  if (interactive && (stream.columns ?? 0) < GLOBE_COLUMNS + 2) {
    return {
      mode: 'text',
      motion: !motionOff,
      reason: `window is narrower than ${GLOBE_COLUMNS + 2} columns`,
    };
  }
  if (motionOff) return { mode: 'static', motion: false, reason: motionOff };
  if ((stream.rows ?? 0) <= MIN_ANIMATED_ROWS) {
    return {
      mode: 'static',
      motion: true,
      reason: `window is ${MIN_ANIMATED_ROWS} rows or fewer`,
    };
  }
  // Checked last: it spawns a process, and only matters when we'd animate.
  if (reducesMotion()) {
    return {
      mode: 'static',
      motion: false,
      reason: 'the system Reduce Motion setting is on',
    };
  }
  return { mode: 'animate', motion: true, reason: null };
}
