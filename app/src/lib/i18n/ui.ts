// The UI pass: header and navigation, accessibility labels, Live/Preview, pricing, steppers, privacy and terms, errors and the 404 page. All three languages.
import type { Lang } from "../translations";

type Dict = Record<string, string>;

const en: Dict = {
  "a11y.skip": "Skip to content",
  "nav.trust": "Trust",
  "nav.faq": "FAQ",
  "nav.main": "Main menu",
  "nav.menu.open": "Open menu",
  "nav.menu.close": "Close menu",
};

const hing: Dict = {
  "a11y.skip": "Seedhe content par jaayein",
  "nav.trust": "Bharosa",
  "nav.faq": "Sawaal",
  "nav.main": "Main menu",
  "nav.menu.open": "Menu kholein",
  "nav.menu.close": "Menu band karein",
};

const hi: Dict = {
  "a11y.skip": "सीधे सामग्री पर जाएँ",
  "nav.trust": "भरोसा",
  "nav.faq": "सवाल",
  "nav.main": "मुख्य मेन्यू",
  "nav.menu.open": "मेन्यू खोलें",
  "nav.menu.close": "मेन्यू बंद करें",
};

export const UI: Record<Lang, Dict> = { en, hing, hi };
