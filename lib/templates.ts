export const TEMPLATES: Record<string, string> = {
  GHOST_DAY14: "Hey! Thanks for dropping by Koppiku recently. We'd love to see you again — here's 20% off your next visit. Valid for 7 days. ☕",
  GHOST_DAY30_FINAL: "Still thinking about that coffee? Here's one last offer — 20% off, valid this week only. Hope to see you at Koppiku soon. 🤍",
  FLICKERER_WINBACK: "Hey, miss your {favourite_item}? It misses you too 😢 Come back — this one's on us. Free drink voucher, valid 10 days. ☕",
  FLICKERER_POINTS_NUDGE: "Psst — you have {points_balance} points at Koppiku. That's almost a free {favourite_item}. Don't let them go to waste! 🏃",
  FLICKERER_STREAK_ENROL: "Welcome back! 🎉 Visit 3 more times this month and earn double points. Your streak starts now. ☕🔥",
  REGULAR_MONTHLY_SUMMARY: "Hey! This month you earned {monthly_points} points at Koppiku {favourite_outlet}. You're one of our top regulars there. Respect. ⭐",
  REGULAR_MILESTONE: "🎉 You just hit visit #{total_visits} at Koppiku! That's a big deal. We've got a little something for you — ask our barista today.",
  REGULAR_POINTS_NUDGE: "You're {points_to_reward} points away from a free {favourite_item}. Come by soon! ☕",
  EXPLORER_NEW_OUTLET: "New outlet unlocked! 🗺️ You've now visited {outlet_count} Koppiku outlets. Explorer bonus: 2× points on your next visit. Keep exploring!",
  EXPLORER_MONTHLY_NEWS: "Hey Explorer! Here's what's new at Koppiku this month: {monthly_news}. You heard it first. ☕✨",
  EXPLORER_REFERRAL: "You clearly love Koppiku 😍 Bring a friend — both of you get bonus points when they make their first purchase. Share your code: {referral_code}",
  HOARDER_POINTS_STATEMENT: "Your Koppiku points update: you have {points_balance} points. That's enough for {redeemable_drinks} free drink(s). Next time you're in, just ask! ☕",
  HOARDER_EXPIRY_NUDGE: "Heads up! Your {expiring_points} points expire soon if you don't visit. Come by Koppiku before they disappear. ⏳",
  HOARDER_FIRST_REDEMPTION: "First redemption done! 🎊 You just used your points like a pro. Here's a bonus 50 points as a welcome to the club. ☕",
  GROUP_POST_ORDER: "Thanks for the big order! 🙌 Next time you order 5+ drinks, get 10% off. Your team deserves good coffee. ☕",
  GROUP_PREORDER_NUDGE: "Skip the queue for your next group order — pre-order on the Koppiku app and have it ready when you arrive. 📱",
  GROUP_MONTHLY_OCCASION: "Planning a team catch-up this month? Koppiku's got your office coffee sorted. Ask about group orders at your nearest outlet. ☕🏢",
  DORMANT_FIRST_NUDGE: "Hi {first_name}! You joined the Koppiku family but haven't ordered yet 😊 Your first cup is waiting — visit any outlet and show this message for 15% off. ☕",
  DORMANT_FINAL_NUDGE: "Hey {first_name}, we saved a cup for you! This is your reminder that Koppiku is just around the corner. First order gets 15% off — come say hi! ☕",
  DORMANT_CONVERTED: '',
}

export function resolveTemplate(templateKey: string, vars: Record<string, string>): string {
  const template = TEMPLATES[templateKey] ?? ''
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}
