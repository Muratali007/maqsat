/** ИИ-функции включаются строкой NEXT_PUBLIC_AI_ENABLED=1 (и ANTHROPIC_API_KEY). Пока выключено — показываем «Скоро». */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI_ENABLED === "1";
