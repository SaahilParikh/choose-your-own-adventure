const STYLE_PREFIX = "Fantasy illustration, detailed, atmospheric,";
const QUALITY_SUFFIX = "high quality, vibrant colors, dramatic lighting";
const MAX_PROMPT_LENGTH = 512;

export function enhanceImagePrompt(rawPrompt: string): string {
  const full = `${STYLE_PREFIX} ${rawPrompt}. ${QUALITY_SUFFIX}`;
  return full.length > MAX_PROMPT_LENGTH
    ? full.slice(0, MAX_PROMPT_LENGTH)
    : full;
}
