/** The driving-rules topics the catalogue and the prompts name. */
export const TOPICS = ["lez", "speed", "winter", "alcohol", "toll", "truck_ban", "equipment", "emergency", "ev"] as const;
export type Topic = (typeof TOPICS)[number];

export const LANGUAGES = ["de", "en"] as const;
