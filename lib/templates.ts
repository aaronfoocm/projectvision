export const TEMPLATES: Record<string, string> = {
  // Champion — VIP treatment, no generic promos
  CHAMPION_THANK_YOU: "Hey {first_name} ⭐ You're one of Koppiku's most loyal regulars and we just wanted to say — thank you. Genuinely. See you soon. ☕",
  CHAMPION_EARLY_ACCESS: "Hi {first_name}! VIP first look — we've got something new at Koppiku and you're hearing about it before everyone else. Come try it. ☕✨",

  // Regular — habit reinforcement, milestone nudges
  REGULAR_MILESTONE: "🎉 {first_name}, you just hit visit #{total_visits} at Koppiku! That's a big deal. We've got a little something for you — ask our barista today.",
  REGULAR_STREAK: "Hey {first_name}! You're {visits_to_next_reward} visits away from your next Koppiku reward. Keep that streak going! ☕🔥",
  REGULAR_POINTS_NUDGE: "You're {points_to_reward} points away from a free {favourite_item}. Come by soon! ☕",

  // New / Trial — convert the curious into regulars
  NEW_TRIAL_48H: "Hey! Thanks for trying Koppiku ☕ We'd love to be your regular — come back this week and get 20% off your next visit. See you soon!",
  NEW_TRIAL_PROFILE: "Hi! One quick thing — fill in your birthday in your Koppiku profile and get a free drink on us 🎂 Takes 30 seconds.",

  // At-Risk — personal, time-sensitive, reference their points
  AT_RISK_WINBACK: "Hey {first_name}, it's been a while 👋 You still have {points_balance} points at Koppiku — don't let them go to waste. Come by soon, your usual is waiting.",
  AT_RISK_WEEKLY: "Still thinking about it, {first_name}? Your {points_balance} Koppiku points are here whenever you are. We'd love to see you back. ☕",

  // Lapsed Loyal — strong comeback, remind what they ordered, max 2 contacts
  LAPSED_LOYAL_COMEBACK_1: "Hi {first_name} 💔 It's been too long — you used to be one of our regulars. We miss you. Here's a special offer just for you: {offer}. P.S. We remember you love {favourite_item}. ☕",
  LAPSED_LOYAL_COMEBACK_2: "Hey {first_name}, one last message 🤍 We've got something special to bring you back to Koppiku. Your {favourite_item} is still waiting. Offer valid this week.",

  // Dormant — urgency via points expiry, one blast only
  DORMANT_POINTS_EXPIRY: "Hi {first_name}! Heads up — your {points_balance} Koppiku points are about to expire. That's real value going to waste. Pop in before they're gone. ⏳",

  // Ghost — single push only, no WhatsApp credits wasted
  GHOST_SINGLE_PUSH: "Hey! Still thinking about your Koppiku {favourite_item}? We haven't seen you in a while — come back and try it again. ☕",

  // Never Transacted — activation, not retention
  NEVER_TRANSACTED_ACTIVATION: "Hi {first_name} 🌱 You joined the Koppiku family but haven't ordered yet. Your first cup is waiting — get 50% off your first purchase. Just show this at the counter. ☕",
}

export function resolveTemplate(templateKey: string, vars: Record<string, string>): string {
  const template = TEMPLATES[templateKey] ?? ''
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}
